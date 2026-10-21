import type { ModuleContract } from './module';

/**
 * The assets contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/asset.ts:63
 * - routes: apps/api/src/routes/assets.ts
 * - the retire path: apps/api/src/routes/assets.ts:359-386
 * - the admin screens: apps/web/src/app/(admin)/assets
 *
 * The asset register is the stuff the PG owns. Nothing here is a person, and
 * nothing here moves money; the two clocks it does carry are the low stock
 * threshold and the next service date.
 */
export const ASSETS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the register of what the PG owns usable: what is in stock, what is broken, and what is due for service',
    doneLooksLike:
      'every asset carries a status that says whether it can be used, nothing sits below its low stock threshold without a decision, and no service date has passed unnoticed',
    primaryAction: 'Change the status of an asset',
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
            'the operator registers an asset; the create schema defaults the status to available (apps/api/src/routes/assets.ts:38-40). An admin can also move an asset back to available with PUT /assets/:id',
        },
      },
      {
        // It is out and somebody is using it.
        status: 'in_use',
        enteredBy: {
          method: 'PUT',
          path: '/assets/:id',
          condition: 'an admin moves an asset to in_use by hand',
        },
      },
      {
        // It is broken and being worked on.
        status: 'under_maintenance',
        enteredBy: {
          method: 'PUT',
          path: '/assets/:id',
          condition: 'an admin moves an asset to under_maintenance by hand',
        },
      },
      {
        // It is broken past use.
        status: 'damaged',
        enteredBy: {
          method: 'PUT',
          path: '/assets/:id',
          condition: 'an admin moves an asset to damaged by hand',
        },
      },
      {
        // It left the register. Nothing comes back out of this.
        status: 'retired',
        enteredBy: {
          method: 'DELETE',
          path: '/assets/:id',
          condition:
            'DELETE /assets/:id does not delete the row, it sets status=retired and writes an update audit log entry (apps/api/src/routes/assets.ts:359-386)',
        },
      },
    ],
    terminal: 'retired',
    deadEnd: 'retired',
  },
  truthContract: [
    {
      action: 'Take an asset out of service',
      operatorBelieves: 'the residents of that room know their geyser is being repaired',
      serverCommits:
        'PUT /assets/:id writes the new fields including the status, and writes an update audit log entry with the changed field names (apps/api/src/routes/assets.ts:295-338). When the status moves into under_maintenance or damaged it then pushes a service_update notification to the active residents of the room the asset sits in, or to the residents of the floor when the asset hangs on a floor (apps/api/src/routes/assets.ts:84-157, :340-353). The Asset model carries no owner field, so there is nobody on the office side to notify; an asset with neither a room nor a floor has nobody to tell and the reason is logged.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the asset page shows the new status and the residents of that room or floor get the notification in the portal',
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
      action: 'Retire an asset',
      operatorBelieves: 'the asset left the register and the stock count is right',
      serverCommits:
        'DELETE /assets/:id sets status=retired, keeps the row and writes an update audit log entry with the name and the retired flag (apps/api/src/routes/assets.ts:359-386). The asset drops out of the service due list, because that list filters on a status other than retired (apps/api/src/routes/assets.ts:225-232); the low stock list does not filter on status at all, so a retired item that sits under its threshold still shows there (apps/api/src/routes/assets.ts:213-222). It sends no notification: the retire path is not one of the two out of service statuses, so no resident is told that the item left the register.',
      mismatchSurfacedAt:
        'the assets list shows the asset retired, and the stock and service banners drop it',
      provenance: {
        auditAction: 'update',
        screen: '/assets/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the asset was retired but the quantity was left counted, so the stock number lies',
      runbook3am: 'open /assets?status=retired and correct the quantity on the record',
    },
  ],
  layout: {
    archetype: 'workspace',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'StatCard',
      'LowStockBanner',
      'ServiceDueBanner',
      'AssetVisuals',
    ],
    mustNotLookLike:
      'a spend ledger: an asset row is a thing in a room, and the two clocks on the page are stock and service, not money',
    ownNumber: 'items below their low stock threshold',
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
        enabledWhen: 'the repair is still open',
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
        target: '/assets?status=available',
      },
    },
  },
};
