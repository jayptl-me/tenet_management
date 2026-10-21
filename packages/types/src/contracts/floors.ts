import type { ModuleContract } from './module';

/**
 * The floors contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the four admin screens (2026-10-21, wave 6):
 *
 * - the model: apps/api/src/models/floor.ts (no status field, see below)
 * - the routes: apps/api/src/routes/floors.ts
 * - the list aggregate: apps/api/src/routes/floors.ts:97-172
 * - the rooms of a floor and the occupancy the server computes: apps/api/src/routes/floors.ts:188-260
 * - the create path and the service seeding: apps/api/src/routes/floors.ts:262-296
 * - the update path and the stripped room count: apps/api/src/routes/floors.ts:299-334
 * - the delete path and its two refusals: apps/api/src/routes/floors.ts:337-386
 * - the per floor service backfill: apps/api/src/routes/floors.ts:388-414
 * - the room count the room hooks keep in step: apps/api/src/models/room.ts:162-180
 * - the service of a floor and the row the office creates for it: apps/api/src/routes/services.ts:279-358
 * - the write trail: apps/api/src/routes/audit.ts:13-52
 * - the admin screens: apps/web/src/app/(admin)/floors
 *
 * THE FLOOR MODEL HAS NO STATUS FIELD (apps/api/src/models/floor.ts:19-82). A floor is a level, a
 * label, the room count that the room hooks keep in sync and the amenity counts. Its state is the
 * state of what hangs off it: the rooms, the beds and the service rows.
 *
 * THE GRID, in full. A floor is in one cell of this grid and no other:
 *
 *   occupancy        the beds of the active rooms of the floor: taken | free
 *   service health   operational | degraded | down, one row per per floor amenity
 *   in service       the rooms of the floor: active | out of service
 *
 * The move between the cells is not a status change but a write: a room save, a room retire or a
 * service update. The next best action is therefore declared per cell and per empty state.
 */
export const FLOORS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'holding the shape of the building: what each level holds, how many of its beds are free, how healthy the services of that level are, and what the office does about it from where it stands',
    doneLooksLike:
      'every floor shows the room count the server holds, the beds of those rooms with the resident in each of them, the service rows of that floor with their state, and the write trail that proves what the office did',
    primaryAction:
      'Open a floor and act on it: add a room, set a service up, rename the floor or retire a room',
  },
  stateMachine: {
    domain: 'floors',
    model: 'floor',
    kind: 'grid',
    // The floor model carries no status enum (apps/api/src/models/floor.ts). The state of a floor is
    // the state of what hangs off it:
    //   totalRooms    the count of the active rooms, kept in step by the room hooks
    //   amenityCounts the units the office declares for the level
    //   rooms         the rooms of the floor, each with its own beds
    //   services      one ServiceStatus row per per floor amenity definition
    statuses: [],
  },
  truthContract: [
    {
      action: 'Add a floor',
      operatorBelieves: 'the floor exists with its level, its label and the services of that level',
      serverCommits:
        'POST /floors writes the floor with the level, the label and the room count, seeds a service status row for every per floor amenity definition the app config holds and writes a create audit log entry with the level, the label and the room count (apps/api/src/routes/floors.ts:262-296). The seed is best effort: a failure leaves the floor in place and is swallowed by the handler, and the office sets the missing rows up by hand. The level is filled in by the form, not by the server: the server refuses a level or a label that is taken (DUPLICATE_FLOOR) and a level below 0. The room count is a placeholder: the room hooks recount the active rooms of the floor on every room save and retire (apps/api/src/models/room.ts:162-180). Nobody is told.',
      mismatchSurfacedAt:
        'the floor page shows the floor the server holds, its rooms and its service rows; the create form lands on that page instead of on a local claim',
      provenance: {
        auditAction: 'create',
        screen: '/floors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the floor was written but the service rows were not, so the floor carries no service and a broken service on it cannot be reported',
      runbook3am:
        'open /floors, open the floor and look at the services it lists; the missing ones are named there',
    },
    {
      action: 'Rename a floor or move it to another level',
      operatorBelieves: 'the floor carries the new label and the new level',
      serverCommits:
        'PUT /floors/:id writes the fields the body carries, strips the room count from the body before the write and writes an update audit log entry with the fields that moved (apps/api/src/routes/floors.ts:299-334). The room count is never written by this call: the room hooks keep it in step with the active rooms of the floor (apps/api/src/models/room.ts:162-180). It refuses a level or a label that another floor holds (DUPLICATE_FLOOR) and a level below 0. It moves no room, no bed and no resident, and it sends no message.',
      mismatchSurfacedAt:
        'the floor page shows the new label and the new level; the rooms of the floor stay where they are',
      provenance: {
        auditAction: 'update',
        screen: '/floors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office renamed the floor and believes the building followed, but only the label moved: the room numbers and the leases still carry the old level',
      runbook3am: 'open /floors, open the floor and read the update entry in its write trail',
    },
    {
      action: 'Delete a floor',
      operatorBelieves: 'the floor is gone and nothing that belonged to it is left behind',
      serverCommits:
        'DELETE /floors/:id refuses while active rooms (FLOOR_HAS_ROOMS) or washing machines (FLOOR_HAS_MACHINES) are still on the floor, then removes the floor row, cascades the service status rows of that floor away and writes a delete audit log entry (apps/api/src/routes/floors.ts:337-386). It is a hard delete: the floor row is gone for good.',
      mismatchSurfacedAt:
        'the floors list no longer carries the floor and the floor page answers that there is no floor for that id',
      provenance: {
        auditAction: 'delete',
        screen: '/floors',
        actor: 'admin',
      },
      stuckStateMeans:
        'a floor was deleted with service rows left behind, so the service board shows a floor that does not exist',
      runbook3am: 'open /services and look for the rows whose floor is gone',
    },
    {
      action: 'Backfill the floor services',
      operatorBelieves: 'every floor carries a status for every per floor amenity',
      serverCommits:
        'POST /floors/reseed-services walks every floor and creates the service status rows that are missing for the per floor amenity keys, and reports how many floors it touched and how many rows it created (apps/api/src/routes/floors.ts:388-414). It is idempotent, it creates only the missing keys and it writes the audit log entry against every floor, not against one. It tells nobody.',
      mismatchSurfacedAt: 'the response counts and the service board show the new rows',
      provenance: {
        screen: '/services',
        actor: 'admin',
      },
      stuckStateMeans:
        'an amenity definition was added and no floor has a status for it, so the service board is missing a column',
      runbook3am: 'open /services and run the backfill, then check the service board again',
    },
    {
      action: 'Set a service of a floor up',
      operatorBelieves:
        'the service of that floor is now tracked and can be reported when it breaks',
      serverCommits:
        'POST /services writes the service status row for that floor and that service type with the status operational, stamps it with the office and the time and writes a create audit log entry under the service (apps/api/src/routes/services.ts:279-358). It refuses a service type that is not a per floor amenity definition (INVALID_SERVICE_TYPE) and a floor the server does not know. It tells nobody: a row that was missing is a row nobody had reported.',
      mismatchSurfacedAt:
        'the services of the floor on the floor page show the new row, and the service board shows it too',
      provenance: {
        auditAction: 'create',
        screen: '/floors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office believes the service is tracked and it is not, so a broken service on that floor cannot be reported',
      runbook3am:
        'open the floor and read the services it lists; the definitions without a row are named there',
    },
    {
      action: 'Take a room of a floor out of service',
      operatorBelieves: 'the room is out of service and the floor count is right',
      serverCommits:
        'DELETE /rooms/:id refuses while active tenants still occupy the room (ACTIVE_TENANTS), then keeps the room record and sets isActive false, recomputes the room count of the floor and writes a delete audit log entry (apps/api/src/routes/rooms.ts:799-845). The server pushes a service update to the residents of the room, but it refuses the retire while a resident occupies it, so there is nobody left to tell (apps/api/src/routes/rooms.ts:217-256).',
      mismatchSurfacedAt:
        'the rooms of the floor show the room out of service and the room count of the floor drops',
      provenance: {
        auditAction: 'delete',
        screen: '/floors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the room was retired while a resident was still in it, so the occupancy and the room count of the floor disagree',
      runbook3am:
        'open /floors, open the floor and compare the rooms it lists with the rooms board filtered on that floor',
    },
    {
      action: 'Read the floors of the building',
      operatorBelieves: 'the numbers on the screen are the numbers of the building',
      serverCommits:
        'GET /floors/overview reads the floors, the rooms and the service rows and returns, for every floor, the active room count, the bed map, the occupancy, the sum of the rent of its active rooms and the service health (apps/api/src/routes/floors.ts:97-172). The route takes no filter: the search and the health filter on the list narrow the screen and not the numbers, which stay over the whole set of floors the server returns.',
      mismatchSurfacedAt:
        'the band of the floors list names the scope of every number, and the legend says what the filters really do',
      provenance: {
        screen: '/floors',
        actor: 'admin',
      },
      stuckStateMeans:
        'the floors on the screen and the numbers in the band cover different sets, so the bed count and the rows do not agree',
      runbook3am:
        'open /floors, read the address bar, and compare the band with the floors on screen',
    },
  ],
  layout: {
    archetype: 'floor-map',
    grammarTokens: [
      'PageBand',
      'StatusTabs',
      'FilterChips',
      'FloorCard',
      'FloorServiceGrid',
      'FloorStackPreview',
      'BedMiniGrid',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'ErrorBanner',
      'DataTable',
      'DetailCard',
      'ContentFrame',
      'FormPage',
      'FormCard',
      'FormActions',
      'FormSection',
      'AmenityCountStepper',
      'ConfirmModal',
    ],
    mustNotLookLike:
      'a room table: a floor row is a level of the building with its own shape, and the beds and the services of that level are what has to be readable at a glance',
    ownNumber:
      'the free beds and the service health of the level, over the whole set of floors the server reports',
  },
  nextBestAction: {
    perStatus: {
      // The floor has no status of its own: the cells of its grid are what the
      // next action is declared for.
      free_beds: {
        label: 'Open the floor',
        target: '/floors/[id]',
        enabledWhen: 'the floor holds a bed that no resident is in',
      },
      full: {
        label: 'Open the floor',
        target: '/floors/[id]',
        enabledWhen: 'every bed of the rooms in service holds a resident',
      },
      service_not_working: {
        label: 'Open the service board',
        target: '/services',
        enabledWhen: 'a service of the floor is degraded or down',
      },
      service_not_set_up: {
        label: 'Set the services up',
        target: '/floors/[id]',
        enabledWhen: 'the server holds no service row for a per floor amenity on that floor',
      },
      out_of_service: {
        label: 'Put the room back in service',
        target: '/rooms/[id]/edit',
        enabledWhen: 'a room of the floor is out of service',
      },
    },
    perEmptyState: {
      floors: {
        label: 'Add the first floor',
        target: '/floors/new',
      },
      filtered: {
        label: 'Clear the filters',
        target: '/floors',
      },
      no_rooms: {
        label: 'Add a room',
        target: '/rooms/new',
      },
      no_service_row: {
        label: 'Set the services up',
        target: '/floors/[id]',
      },
    },
  },
};
