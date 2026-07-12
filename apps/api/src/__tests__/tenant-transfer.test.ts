/**
 * Tenant Transfer Atomicity Tests (P0-T1).
 *
 * Verifies that the room/bed transfer logic validates the target bed is free
 * BEFORE freeing the old bed. When the target is occupied, the old bed must
 * remain occupied (transaction rolls back). On success, both rooms are updated
 * atomically within a single transaction.
 *
 * Pattern follows beds.test.ts — model-level integration tests using
 * session.withTransaction to mirror the PUT /:id handler logic.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { User } from '../models/user.js';
import { Floor } from '../models/floor.js';
import { AppError } from '../lib/routeUtils.js';
import type { IBedSubdoc } from '../models/room.js';

type AnyDoc = Record<string, unknown>;

const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

let counter = 0;

async function seedFloorAndRoom(sharing: 2 | 3 | 4 = 2) {
  counter += 1;
  const floor = await floorCreate({ floorNumber: 100 + counter, label: `Transfer Floor ${counter}`, totalRooms: 1 });
  const fn = `T${counter}${Date.now().toString().slice(-4)}`;
  const room = await roomCreate({
    roomNumber: fn,
    floorId: floor._id,
    sharingType: sharing,
    monthlyRent: 8000,
    beds: Room.generateBeds(sharing),
  });
  const fullRoom = await Room.findById(room._id as string);
  if (!fullRoom) throw new Error('seed room failed');
  return { room: fullRoom };
}

async function seedUserAndTenant(
  roomIdStr: string,
  bedId: string,
  overrides: AnyDoc = {},
) {
  const suffix = `${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
  const e = `tx-${suffix}@example.com`;
  const p = `+91999${String(Date.now()).slice(-6)}${counter}`;
  const user = await userCreate({
    name: 'Transfer Tenant',
    email: e,
    phone: p,
    passwordHash: 'dummyhash',
    role: 'tenant',
    isActive: true,
  });
  const tenant = await tenantCreate({
    userId: user._id,
    roomId: roomIdStr,
    bedId,
    moveInDate: new Date('2026-06-01'),
    monthlyRent: 8000,
    isActive: true,
    ...overrides,
  });
  const fullTenant = await Tenant.findById(tenant._id as string);
  if (!fullTenant) throw new Error('seed tenant failed');
  return { tenant: fullTenant };
}

/** Occupy a bed in a room and persist. */
async function occupyBed(
  roomId: string,
  bedId: string,
  tenantId: mongoose.Types.ObjectId,
) {
  const room = await Room.findById(roomId);
  if (!room) return;
  const bed = room.beds.find((b) => b.bedId === bedId);
  if (bed) {
    bed.isOccupied = true;
    bed.tenantId = tenantId as unknown as mongoose.Schema.Types.ObjectId;
  }
  room.occupancyCount = room.beds.filter((b) => b.isOccupied).length;
  await room.save();
}

function getBed(room: { beds: IBedSubdoc[] } | null, bedId: string): IBedSubdoc | undefined {
  return (room?.beds as IBedSubdoc[] | undefined)?.find((b) => b.bedId === bedId);
}

describe('Tenant Transfer Atomicity (P0-T1)', () => {
  // Test 1: Transfer to an occupied bed — old bed must remain occupied
  it('cross-room transfer to occupied bed throws 409 and leaves old bed occupied', async () => {
    const { room: room1 } = await seedFloorAndRoom(2);
    const { room: room2 } = await seedFloorAndRoom(2);
    const { tenant: tenant1 } = await seedUserAndTenant(room1.id, 'A');
    const { tenant: tenant2 } = await seedUserAndTenant(room2.id, 'A');

    // Occupy beds for both tenants
    await occupyBed(room1.id, 'A', tenant1._id as unknown as mongoose.Types.ObjectId);
    await occupyBed(room2.id, 'A', tenant2._id as unknown as mongoose.Types.ObjectId);

    const session = await mongoose.startSession();
    let threw = false;
    let thrownError: unknown = null;

    try {
      await session.withTransaction(async () => {
        const sessionTenant = await Tenant.findById(tenant1.id).session(session);
        if (!sessionTenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

        // Load target room inside transaction
        const newRoom = await Room.findById(room2.id).session(session);
        if (!newRoom) throw new AppError('Room vanished', 500, 'ROOM_VANISHED');

        const newBedId = 'A';
        const newBed = newRoom.beds.find((b) => b.bedId === newBedId);
        if (!newBed) throw new AppError('Bed disappeared', 500, 'BED_VANISHED');

        // P0-T1 fix: validate target bed is free BEFORE freeing old bed
        if (newBed.isOccupied && String(newBed.tenantId ?? '') !== String(sessionTenant._id)) {
          throw new AppError('Bed is already occupied', 409, 'BED_OCCUPIED');
        }

        // This code path should NOT be reached when the bed is occupied
        const oldRoom = await Room.findById(sessionTenant.roomId).session(session);
        if (oldRoom) {
          const oldBed = oldRoom.beds.find((b) => b.bedId === sessionTenant.bedId);
          if (oldBed) {
            oldBed.isOccupied = false;
            oldBed.tenantId = null;
          }
          oldRoom.occupancyCount = oldRoom.beds.filter((b) => b.isOccupied).length;
          await oldRoom.save({ session });
        }
      });
    } catch (err) {
      threw = true;
      thrownError = err;
    } finally {
      session.endSession();
    }

    // The transaction should have thrown
    expect(threw).toBe(true);
    expect(thrownError).toBeInstanceOf(AppError);
    const appErr = thrownError as AppError;
    expect(appErr.code).toBe('BED_OCCUPIED');
    expect(appErr.status).toBe(409);

    // Old bed in room 1 must STILL be occupied (not freed)
    const finalRoom1 = await Room.findById(room1.id).lean();
    const oldBed = getBed(finalRoom1 as { beds: IBedSubdoc[] } | null, 'A');
    expect(oldBed?.isOccupied).toBe(true);
    expect(finalRoom1?.occupancyCount).toBe(1);

    // Target bed in room 2 must still be occupied by tenant2
    const finalRoom2 = await Room.findById(room2.id).lean();
    const targetBed = getBed(finalRoom2 as { beds: IBedSubdoc[] } | null, 'A');
    expect(targetBed?.isOccupied).toBe(true);
    expect(finalRoom2?.occupancyCount).toBe(1);
  });

  // Test 2: Same-room bed swap to occupied bed — old bed remains occupied
  it('same-room bed swap to occupied bed throws 409 and leaves old bed occupied', async () => {
    const { room } = await seedFloorAndRoom(3);
    const { tenant: tenant1 } = await seedUserAndTenant(room.id, 'A');
    const { tenant: tenant2 } = await seedUserAndTenant(room.id, 'B');

    await occupyBed(room.id, 'A', tenant1._id as unknown as mongoose.Types.ObjectId);
    await occupyBed(room.id, 'B', tenant2._id as unknown as mongoose.Types.ObjectId);

    const session = await mongoose.startSession();
    let threw = false;
    let thrownError: unknown = null;

    try {
      await session.withTransaction(async () => {
        const sessionTenant = await Tenant.findById(tenant1.id).session(session);
        if (!sessionTenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

        const currentRoom = await Room.findById(sessionTenant.roomId).session(session);
        if (!currentRoom) throw new AppError('Room vanished', 500, 'ROOM_VANISHED');

        // P0-T1 fix: validate target bed is free BEFORE freeing old bed
        const targetBed = currentRoom.beds.find((b) => b.bedId === 'B');
        if (!targetBed) throw new AppError('Bed disappeared', 500, 'BED_VANISHED');
        if (targetBed.isOccupied && String(targetBed.tenantId ?? '') !== String(sessionTenant._id)) {
          throw new AppError('Bed is already occupied', 409, 'BED_OCCUPIED');
        }

        // This code path should NOT be reached when the bed is occupied
        const oldBed = currentRoom.beds.find((b) => b.bedId === sessionTenant.bedId);
        if (oldBed) {
          oldBed.isOccupied = false;
          oldBed.tenantId = null;
        }
      });
    } catch (err) {
      threw = true;
      thrownError = err;
    } finally {
      session.endSession();
    }

    expect(threw).toBe(true);
    const appErr = thrownError as AppError;
    expect(appErr.code).toBe('BED_OCCUPIED');
    expect(appErr.status).toBe(409);

    // Both beds must still be occupied
    const finalRoom = await Room.findById(room.id).lean();
    expect(getBed(finalRoom as { beds: IBedSubdoc[] } | null, 'A')?.isOccupied).toBe(true);
    expect(getBed(finalRoom as { beds: IBedSubdoc[] } | null, 'B')?.isOccupied).toBe(true);
    expect(finalRoom?.occupancyCount).toBe(2);
  });

  // Test 3: Successful cross-room transfer — old freed, new occupied atomically
  it('successful cross-room transfer frees old bed and occupies new bed atomically', async () => {
    const { room: room1 } = await seedFloorAndRoom(2);
    const { room: room2 } = await seedFloorAndRoom(3);
    const { tenant } = await seedUserAndTenant(room1.id, 'A');

    await occupyBed(room1.id, 'A', tenant._id as unknown as mongoose.Types.ObjectId);

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const sessionTenant = await Tenant.findById(tenant.id).session(session);
        if (!sessionTenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

        const newRoom = await Room.findById(room2.id).session(session);
        if (!newRoom) throw new AppError('Room vanished', 500, 'ROOM_VANISHED');

        const newBedId = 'C';
        const newBed = newRoom.beds.find((b) => b.bedId === newBedId);
        if (!newBed) throw new AppError('Bed disappeared', 500, 'BED_VANISHED');

        // Validate target bed is free BEFORE freeing old bed
        if (newBed.isOccupied && String(newBed.tenantId ?? '') !== String(sessionTenant._id)) {
          throw new AppError('Bed is already occupied', 409, 'BED_OCCUPIED');
        }

        // Free old bed
        const oldRoom = await Room.findById(sessionTenant.roomId).session(session);
        if (oldRoom) {
          const oldBed = oldRoom.beds.find((b) => b.bedId === sessionTenant.bedId);
          if (oldBed) {
            oldBed.isOccupied = false;
            oldBed.tenantId = null;
          }
          oldRoom.occupancyCount = oldRoom.beds.filter((b) => b.isOccupied).length;
          await oldRoom.save({ session });
        }

        // Occupy new bed
        newBed.isOccupied = true;
        newBed.tenantId = sessionTenant._id as unknown as mongoose.Schema.Types.ObjectId;
        newRoom.markModified('beds');
        newRoom.occupancyCount = newRoom.beds.filter((b) => b.isOccupied).length;
        await newRoom.save({ session });

        sessionTenant.roomId = newRoom._id as unknown as mongoose.Schema.Types.ObjectId;
        sessionTenant.bedId = newBedId;
        await sessionTenant.save({ session });
      });
    } finally {
      session.endSession();
    }

    // Old room: bed A freed
    const finalRoom1 = await Room.findById(room1.id).lean();
    expect(getBed(finalRoom1 as { beds: IBedSubdoc[] } | null, 'A')?.isOccupied).toBe(false);
    expect(finalRoom1?.occupancyCount).toBe(0);

    // New room: bed C occupied
    const finalRoom2 = await Room.findById(room2.id).lean();
    expect(getBed(finalRoom2 as { beds: IBedSubdoc[] } | null, 'C')?.isOccupied).toBe(true);
    expect(finalRoom2?.occupancyCount).toBe(1);

    // Tenant updated
    const finalTenant = await Tenant.findById(tenant.id).lean();
    expect(String(finalTenant?.roomId)).toBe(String(room2._id));
    expect(finalTenant?.bedId).toBe('C');
  });

  // Test 4: Successful same-room bed swap — old freed, new occupied atomically
  it('successful same-room bed swap frees old bed and occupies new bed atomically', async () => {
    const { room } = await seedFloorAndRoom(3);
    const { tenant } = await seedUserAndTenant(room.id, 'A');

    await occupyBed(room.id, 'A', tenant._id as unknown as mongoose.Types.ObjectId);

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const sessionTenant = await Tenant.findById(tenant.id).session(session);
        if (!sessionTenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

        const currentRoom = await Room.findById(sessionTenant.roomId).session(session);
        if (!currentRoom) throw new AppError('Room vanished', 500, 'ROOM_VANISHED');

        const targetBed = currentRoom.beds.find((b) => b.bedId === 'C');
        if (!targetBed) throw new AppError('Bed disappeared', 500, 'BED_VANISHED');
        if (targetBed.isOccupied && String(targetBed.tenantId ?? '') !== String(sessionTenant._id)) {
          throw new AppError('Bed is already occupied', 409, 'BED_OCCUPIED');
        }

        const oldBed = currentRoom.beds.find((b) => b.bedId === sessionTenant.bedId);
        if (oldBed) {
          oldBed.isOccupied = false;
          oldBed.tenantId = null;
        }
        targetBed.isOccupied = true;
        targetBed.tenantId = sessionTenant._id as unknown as mongoose.Schema.Types.ObjectId;
        currentRoom.occupancyCount = currentRoom.beds.filter((b) => b.isOccupied).length;
        await currentRoom.save({ session });

        sessionTenant.bedId = 'C';
        await sessionTenant.save({ session });
      });
    } finally {
      session.endSession();
    }

    const finalRoom = await Room.findById(room.id).lean();
    expect(getBed(finalRoom as { beds: IBedSubdoc[] } | null, 'A')?.isOccupied).toBe(false);
    expect(getBed(finalRoom as { beds: IBedSubdoc[] } | null, 'C')?.isOccupied).toBe(true);
    expect(finalRoom?.occupancyCount).toBe(1);

    const finalTenant = await Tenant.findById(tenant.id).lean();
    expect(finalTenant?.bedId).toBe('C');
  });
});
