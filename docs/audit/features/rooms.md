# Rooms -- Feature Audit

**Last verified:** 2026-07-16
**Auditor:** code-verified source pass
**Grade:** A-

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/room.ts` |
| Routes | `apps/api/src/routes/rooms.ts` |
| Types | `packages/types/src/room.ts` |
| FE list | `apps/web/src/app/(admin)/rooms/page.tsx` |
| FE new | `apps/web/src/app/(admin)/rooms/new/page.tsx` |
| FE detail | `apps/web/src/app/(admin)/rooms/[id]/page.tsx` |
| FE edit | `apps/web/src/app/(admin)/rooms/[id]/edit/page.tsx` |
| Related UI | `apps/web/src/components/ui/ServiceStatusIndicator.tsx` (floor services on room list) |

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/rooms` | authGuard | Paginated; filters: floorId, sharingType, isActive, roomNumber; populate floor |
| GET | `/api/v1/rooms/available` | authGuard | Active rooms with at least one vacant bed; **no FE consumer** |
| GET | `/api/v1/rooms/:id` | authGuard | Populate floor; inject tenantName on occupied beds |
| POST | `/api/v1/rooms` | adminOnly | generateBeds(sharingType); roomAmenities optional; 11000 -> ROOM_NUMBER_EXISTS |
| PUT | `/api/v1/rooms/:id` | adminOnly | Partial; sharingType rebuild + remaps Tenant.bedId; BEDS_OCCUPIED_ON_DOWNSIZE; concurrent guard |
| DELETE | `/api/v1/rooms/:id` | adminOnly | Soft: isActive=false; blocks ACTIVE_TENANTS; **explicitly recomputes Floor.totalRooms** |

## FE page matrix

| Page | Path | Wired | FormPage/DataTable | Notes |
|------|------|-------|--------------------|-------|
| List | `/rooms` | Y | PageHeader + DataTable + StatusBadge + TableActions + mobileCard | Filters roomNumber/sharing/active; soft-delete ConfirmModal |
| New | `/rooms/new` | Y | FormPage + FormCard + FormSection | ResourceSelect floors; optional ?floorId= prefill; room amenity status selects |
| Detail | `/rooms/[id]` | Y | FormPage + DetailCard + StatCard | Beds, tenants, amenity aggregate chart, photos if present |
| Edit | `/rooms/[id]/edit` | Y | FormPage + FormCard | Floor Select (not ResourceSelect); isActive; room amenities |

## Field coverage

| Field | Model | New | Edit | Detail | List | Gap |
|-------|:-----:|:---:|:----:|:------:|:----:|-----|
| roomNumber | Y | Y | Y | Y | Y | unique, uppercase |
| floorId / floor | Y | Y | Y | Y | Y | New: ResourceSelect; Edit: plain Select |
| sharingType | Y | Y | Y | Y | Y | 2/3/4; beds auto-rebuilt on change |
| monthlyRent | Y | Y | Y | Y | Y | ROOM-level (correct) |
| description | Y | Y | Y | Y | N | optional |
| isActive | Y | N | Y | Y | Y | create defaults true |
| beds[] | Y | auto | -- | Y | Y (avail count) | never manual edit; correct |
| occupancyCount | Y | derived | -- | via beds | via beds | pre-save on beds modify |
| roomAmenities[] | Y | Y | Y | Y (aggregate) | N | only `!isPerFloor` defs from AppConfig |
| photos[] | Y | **N** | **N** | Y if set | N | API accepts URL array; no upload UI |

## Lifecycle / special actions

| Action | API | FE CTA | Status |
|--------|-----|--------|--------|
| Create room + beds | POST /rooms | New form Save | OK |
| Soft delete | DELETE /rooms/:id | List ConfirmModal | OK; recomputes floor totalRooms |
| Reactivate | PUT isActive=true | Edit checkbox | OK if user can open inactive room |
| Sharing type change | PUT + rebuildBedsForSharingType | Edit sharing Select | API OK; FE may show generic error on conflict |
| Room amenities health | PUT roomAmenities | New/Edit status Selects | OK for non-per-floor only |
| Vacant-bed lookup | GET /rooms/available | none | **Unused** (tenants use `rooms?isActive=true`) |
| Floor service glance | GET /services?floorId= | ServiceStatusIndicator on list | Shows **floor** services, not roomAmenities |

## Domain placement notes

- **ROOM-level (correct):** `roomNumber`, `sharingType`, `monthlyRent`, `beds`, `occupancyCount`, `photos`, `roomAmenities` (non-per-floor only).
- **Not on Room:** per-floor amenities (wifi, electricity, water, geyser, washing_machine, fridge) live in AppConfig as `isPerFloor=true` and are tracked as `ServiceStatus` on floors.
- New/Edit filter amenityDefinitions with `!d.isPerFloor` for room amenity status Selects -- **domain correct**.
- Room list "Services" column uses `ServiceStatusIndicator` with `floorId` -- intentional floor health glance, not room-level amenity status. Room-level amenity status is only on detail/edit.
- Detail "Room Amenities Status" is a StackedBarChart aggregate only (no per-key labels) -- UX polish gap, not misplacement.

## Design / stack

- FormPage / FormCard / FormSection / FormActions / FormGrid on new + edit: **yes**
- StatusBadge + statusToVariant for active/inactive: **yes**
- Select: themed `@/components/ui/Select` for sharing / amenity status (not native)
- Floor pick: ResourceSelect on new; plain Select on edit (inconsistency, P2)
- Tokens: CSS variables throughout; no hardcoded gray palette on pages reviewed
- Soft-delete ConfirmModal: **"Deactivate Room"** / marked inactive (accurate soft-delete; see RM-7 closed)

## Open gaps (ordered)

| ID | Sev | Gap | Paths | Later fix agent notes |
|----|-----|-----|-------|----------------------|
| RM-1 | P2 | No photo upload/manage on new/edit; photos only render on detail if already set | `rooms/new`, `rooms/[id]/edit`, model `photos` | Wire Cloudinary upload pattern used elsewhere, or drop photos from create/update contract |
| RM-2 | P2 | `@pg/types` `IRoom` / `IRoomCreate` omit `roomAmenities` | `packages/types/src/room.ts` | Add `roomAmenities?: RoomAmenityStatus[]` to IRoom + create/update types |
| RM-3 | P2 | GET `/rooms/available` unused by admin FE | `routes/rooms.ts`; tenants use ResourceSelect | Wire OccupancyBedPicker/tenants to available, or document as public/API-only |
| RM-4 | P2 | Edit floor uses plain Select vs ResourceSelect on new | `rooms/[id]/edit/page.tsx` | Match new page ResourceSelect + floorLabel |
| RM-5 | P2 | Sharing downsize / concurrent conflict: FE often generic "Failed to update" | edit page catch | Use `parseApiError` (already imported on edit) and surface code/message |
| RM-6 | P2 | Detail amenity section is aggregate only; no per-amenity key/status rows | `rooms/[id]/page.tsx` | List each roomAmenity with StatusBadge + def label from app-config |

## Closed / do-not-refile

| Claim | Why closed |
|-------|------------|
| Soft-delete leaves Floor.totalRooms stale | DELETE path explicitly recounts active rooms and updates Floor (rooms.ts ~365-374) |
| Room forms show per-floor services as room amenities | New/Edit filter `!isPerFloor` only; floor services stay on FloorServiceGrid / ServiceStatusIndicator |
| monthlyRent / beds / sharingType on floor | Confirmed ROOM model only |
| Missing CRUD pages | List/new/detail/edit all present and wired |
| beds must equal sharingType | Schema validator + generateBeds / rebuildBedsForSharingType |
| Soft-delete ConfirmModal irreversible copy (RM-7) | **FIXED** -- title "Deactivate Room"; message marked inactive / hidden from new assignments |

## Acceptance checklist for fix agents

- [ ] Photo create/edit UX or intentional API-only photos documented
- [ ] `IRoom` includes `roomAmenities` matching model
- [ ] Edit room floor picker matches new (ResourceSelect)
- [ ] API conflict codes (BEDS_OCCUPIED_ON_DOWNSIZE, CONCURRENT_MODIFICATION) shown in FE banner
- [x] Soft-delete modal copy accurate (Deactivate Room)
- [ ] Room list still shows floor service glance only; room amenity status remains on room forms/detail

## Remediation log

| Date | Change |
|------|--------|
| 2026-07-16 | Full re-audit from source; supersedes prior soft-delete totalRooms P1 and stub gap list |
| 2026-07-16 | Reconcile | **RM-7 CLOSED** -- Deactivate Room ConfirmModal |
