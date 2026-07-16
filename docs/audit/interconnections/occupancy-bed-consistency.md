# Interconnection: Occupancy and Bed Consistency

**Last verified:** 2026-07-16

## Flow diagram or steps (ASCII ok)

```
Invariants (must hold after every mutation):
  1. bed.isOccupied === true  <=>  bed.tenantId != null
  2. Room.occupancyCount === count(beds where isOccupied)
  3. Active Tenant.roomId/bedId points at bed with matching tenantId + isOccupied
  4. At most one active tenant per physical bed (enforced in app; DB index not unique)

Mutation paths:
  Tenant create     -> claim bed in session
  PUT transfer      -> validate free -> free old -> claim new (session)
  PUT bed swap      -> same room, free old -> claim new (session)
  Checkout          -> free bed (session)
  Reinstate         -> claim if free (session)
  Tenant delete     -> free bed (session cascade)
  Room sharingType  -> rebuildBedsForSharingType + pack remaps + Tenant.bedId sync
  Room soft-delete  -> block if active tenants; isActive false; recompute Floor.totalRooms
```

## Code paths (source files)

| Concern | Path |
|---------|------|
| Room model, beds subdoc, pre-save occupancyCount, generateBeds | `apps/api/src/models/room.ts` |
| rebuildBedsForSharingType + PUT sharingType + DELETE soft | `apps/api/src/routes/rooms.ts` |
| Tenant lifecycle bed mutations | `apps/api/src/routes/tenants.ts` |
| Tenant indexes | `apps/api/src/models/tenant.ts` (`{ roomId, bedId, isActive }` non-unique) |
| Floor.totalRooms sync | room model post-save / post-delete; soft-delete path in rooms.ts |
| Unit / integration tests | `apps/api/src/__tests__/beds.test.ts`, `tenant-transfer.test.ts`, `rooms.test.ts`, `module-http-e2e.test.ts` |
| Admin create/edit bed UI | tenants new OccupancyBedPicker; edit filtered Select; rooms detail |
| Related | `docs/audit/interconnections/tenant-lifecycle.md`, `docs/audit/features/rooms.md`, `docs/audit/features/tenants.md` |

### rebuildBedsForSharingType (rooms.ts)

- Packs occupied beds into slots A..N for new sharing type (2/3/4).
- Throws `BEDS_OCCUPIED_ON_DOWNSIZE` if occupied count > new type.
- Returns remaps when tenant must move slot (e.g. C occupied on 3->2 packs to A).
- Applied via atomic `findOneAndUpdate({ _id, sharingType: old })` to guard concurrent sharingType edits; then `Tenant.findByIdAndUpdate` for each remap.

### Floor.totalRooms

- Model `post('save')` and `post('findOneAndDelete')` recompute active room count.
- Soft-delete uses `findByIdAndUpdate({ isActive: false })` which **skips** document middleware; route **explicitly** recomputes `Floor.totalRooms` after soft-delete (verified in rooms.ts DELETE).

### Mutation matrix

| Path | File | Bed handling | Atomic? |
|------|------|--------------|---------|
| Tenant create | tenants.ts POST | set occupied + tenantId; occupancyCount | Session txn; still RMW check-then-set (race under load) |
| Tenant PUT transfer | tenants.ts | validate free first, free old, claim new | Session **yes** (fixed) |
| Tenant PUT bed swap | tenants.ts | same room free+claim | Session **yes** |
| Checkout | tenants.ts | free bed | Session **yes** |
| Reinstate | tenants.ts | reclaim if free else 409 | Session **yes** |
| Tenant delete | tenants.ts | free bed | Session cascade **yes** |
| Room sharingType | rooms.ts | rebuild + remaps | findOneAndUpdate concurrent guard |
| Room soft-delete | rooms.ts | blocked if active tenants; beds left as historical | Soft; Floor.totalRooms recomputed |

## What works

- Pre-save on Room derives `occupancyCount` from `beds.isOccupied`.
- Create / checkout / reinstate / delete / transfer / swap all update beds and occupancyCount.
- Transfer no longer frees old bed before validating new (validate-first + session).
- Downsize blocked with `BEDS_OCCUPIED_ON_DOWNSIZE` 409 when occupied > new type.
- Soft-delete room blocked with `ACTIVE_TENANTS` when active occupants remain.
- Soft-delete recomputes Floor.totalRooms (explicit path).
- Tests cover create, checkout free, delete free, transfer, bed swap, sharingType preserve, occupancyCount equality.

## Gaps / half-baked

| Severity | Gap | Proof |
|----------|-----|-------|
| P1 | No partial unique index on active tenant `(roomId, bedId)` — two concurrent POSTs can still double-book under race | `tenant.ts` index non-unique; claim is read-modify-write on Room document |
| P1 | No shared `claimBed` / `releaseBed` helpers using atomic array filters (`beds.elemMatch` update) | Duplicated RMW logic across tenants.ts paths |
| P2 | Historical inactive tenants may still point at beds after room soft-delete (beds not cleared) | Soft-delete only sets room.isActive false |
| P2 | Reinstate / transfer still check-then-set inside session; without unique index, theoretical race across sessions | Mongo default read concern |

**Obsolete:** claim that PUT transfer has no session / free-before-validate (fixed). Floor soft-delete without totalRooms recompute (fixed).

## Acceptance for fix agents

- [x] Create two tenants same bed sequential -- second 400 `BED_OCCUPIED`
- [x] Transfer A->B frees A; occupies B
- [x] Checkout frees bed; reinstate reclaims; reinstate when bed taken fails 409
- [x] Delete frees bed
- [x] sharingType downsize with too many occupants fails with `BEDS_OCCUPIED_ON_DOWNSIZE`
- [x] Soft-delete room with active tenants fails; Floor.totalRooms updated when allowed
- [ ] Concurrent create stress: no double occupancy (needs unique partial index or atomic claim)
- [ ] Shared claimBed/releaseBed used by all tenant paths
- [ ] Optional: partial unique index `{ roomId, bedId }` where `isActive: true`

## Remediation log

| Date | Change | Status |
|------|--------|--------|
| historical | Transfer non-atomic; isActive toggle left orphan occupied beds | Open then |
| ~2026-07-12+ | Transfer/swap in session; isActive free toggle removed; Floor recompute on soft-delete; rebuildBeds remaps | **Fixed** |
| 2026-07-16 | Re-verified rooms.ts + tenants.ts + models; residual race uniqueness P1 | Docs synced |
