# Services Module - Audit Pass 1

Module: services
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

services (floor ServiceStatus health: operational/degraded/down + complaint counts).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                       | Status  |
| ------ | --------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/services/page.tsx -> /services                     | WORKING |
| Create | apps/web/src/app/(admin)/services/new/page.tsx -> /services/new             | WORKING |
| Detail | apps/web/src/app/(admin)/services/[id]/page.tsx -> /services/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/services/[id]/edit/page.tsx -> /services/[id]/edit | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                        | Route                | API Used                          | Status  |
| ----------------------------- | -------------------- | --------------------------------- | ------- |
| Floor services + report issue | services_screen.dart | floor/with-complaints (unwrapped) | WORKING |

### 2.3 Not Accessible

| Actor          | Blocked Surface                | Enforcement                 |
| -------------- | ------------------------------ | --------------------------- |
| tenant         | other floors services (report) | floor-membership check, 403 |
| guardian/other | PUT services                   | role guard, 403             |
| tenant         | operational restore            | PERMISSION_DENIED, 400      |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                | Element                        | Status                       |
| -------------------------------------- | ------------------------------ | ---------------------------- |
| Summary cards + status + floor filters | StatCard/Select/ResourceSelect | WORKING (floor filter added) |
| Variants via statusToVariant           | StatusBadge                    | WORKING (helper deleted)     |
| Full-set CSV export                    | Button                         | WORKING (fixed page-only)    |
| parseApiError                          | errorParser                    | WORKING (added)              |
| Custom SVG                             | none                           | NO CUSTOM SVG                |

### 3.2 Create

| Feature                                         | Element     | Status          |
| ----------------------------------------------- | ----------- | --------------- |
| Strict isPerFloor === true options (API mirror) | Select      | WORKING (fixed) |
| parseApiError                                   | errorParser | WORKING (added) |
| Custom SVG                                      | none        | NO CUSTOM SVG   |

### 3.3 Detail

| Feature                           | Element    | Status        |
| --------------------------------- | ---------- | ------------- |
| Health + complaints + notes cards | DetailCard | WORKING       |
| Duplicate Edit CTA removed        | —          | REMOVED       |
| Custom SVG                        | none       | NO CUSTOM SVG |

### 3.4 Edit

| Feature                                                     | Element               | Status                    |
| ----------------------------------------------------------- | --------------------- | ------------------------- |
| Strict isPerFloor options; floor read-only (schema dropped) | Select/ResourceSelect | WORKING (fixed)           |
| Notes section simplified                                    | Textarea              | WORKING (nesting removed) |
| parseApiError on load/submit                                | errorParser           | WORKING (added)           |
| Custom SVG                                                  | none                  | NO CUSTOM SVG             |

## 4. Shared Components

| Component                                                                                                                                     | Path                           | Status  |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------- |
| floorLabel/roomLabel                                                                                                                          | resource-select-presets        | WORKING |
| FloorServiceGrid                                                                                                                              | ui (floor detail + rooms list) | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Select/Textarea/ResourceSelect | ui/*                           | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/services.ts)

| Endpoint                                                            | Auth                | Status                |
| ------------------------------------------------------------------- | ------------------- | --------------------- |
| GET /summary, GET /, GET /floor/:floorId/with-complaints            | authGuard           | WORKING               |
| POST / (isPerFloor enforcement)                                     | adminOnly           | WORKING               |
| PUT /:id (tenant own-floor scope; note audits)                      | authGuard           | WORKING               |
| PUT /:id/full (INVALID_SERVICE_TYPE guard)                          | adminOnly           | WORKING               |
| GET /:id, DELETE /:id                                               | authGuard/adminOnly | WORKING               |
| Batched complaint-count enricher (rooms + aggregate)                | internal            | WORKING (N+1 removed) |
| Floor create seeds statuses; POST /floors/reseed-services backfills | floors.ts           | WORKING (added)       |

### 5.2 Database Models

| Model         | Relation                              | Status  |
| ------------- | ------------------------------------- | ------- |
| ServiceStatus | floorId -> Floor; unique floor+type   | WORKING |
| AppConfig     | amenityDefinitions isPerFloor catalog | WORKING |

## 6. Missing Custom Components

| Component | Need                                      | Status |
| --------- | ----------------------------------------- | ------ |
| none      | Summary cards + grids cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                       | Status  |
| -------- | ----------------------------- | ------- |
| List     | Add, Export, View/Edit/Delete | WORKING |
| Detail   | Edit                          | WORKING |
| New/Edit | Save/Cancel                   | WORKING |

## 8. SVG Inventory

| Location          | SVG         | Status        |
| ----------------- | ----------- | ------------- |
| All service pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location          | Status  |
| ------------------------- | ----------------- | ------- |
| List table + mobile cards | services/page.tsx | WORKING |
| CSV export (6 cols)       | services/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. List floor filter + variant + CSV + parsers. 2. New strict filter + parser. 3. Edit strict filter + read-only floor + parsers. 4. Detail duplicate CTA removal. 5. API tenant scope + note audits + parseId + batched enricher. 6. reseed-services endpoint. 7. Flutter services unwrap + category map.

## 11. Out of Scope for This Pass

1. Room-amenity complaint category mapping (enricher falls back safely; services rows are per-floor only).
2. Amenity-def flip/delete migration (catalog versioning; separate product decision).

## 12. Pass 1 Fixes Applied

| Fix                                                                   | Files                                                | Status  |
| --------------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| Tenant own-floor PUT scope + note audits + parseId + batched enricher | apps/api/src/routes/services.ts                      | WORKING |
| POST /floors/reseed-services                                          | apps/api/src/routes/floors.ts                        | WORKING |
| List floor filter + variant + full CSV + parsers                      | apps/web/src/app/(admin)/services/page.tsx           | WORKING |
| New strict isPerFloor + parser                                        | apps/web/src/app/(admin)/services/new/page.tsx       | WORKING |
| Edit strict filter + read-only floor + parsers                        | apps/web/src/app/(admin)/services/[id]/edit/page.tsx | WORKING |
| Detail duplicate CTA removed                                          | apps/web/src/app/(admin)/services/[id]/page.tsx      | REMOVED |
| Flutter services unwrap + complaint category map                      | services_screen.dart, tenant_repository.dart         | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.
