import type { ModuleContract } from './module';

/**
 * The rooms contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - the model: apps/api/src/models/room.ts
 * - routes: apps/api/src/routes/rooms.ts
 * - the bed rebuild on a sharing type change: apps/api/src/routes/rooms.ts:84-123
 * - the occupancy reconcile: apps/api/src/routes/rooms.ts:342-368
 * - the admin screens: apps/web/src/app/(admin)/rooms
 *
 * THE ROOM MODEL HAS NO ROOM LEVEL STATUS. Its only status enum is the one on
 * the amenity subdocument (apps/api/src/models/room.ts:60-65), so that is the
 * grid this contract declares. The room own lifecycle is isActive plus the
 * per bed isOccupied flag, and both are written by the routes below.
 */
export const ROOMS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the bed map true: who sleeps in which bed, what each room costs, and which amenity in the room is broken',
    doneLooksLike:
      'every bed in every room is either taken by a named resident or marked free, and every amenity in a room reads operational, degraded or down',
    primaryAction: 'Fix the bed map or the amenity state of a room',
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
            'an admin writes the amenity list of the room; every amenity carries its own status (apps/api/src/routes/rooms.ts:23-47, :512-543)',
        },
      },
      {
        // The amenity works badly.
        status: 'degraded',
        enteredBy: {
          method: 'PUT',
          path: '/rooms/:id',
          condition: 'an admin marks an amenity of the room as degraded',
        },
      },
      {
        // The amenity does not work.
        status: 'down',
        enteredBy: {
          method: 'PUT',
          path: '/rooms/:id',
          condition: 'an admin marks an amenity of the room as down',
        },
      },
    ],
    // The room own lifecycle is not in this enum: isActive is the room flag and
    // beds[].isOccupied is the bed flag (apps/api/src/models/room.ts:96-122).
  },
  truthContract: [
    {
      action: 'Mark an amenity of a room as degraded or down',
      operatorBelieves: 'the residents of that room know their geyser or their wifi is broken',
      serverCommits:
        'PUT /rooms/:id writes the amenity list, recomputes the floor room count when the room or the active flag moved, and writes an update audit log entry with the changed fields (apps/api/src/routes/rooms.ts:610-652). It then compares the amenity list before and after the write and pushes a service_update notification to the active residents of that room for every amenity whose status actually moved (apps/api/src/routes/rooms.ts:160-210, :643-652). A room with nobody in it has nobody to tell, so nothing is sent and the reason is logged. A failed push never undoes the room write.',
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
      action: 'Change the sharing type of a room',
      operatorBelieves: 'the beds were repacked and everybody still has a bed',
      serverCommits:
        'PUT /rooms/:id rebuilds the beds array for the new sharing type, keeps the occupied beds packed into the first slots, refuses a downsize while beds are occupied (BEDS_OCCUPIED_ON_DOWNSIZE), moves the tenants that had to shift and writes an update audit log entry with the old and the new sharing type (apps/api/src/routes/rooms.ts:84-123, :493-608). The bed move itself is never announced: the only notification on that path is the amenity one, and it fires only when an amenity status changed with the same write (apps/api/src/routes/rooms.ts:578-588).',
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
      action: 'Retire a room',
      operatorBelieves: 'the room is out of service and the floor count is right',
      serverCommits:
        'DELETE /rooms/:id refuses while active tenants still occupy the room (ACTIVE_TENANTS), then sets isActive=false, recomputes Floor.totalRooms and writes a delete audit log entry (apps/api/src/routes/rooms.ts:654-690). It is a soft delete: the room row stays. It sends no notification: the residents who live there are not told that their room is out of service.',
      mismatchSurfacedAt:
        'the floors page shows the room count and the room no longer appears as active',
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
      action: 'Reconcile the bed map',
      operatorBelieves: 'the beds match the tenant records again',
      serverCommits:
        'POST /rooms/reconcile-occupancy rebuilds the beds array from the active tenant records, reports the fixed rooms, the freed beds, the conflicts and the orphans, and writes a reconcile audit log entry (apps/api/src/routes/rooms.ts:348-368).',
      mismatchSurfacedAt:
        'the reconcile report lists every room it fixed and every conflict it could not resolve',
      provenance: {
        auditAction: 'reconcile',
        screen: '/rooms',
        actor: 'admin',
      },
      stuckStateMeans:
        'the reconcile report lists conflicts, so two records claim the same bed and the map cannot be trusted',
      runbook3am: 'open /rooms, run the reconcile, and work the conflicts it reports',
    },
  ],
  layout: {
    archetype: 'floor-map',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'BedOccupancyGrid',
      'OccupancyRing',
      'ServiceStatusIndicator',
    ],
    mustNotLookLike:
      'a roster: a room row is a set of beds with a shape, and the map of beds is what has to be readable',
    ownNumber: 'beds occupied in this room',
  },
  nextBestAction: {
    perStatus: {
      operational: {
        label: 'Open the room',
        target: '/rooms/[id]',
      },
      degraded: {
        label: 'Fix or replace it',
        target: '/rooms/[id]',
        enabledWhen: 'the amenity is still degraded',
      },
      down: {
        label: 'Tell the floor',
        target: '/rooms/[id]',
      },
    },
    perEmptyState: {
      rooms: {
        label: 'Add a room',
        target: '/rooms/new',
      },
      no_active_rooms: {
        label: 'Open the floors',
        target: '/floors',
      },
    },
  },
};
