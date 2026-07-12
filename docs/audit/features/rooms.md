# Rooms -- Gap Analysis

**Priority:** P1  
**Verdict:** Functionally wired CRUD; integrity edges and design gaps remain.

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/room.ts` |
| Routes | `apps/api/src/routes/rooms.ts` |
| Types | `packages/types/src/room.ts` |
| FE | `apps/web/src/app/(admin)/rooms/{page,new,[id], [id]/edit}/page.tsx` |

## API surface

| Method | Path | Status |
|--------|------|--------|
| GET | `/rooms` | Paginated, floor/sharing/active filters, populate floor |
| GET | `/rooms/available` | Vacant beds |
| GET | `/rooms/:id` | + tenant names on beds |
| POST | `/rooms` | admin; generateBeds; 11000 roomNumber |
| PUT | `/rooms/:id` | sharingType rebuild + concurrent guard |
| DELETE | `/rooms/:id` | soft isActive=false; blocks if active tenants |

## FE wiring

| Page | Calls | Status |
|------|-------|--------|
| List | GET rooms, DELETE rooms/:id | OK -- PageHeader, DataTable, StatusBadge, mobileCard |
| Detail | GET rooms/:id | OK -- beds + tenantName |
| New | POST rooms, GET app-config, floors via ResourceSelect | OK functional |
| Edit | GET rooms/:id, floors, app-config; PUT rooms/:id | OK functional |

## Field coverage

| Field | Model | New | Edit | Detail | Notes |
|-------|:-----:|:---:|:----:|:------:|-------|
| roomNumber | Y | Y | Y | Y | unique uppercase |
| floorId | Y | Y | Y | Y | New: ResourceSelect; Edit: often Select -- inconsistent |
| sharingType | Y | Y | Y | Y | 2/3/4 |
| monthlyRent | Y | Y | Y | Y | |
| description | Y | Y | Y | Y | |
| isActive | Y | -- | Y | Y | |
| roomAmenities[] | Y | Y | Y | Y | from amenityDefinitions !isPerFloor |
| photos[] | Y | **N** | **N** | maybe | **gap** -- no upload UI |
| beds[] | Y | auto | read-only | Y | never manual edit |
| occupancyCount | derived | -- | -- | Y | pre-save on beds modify |

## Relational integrity issues

1. **P1 Soft-delete Floor.totalRooms desync**  
   DELETE uses `findByIdAndUpdate({ isActive: false })`. Room post-save / findOneAndDelete hooks do not run. Floor.totalRooms counts `isActive: true` rooms via post-save only. Soft-deleted rooms leave floor counts stale high.

2. **P2 No reactivate**  
   Soft-deleted rooms cannot be reactivated via dedicated endpoint/UI (only isActive on edit if still loadable -- inactive may be filtered from lists).

3. **P1 Sharing downsize**  
   Backend correctly rejects when occupied > newSharingType (`BEDS_OCCUPIED_ON_DOWNSIZE`). FE must surface `error.message` from API, not generic "Failed to update".

4. **P2 Occupied bed IDs not in standard slice**  
   rebuildBeds preserves non-standard occupied then truncates -- edge corruption case only.

## Component / design

- Native Select for sharingType / floor on forms -- design P1.
- StatusBadge for active/inactive -- OK.
- FormPage stack -- OK.

## Required fixes (ordered)

- [ ] After soft-delete, recompute Floor.totalRooms for that floorId (explicit count update)
- [ ] Optional reactivate: PUT isActive true with floor recompute
- [ ] Photo upload using Cloudinary/document pattern OR remove photos from API public contract
- [ ] Edit floor: ResourceSelect/SearchableSelect
- [ ] Surface API conflict codes on FE toast/banner
- [ ] Replace native Select after design batch

## Acceptance tests

- [ ] Create room sharing 3 -> 3 empty beds A/B/C
- [ ] Assign tenants via tenant flow; occupancyCount matches
- [ ] PUT sharingType 3->4 preserves occupants; 4->2 blocked if 3 occupied
- [ ] Soft-delete with 0 active tenants; floor totalRooms decreases
- [ ] Soft-delete blocked with active tenants
