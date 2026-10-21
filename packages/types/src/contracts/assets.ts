import type { ModuleContract } from './module';

/**
 * The assets contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth
 * rebuild of the four admin screens:
 *
 * - the model: apps/api/src/models/asset.ts:21-98 (the status enum at :61-65)
 * - the routes: apps/api/src/routes/assets.ts:158-384
 * - the notification to the residents: apps/api/src/routes/assets.ts:84-157
 * - the page size the server clamps: apps/api/src/lib/routeUtils.ts:14-20
 * - the write trail: apps/api/src/routes/audit.ts:13-52
 * - the admin screens: apps/web/src/app/(admin)/assets
 *
 * THE ASSET MODEL HAS NO OWNER. There is no owner, no creator and no assignee field on
 * the record (apps/api/src/models/asset.ts:21-98), so there is nobody on the office side
 * to notify. The ones affected by an asset are the residents of the room it sits in, or of
 * the floor it hangs on, and the server resolves them from the asset record itself.
 *
 * WHO IS TOLD, AND WHO IS NOT. One action of this module reaches a person: an edit that
 * moves the state into under_maintenance or damaged pushes a service_update to the active
 * residents of the room, or of the floor (apps/api/src/routes/assets.ts:84-157, :338-351).
 * Every other action reaches nobody:
 *
 *   - registering an asset, whatever state it is registered in (the create path writes no
 *     notification at all);
 *   - moving the state back to available or in use: the residents are never told that the
 *     item works again;
 *   - retiring an asset;
 *   - moving an asset to another room or another floor;
 *   - adjusting the count or the threshold;
 *   - recording a service, or moving the service dates.
 *
 * An asset with neither a room nor a floor has nobody to tell: the server writes the reason
 * in its log and sends nothing.
 *
 * THE GRID, in full. An asset is in one cell of this grid and no other:
 *
 *   state        available | in_use | under_maintenance | damaged | retired
 *   count        the number on hand, against the threshold the record carries
 *   service      the next service date the server holds, if any
 *   placement    a room, a floor, or neither
 *
 * The move between the cells is not a status change but a write: the state, the count, the
 * dates or the placement. The next best action is therefore declared per state and per
 * empty state.
 */
export const ASSETS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the register of what the PG owns usable: what is broken, what is due for service, what is running out, and where every item lives',
    doneLooksLike:
      'every item carries a state that says whether it can be used, every item links to the room or the floor it lives in, nothing sits at or below its threshold without a decision, no service date passes unnoticed, and every write is on the record of the item',
    primaryAction: 'Change the state of an item and act on it where it stands',
  },
  stateMachine: {
    domain: 'assets',
    model: 'asset',
    kind: 'grid',
    statuses: [
      {
        // It is there and it works.
        status: 'available',
        enteredBy: {
          method: 'POST',
          path: '/assets',
          condition:
            'the operator registers an asset; the create schema defaults the state to available (apps/api/src/routes/assets.ts:41-43). An admin can also move an asset back to available with PUT /assets/:id',
        },
      },
      {
        // It is out and somebody is using it.
        status: 'in_use',
        enteredBy: {
          method: 'PUT',
          path: '/assets/:id',
          condition: 'an admin moves an asset to in_use by hand (apps/api/src/routes/assets.ts:321-324)',
        },
      },
      {
        // It is broken and being worked on.
        status: 'under_maintenance',
        enteredBy: {
          method: 'PUT',
          path: '/assets/:id',
          condition:
            'an admin moves an asset to under_maintenance by hand (apps/api/src/routes/assets.ts:321-324). This is one of the two states that reach the residents of the room',
        },
      },
      {
        // It is broken past use.
        status: 'damaged',
        enteredBy: {
          method: 'PUT',
          path: '/assets/:id',
          condition:
            'an admin moves an asset to damaged by hand (apps/api/src/routes/assets.ts:321-324). This is the second of the two states that reach the residents of the room',
        },
      },
      {
        // It left the register. Nothing comes back out of this.
        status: 'retired',
        enteredBy: {
          method: 'DELETE',
          path: '/assets/:id',
          condition:
            'DELETE /assets/:id does not delete the row, it sets status=retired and writes an update audit log entry with the name and the retired flag (apps/api/src/routes/assets.ts:362-381)',
        },
      },
    ],
    terminal: 'retired',
    deadEnd: 'retired',
  },
  truthContract: [
    {
      action: 'Register an asset',
      operatorBelieves: 'the item is on the register and the people who live with it know',
      serverCommits:
        'POST /assets writes the asset with the name, the category, the location, the count, the threshold, the state, the floor and the room, and writes a create audit log entry with the name, the category and the count (apps/api/src/routes/assets.ts:253-290). The state defaults to available when the body does not carry one (:41-43). It sends no message at all: the notification to the residents is fired from the update path only (:342-351), so an asset that is registered already under maintenance or already damaged reaches nobody. The room and the floor it carries are what decide who hears about it later.',
      mismatchSurfacedAt:
        'the assets list shows the new item with its state and its placement; nobody is told, because the create path writes no notification',
      provenance: {
        auditAction: 'create',
        screen: '/assets/new',
        actor: 'admin',
      },
      stuckStateMeans:
        'the register holds an item that is out of service and the residents of its room still use it, because nothing was ever sent to them',
      runbook3am:
        'open /assets, find the item, and if it is out of service, edit it once so the server pushes the message to the residents of its room',
    },
    {
      action: 'Change the state of an asset',
      operatorBelieves:
        'the residents of that room know their geyser is being repaired, and the office knows the item is back in service',
      serverCommits:
        'PUT /assets/:id writes the fields the body carries, writes an update audit log entry with the changed field names (apps/api/src/routes/assets.ts:293-336). When the new state is under_maintenance or damaged AND it moved, it pushes a service_update notification to the active residents of the room the asset sits in, or to the residents of the floor when the asset hangs on a floor (:338-351, :84-157). An asset with neither a room nor a floor has nobody to tell: nothing is sent and the reason is written in the server log (:135-141). A failed push never undoes the write (:152-154). Every other move is silent: moving back to available or in use tells nobody that the item works again.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the asset page shows the new state and the residents of that room or floor get the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/assets/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the asset reads under_maintenance or damaged and the residents never got the message, so they still use it',
      runbook3am:
        'open /assets?status=under_maintenance and, if the residents have no notification, tell the room or the floor on the spot',
    },
    {
      action: 'Put an asset somewhere else',
      operatorBelieves: 'the item now lives in that room, and the residents of that room know',
      serverCommits:
        'PUT /assets/:id writes the floor and the room (apps/api/src/routes/assets.ts:304-310) and writes an update audit log entry with the changed field names (:328-336). It sends no message: the move itself is not announced, and the only message the server sends about an asset is the out of service one, which fires on a later state change. The placement is what decides who hears about it then.',
      mismatchSurfacedAt:
        'the asset page shows the new room and the new floor; the residents of the new room are not told that the item moved in',
      provenance: {
        auditAction: 'update',
        screen: '/assets/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the item sits in a room whose residents believe it is somewhere else, and the next out of service message reaches the wrong people',
      runbook3am:
        'open /assets/[id], read the room and the floor in the placement card, and compare them with the update entry in the write trail',
    },
    {
      action: 'Record a service on an asset',
      operatorBelieves: 'the service happened and the next one is booked',
      serverCommits:
        'PUT /assets/:id writes the purchase, the last service and the next service dates (apps/api/src/routes/assets.ts:311-319) and writes an update audit log entry with the changed field names (:328-336). It sends no message: a service date is between the office and the register. The next service date is what puts the asset on the service due list thirty days before it falls due (apps/api/src/routes/assets.ts:224-236), and a retired asset is left out of that list.',
      mismatchSurfacedAt:
        'the asset page shows the new dates and the service timeline; nobody outside the office is told',
      provenance: {
        auditAction: 'update',
        screen: '/assets/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the record says the item was serviced when it was not, and the next service date puts it back on the due list at the wrong time',
      runbook3am:
        'open /assets?view=due and read the next service date of each item against the last service date',
    },
    {
      action: 'Adjust the count of an asset',
      operatorBelieves: 'the count on the register is the count in the store',
      serverCommits:
        'PUT /assets/:id writes the count and the threshold (apps/api/src/routes/assets.ts:304) and writes an update audit log entry with the changed field names (:328-336). It sends no message. The count is what the low stock set is built from: an item at or below its threshold appears on it (apps/api/src/routes/assets.ts:213-216), and that set does not leave out a retired item, so a retired item that was left counted still shows there.',
      mismatchSurfacedAt:
        'the low stock band of the assets list and the stock meter of the asset page show the count the server holds',
      provenance: {
        auditAction: 'update',
        screen: '/assets/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the count on the record is not the count in the store, so the low stock list asks for the wrong things',
      runbook3am:
        'open /assets?view=low and compare the count of each item with the shelf it stands on',
    },
    {
      action: 'Retire an asset',
      operatorBelieves: 'the asset left the register and the stock count is right',
      serverCommits:
        'DELETE /assets/:id sets status=retired, keeps the row and writes an update audit log entry with the name and the retired flag (apps/api/src/routes/assets.ts:362-381). The asset drops out of the service due list, because that list filters on a status other than retired (apps/api/src/routes/assets.ts:228-231); the low stock list does not filter on status at all, so a retired item that sits under its threshold still shows there (:213-216). It sends no notification: the retire path is not one of the two out of service states, so no resident is told that the item left the register.',
      mismatchSurfacedAt:
        'the assets list shows the asset retired, the service due list drops it and the low stock list keeps it',
      provenance: {
        auditAction: 'update',
        screen: '/assets/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the asset was retired but the quantity was left counted, so the low stock number lies',
      runbook3am: 'open /assets?status=retired and correct the quantity on the record',
    },
    {
      action: 'Read the register and the two clocks',
      operatorBelieves: 'the numbers on the screen are the numbers of the set they are looking at',
      serverCommits:
        'GET /assets reads the filters of the address bar (category, status, search), returns the assets with the floor and the room resolved, and returns the total of the whole filtered set, not of the page (apps/api/src/routes/assets.ts:158-209). The server serves at most 100 assets in one page (apps/api/src/lib/routeUtils.ts:14-20). GET /assets/low-stock returns every asset at or below its threshold and GET /assets/service-due every asset due within thirty days; neither set takes a filter, neither is paginated and neither resolves the floor and the room (apps/api/src/routes/assets.ts:212-236).',
      mismatchSurfacedAt:
        'the band of the assets list names the scope of every number and the legend says what each column and each view really does',
      provenance: {
        screen: '/assets',
        actor: 'admin',
      },
      stuckStateMeans:
        'the band and the rows cover different sets, so the count on the screen and the rows on the screen disagree',
      runbook3am:
        'open /assets, read the address bar, and compare the band with the rows the filters produce',
    },
  ],
  layout: {
    archetype: 'workspace',
    grammarTokens: [
      'DataTable',
      'StatusTabs',
      'StatusBadge',
      'PageBand',
      'PageHeader',
      'FilterChips',
      'EmptyState',
      'DetailCard',
      'ContentFrame',
      'FormPage',
      'FormCard',
      'ConfirmModal',
      'AssetVisuals',
    ],
    mustNotLookLike:
      'a spend ledger: an asset row is a thing in a room, and the two clocks on the page are stock and service, not money',
    ownNumber: 'the items below their low stock threshold, over the whole register',
  },
  nextBestAction: {
    perStatus: {
      available: {
        label: 'Open the asset',
        target: '/assets/[id]',
      },
      in_use: {
        label: 'Open the asset',
        target: '/assets/[id]',
      },
      under_maintenance: {
        label: 'Book the repair',
        target: '/assets/[id]',
        enabledWhen: 'the item is still under maintenance',
      },
      damaged: {
        label: 'Decide: repair or retire',
        target: '/assets/[id]',
      },
      retired: {
        label: 'Read the retirement',
        target: '/assets/[id]',
      },
    },
    perEmptyState: {
      assets: {
        label: 'Register an asset',
        target: '/assets/new',
      },
      low_stock: {
        label: 'Open the low stock list',
        target: '/assets?view=low',
      },
      service_due: {
        label: 'Open the service due list',
        target: '/assets?view=due',
      },
      filtered_out: {
        label: 'Clear the filters',
        target: '/assets',
      },
    },
  },
};
