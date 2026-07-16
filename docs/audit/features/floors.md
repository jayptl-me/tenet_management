# Floors -- Feature Audit

**Last verified:** 2026-07-16
**Auditor:** code-verified source pass
**Grade:** A-

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/floor.ts` |
| Routes | `apps/api/src/routes/floors.ts` |
| Types | `packages/types/src/floor.ts` |
| FE list | `apps/web/src/app/(admin)/floors/page.tsx` |
| FE new | `apps/web/src/app/(admin)/floors/new/page.tsx` |
| FE detail | `apps/web/src/app/(admin)/floors/[id]/page.tsx` |
| FE edit | `apps/web/src/app/(admin)/floors/[id]/edit/page.tsx` |
| Service grid | `apps/web/src/components/ui/FloorServiceGrid.tsx` |
| Amenity defs | `AppConfig.amenityDefinitions` via GET app-config |

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/floors` | authGuard | Full list sorted by floorNumber; **no server pagination** |
| GET | `/api/v1/floors/:id` | authGuard | Single floor lean |
| POST | `/api/v1/floors` | adminOnly | floorNumber, label, totalRooms, amenityCounts optional; 11000 DUPLICATE_FLOOR |
| PUT | `/api/v1/floors/:id` | adminOnly | Partial; **strips totalRooms** (server-managed via Room hooks) |
| DELETE | `/api/v1/floors/:id` | adminOnly | Hard delete; blocks if any rooms (FLOOR_HAS_ROOMS) |

No floor endpoint creates `ServiceStatus` rows.

## FE page matrix

| Page | Path | Wired | FormPage/DataTable | Notes |
|------|------|-------|--------------------|-------|
| List | `/floors` | Y | PageHeader + DataTable + TableActions + mobileCard | Client filter/search + client slice pagination; FloorServiceGrid compact |
| New | `/floors/new` | Y | FormPage + FormCard | Per-floor amenity **counts** from isPerFloor defs; posts amenityCounts only |
| Detail | `/floors/[id]` | Y | FormPage + DetailCard + StatCard | FloorServiceGrid full; rooms table; amenityCounts display |
| Edit | `/floors/[id]/edit` | Y | FormPage + FormCard | totalRooms read-only display; amenityCounts editable |

## Field coverage

| Field | Model | New | Edit | Detail | List | Gap |
|-------|:-----:|:---:|:----:|:------:|:----:|-----|
| floorNumber | Y | Y | Y | Y | Y | unique |
| label | Y | Y | Y | Y | Y | unique index |
| totalRooms | Y | Y (user input) | read-only | Y | Y | create allows seed value; then auto-synced from active rooms |
| amenityCounts[] | Y | Y | Y | Y | N | inventory counts for isPerFloor amenities |
| amenities (legacy) | Y deprecated | N | N | fallback interface only | N | washingMachines/fridges still on schema |
| description | **N** | N | N | FE type allows but model has none | N | dead FE interface field |
| ServiceStatus rows | other model | **N seed** | N | via FloorServiceGrid | via grid | **seeded on floor create** (seedFloorServiceStatuses) |

## Lifecycle / special actions

| Action | API | FE CTA | Status |
|--------|-----|--------|--------|
| Create floor | POST /floors | New form | OK for identity + amenityCounts |
| Seed ServiceStatus for isPerFloor amenities | seedFloorServiceStatuses | automatic on create | **PASS** |
| Update amenity counts | PUT amenityCounts | Edit form | OK |
| View service health | GET services/floor/:id/with-complaints | FloorServiceGrid | OK when rows exist |
| Delete floor | DELETE | List ConfirmModal | OK; blocked when rooms exist |
| Add room from empty floor | -- | Detail empty CTA -> `/rooms/new?floorId=` | OK |
| Report service issue | -- | Detail onReportIssue -> complaints/new | OK deep-link |

## Domain placement notes

- **FLOOR-level (correct):** `floorNumber`, `label`, `totalRooms` (derived after rooms exist), `amenityCounts` (how many units of each per-floor amenity).
- **NOT floor-level:** `monthlyRent`, beds, roomNumber, sharingType -- correctly absent from floor model/forms.
- **isPerFloor=true amenities:**
  - **Counts** edited on floor new/edit as amenityCounts (inventory).
  - **Operational status** tracked via ServiceStatus + FloorServiceGrid / ServiceStatusIndicator.
  - Floor forms correctly load defs with `d.isPerFloor` for count inputs only.
- **isPerFloor=false amenities:** not on floor forms -- room roomAmenities only. Correct.
- **Service seed:** creating a floor seeds ServiceStatus rows via `seedFloorServiceStatuses` for each isPerFloor amenity (FL-1 closed).
- FloorServiceGrid filters displayed services to isPerFloor keys when definitions load -- correct guard against room-only keys leaking into the grid.
- Seed script (`seed.ts`) inserts ServiceStatus with legacy keys like `washing_machine_1` / `washing_machine_2` which may not match AppConfig defaults (`washing_machine`) -- seed drift vs live defs.

## Design / stack

- FormPage stack on new/edit/detail: **yes**
- List: PageHeader, DataTable, EmptyState, ErrorBanner, ConfirmModal
- FloorServiceGrid uses theme tokens for operational/degraded/down
- No StatusBadge on floor list (floor has no status enum) -- N/A
- Mobile card omits FloorServiceGrid (desktop Services column only) -- P2 polish

## Open gaps (ordered)

| ID | Sev | Gap | Paths | Later fix agent notes |
|----|-----|-----|-------|----------------------|
| FL-2 | P2 | totalRooms on create is user-editable but later overwritten by Room post-save counts | `floors/new`, model | Prefer omit totalRooms on create or label as "planned capacity" and keep separate; align with PUT strip behavior |
| FL-3 | P2 | Deprecated `amenities.washingMachines/fridges` still on model/types/route schema | floor model, types, floors route | Stop accepting amenities in Zod; migrate any remaining docs into amenityCounts; remove field in later pass |
| FL-4 | P2 | Detail FE declares `description` but Floor model has no description | `floors/[id]/page.tsx` | Remove dead UI branch or add optional description field end-to-end |
| FL-5 | P2 | List mobile cards omit service health chips | `floors/page.tsx` mobileCardRenderer | Reuse FloorServiceGrid compact or status summary |
| FL-6 | P2 | Seed ServiceStatus keys may not match AppConfig amenity keys | `apps/api/src/scripts/seed.ts` | Seed from DEFAULT_AMENITY_DEFINITIONS isPerFloor keys only |
| FL-7 | P3 | Client-only pagination/search (API returns all floors) | list + GET /floors | Fine for small buildings; add query params if needed |

## Closed / do-not-refile

| Claim | Why closed |
|-------|------------|
| Floor create no ServiceStatus seed (FL-1) | **FIXED** -- `seedFloorServiceStatuses` after Floor.create |
| Cannot delete floor with rooms | DELETE checks Room.countDocuments and returns FLOOR_HAS_ROOMS |
| totalRooms desync on room soft-delete | Rooms DELETE recomputes Floor.totalRooms; Room post-save/findOneAndDelete also update |
| Rent/sharing/beds managed on floor | Not present on floor model or forms |
| FloorServiceGrid shows room amenities | Filters to isPerFloor keys from AppConfig |
| Missing floor CRUD pages | All four surfaces present and wired |

## Acceptance checklist for fix agents

- [x] Creating a floor with isPerFloor amenity defs yields matching ServiceStatus rows (`seedFloorServiceStatuses`)
- [x] FloorServiceGrid non-empty after floor create without visiting Services module
- [x] No monthlyRent/sharingType/beds fields on floor forms
- [x] amenityCounts only for isPerFloor amenities
- [ ] Deprecated amenities object not written from FE (FL-3)
- [ ] Detail does not render phantom description unless model supports it (FL-4)

## Remediation log

| Date | Change |
|------|--------|
| 2026-07-16 | Full re-audit from source; prior stub gaps replaced; soft-delete totalRooms claim closed |
| 2026-07-16 | **FL-1 CLOSED** -- seedFloorServiceStatuses; residual open are P2 only |
