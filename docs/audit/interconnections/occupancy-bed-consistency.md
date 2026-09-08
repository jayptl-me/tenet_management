# Interconnection: Occupancy and Bed Consistency

**Last verified:** 2026-09-07 UTC (source re-verified; reconcile tooling added)

## Diagnosis (2026-09-07): why rooms show Available while tenants are assigned

| #   | Finding                                                                                                                                                                                                                  | Proof                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 1   | Single MongoDB; no demo-vs-real split. Sample seed links beds correctly in current code (`room.beds[i].isOccupied=true`, `tenantId`, `save()`).                                                                          | `apps/api/src/scripts/seed.ts` lines 246-249                                |
| 2   | Two UI truth sources diverge on drift: tenants list reads Tenant-side (`tenant.roomId`), rooms matrix reads Room-side (`beds[].isOccupied`). Any drift shows assignment on one page and Available + Assign on the other. | `tenants/page.tsx` vs `BedOccupancyGrid.tsx` + `GET /rooms`                 |
| 3   | Seed is insert-only with no wipe and no re-run guard (pre-fix): re-running sample seed crashed on duplicate floors, inviting manual DB patches; DBs seeded by older code were never backfilled.                          | `seed.ts` `seed()` / `seedSampleData` (guard added, see Remediation log)    |
| 4   | All live API mutation paths are transaction-safe in current code; drift only enters out-of-band (old code, manual edits, imports). No detector or repair tool existed pre-fix.                                           | `tenants.ts` POST/PUT/checkout/reinstate/DELETE, `rooms.ts` sharing rebuild |
| 5   | Stale doc claims (fixed in code, not in docs): partial unique bed index exists; transfer is session-atomic.                                                                                                              | `tenant.ts` `unique_active_room_bed`; `tenants.ts` PUT                      |

## Flow diagram or steps (ASCII ok)

```
Invariants (must hold after every mutation):
  1. bed.isOccupied === true  <=>  bed.tenantId != null
  2. Room.occupancyCount === count(beds where isOccupied)
  3. Active Tenant.roomId/bedId points at bed with matching tenantId + isOccupied
  4. At most one active tenant per physical bed (enforced by `unique_active_room_bed`
     partial unique index on { roomId, bedId } where isActive; 11000 maps to 409
     BED_OCCUPIED on create/transfer/reinstate)

Mutation paths:
  Tenant create     -> claim bed in session
  PUT transfer      -> validate free -> free old -> claim new (session)
  PUT bed swap      -> same room, free old -> claim new (session)
  Checkout          -> free bed (session)
  Reinstate         -> claim if free (session)
  Tenant delete     -> free bed (session cascade)
  Room sharingType  -> rebuildBedsForSharingType + pack remaps + Tenant.bedId sync
  Room soft-delete  -> block if active tenants; isActive false; recompute Floor.totalRooms
  Reconcile         -> rebuild all beds[] from active tenants; report conflicts/orphans
                      (GET dry-run / POST apply on /rooms/reconcile-occupancy, admin only)
```

## Code paths (source files)

| Concern                                                        | Path                                                                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Room model, beds subdoc, pre-save occupancyCount, generateBeds | `apps/api/src/models/room.ts`                                                                                                                   |
| rebuildBedsForSharingType + PUT sharingType + DELETE soft      | `apps/api/src/routes/rooms.ts`                                                                                                                  |
| Reconcile dry-run/apply (beds rebuilt from active tenants)     | `apps/api/src/services/occupancy-reconcile.service.ts` + `GET/POST /rooms/reconcile-occupancy` in `apps/api/src/routes/rooms.ts`                |
| Reconcile trigger + conflict/orphan report UI                  | Reconcile button + result panel in `apps/web/src/app/(admin)/rooms/page.tsx`                                                                    |
| Tenant lifecycle bed mutations                                 | `apps/api/src/routes/tenants.ts`                                                                                                                |
| Tenant indexes                                                 | `apps/api/src/models/tenant.ts` (`unique_active_room_bed` partial unique on { roomId, bedId } where isActive)                                   |
| Audit reconcile action                                         | `reconcile` in `apps/api/src/lib/write-audit-log.ts` + `apps/api/src/models/auditLog.ts` enum                                                   |
| Sample seed bed linkage + re-run guard                         | `apps/api/src/scripts/seed.ts` (links beds on seed; skips when collections populated)                                                           |
| Floor.totalRooms sync                                          | room model post-save / post-delete; soft-delete path in rooms.ts                                                                                |
| Unit / integration tests                                       | `apps/api/src/__tests__/beds.test.ts`, `tenant-transfer.test.ts`, `rooms.test.ts`, `module-http-e2e.test.ts`                                    |
| Admin create/edit bed UI                                       | tenants new OccupancyBedPicker; edit filtered Select; rooms detail                                                                              |
| Related                                                        | `docs/audit/interconnections/tenant-lifecycle.md`, `docs/audit/features/rooms.md`, `docs/audit/features/tenants_audit_pass1_20260907-230647.md` |

### rebuildBedsForSharingType (rooms.ts)

- Packs occupied beds into slots A..N for new sharing type (2/3/4).
- Throws `BEDS_OCCUPIED_ON_DOWNSIZE` if occupied count > new type.
- Returns remaps when tenant must move slot (e.g. C occupied on 3->2 packs to A).
- Applied via atomic `findOneAndUpdate({ _id, sharingType: old })` to guard concurrent sharingType edits; then `Tenant.findByIdAndUpdate` for each remap.

### Floor.totalRooms

- Model `post('save')` and `post('findOneAndDelete')` recompute active room count.
- Soft-delete uses `findByIdAndUpdate({ isActive: false })` which **skips** document middleware; route **explicitly** recomputes `Floor.totalRooms` after soft-delete (verified in rooms.ts DELETE).

### Mutation matrix

| Path                | File            | Bed handling                                       | Atomic?                                                 |
| ------------------- | --------------- | -------------------------------------------------- | ------------------------------------------------------- |
| Tenant create       | tenants.ts POST | set occupied + tenantId; occupancyCount            | Session txn; still RMW check-then-set (race under load) |
| Tenant PUT transfer | tenants.ts      | validate free first, free old, claim new           | Session **yes** (fixed)                                 |
| Tenant PUT bed swap | tenants.ts      | same room free+claim                               | Session **yes**                                         |
| Checkout            | tenants.ts      | free bed                                           | Session **yes**                                         |
| Reinstate           | tenants.ts      | reclaim if free else 409                           | Session **yes**                                         |
| Tenant delete       | tenants.ts      | free bed                                           | Session cascade **yes**                                 |
| Room sharingType    | rooms.ts        | rebuild + remaps                                   | findOneAndUpdate concurrent guard                       |
| Room soft-delete    | rooms.ts        | blocked if active tenants; beds left as historical | Soft; Floor.totalRooms recomputed                       |

## What works

- Pre-save on Room derives `occupancyCount` from `beds.isOccupied`.
- Create / checkout / reinstate / delete / transfer / swap all update beds and occupancyCount.
- Transfer no longer frees old bed before validating new (validate-first + session).
- Downsize blocked with `BEDS_OCCUPIED_ON_DOWNSIZE` 409 when occupied > new type.
- Soft-delete room blocked with `ACTIVE_TENANTS` when active occupants remain.
- Soft-delete recomputes Floor.totalRooms (explicit path).
- Tests cover create, checkout free, delete free, transfer, bed swap, sharingType preserve, occupancyCount equality.
- `unique_active_room_bed` partial unique index backs all claims (11000 maps to 409 BED_OCCUPIED).
- Reconcile endpoint + rooms UI repairs any out-of-band drift and reports conflicts/orphans/invalid rooms.

## Gaps / half-baked

| Severity | Gap                                                                                                              | Proof                                                                                   | Status                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P1       | ~~No partial unique index on active tenant `(roomId, bedId)`~~ — index exists; claim is stale                    | `tenant.ts` `unique_active_room_bed`; 11000 mapped to 409 in tenants POST/PUT/reinstate | FIXED (was stale doc, code already correct)                          |
| P2       | No shared `claimBed` / `releaseBed` helpers using atomic array filters (`beds.elemMatch` update)                 | Duplicated RMW logic across tenants.ts paths (session-guarded; index-backed)            | RESIDUAL hardening, not a live break                                 |
| P2       | Historical inactive tenants may still point at beds after room soft-delete (beds not cleared)                    | Soft-delete only sets room.isActive false                                               | OPEN (report-only; reconcile frees beds claimed by inactive tenants) |
| P2       | Reinstate / transfer still check-then-set inside session; without unique index, theoretical race across sessions | Superseded: partial unique index + 11000 mapping closes the race                        | FIXED (was stale doc, code already correct)                          |

**Obsolete:** claim that PUT transfer has no session / free-before-validate (fixed). Floor soft-delete without totalRooms recompute (fixed).

## Acceptance for fix agents

- [x] Create two tenants same bed sequential -- second 400 `BED_OCCUPIED`
- [x] Transfer A->B frees A; occupies B
- [x] Checkout frees bed; reinstate reclaims; reinstate when bed taken fails 409
- [x] Delete frees bed
- [x] sharingType downsize with too many occupants fails with `BEDS_OCCUPIED_ON_DOWNSIZE`
- [x] Soft-delete room with active tenants fails; Floor.totalRooms updated when allowed
- [x] Concurrent create stress: no double occupancy (`unique_active_room_bed` partial index + 11000 to 409)
- [ ] Shared claimBed/releaseBed used by all tenant paths (residual hardening)
- [x] Reconcile repairs drift: dry-run report + apply with conflicts/orphans/invalidRooms (`GET/POST /rooms/reconcile-occupancy` + rooms page Reconcile button)
- [x] Seed re-run guard skips sample data when collections are populated (no duplicate-key half-states)

## Remediation log

| Date         | Change                                                                                                                                                         | Status      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| historical   | Transfer non-atomic; isActive toggle left orphan occupied beds                                                                                                 | Open then   |
| ~2026-07-12+ | Transfer/swap in session; isActive free toggle removed; Floor recompute on soft-delete; rebuildBeds remaps                                                     | **Fixed**   |
| 2026-07-16   | Re-verified rooms.ts + tenants.ts + models; residual race uniqueness P1                                                                                        | Docs synced |
| 2026-09-07   | Reconcile service + admin routes + rooms UI trigger; seed re-run guard; audit `reconcile` action; stale P1 index claims corrected (code already had the index) | **Fixed**   |
