# Services -- Feature Audit

**Last verified:** 2026-07-16
**Auditor:** code-verified source pass
**Grade:** A-

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/serviceStatus.ts` |
| Routes | `apps/api/src/routes/services.ts` |
| Types | `packages/types/src/service.ts` |
| Amenity defs | `apps/api/src/models/appConfig.ts` amenityDefinitions; `packages/types/src/appConfig.ts` |
| FE list | `apps/web/src/app/(admin)/services/page.tsx` |
| FE new | `apps/web/src/app/(admin)/services/new/page.tsx` |
| FE detail | `apps/web/src/app/(admin)/services/[id]/page.tsx` |
| FE edit | `apps/web/src/app/(admin)/services/[id]/edit/page.tsx` |
| Floor grid | `apps/web/src/components/ui/FloorServiceGrid.tsx` |
| Room list chips | `apps/web/src/components/ui/ServiceStatusIndicator.tsx` |

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/services/summary` | adminOnly | Aggregate counts by status; **no FE consumer** |
| GET | `/api/v1/services` | authGuard | Paginated; filters floorId, status; populate floor; enrich openComplaintCount |
| GET | `/api/v1/services/floor/:floorId/with-complaints` | authGuard | Floor services + totalRooms; used by FloorServiceGrid |
| POST | `/api/v1/services` | adminOnly | floorId + serviceType + status/note; validates type against **any** amenityDefinitions key; unique floorId+serviceType |
| GET | `/api/v1/services/:id` | authGuard | Populate floor; openComplaintCount; **does not populate lastUpdatedBy name** |
| PUT | `/api/v1/services/:id` | authGuard | Status/note only; non-admin cannot set operational |
| PUT | `/api/v1/services/:id/full` | adminOnly | serviceType/status/note; used by admin edit form; floorId **not** updatable |
| DELETE | `/api/v1/services/:id` | adminOnly | Hard delete |

## FE page matrix

| Page | Path | Wired | FormPage/DataTable | Notes |
|------|------|-------|--------------------|-------|
| List | `/services` | Y | PageHeader + DataTable + StatusBadge + mobileCard | Status filter; open complaint badge; delete confirm |
| New | `/services/new` | Y | FormPage + FormCard | Prefers isPerFloor defs for type options; ResourceSelect floor |
| Detail | `/services/[id]` | Y | FormPage + DetailCard + StatCard | Hardcoded serviceLabels map (incomplete vs AppConfig) |
| Edit | `/services/[id]/edit` | Y | FormPage + FormCard | PUT `/full`; floor ResourceSelect **disabled**; type filter isPerFloor !== false |

## Field coverage

| Field | Model | New | Edit | Detail | List | Gap |
|-------|:-----:|:---:|:----:|:------:|:----:|-----|
| floorId | Y | Y | display only | Y | via floor.label | immutable after create |
| serviceType | Y | Y | Y | Y | Y | isPerFloor key only -- API `isValidFloorServiceType` enforces (SV-1 closed) |
| status | Y | Y | Y | Y | Y | operational/degraded/down |
| note | Y | Y | Y | Y | Y (truncate) | optional max 500 |
| lastUpdatedBy | Y | auto | auto | shows name if present | "Updated By" column | **never populated** on list/detail API |
| lastUpdatedAt | Y | auto | auto | Y | Y | OK |
| openComplaintCount | computed | -- | -- | Y | Y | via amenity applicableComplaintCategories map |

## Lifecycle / special actions

| Action | API | FE CTA | Status |
|--------|-----|--------|--------|
| Create floor service | POST /services | New form | OK when type unique per floor |
| Quick status update | PUT /:id | not used by admin edit | API exists; admin edit uses /full |
| Full admin edit | PUT /:id/full | Edit form | OK; cannot move floor |
| Delete | DELETE | List ConfirmModal | OK |
| Floor grid health | GET floor/.../with-complaints | FloorServiceGrid | OK |
| Summary dashboard | GET /summary | none | **Unused** |
| Auto-seed on floor create | floors POST seedFloorServiceStatuses | automatic | **PASS** |
| Tenant report degraded/down | PUT /:id | portal / future | API permission path exists |

## Domain placement notes

- **ServiceStatus is floor-scoped only** (compound unique floorId + serviceType). Correct home for `isPerFloor=true` amenity operational health.
- **Room-level amenities** (`isPerFloor=false`: fan, bed, bedsheet, pillow) belong on `Room.roomAmenities[]`, not ServiceStatus.
- FE new prefers isPerFloor defs; edit uses `isPerFloor !== false` (treats missing flag as floor). FloorServiceGrid filters display to isPerFloor keys.
- **CLOSED SV-1:** `isValidFloorServiceType` requires `isPerFloor === true` so room-only keys (e.g. fan) cannot become floor ServiceStatus rows.
- Complaint enrichment maps serviceType -> `applicableComplaintCategories` then counts open/in_progress complaints on rooms of that floor -- correct for floor services.
- Seed inserts legacy types (`washing_machine_1`, `washing_machine_2`) that are **not** default AppConfig keys (`washing_machine`) -- orphan statuses after seed vs settings.

## Design / stack

- FormPage on new/edit/detail: **yes**
- StatusBadge on list/detail: **yes**
- Themed Select for status/type: **yes**
- ResourceSelect for floor: **yes**
- Detail labels: hardcoded `serviceLabels` map instead of AppConfig -- P2
- List "Updated By" always empty without populate -- looks broken
- Tokens: CSS variables throughout

## Open gaps (ordered)

| ID | Sev | Gap | Paths | Later fix agent notes |
|----|-----|-----|-------|----------------------|
| SV-3 | P2 | lastUpdatedBy never populated; list Updated By always blank | services GET routes | `.populate('lastUpdatedBy', 'name')` on list/get/create responses |
| SV-4 | P2 | GET /services/summary unused | services.ts, dashboard? | Wire admin dashboard health widget or remove if dead |
| SV-5 | P2 | Detail page hardcoded serviceLabels incomplete | `services/[id]/page.tsx` | Resolve label/icon from app-config amenityDefinitions like list page |
| SV-6 | P2 | Seed serviceTypes drift from AppConfig defaults | `scripts/seed.ts` | Use isPerFloor keys from DEFAULT_AMENITY_DEFINITIONS |
| SV-7 | P2 | Edit filter `isPerFloor !== false` differs slightly from new (`isPerFloor` true only preferred) | new vs edit | Align both to strict isPerFloor === true |
| SV-8 | P3 | Floor cannot be reassigned on edit (disabled) | edit page + /full schema | Document intentional; change would need unique-key migration |

## Closed / do-not-refile

| Claim | Why closed |
|-------|------------|
| isValidServiceType any key (SV-1) | **FIXED** -- isValidFloorServiceType requires isPerFloor |
| No seed on floor create (SV-2) | **FIXED** -- seedFloorServiceStatuses |
| FE edit uses status-only PUT | Edit uses PUT `/services/:id/full` with serviceType/status/note |
| No create path | POST /services implemented and FE new wired |
| No floor complaint enrichment | with-complaints + list enrich openComplaintCount |
| Room amenities stored as ServiceStatus | Room path uses roomAmenities; ServiceStatus is floor document |
| Duplicate floor+type | Unique index + DUPLICATE_SERVICE handling |

## Acceptance checklist for fix agents

- [x] API rejects serviceType where amenity isPerFloor is false (`isValidFloorServiceType`)
- [x] New/edit type dropdowns only list isPerFloor amenities
- [x] After floor create, services appear in FloorServiceGrid without manual add (`seedFloorServiceStatuses`)
- [ ] List/detail show lastUpdatedBy.name when set (SV-3)
- [ ] Detail labels match AmenityTypesTab labels (SV-5)
- [ ] Seed data serviceTypes match AppConfig keys (SV-6)

## Remediation log

| Date | Change |
|------|--------|
| 2026-07-16 | Full re-audit from source; prior stub replaced |
| 2026-07-16 | **SV-1 / SV-2 CLOSED** in code -- isValidFloorServiceType + seedFloorServiceStatuses; residual open are P2 only |
