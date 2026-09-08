import { Schema } from 'mongoose';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { safeFilter } from '../lib/routeUtils.js';
import { logger } from '../lib/logger.js';

export interface BedConflict {
  roomId: string;
  roomNumber: string;
  bedId: string;
  tenantIds: string[];
  tenantNames: string[];
  keptTenantId: string;
}

export interface TenantOrphan {
  tenantId: string;
  tenantName: string;
  roomId: string;
  bedId: string;
  reason: 'room_missing' | 'room_inactive' | 'bed_missing';
}

export interface InvalidRoom {
  roomId: string;
  roomNumber: string;
  sharingType: number;
  bedCount: number;
}

export interface ReconcileReport {
  dryRun: boolean;
  scannedRooms: number;
  scannedTenants: number;
  fixedRooms: number;
  occupiedBeds: number;
  freedBeds: number;
  conflicts: BedConflict[];
  orphans: TenantOrphan[];
  invalidRooms: InvalidRoom[];
}

interface ActiveTenantRow {
  _id: unknown;
  roomId: unknown;
  bedId: string;
  moveInDate?: Date | string;
  userId?: { _id?: unknown; name?: string } | unknown;
}

/**
 * Rebuild every room's beds[] from ground truth (active tenants) and report drift.
 *
 * Invariants restored per room:
 *   bed.isOccupied === true  <=>  bed.tenantId points at an active tenant
 *   occupancyCount === count(occupied beds)
 *   at most one active tenant per bed (conflicts keep earliest move-in, rest reported)
 * Tenants pointing at missing/inactive rooms or non-existent bed slots are
 * reported as orphans for manual transfer; rooms whose bed count mismatches
 * sharingType are reported as invalid (slots still rebuilt, never resized here).
 */
export async function reconcileOccupancy(dryRun: boolean): Promise<ReconcileReport> {
  const rooms = await Room.find(safeFilter({}));
  const tenants = (await Tenant.find(safeFilter({ isActive: true }))
    .populate({ path: 'userId', select: 'name' })
    .lean()) as unknown as ActiveTenantRow[];

  const roomById = new Map<string, (typeof rooms)[number]>();
  for (const room of rooms) roomById.set(String(room._id), room);

  const claims = new Map<string, ActiveTenantRow[]>();
  const orphans: TenantOrphan[] = [];
  for (const tenant of tenants) {
    const roomId = String(tenant.roomId ?? '');
    const room = roomById.get(roomId);
    const tenantId = String(tenant._id);
    const userDoc = tenant.userId as { name?: string } | undefined;
    const tenantName =
      userDoc && typeof userDoc === 'object' ? (userDoc.name ?? 'Unknown') : 'Unknown';
    if (!room) {
      orphans.push({
        tenantId,
        tenantName,
        roomId,
        bedId: tenant.bedId,
        reason: 'room_missing',
      });
      continue;
    }
    if (!room.isActive) {
      orphans.push({
        tenantId,
        tenantName,
        roomId,
        bedId: tenant.bedId,
        reason: 'room_inactive',
      });
      continue;
    }
    if (!room.beds.some((b) => b.bedId === tenant.bedId)) {
      orphans.push({
        tenantId,
        tenantName,
        roomId,
        bedId: tenant.bedId,
        reason: 'bed_missing',
      });
      continue;
    }
    const key = `${roomId}:${tenant.bedId}`;
    const list = claims.get(key) ?? [];
    list.push(tenant);
    claims.set(key, list);
  }

  const conflicts: BedConflict[] = [];
  const invalidRooms: InvalidRoom[] = [];
  let fixedRooms = 0;
  let occupiedBeds = 0;
  let freedBeds = 0;

  for (const room of rooms) {
    if (room.beds.length !== room.sharingType) {
      invalidRooms.push({
        roomId: String(room._id),
        roomNumber: room.roomNumber,
        sharingType: room.sharingType,
        bedCount: room.beds.length,
      });
    }

    let changed = false;
    for (const bed of room.beds) {
      const key = `${String(room._id)}:${bed.bedId}`;
      const list = claims.get(key) ?? [];
      if (list.length === 0) {
        if (bed.isOccupied || bed.tenantId) {
          freedBeds += 1;
          changed = true;
          if (!dryRun) {
            bed.isOccupied = false;
            bed.tenantId = null;
          }
        }
        continue;
      }
      const ordered = [...list].sort((a, b) => {
        const da = new Date(a.moveInDate ?? 0).getTime();
        const db = new Date(b.moveInDate ?? 0).getTime();
        if (da !== db) return da - db;
        return String(a._id).localeCompare(String(b._id));
      });
      const keeper = ordered[0]!;
      if (ordered.length > 1) {
        conflicts.push({
          roomId: String(room._id),
          roomNumber: room.roomNumber,
          bedId: bed.bedId,
          tenantIds: ordered.map((t) => String(t._id)),
          tenantNames: ordered.map((t) => {
            const u = t.userId as { name?: string } | undefined;
            return u && typeof u === 'object' ? (u.name ?? 'Unknown') : 'Unknown';
          }),
          keptTenantId: String(keeper._id),
        });
      }
      const keeperId = String(keeper._id);
      if (!bed.isOccupied || String(bed.tenantId ?? '') !== keeperId) {
        changed = true;
        if (!dryRun) {
          bed.isOccupied = true;
          bed.tenantId = keeper._id as unknown as Schema.Types.ObjectId;
        }
      }
      occupiedBeds += 1;
    }

    if (changed) {
      fixedRooms += 1;
      if (!dryRun) {
        room.occupancyCount = room.beds.filter((b) => b.isOccupied).length;
        await room.save();
      }
    }
  }

  const report: ReconcileReport = {
    dryRun,
    scannedRooms: rooms.length,
    scannedTenants: tenants.length,
    fixedRooms,
    occupiedBeds,
    freedBeds,
    conflicts,
    orphans,
    invalidRooms,
  };

  logger.info(
    { dryRun, fixedRooms, freedBeds, conflicts: conflicts.length, orphans: orphans.length },
    'Occupancy reconcile completed',
  );
  return report;
}
