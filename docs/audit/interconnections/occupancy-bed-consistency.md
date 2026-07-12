# Interconnection: Occupancy and Bed Consistency

## Invariants (must always hold)

1. For each Room bed: `isOccupied === true` iff `tenantId != null`.
2. `Room.occupancyCount === count(beds where isOccupied)`.
3. Active Tenant with `roomId`/`bedId` must point at a bed with matching `tenantId` and `isOccupied true`.
4. At most one active Tenant per (roomId, bedId) -- index exists `{ roomId, bedId, isActive }` but is **not unique**; only compound non-unique index. **Gap:** cannot rely on DB unique for bed exclusivity.

## Mutation paths (verified)

| Path | File | Bed handling | Atomic? |
|------|------|--------------|---------|
| Tenant create | tenants.ts POST | set bed occupied + tenantId; occupancyCount | Session txn but bed check-then-set race |
| Tenant PUT transfer | tenants.ts | free old, claim new | No session; race |
| Tenant PUT bed swap | tenants.ts | same room | No session; race |
| Checkout | tenants.ts | free bed | Session OK |
| Reinstate | tenants.ts | reclaim if free | Session; still check-then-set |
| Tenant delete | tenants.ts | free bed | Session cascade OK |
| Room sharingType change | rooms.ts rebuildBedsForSharingType | preserve occupied | concurrent sharingType guard yes |
| Room soft-delete | rooms.ts | blocked if active tenants | does not clear beds if inactive tenants remain historically |

## Failure modes

1. **Double book:** two POST /tenants same bed concurrent.
2. **Orphan occupied bed:** PUT isActive false without freeing bed.
3. **Orphan tenant pointer:** bed freed but tenant still active (partial failure without session on transfer).
4. **Floor count:** soft-delete rooms without Floor.totalRooms recompute.
5. **Downsize:** correctly blocked when occupied > new type.

## Required remediation (still open 2026-07-12)

- Shared helper `claimBed(roomId, bedId, tenantId, session)` using atomic array filter update.
- Shared helper `releaseBed(roomId, bedId, tenantId, session)`.
- Optional unique partial index: active tenants unique on roomId+bedId where isActive true (Mongo partialFilterExpression).
- Never set tenant.isActive false outside checkout without releaseBed.
- **P0:** PUT transfer must validate new bed free before freeing old; use transaction.
- **P0:** Remove free `isActive` toggle from tenant edit/PUT.

Cross-ref: [tenant-lifecycle.md](./tenant-lifecycle.md), [features/tenants.md](../features/tenants.md), LIVE IDs P0-T1 / P0-T2.

## Test matrix for agents

- [ ] Create two tenants same bed sequential -- second 400 BED_OCCUPIED
- [ ] Create concurrent (stress) -- no double occupancy
- [ ] Transfer A->B frees A
- [ ] Checkout frees bed; reinstate reclaims; reinstate when bed taken fails
- [ ] Delete frees bed
- [ ] sharingType downsize with occupants fails with code
