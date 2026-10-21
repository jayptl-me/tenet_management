import type { ModuleContract } from './module';

/**
 * The rooms contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the four admin screens (2026-10-21, wave 6):
 *
 * - the model: apps/api/src/models/room.ts
 * - routes: apps/api/src/routes/rooms.ts
 * - the bed rebuild on a sharing type change: apps/api/src/routes/rooms.ts:84-123
 * - the occupancy reconcile: apps/api/src/services/occupancy-reconcile.service.ts:62-219
 * - the bed move of a resident: apps/api/src/routes/tenants.ts:503-730
 * - the rent a resident is billed from: apps/api/src/services/invoice.service.ts:97
 * - the page size the server clamps: apps/api/src/lib/routeUtils.ts:16
 * - the admin screens: apps/web/src/app/(admin)/rooms
 *
 * THE ROOM MODEL HAS NO ROOM LEVEL STATUS. Its only status enum is the one on the amenity
 * subdocument (apps/api/src/models/room.ts:59-65), so that is the axis the state machine below
 * declares. The room own lifecycle is isActive plus the per bed isOccupied flag, and both are
 * written by the routes below.
 *
 * THE GRID, in full. A room is in one cell of this grid and no other:
 *
 *   service state      the health of the amenities the office tracks for the room
 *                      operational | degraded | down
 *   occupancy          free (no bed is taken) | part taken | full
 *   sharing type       2 | 3 | 4 beds
 *   in service         isActive true | false
 *
 * The move between the cells is not a status change but a write: the beds array, the sharing type
 * or the active flag. The next best action is therefore declared per cell and per empty state.
 */
export const ROOMS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the bed map true: which bed of which room is free, who sleeps in it, and what happens to a resident when their bed moves',
    doneLooksLike:
      'every bed of every room is either taken by a named resident or marked free, a room that depends on a broken amenity has told its residents, and a bed that moved is written on the record of the resident who moved',
    primaryAction: 'Put a resident in a bed, or take a room out of service',
  },
  stateMachine: {
    domain: 'rooms',
    model: 'room',
    kind: 'grid',
    statuses: [
      {
        // The amenity works.
        status: 'operational',
        enteredBy: {
          method: 'PUT',
          path: '/rooms/:id',
          condition:
            'an admin writes the amenity list of the room; every amenity carries its own status (apps/api/src/routes/rooms.ts:25-28, :40-49, :512-543)',
        },
      },
      {
        // The amenity works badly.
        status: 'degraded',
        enteredBy: {
          method: 'PUT',
          path: '/rooms/:id',
          condition:
            'an admin marks an amenity of the room as degraded; the write also pushes a service update to the residents of the room (apps/api/src/routes/rooms.ts:160-207)',
        },
      },
      {
        // The amenity does not work.
        status: 'down',
        enteredBy: {
          method: 'PUT',
          path: '/rooms/:id',
          condition:
            'an admin marks an amenity of the room as down; the write also pushes a service update to the residents of the room (apps/api/src/routes/rooms.ts:160-207)',
        },
      },
    ],
    // The room own lifecycle is not in this enum: isActive is the room flag and beds[].isOccupied
    // is the bed flag (apps/api/src/models/room.ts:96-122).
  },
  truthContract: [
    {
      action: 'Put a resident in a bed of a room',
      operatorBelieves:
        'the resident sleeps in that bed from now on, and the resident knows that they do',
      serverCommits:
        'PUT /tenants/:id with the room and the bed frees the bed the resident held, takes the new one, stamps the bed onto the resident record and writes a tenant_transfer audit log entry with the room and the bed before and after (apps/api/src/routes/tenants.ts:534-562, :600-663, :681-702). It refuses a bed that is taken (BED_OCCUPIED), a room that is not active (ROOM_INACTIVE) and a checked out resident (TENANT_INACTIVE). It does not change the rent on the resident record: the bill is raised from the rent the record carries (apps/api/src/services/invoice.service.ts:97). It sends no message at all.',
      mismatchSurfacedAt:
        'the room page shows the new bed of the resident and the resident page shows the new room and bed; the resident is not told: they see the change only the next time they open the app',
      provenance: {
        auditAction: 'tenant_transfer',
        screen: '/rooms/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bed map says the resident is in one bed and the resident record says another, so the occupancy count and the rent roll disagree',
      runbook3am:
        'open /rooms/[id], read the bed map, then compare the bed of the resident on /tenants/[id] with the bed the room holds',
    },
    {
      action: 'Change the sharing type of a room',
      operatorBelieves: 'the beds were repacked and everybody still has a bed',
      serverCommits:
        'PUT /rooms/:id rebuilds the beds array for the new sharing type, keeps the occupied beds packed into the first slots, refuses a downsize while beds are occupied (BEDS_OCCUPIED_ON_DOWNSIZE), writes the new bed onto the record of every resident the repack moves and writes an update audit log entry with the old and the new sharing type (apps/api/src/routes/rooms.ts:84-123, :490-605). The bed move itself is never announced: the only notification on that path is the amenity one, and it fires only when an amenity status changed with the same write (apps/api/src/routes/rooms.ts:578-588).',
      mismatchSurfacedAt:
        'the room page shows the new bed grid; a resident who was moved finds out from the portal',
      provenance: {
        auditAction: 'update',
        screen: '/rooms/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bed map says a resident is in another bed and their rent record still points at the old one',
      runbook3am:
        'open /rooms/[id], read the update entry, then compare the bed with the tenant record',
    },
    {
      action: 'Create a room',
      operatorBelieves: 'the room exists, with its beds and its rent',
      serverCommits:
        'POST /rooms checks that the floor exists (FLOOR_NOT_FOUND), builds one bed per letter of the sharing type with Room.generateBeds (apps/api/src/models/room.ts:183-190), writes the room, writes a create audit log entry with the number, the sharing type, the floor and the rent, and refuses a room number that already exists (ROOM_NUMBER_EXISTS) (apps/api/src/routes/rooms.ts:418-471). The model refuses a room whose bed count does not match its sharing type (apps/api/src/models/room.ts:110-118). Every bed starts free, no resident is attached, no bill is raised and the floor room count is recounted by the room hooks (apps/api/src/models/room.ts:162-169).',
      mismatchSurfacedAt:
        'the rooms list shows the new room with its empty bed map; nobody is told about a new room, because a new room is not yet the business of a resident',
      provenance: {
        auditAction: 'create',
        screen: '/rooms/new',
        actor: 'admin',
      },
      stuckStateMeans:
        'the room exists but the floor still counts the old number of rooms, so the floor card and the rooms list disagree',
      runbook3am: 'open /rooms, find the room, and compare the room count on its floor page',
    },
    {
      action: 'Edit a room',
      operatorBelieves:
        'the room now has the new number, the new rent, the new floor and the new amenity health, and the residents know',
      serverCommits:
        'PUT /rooms/:id writes the fields the body carries, recounts the rooms of the floors that moved, and writes an update audit log entry with the fields that moved (apps/api/src/routes/rooms.ts:607-647). The rent of the room is the number the office starts from when a resident is checked in; what every resident owes is raised from the rent on their own record, so this write changes what nobody owes (apps/api/src/services/invoice.service.ts:97). A floor move keeps the residents where they sleep. Unchecking the active flag takes the room out of the lists a new resident is picked from. Only a change of an amenity status reaches the residents.',
      mismatchSurfacedAt:
        'the room page shows the new record; the residents of the room see nothing unless an amenity status changed',
      provenance: {
        auditAction: 'update',
        screen: '/rooms/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office believes the room was changed and the residents were told, and neither happened: no message reached them and only the audit entry records the write',
      runbook3am:
        'open /rooms/[id], read the update entry in the audit log, and tell the residents of the room by hand',
    },
    {
      action: 'Mark an amenity of a room as degraded or down',
      operatorBelieves: 'the residents of that room know their geyser or their wifi is broken',
      serverCommits:
        'PUT /rooms/:id writes the amenity list, recomputes the floor room count when the room or the active flag moved, and writes an update audit log entry with the changed fields (apps/api/src/routes/rooms.ts:610-652). It then compares the amenity list before and after the write and pushes a service_update notification to the active residents of that room for every amenity whose status actually moved (apps/api/src/routes/rooms.ts:160-207, :643-652). A room with nobody in it has nobody to tell, so nothing is sent and the reason is logged. A failed push never undoes the room write.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the room page shows the amenity chip and the residents of that room get the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/rooms/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the amenity reads down and the residents never got the message, so they still use it',
      runbook3am:
        'open /rooms, find the room with the broken amenity, and if the residents have no notification, tell them on the floor',
    },
    {
      action: 'Take a room out of service',
      operatorBelieves: 'the room is out of service and the floor count is right',
      serverCommits:
        'DELETE /rooms/:id refuses while active tenants still occupy the room (ACTIVE_TENANTS), then sets isActive=false, recomputes Floor.totalRooms and writes a delete audit log entry (apps/api/src/routes/rooms.ts:651-693). It is a soft delete: the room row stays. It sends no notification: the residents who live there are not told that their room is out of service.',
      mismatchSurfacedAt:
        'the floors page shows the room count and the room no longer appears in the lists a new resident is picked from',
      provenance: {
        auditAction: 'delete',
        screen: '/rooms/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the room was retired while a resident was still in it, so occupancy and the floor count disagree',
      runbook3am:
        'open /rooms?isActive=false and check the tenants still pointing at a retired room',
    },
    {
      action: 'Rebuild the bed map',
      operatorBelieves: 'the beds match the tenant records again',
      serverCommits:
        'POST /rooms/reconcile-occupancy rebuilds the beds array from the active tenant records, reports the fixed rooms, the freed beds, the conflicts and the orphans, and writes a reconcile audit log entry (apps/api/src/routes/rooms.ts:345-365, apps/api/src/services/occupancy-reconcile.service.ts:62-219). The same service reports the drift without writing it when it is called with a dry run, which is what the office reads before it applies anything (apps/api/src/routes/rooms.ts:339-342). It tells nobody.',
      mismatchSurfacedAt:
        'the reconcile report lists every room it fixed and every conflict it could not resolve',
      provenance: {
        auditAction: 'reconcile',
        screen: '/rooms',
        actor: 'admin',
      },
      stuckStateMeans:
        'the reconcile report lists conflicts, so two records claim the same bed and the map cannot be trusted',
      runbook3am: 'open /rooms, run the check on the bed map, and work the conflicts it reports',
    },
    {
      action: 'Read the beds of the building and who holds them',
      operatorBelieves:
        'the numbers on the screen are the numbers of the rooms they are looking at',
      serverCommits:
        'GET /rooms reads the filters of the address bar (floor, sharing type, active flag, room number), returns the rooms with the name of the resident of every bed, and returns the statistics of the WHOLE filtered set, not of the page (apps/api/src/routes/rooms.ts:214-335). The server serves at most 100 rooms in one page (apps/api/src/lib/routeUtils.ts:16), and it cannot filter on a free bed, so a free bed filter narrows the rooms on the screen and nothing else.',
      mismatchSurfacedAt:
        'the band of the rooms list names the scope of every number, and the legend says what a free bed filter really does',
      provenance: {
        screen: '/rooms',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bed map of the screen and the statistics of the band cover different sets, so the free bed count and the rows do not agree',
      runbook3am:
        'open /rooms, read the address bar, and compare the free bed count with the bed map of the rooms on screen',
    },
  ],
  layout: {
    archetype: 'floor-map',
    grammarTokens: [
      'DataTable',
      'PageBand',
      'StatusTabs',
      'FilterChips',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'DetailCard',
      'ContentFrame',
      'BedOccupancyGrid',
      'FloorServiceGrid',
      'FormPage',
      'FormCard',
    ],
    mustNotLookLike:
      'a roster of people: a room row is a set of beds with a shape, and the map of the beds is what has to be readable at a glance',
    ownNumber:
      'the free beds of the set the server reports for the filters in the address bar, with the beds taken beside it',
  },
  nextBestAction: {
    perStatus: {
      operational: {
        label: 'Open the room',
        target: '/rooms/[id]',
      },
      degraded: {
        label: 'Fix or replace it',
        target: '/rooms/[id]/edit',
        enabledWhen: 'the amenity is still degraded',
      },
      down: {
        label: 'Tell the floor',
        target: '/rooms/[id]/edit',
        enabledWhen: 'the amenity is still down',
      },
      free_in_service: {
        label: 'Put a resident in it',
        target: '/rooms/[id]',
        enabledWhen: 'the room is in service and no bed of it holds a resident',
      },
      part_taken_in_service: {
        label: 'Fill the free bed',
        target: '/rooms/[id]',
        enabledWhen: 'the room is in service and at least one of its beds is free',
      },
      full_in_service: {
        label: 'Open the room',
        target: '/rooms/[id]',
        enabledWhen: 'every bed of the room holds a resident',
      },
      out_of_service: {
        label: 'Put the room back in service',
        target: '/rooms/[id]/edit',
        enabledWhen: 'the active flag of the room is false',
      },
    },
    perEmptyState: {
      rooms: {
        label: 'Add a room',
        target: '/rooms/new',
      },
      no_free_bed: {
        label: 'Open the floor map',
        target: '/rooms',
      },
      no_active_rooms: {
        label: 'Open the floors',
        target: '/floors',
      },
    },
  },
};
