# Electricity Module - Audit Pass 1

Module: electricity
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

electricity (room submeter bills: draft -> finalized -> distributed -> invoice shares).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                             | Status  |
| ------ | --------------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/electricity/page.tsx -> /electricity                     | WORKING |
| Create | apps/web/src/app/(admin)/electricity/new/page.tsx -> /electricity/new             | WORKING |
| Detail | apps/web/src/app/(admin)/electricity/[id]/page.tsx -> /electricity/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/electricity/[id]/edit/page.tsx -> /electricity/[id]/edit | WORKING |

### 2.2 End-User (mobile)

| Screen                            | Route                   | API Used                             | Status  |
| --------------------------------- | ----------------------- | ------------------------------------ | ------- |
| Tenant readings + share + history | electricity_screen.dart | GET electricity/my                   | WORKING |
| Guardian ward readings            | same screen via ward    | GET electricity/my (ward mode added) | WORKING |
| Bill detail (room-scoped)         | deep links              | GET electricity/:id (room-scoped)    | WORKING |

### 2.3 Not Accessible

| Actor           | Blocked Surface                       | Enforcement                    |
| --------------- | ------------------------------------- | ------------------------------ |
| tenant/guardian | all /electricity Next routes          | AdminLayout role guard         |
| tenant/guardian | other rooms bills                     | room-entry coverage check, 403 |
| tenant          | create/finalize/distribute/PUT/DELETE | adminOnly, 403                 |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                              | Element        | Status                |
| ---------------------------------------------------- | -------------- | --------------------- |
| Columns Month/Total/Rooms/Units/Status/Notes/Actions | DataTable      | WORKING (Units added) |
| Month + status filters                               | Input + Select | WORKING               |
| Summary StatCards billed/units/distributed/count     | StatCard       | WORKING (added)       |
| Full-set CSV export                                  | Button         | WORKING (added)       |
| Draft-only edit, non-distributed delete              | TableActions   | WORKING               |
| parseApiError on load/delete/export                  | errorParser    | WORKING (added)       |
| Custom SVG                                           | none           | NO CUSTOM SVG         |

### 3.2 Create

| Feature                                                     | Element           | Status                      |
| ----------------------------------------------------------- | ----------------- | --------------------------- |
| Month + total + room entries + readings + reconcile preview | FormSections      | WORKING (pre-existing rich) |
| Bill image upload                                           | Cloudinary widget | WORKING                     |
| Custom SVG                                                  | none              | NO CUSTOM SVG               |

### 3.3 Detail

| Feature                                                   | Element     | Status                               |
| --------------------------------------------------------- | ----------- | ------------------------------------ |
| StatCards total/rooms/units/room-total/variance + warning | StatCard    | WORKING                              |
| Finalize/Distribute/View Invoices actions                 | Button      | WORKING (View Invoices pre-existing) |
| Room entries table with floor column + room links         | table       | WORKING (floor added)                |
| Bill image/PDF viewer + upload/replace/remove             | DetailCard  | WORKING                              |
| parseApiError on load/finalize/distribute                 | errorParser | WORKING (added)                      |
| Custom SVG                                                | none        | NO CUSTOM SVG                        |

### 3.4 Edit

| Feature                                               | Element      | Status                      |
| ----------------------------------------------------- | ------------ | --------------------------- |
| Locked-state guard + readings editor + reconcile gate | FormSections | WORKING (pre-existing rich) |
| Custom SVG                                            | none         | NO CUSTOM SVG               |

## 4. Shared Components

| Component                                                                                                                                                               | Path | Status  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea/StatCard/DetailCard | ui/* | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/electricity.ts)

| Endpoint                                                  | Auth              | Status  |
| --------------------------------------------------------- | ----------------- | ------- |
| GET / (month/status; floor populate everywhere)           | adminOnly         | WORKING |
| GET /my (tenant + guardian ward mode)                     | authGuard + roles | WORKING |
| GET /:id (room-entry coverage for tenant/guardian)        | authGuard         | WORKING |
| POST / (reconcile hard block)                             | adminOnly         | WORKING |
| PUT /:id (locked-state guard)                             | adminOnly         | WORKING |
| POST /:id/finalize, /distribute (atomic claim + rollback) | adminOnly         | WORKING |
| POST/DELETE /:id/image (Cloudinary)                       | adminOnly         | WORKING |
| FSM exemplary; kept as pattern reference                  | —                 | WORKING |

### 5.2 Database Models

| Model           | Relation                                                    | Status  |
| --------------- | ----------------------------------------------------------- | ------- |
| ElectricityBill | roomEntries.roomId -> Room; variance snapshot; month unique | WORKING |
| Invoice/Payment | distribute writes electricity shares; balance-aware         | WORKING |

## 6. Missing Custom Components

| Component | Need                                   | Status |
| --------- | -------------------------------------- | ------ |
| none      | StatCards + tables cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                                                  | Status  |
| -------- | -------------------------------------------------------- | ------- |
| List     | Record, Export, View/Edit/Delete                         | WORKING |
| Detail   | Edit, Finalize, Distribute, View Invoices, image actions | WORKING |
| New/Edit | Save/Cancel                                              | WORKING |

## 8. SVG Inventory

| Location              | SVG         | Status        |
| --------------------- | ----------- | ------------- |
| All electricity pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location             | Status  |
| ------------------------- | -------------------- | ------- |
| List table + mobile cards | electricity/page.tsx | WORKING |
| CSV export (6 cols)       | electricity/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. List StatCards + Units column + CSV + parsers. 2. Detail floor column + parsers. 3. API floor populate everywhere. 4. Guardian /my ward mode + :id room coverage. 5. Flutter bill proof viewer.

## 11. Out of Scope for This Pass

1. distribute/generateSingleInvoice share derivation unification (verified consistent).
2. Checkout draft handling (drafts are not dues).

## 12. Pass 1 Fixes Applied

| Fix                                          | Files                                              | Status  |
| -------------------------------------------- | -------------------------------------------------- | ------- |
| List StatCards + Units + CSV + parsers       | apps/web/src/app/(admin)/electricity/page.tsx      | WORKING |
| Detail floor column + parsers                | apps/web/src/app/(admin)/electricity/[id]/page.tsx | WORKING |
| Floor populate on list/create/PUT responses  | apps/api/src/routes/electricity.ts                 | WORKING |
| Guardian /my ward mode; :id room-scoped read | apps/api/src/routes/electricity.ts                 | WORKING |
| Flutter bill proof image + external open     | electricity_screen.dart                            | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.
