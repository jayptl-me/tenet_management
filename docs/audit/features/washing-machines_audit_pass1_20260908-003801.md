# Washing Machines Module - Audit Pass 1

Module: washing-machines
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

washing machines (floor machines, tenant claim with timer, single-claim limit, release).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                                       | Status  |
| ------ | ------------------------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/washing-machines/page.tsx -> /washing-machines                     | WORKING |
| Create | apps/web/src/app/(admin)/washing-machines/new/page.tsx -> /washing-machines/new             | WORKING |
| Detail | apps/web/src/app/(admin)/washing-machines/[id]/page.tsx -> /washing-machines/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/washing-machines/[id]/edit/page.tsx -> /washing-machines/[id]/edit | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                                     | Route                        | API Used                      | Status  |
| ------------------------------------------ | ---------------------------- | ----------------------------- | ------- |
| Floor machines + claim/release + countdown | washing_machines_screen.dart | GET washing-machines (scoped) | WORKING |

### 2.3 Not Accessible

| Actor            | Blocked Surface                   | Enforcement                  |
| ---------------- | --------------------------------- | ---------------------------- |
| tenant, guardian | all /washing-machines Next routes | AdminLayout role guard       |
| tenant           | others claims; admin mutations    | ownership/adminOnly, 403/400 |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                            | Element            | Status                        |
| -------------------------------------------------- | ------------------ | ----------------------------- |
| Table floor/status/claimant/timer + Release action | DataTable + Button | WORKING (raw button replaced) |
| Status filter                                      | Select             | WORKING                       |
| Full-set CSV export                                | Button             | WORKING (fixed page-only)     |
| parseApiError on load/release/delete/export        | errorParser        | WORKING (added)               |
| Custom SVG                                         | none               | NO CUSTOM SVG                 |

### 3.2 Create

| Feature                                       | Element     | Status          |
| --------------------------------------------- | ----------- | --------------- |
| Placement + Configuration sections with icons | FormSection | WORKING (added) |
| parseApiError                                 | errorParser | WORKING (added) |
| Custom SVG                                    | none        | NO CUSTOM SVG   |

### 3.3 Detail

| Feature                       | Element             | Status                   |
| ----------------------------- | ------------------- | ------------------------ |
| Machine + claim + timer cards | DetailCard/StatCard | WORKING                  |
| Status via statusToVariant    | StatusBadge         | WORKING (helper deleted) |
| parseApiError on load         | errorParser         | WORKING (added)          |
| Custom SVG                    | none                | NO CUSTOM SVG            |

### 3.4 Edit

| Feature                                                           | Element          | Status              |
| ----------------------------------------------------------------- | ---------------- | ------------------- |
| In-use claim preservation (status unset; explicit release choice) | Select + warning | WORKING (400 fixed) |
| Status omitted from payload when untouched                        | payload strip    | WORKING             |
| parseApiError on load/submit                                      | errorParser      | WORKING (added)     |
| Custom SVG                                                        | none             | NO CUSTOM SVG       |

## 4. Shared Components

| Component                                                                                                                                                               | Path                    | Status  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| floorLabel                                                                                                                                                              | resource-select-presets | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea/DetailCard/StatCard | ui/*                    | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/washingMachines.ts)

| Endpoint                                              | Auth      | Status          |
| ----------------------------------------------------- | --------- | --------------- |
| GET / (tenant floor auto-scope)                       | authGuard | WORKING         |
| GET /floor/:floorId, GET /:id                         | authGuard | WORKING         |
| POST / (floor ownership, unique number)               | adminOnly | WORKING         |
| PUT /:id (claim cleared on non-in_use)                | adminOnly | WORKING         |
| POST /:id/claim (available guard, single-claim limit) | authGuard | WORKING         |
| POST /:id/release (owner/admin)                       | authGuard | WORKING         |
| DELETE /:id (in_use 409)                              | adminOnly | WORKING (added) |

### 5.2 Database Models

| Model          | Relation                                       | Status  |
| -------------- | ---------------------------------------------- | ------- |
| WashingMachine | floorId -> Floor; currentUser -> Tenant; timer | WORKING |

## 6. Missing Custom Components

| Component | Need                              | Status |
| --------- | --------------------------------- | ------ |
| none      | Timer + cards cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                                | Status  |
| -------- | -------------------------------------- | ------- |
| List     | Add, Export, Release, View/Edit/Delete | WORKING |
| Detail   | Edit, Claim/Release                    | WORKING |
| New/Edit | Save/Cancel                            | WORKING |

## 8. SVG Inventory

| Location          | SVG         | Status        |
| ----------------- | ----------- | ------------- |
| All machine pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location                  | Status  |
| ------------------------- | ------------------------- | ------- |
| List table + mobile cards | washing-machines/page.tsx | WORKING |
| CSV export (8 cols)       | washing-machines/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. Edit in_use preservation. 2. List Button + parsers + full CSV. 3. Detail variant + parser. 4. New sections + parser. 5. DELETE in_use 409. 6. Flutter single-hop list + fallback.

## 11. Out of Scope for This Pass

1. Cross laundry-machine booking link (independent systems by design).
2. Claim timer push notifications (no scheduler surface for it).

## 12. Pass 1 Fixes Applied

| Fix                                                | Files                                                        | Status  |
| -------------------------------------------------- | ------------------------------------------------------------ | ------- |
| DELETE in_use 409 MACHINE_IN_USE                   | apps/api/src/routes/washingMachines.ts                       | WORKING |
| Edit in_use preservation + payload strip + parsers | apps/web/src/app/(admin)/washing-machines/[id]/edit/page.tsx | WORKING |
| List Button + parsers + full CSV                   | apps/web/src/app/(admin)/washing-machines/page.tsx           | WORKING |
| Detail variant + parser                            | apps/web/src/app/(admin)/washing-machines/[id]/page.tsx      | WORKING |
| New sections + parser                              | apps/web/src/app/(admin)/washing-machines/new/page.tsx       | WORKING |
| Flutter single-hop myWashingMachines + fallback    | washing_machines_screen.dart, tenant_repository.dart         | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.
