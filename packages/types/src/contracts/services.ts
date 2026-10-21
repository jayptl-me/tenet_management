import type { ModuleContract } from './module';

/**
 * The services contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the four admin screens (2026-10-21, wave 6):
 *
 * - the model: apps/api/src/models/serviceStatus.ts
 * - the routes: apps/api/src/routes/services.ts
 * - the status path and its notification: apps/api/src/routes/services.ts:361-461
 * - the notification itself: apps/api/src/routes/services.ts:132-190
 * - the create path and its refusals: apps/api/src/routes/services.ts:279-358
 * - the full update path: apps/api/src/routes/services.ts:480-569
 * - the delete path: apps/api/src/routes/services.ts:572-597
 * - the per floor seed: apps/api/src/routes/floors.ts:388-414
 * - the per floor service health the board reads: apps/api/src/routes/floors.ts:97-172
 * - the rooms of a floor and the residents on it: apps/api/src/routes/floors.ts:188-260
 * - the admin screens: apps/web/src/app/(admin)/services
 *
 * A SERVICE BELONGS TO A FLOOR, NOT TO A ROOM. The model carries a floorId and no room
 * (apps/api/src/models/serviceStatus.ts:16-19), and the unique index is the floor and the service
 * type (apps/api/src/models/serviceStatus.ts:66). So the residents a service reaches are the
 * residents of that floor, never the residents of one room: the server resolves them from the
 * service through the rooms of the floor and the tenant records
 * (apps/api/src/routes/services.ts:132-190).
 *
 * THE GRID, in full. A row of this module is one floor and one service type, and the cell is the
 * state of that service on that floor:
 *
 *   state       operational | degraded | down
 *   service     one of the per floor amenity definitions of AppConfig
 *   floor       every floor of the building, including the floors that carry no row at all
 *
 * A tile the server does not hold is a gap, not a state: the row has to be created first. The
 * service type is not a status, so it is not in the state machine below; it is a column of the
 * board.
 */
export const SERVICES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'holding the health of the building: what is working and what is not on every floor, and putting a broken service back when it is repaired',
    doneLooksLike:
      'every floor carries the state of every service the office tracks on it, a broken service says who lives above it, and the residents of that floor have been told',
    primaryAction: 'Set the state of a service on a floor',
  },
  stateMachine: {
    domain: 'services',
    model: 'serviceStatus',
    kind: 'grid',
    statuses: [
      {
        // The service works.
        status: 'operational',
        enteredBy: {
          method: 'PUT',
          path: '/services/:id',
          condition:
            'an admin puts the service back to operational. Only an admin may do this: a resident may report a service as degraded or down on their own floor, and is refused with a 400 and the message "Only administrators can set a service status to operational" when they try to set it to operational (apps/api/src/routes/services.ts:372-406). The same state is the default of a row that is created (apps/api/src/models/serviceStatus.ts:30-34)',
        },
      },
      {
        // The service works badly.
        status: 'degraded',
        enteredBy: {
          method: 'PUT',
          path: '/services/:id',
          condition:
            'an admin, or a resident who lives on that floor, reports the service as degraded (apps/api/src/routes/services.ts:277-334, :361-407). The write pushes a service update to the residents of the floor (apps/api/src/routes/services.ts:442-452)',
        },
      },
      {
        // The service does not work.
        status: 'down',
        enteredBy: {
          method: 'PUT',
          path: '/services/:id',
          condition:
            'an admin, or a resident who lives on that floor, reports the service as down (apps/api/src/routes/services.ts:277-334, :361-407). The write pushes a service update to the residents of the floor (apps/api/src/routes/services.ts:442-452)',
        },
      },
    ],
  },
  truthContract: [
    {
      action: 'Report a service of a floor as degraded or down',
      operatorBelieves:
        'the residents of that floor know their service is broken, because the office reported it',
      serverCommits:
        'PUT /services/:id checks that a non-admin may only touch a service on their own floor and may never set it to operational, writes the state, stamps the record with the office and the time, keeps the note, and writes an update audit log entry with the state it came from (apps/api/src/routes/services.ts:361-433). When the state actually moved it then pushes a service_update notification to the residents of the floor, resolved from the service through the rooms of the floor and the tenant records (apps/api/src/routes/services.ts:132-190, :442-452). A floor with nobody living on it has nobody to tell, so nothing is sent and the reason is logged. A failed push never undoes the write.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the board and the service page show the new state, and the residents of that floor get the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/services/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the service reads down, the residents are still without it, and either the push failed or the note that would explain it was never written',
      runbook3am:
        'open /services?status=down, read the write trail of the service on /services/[id], and if the residents have no notification, tell the floor directly',
    },
    {
      action: 'Put a service back to operational',
      operatorBelieves: 'the floor knows the service is working again',
      serverCommits:
        'PUT /services/:id writes the state back to operational with the note, stamps the record with the office and the time and writes an update audit log entry with the state it came from (apps/api/src/routes/services.ts:361-433). The state change also pushes a service_update notification to the residents of that floor, with the note in the body when there is one (apps/api/src/routes/services.ts:132-190, :442-452).',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the board and the service page show operational again, and the residents of that floor get the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/services/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the service reads operational while the residents still have no service, because the push failed and they heard about the repair from a neighbour',
      runbook3am: 'open /services and check the floors that still read degraded or down',
    },
    {
      action: 'Change the note of a service without changing its state',
      operatorBelieves: 'the office wrote down what is wrong and the record keeps it',
      serverCommits:
        'PUT /services/:id writes the note, stamps the record with the office and the time and writes an update audit log entry with noteChanged (apps/api/src/routes/services.ts:409-433). The state did not move, so no notification goes to the residents: the note reaches the audit trail and the portal only.',
      mismatchSurfacedAt:
        'the service page shows the note and the write trail shows the entry',
      provenance: {
        auditAction: 'update',
        screen: '/services/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office believes the residents read the note, and they never will: a note alone is not a message',
      runbook3am:
        'open /services/[id], read the note, and if the residents have to know it, change the state so the server pushes the update',
    },
    {
      action: 'Provision a service on a floor',
      operatorBelieves: 'the floor now carries that service, and the residents know',
      serverCommits:
        'POST /services checks that the service type is a per floor amenity definition of AppConfig (a room only amenity is refused with a 400 and the message "Invalid service type. Must match an isPerFloor AppConfig amenity definition key."), checks that the floor exists (FLOOR_NOT_FOUND), creates the row with the state and the note, stamps it with the office and the time, writes a create audit log entry and refuses a second row for the same floor and service type with a conflict (apps/api/src/routes/services.ts:279-358). It sends no notification: a row that is created reaches nobody.',
      mismatchSurfacedAt:
        'the board shows the new tile and the write trail of the service shows the create entry; the residents of the floor are not told',
      provenance: {
        auditAction: 'create',
        screen: '/services/new',
        actor: 'admin',
      },
      stuckStateMeans:
        'the row exists in a state the residents were never told about, so the floor believes a service is working that nobody announced',
      runbook3am:
        'open /services, find the floor, and set the state from the board: that write reaches the residents',
    },
    {
      action: 'Provision the service on every floor of the building',
      operatorBelieves: 'every floor carries the service afterwards',
      serverCommits:
        'The admin screen asks the server once per floor (POST /services) and reports the answer of every floor on its own: created, held because that floor already has the service, or failed with the reason the server gave (apps/web/src/app/(admin)/services/new/page.tsx). The server refuses a second row for the same floor and service type with a conflict, so a floor that already has the service is held, not overwritten (apps/api/src/routes/services.ts:351-354). The answer of every floor is carried to the board in the address bar and shown there.',
      mismatchSurfacedAt:
        'the board opens on the per floor answer of the run, one row per floor',
      provenance: {
        screen: '/services',
        actor: 'admin',
      },
      stuckStateMeans:
        'a floor was held and the office believed the whole building was provisioned, so one floor still has no service',
      runbook3am:
        'open /services and read the tiles that are not set up: they name the floor and the service that is missing',
    },
    {
      action: 'Change the service type of a row',
      operatorBelieves: 'the row now carries another service, and the floor is told',
      serverCommits:
        'PUT /services/:id/full writes the new service type on the row and writes an update audit log entry (apps/api/src/routes/services.ts:480-569). It refuses a type the floor already has with DUPLICATE_SERVICE. It pushes no notification and it does not stamp the record with the office and the time, because a service type is a label on the row and not a state of the floor.',
      mismatchSurfacedAt:
        'the board and the service page show the new type; the residents of the floor are not told and the record still carries the office that wrote the row before',
      provenance: {
        auditAction: 'update',
        screen: '/services/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the row carries a type nobody was told about, so the board and the notice the residents received name different services',
      runbook3am:
        'open /services/[id], read the write trail, and set the state from the record so the residents of the floor are reached',
    },
    {
      action: 'Remove the row of a service from a floor',
      operatorBelieves: 'the floor no longer carries that service',
      serverCommits:
        'DELETE /services/:id deletes the row, writes a delete audit log entry and broadcasts the change (apps/api/src/routes/services.ts:572-597). It is a hard delete: the floor loses the service until the seed creates it again, and it sends no notification, so the residents of the floor are not told.',
      mismatchSurfacedAt:
        'the board shows the tile as not set up; the residents of the floor still believe the service is there',
      provenance: {
        auditAction: 'delete',
        screen: '/services/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the row is gone and the floor has no state for that service, so the board cannot say whether the residents still have it',
      runbook3am:
        'open /services, find the floor whose tile is not set up, and provision it again or tell the floor',
    },
    {
      action: 'Seed the service rows the floors are missing',
      operatorBelieves: 'every floor now carries every service the office tracks per floor',
      serverCommits:
        'POST /floors/reseed-services walks every floor and creates only the service rows that are missing for the per floor amenity keys, so the run is idempotent, and reports how many floors it touched and how many rows it created (apps/api/src/routes/floors.ts:388-414). The new rows start operational and it writes no notification: a row that was missing is a row nobody had reported.',
      mismatchSurfacedAt:
        'the board shows the new tiles and the run reports the floors it touched',
      provenance: {
        screen: '/services',
        actor: 'admin',
      },
      stuckStateMeans:
        'an amenity definition was added and no floor has a state for it, so the board shows the service as not set up on every floor',
      runbook3am: 'open /services, run the seed, and check the tiles that were not set up',
    },
    {
      action: 'Read the health of the building',
      operatorBelieves: 'the board shows the state of every service of every floor',
      serverCommits:
        'GET /services reads the floor and the state of the address bar, returns the rows with the name of the floor and the office that last wrote them, and enriches every row with the open complaints of the floor (apps/api/src/routes/services.ts:212-253). The list route serves at most 100 rows in one page, so the board walks the pages and reports the size of the set it holds. The server cannot filter on a service type, so that filter narrows the board on the screen and the legend says so. The per floor counts of the band come from GET /floors/overview, which the server computes over the whole set of rows (apps/api/src/routes/floors.ts:97-172).',
      mismatchSurfacedAt:
        'the band names the scope of every number, and the count on every tab is the number of tiles that tab shows',
      provenance: {
        screen: '/services',
        actor: 'admin',
      },
      stuckStateMeans:
        'the board holds a set the server does not have, so a floor reads a state that was never written',
      runbook3am:
        'open /services, read the address bar, and compare the count on a tab with the tiles the board shows',
    },
  ],
  layout: {
    archetype: 'board',
    grammarTokens: [
      'PageBand',
      'StatusTabs',
      'FilterChips',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'ErrorBanner',
      'ResourceSelect',
      'Select',
      'Textarea',
      'Button',
      'DetailCard',
      'ContentFrame',
      'FormPage',
      'FormCard',
      'FormActions',
      'FormSection',
      'ConfirmModal',
    ],
    mustNotLookLike:
      'a complaints queue: a service row is a floor and a service type, and the tile is the state of the building, not a person waiting',
    ownNumber:
      'the residents on the floors that carry a degraded or down service: the occupied beds the server reports on those floors',
  },
  nextBestAction: {
    perStatus: {
      operational: {
        label: 'Open the service',
        target: '/services/[id]',
      },
      degraded: {
        label: 'Bring it back',
        target: '/services/[id]',
        enabledWhen: 'the service is still degraded',
      },
      down: {
        label: 'Report it and tell the floor',
        target: '/services/[id]',
        enabledWhen: 'the service is still down',
      },
      not_set_up: {
        label: 'Provision it on the floor',
        target: '/services/new',
        enabledWhen: 'the server holds no row for that service on that floor',
      },
    },
    perEmptyState: {
      services: {
        label: 'Provision a service',
        target: '/services/new',
      },
      floors: {
        label: 'Add a floor',
        target: '/floors/new',
      },
      filtered: {
        label: 'Clear the filters',
        target: '/services',
      },
      no_service_row: {
        label: 'Seed the missing rows',
        target: '/services',
      },
    },
  },
};
