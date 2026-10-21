import type { ModuleContract } from './module';

/**
 * The floors contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - the model: apps/api/src/models/floor.ts (no status field, see below)
 * - routes: apps/api/src/routes/floors.ts
 * - the create path and the service seeding: apps/api/src/routes/floors.ts:262-296
 * - the delete path and its cascade: apps/api/src/routes/floors.ts:336-386
 * - the admin screens: apps/web/src/app/(admin)/floors
 *
 * THE FLOOR MODEL HAS NO STATUS FIELD. A floor is a number, a label, the room
 * count that the room hooks keep in sync and the amenity counts. The state of
 * a floor is what hangs off it: the beds, the services and the machines.
 */
export const FLOORS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'holding the shape of the building: how many rooms each floor has, how many of them are full, and what is on that floor',
    doneLooksLike:
      'every floor shows the room count the rooms actually carry and the beds that are free, and the amenities of that floor are seeded',
    primaryAction: 'Set up a floor and its amenities',
  },
  stateMachine: {
    domain: 'floors',
    model: 'floor',
    kind: 'grid',
    // The floor model carries no status enum (apps/api/src/models/floor.ts).
    // The state of a floor is the state of what hangs off it:
    //   totalRooms    the room count, kept in sync by the room hooks
    //   amenityCounts what the floor has, per amenity key
    statuses: [],
  },
  truthContract: [
    {
      action: 'Add a floor',
      operatorBelieves: 'the floor exists with its rooms and its amenities',
      serverCommits:
        'POST /floors writes the floor with the number, the label and the declared room count, seeds a service status row for every per floor amenity definition and writes a create audit log entry (apps/api/src/routes/floors.ts:262-296). The room count on the floor is not what the operator typed later: the room hooks recount the active rooms on every room save and delete (apps/api/src/models/room.ts:162-180).',
      mismatchSurfacedAt:
        'the floors list shows the room count and the occupancy ring of that floor',
      provenance: {
        auditAction: 'create',
        screen: '/floors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the floor says it has rooms it does not have, so the occupancy ring and the rent roll disagree',
      runbook3am: 'open /floors, compare the room count with the rooms list of that floor',
    },
    {
      action: 'Delete a floor',
      operatorBelieves: 'the floor is gone and nothing that belonged to it is left behind',
      serverCommits:
        'DELETE /floors/:id refuses while active rooms (FLOOR_HAS_ROOMS) or washing machines (FLOOR_HAS_MACHINES) are still on the floor, then removes the floor and cascades the service status rows of that floor away, and writes a delete audit log entry (apps/api/src/routes/floors.ts:336-386). It is a hard delete: the floor row is gone.',
      mismatchSurfacedAt: 'the floors list no longer carries the floor',
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
        'POST /floors/reseed-services walks every floor and creates the service status rows that are missing for the per floor amenity keys, and reports how many floors it touched and how many rows it created (apps/api/src/routes/floors.ts:388-404). It is idempotent and it creates only the missing keys.',
      mismatchSurfacedAt: 'the response counts and the service board show the new rows',
      provenance: {
        screen: '/services',
        actor: 'admin',
      },
      stuckStateMeans:
        'an amenity definition was added and no floor has a status for it, so the service board is missing a column',
      runbook3am: 'open /floors and run the reseed, then check the service board again',
    },
  ],
  layout: {
    archetype: 'floor-map',
    grammarTokens: [
      'DataTable',
      'EmptyState',
      'PageHeader',
      'FloorCard',
      'BedMiniGrid',
      'OccupancyRing',
      'StatCard',
    ],
    mustNotLookLike:
      'a room table: a floor row is a level of the building with its own shape, and the ring of the floor is the number',
    ownNumber: 'beds free on this floor',
  },
  nextBestAction: {
    perStatus: {
      planned: {
        label: 'Open the floor',
        target: '/floors/[id]',
      },
      rooms_added: {
        label: 'Add a room',
        target: '/rooms/new',
      },
    },
    perEmptyState: {
      floors: {
        label: 'Add a floor',
        target: '/floors/new',
      },
      no_service_status: {
        label: 'Seed the floor services',
        target: '/services',
      },
    },
  },
};
