# Laundry Module - Audit Pass 1

Module: laundry (slots)
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

laundry slots (book/confirm/complete/cancel, facility cap 5, tenant uniqueness).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                     | Status  |
| ------ | ------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/laundry/page.tsx -> /laundry                     | WORKING |
| Create | apps/web/src/app/(admin)/laundry/new/page.tsx -> /laundry/new             | WORKING |
| Detail | apps/web/src/app/(admin)/laundry/[id]/page.tsx -> /laundry/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/laundry/[id]/edit/page.tsx -> /laundry/[id]/edit | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                                   | Route               | API Used                        | Status  |
| ---------------------------------------- | ------------------- | ------------------------------- | ------- |
| Slots list (items/notes) + book + cancel | laundry_screen.dart | GET laundry-slots, POST, cancel | WORKING |

### 2.3 Not Accessible

| Actor            | Blocked Surface          | Enforcement                |
| ---------------- | ------------------------ | -------------------------- |
| tenant, guardian | all /laundry Next routes | AdminLayout role guard     |
| tenant           | others slots; PUT        | ownership + adminOnly, 403 |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                         | Element                     | Status                      |
| ------------------------------- | --------------------------- | --------------------------- |
| Tenant cell with room/bed/floor | DataTable                   | WORKING (stay added)        |
| Status + date + tenant filters  | Select/Input/ResourceSelect | WORKING (date/tenant added) |
| Quick confirm + delete          | TableActions                | WORKING                     |
| CSV export with Bed/Floor       | Button                      | WORKING (added)             |
| parseApiError throughout        | errorParser                 | WORKING (added)             |
| Custom SVG                      | none                        | NO CUSTOM SVG               |

### 3.2 Create

| Feature                                    | Element        | Status                      |
| ------------------------------------------ | -------------- | --------------------------- |
| Resident/Schedule/Load sections with icons | FormSection    | WORKING (added)             |
| Active-tenants picker + capacity hint      | ResourceSelect | WORKING (fixed to isActive) |
| DUPLICATE_SLOT via parseApiError           | errorParser    | WORKING (pre-existing)      |
| Custom SVG                                 | none           | NO CUSTOM SVG               |

### 3.3 Detail

| Feature                                  | Element     | Status          |
| ---------------------------------------- | ----------- | --------------- |
| StatCards date/time/items + status badge | StatCard    | WORKING         |
| Tenant card with link + bed/floor/phone  | DetailCard  | WORKING (added) |
| Slot details + notes                     | DetailCard  | WORKING         |
| parseApiError on load                    | errorParser | WORKING (added) |
| Custom SVG                               | none        | NO CUSTOM SVG   |

### 3.4 Edit

| Feature                                           | Element     | Status          |
| ------------------------------------------------- | ----------- | --------------- |
| Status/dates/items/notes + DUPLICATE_SLOT mapping | FormSection | WORKING         |
| parseApiError on load/submit                      | errorParser | WORKING (added) |
| Custom SVG                                        | none        | NO CUSTOM SVG   |

## 4. Shared Components

| Component                                                                                                                                           | Path                    | Status  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| tenantLabel/tenantSublabel                                                                                                                          | resource-select-presets | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea | ui/*                    | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/laundry.ts)

| Endpoint                                          | Auth                | Status  |
| ------------------------------------------------- | ------------------- | ------- |
| GET / tenant branch (meta + pagination + status)  | authGuard           | WORKING |
| GET / admin (status/slotDate/tenantId validated)  | authGuard           | WORKING |
| GET /:id                                          | authGuard           | WORKING |
| POST / (past guard + cap 5 + DUPLICATE_SLOT)      | authGuard           | WORKING |
| PUT /:id (terminal transitions + past-date guard) | adminOnly           | WORKING |
| POST /:id/cancel, DELETE /:id                     | authGuard/adminOnly | WORKING |
| Bed/floor in tenant mapping everywhere            | mapLaundrySlot      | WORKING |

### 5.2 Database Models

| Model                     | Relation                                                    | Status  |
| ------------------------- | ----------------------------------------------------------- | ------- |
| LaundrySlot               | tenantId -> Tenant; unique tenant+date+time; virtual tenant | WORKING |
| generateLaundrySlots stub | unreferenced                                                | REMOVED |

## 6. Missing Custom Components

| Component | Need                                   | Status |
| --------- | -------------------------------------- | ------ |
| none      | StatCards + tables cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                              | Status  |
| -------- | ------------------------------------ | ------- |
| List     | Book, Export, confirm/delete actions | WORKING |
| Detail   | Edit                                 | WORKING |
| New/Edit | Book/Save/Cancel                     | WORKING |

## 8. SVG Inventory

| Location          | SVG         | Status        |
| ----------------- | ----------- | ------------- |
| All laundry pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location         | Status  |
| ------------------------- | ---------------- | ------- |
| List table + mobile cards | laundry/page.tsx | WORKING |
| CSV export (11 cols)      | laundry/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. Tenant GET meta/status/pagination. 2. Admin slotDate/tenantId filters. 3. PUT transitions + past guard. 4. Stub deletion. 5. Bed/floor mapping. 6. List filters + stay cell + CSV + parsers. 7. New sections + active picker. 8. Detail link + bed/floor + parser. 9. Edit parsers. 10. Flutter items/notes + 300 chars + tenantId omit.

## 11. Out of Scope for This Pass

1. Laundry-machine linkage (independent systems by design; double-booking possible and accepted).
2. Slot generation automation (manual booking is the product).

## 12. Pass 1 Fixes Applied

| Fix                                                                   | Files                                               | Status  |
| --------------------------------------------------------------------- | --------------------------------------------------- | ------- |
| Tenant branch meta/pagination/status; admin slotDate/tenantId filters | apps/api/src/routes/laundry.ts                      | WORKING |
| PUT terminal transitions + past-date guard                            | apps/api/src/routes/laundry.ts                      | WORKING |
| generateLaundrySlots stub + barrel export deleted                     | apps/api/src/models/laundrySlot.ts, index.ts        | REMOVED |
| Bed/floor tenant mapping (6 populates)                                | apps/api/src/routes/laundry.ts                      | WORKING |
| List filters + stay cell + CSV + parsers                              | apps/web/src/app/(admin)/laundry/page.tsx           | WORKING |
| New sections + active picker                                          | apps/web/src/app/(admin)/laundry/new/page.tsx       | WORKING |
| Detail link + bed/floor + parser                                      | apps/web/src/app/(admin)/laundry/[id]/page.tsx      | WORKING |
| Edit parsers                                                          | apps/web/src/app/(admin)/laundry/[id]/edit/page.tsx | WORKING |
| Flutter items/notes + 300 chars + tenantId omit                       | laundry_screen.dart, tenant_repository.dart         | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.
