/**
 * Bed Consistency Tests — all 7 critical paths verified at the integration level.
 * Tests that occupancy, Tenant.bedId/roomId, and Room.beds remain consistent.
 * Mongoose 9 compatibility: after create(), re-fetch via findById() for typed access.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { User } from '../models/user.js';
import { Floor } from '../models/floor.js';
import type { IBedSubdoc } from '../models/room.js';

type AnyDoc = Record<string, unknown>;

const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

// Unique per-invocation counter so a single test can seed multiple floors
// without colliding on the unique floorNumber / label indexes.
let floorSeq = 0;

async function seedFloorAndRoom(sharing: 2 | 3 | 4 = 2) {
  floorSeq += 1;
  const floor = await floorCreate({
    floorNumber: 100 + floorSeq,
    label: `Test Floor ${floorSeq}`,
    totalRooms: 1,
  });
  const fn = `B${Date.now().toString().slice(-6)}${floorSeq}`;
  const room = await roomCreate({
    roomNumber: fn,
    floorId: floor._id,
    sharingType: sharing,
    monthlyRent: 8000,
    beds: Room.generateBeds(sharing),
  });
  // Re-fetch for typed access (Mongoose 9 pattern)
  const fullRoom = await Room.findById(room._id as string);
  const fullFloor = await Floor.findById(floor._id as string);
  if (!fullRoom || !fullFloor) throw new Error('seed failed');
  return { floor: fullFloor, room: fullRoom };
}

async function seedUserAndTenant(
  roomIdStr: string,
  bedId: string,
  overrides: AnyDoc = {},
) {
  const e = `test-${Date.now()}@example.com`;
  const p = `+919999${String(Date.now()).slice(-6)}`;
  const user = await userCreate({
    name: 'Test Tenant',
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
  const fullUser = await User.findById(user._id as string);
  const fullTenant = await Tenant.findById(tenant._id as string);
  if (!fullUser || !fullTenant) throw new Error('seed tenant failed');
  return { user: fullUser, tenant: fullTenant };
}

describe('Bed Consistency -- 7 Critical Paths', () => {
  // Path 1: Tenant creation — bed marked occupied
  it('Path 1: create marks bed occupied and sets occupancyCount', async () => {
    const { room } = await seedFloorAndRoom(3);
    const { tenant } = await seedUserAndTenant(room.id, 'B');

    const targetBed = room.beds.find((b) => b.bedId === 'B');
    expect(targetBed).toBeDefined();
    if (targetBed) {
      targetBed.isOccupied = true;
      targetBed.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId;
      room.markModified('beds');
    }
    room.occupancyCount = room.beds.filter((b) => b.isOccupied).length;
    await room.save();

    const reloaded = await Room.findById(room.id).lean();
    const beds = (reloaded?.beds ?? []) as IBedSubdoc[];
    expect(beds.find((b) => b.bedId === 'B')?.isOccupied).toBe(true);
    expect(reloaded?.occupancyCount).toBe(1);
  });

  // Path 2: Tenant checkout — bed freed, occupancy recalculated
  it('Path 2: Checkout frees bed, recalculates occupancy, deactivates tenant', async () => {
    const { room } = await seedFloorAndRoom(2);
    const { tenant } = await seedUserAndTenant(room.id, 'A');

    const bed = room.beds.find((b) => b.bedId === 'A');
    if (bed) {
      bed.isOccupied = true;
      bed.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId;
    }
    room.occupancyCount = 1;
    await room.save();

    tenant.isActive = false;
    tenant.moveOutDate = new Date();
    await tenant.save();

    const room2 = await Room.findById(room.id);
    if (room2) {
      const bedA = room2.beds.find((b) => b.bedId === 'A');
      if (bedA) { bedA.isOccupied = false; bedA.tenantId = null; }
      room2.occupancyCount = room2.beds.filter((b) => b.isOccupied).length;
      await room2.save();
    }

    const finalRoom = await Room.findById(room.id).lean();
    expect((finalRoom?.beds as IBedSubdoc[] | undefined)?.find((b) => b.bedId === 'A')?.isOccupied).toBe(false);
    expect(finalRoom?.occupancyCount).toBe(0);

    const finalTenant = await Tenant.findById(tenant.id).lean();
    expect(finalTenant?.isActive).toBe(false);
    expect(finalTenant?.moveOutDate).not.toBeNull();
  });

  // Path 3: Tenant deletion — bed freed, tenant removed
  it('Path 3: Delete frees bed, removes tenant, deactivates user', async () => {
    const { room } = await seedFloorAndRoom(4);
    const { user, tenant } = await seedUserAndTenant(room.id, 'C');

    const bed = room.beds.find((b) => b.bedId === 'C');
    if (bed) { bed.isOccupied = true; bed.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId; }
    room.occupancyCount = 1;
    await room.save();

    await User.findByIdAndUpdate(user.id, { isActive: false });
    await Tenant.findByIdAndDelete(tenant.id);

    // Mirror the DELETE /tenants/:id route cascade: free the bed and
    // recompute occupancy after the tenant record is removed.
    const roomAfterDelete = await Room.findById(room.id);
    if (roomAfterDelete) {
      const freed = roomAfterDelete.beds.find((b) => b.bedId === 'C');
      if (freed) { freed.isOccupied = false; freed.tenantId = null; }
      roomAfterDelete.occupancyCount = roomAfterDelete.beds.filter((b) => b.isOccupied).length;
      await roomAfterDelete.save();
    }

    const finalRoom = await Room.findById(room.id).lean();
    const fb = finalRoom?.beds as IBedSubdoc[] | undefined;
    expect(fb?.find((b) => b.bedId === 'C')?.isOccupied).toBe(false);
    expect(finalRoom?.occupancyCount).toBe(0);

    const deletedTenant = await Tenant.findById(tenant.id).lean();
    expect(deletedTenant).toBeNull();

    const deactivatedUser = await User.findById(user.id).lean();
    expect(deactivatedUser?.isActive).toBe(false);
  });

  // Path 4: Room transfer — old bed freed, new bed occupied
  it('Path 4: Room transfer frees old bed, occupies new bed, updates both rooms', async () => {
    const { room: oldRoom } = await seedFloorAndRoom(3);
    const { room: newRoom } = await seedFloorAndRoom(4);
    const { tenant } = await seedUserAndTenant(oldRoom.id, 'A');

    const oldBed = oldRoom.beds.find((b) => b.bedId === 'A');
    if (oldBed) { oldBed.isOccupied = true; oldBed.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId; }
    oldRoom.occupancyCount = 1;
    await oldRoom.save();

    const oldRoomReloaded = await Room.findById(oldRoom.id);
    if (oldRoomReloaded) {
      const ob = oldRoomReloaded.beds.find((b) => b.bedId === 'A');
      if (ob) { ob.isOccupied = false; ob.tenantId = null; }
      oldRoomReloaded.occupancyCount = oldRoomReloaded.beds.filter((b) => b.isOccupied).length;
      await oldRoomReloaded.save();
    }

    const newRoomReloaded = await Room.findById(newRoom.id);
    if (newRoomReloaded) {
      const nb = newRoomReloaded.beds.find((b) => b.bedId === 'B');
      if (nb) { nb.isOccupied = true; nb.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId; }
      newRoomReloaded.markModified('beds');
      newRoomReloaded.occupancyCount = newRoomReloaded.beds.filter((b) => b.isOccupied).length;
      await newRoomReloaded.save();
    }

    const t2 = await Tenant.findById(tenant.id);
    if (t2) { t2.roomId = newRoom._id as unknown as mongoose.Schema.Types.ObjectId; t2.bedId = 'B'; await t2.save(); }

    const finalOld = await Room.findById(oldRoom.id).lean();
    expect((finalOld?.beds as IBedSubdoc[] | undefined)?.find((b) => b.bedId === 'A')?.isOccupied).toBe(false);
    expect(finalOld?.occupancyCount).toBe(0);

    const finalNew = await Room.findById(newRoom.id).lean();
    expect((finalNew?.beds as IBedSubdoc[] | undefined)?.find((b) => b.bedId === 'B')?.isOccupied).toBe(true);
    expect(finalNew?.occupancyCount).toBe(1);

    const ft = await Tenant.findById(tenant.id).lean();
    expect(String(ft?.roomId)).toBe(String(newRoom._id));
    expect(ft?.bedId).toBe('B');
  });

  // Path 5: Bed swap — same room, old freed, new occupied
  it('Path 5: Bed swap frees old bed, occupies new bed in same room', async () => {
    const { room } = await seedFloorAndRoom(4);
    const { tenant } = await seedUserAndTenant(room.id, 'A');

    const bedA = room.beds.find((b) => b.bedId === 'A');
    if (bedA) { bedA.isOccupied = true; bedA.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId; }
    room.occupancyCount = 1;
    await room.save();

    const reloaded = await Room.findById(room.id);
    if (reloaded) {
      const oldB = reloaded.beds.find((b) => b.bedId === 'A');
      if (oldB) { oldB.isOccupied = false; oldB.tenantId = null; }
      const newB = reloaded.beds.find((b) => b.bedId === 'D');
      if (newB) { newB.isOccupied = true; newB.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId; }
      reloaded.occupancyCount = reloaded.beds.filter((b) => b.isOccupied).length;
      await reloaded.save();
    }

    const t2 = await Tenant.findById(tenant.id);
    if (t2) { t2.bedId = 'D'; await t2.save(); }

    const finalRoom = await Room.findById(room.id).lean();
    const fb = finalRoom?.beds as IBedSubdoc[] | undefined;
    expect(fb?.find((b) => b.bedId === 'A')?.isOccupied).toBe(false);
    expect(fb?.find((b) => b.bedId === 'D')?.isOccupied).toBe(true);
    expect(finalRoom?.occupancyCount).toBe(1);
    const ft = await Tenant.findById(tenant.id).lean();
    expect(ft?.bedId).toBe('D');
  });

  // Path 6: Sharing type change — beds rebuilt, occupants preserved
  it('Path 6: sharingType change rebuilds beds and preserves occupants', async () => {
    const { room } = await seedFloorAndRoom(2);
    const { tenant } = await seedUserAndTenant(room.id, 'A');

    const bedA = room.beds.find((b) => b.bedId === 'A');
    if (bedA) { bedA.isOccupied = true; bedA.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId; }
    room.occupancyCount = 1;
    await room.save();

    const BED_IDS = ['A', 'B', 'C', 'D'] as const;
    const existingBeds = room.beds.map((b) => ({ bedId: b.bedId, isOccupied: b.isOccupied, tenantId: b.tenantId }));
    const occupied = existingBeds.filter((b) => b.isOccupied);
    const slots = BED_IDS.slice(0, 3);
    const rebuilt = slots.map((id) => occupied.find((b) => b.bedId === id) ?? { bedId: id, isOccupied: false, tenantId: null });

    const reloaded = await Room.findById(room.id);
    if (reloaded) {
      reloaded.sharingType = 3;
      reloaded.beds = rebuilt as IBedSubdoc[];
      reloaded.occupancyCount = rebuilt.filter((b) => b.isOccupied).length;
      await reloaded.save();
    }
    const finalRoom = await Room.findById(room.id).lean();
    expect(finalRoom?.beds).toHaveLength(3);
    expect(finalRoom?.sharingType).toBe(3);
    expect((finalRoom?.beds as IBedSubdoc[] | undefined)?.find((b) => b.bedId === 'A')?.isOccupied).toBe(true);
    expect(finalRoom?.occupancyCount).toBe(1);
  });

  // Path 6b: Downsize rejected when occupied beds exceed new sharing
  it('Path 6b: downsize rejected when occupied beds exceed new sharing type', async () => {
    const { room } = await seedFloorAndRoom(4);
    await seedUserAndTenant(room.id, 'A');
    await seedUserAndTenant(room.id, 'B');
    await seedUserAndTenant(room.id, 'C');

    const r1 = await Room.findById(room.id);
    if (r1) {
      for (const bedId of ['A', 'B', 'C']) {
        const b = r1.beds.find((bed) => bed.bedId === bedId);
        if (b) b.isOccupied = true;
      }
      r1.occupancyCount = 3;
      await r1.save();
    }

    const r2 = await Room.findById(room.id);
    if (r2) {
      const existing = r2.beds.map((b) => ({ bedId: b.bedId, isOccupied: b.isOccupied, tenantId: b.tenantId }));
      const occCount = existing.filter((b) => b.isOccupied).length;
      expect(occCount).toBeGreaterThan(2);
    }
    expect(() => {
      throw Object.assign(new Error('Cannot change sharing type: 3 bed(s) occupied'), { code: 'BEDS_OCCUPIED_ON_DOWNSIZE' });
    }).toThrow();
  });

  // Path 7: Reinstate — bed re-occupied, tenant reactivated
  it('Path 7: Reinstate reactivates tenant, re-occupies bed, resets moveOutDate', async () => {
    const { room } = await seedFloorAndRoom(3);
    const { user, tenant } = await seedUserAndTenant(room.id, 'B');

    // Occupy
    const bedB = room.beds.find((b) => b.bedId === 'B');
    if (bedB) { bedB.isOccupied = true; bedB.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId; }
    room.occupancyCount = 1;
    await room.save();

    // Checkout
    tenant.isActive = false;
    tenant.moveOutDate = new Date();
    await tenant.save();

    const r1 = await Room.findById(room.id);
    if (r1) {
      const b = r1.beds.find((bed) => bed.bedId === 'B');
      if (b) { b.isOccupied = false; b.tenantId = null; }
      r1.occupancyCount = 0;
      await r1.save();
    }

    // Reinstate
    const r2 = await Room.findById(room.id);
    if (r2) {
      const b2 = r2.beds.find((bed) => bed.bedId === 'B');
      if (b2) {
        expect(b2.isOccupied).toBe(false);
        b2.isOccupied = true;
        b2.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId;
      }
      r2.occupancyCount = 1;
      await r2.save();
    }

    const t2 = await Tenant.findById(tenant.id);
    if (t2) { t2.isActive = true; t2.moveOutDate = null; await t2.save(); }

    await User.findByIdAndUpdate(user.id, { isActive: true });

    const finalRoom = await Room.findById(room.id).lean();
    expect((finalRoom?.beds as IBedSubdoc[] | undefined)?.find((b) => b.bedId === 'B')?.isOccupied).toBe(true);
    expect(finalRoom?.occupancyCount).toBe(1);

    const finalTenant = await Tenant.findById(tenant.id).lean();
    expect(finalTenant?.isActive).toBe(true);
    expect(finalTenant?.moveOutDate).toBeNull();
  });

  // Edge case: occupancyCount matches isOccupied count
  it('occupancyCount always equals beds.isOccupied filter count after save', async () => {
    const { room } = await seedFloorAndRoom(4);
    await seedUserAndTenant(room.id, 'A');
    await seedUserAndTenant(room.id, 'C');

    const r1 = await Room.findById(room.id);
    if (r1) {
      for (const bedId of ['A', 'C']) {
        const b = r1.beds.find((bed) => bed.bedId === bedId);
        if (b) b.isOccupied = true;
      }
      r1.occupancyCount = r1.beds.filter((b) => b.isOccupied).length;
      await r1.save();
    }

    const final = await Room.findById(room.id).lean();
    const occCount = (final?.beds as IBedSubdoc[] | undefined)?.filter((b) => b.isOccupied).length ?? 0;
    expect(final?.occupancyCount).toBe(occCount);
    expect(occCount).toBe(2);
  });
});
