# Complaints Module - Audit Pass 1

Module: complaints
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

complaints (filing, kanban triage, status FSM, photos, tenant notifications).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                           | Status  |
| ------ | ------------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/complaints/page.tsx -> /complaints                     | WORKING |
| Create | apps/web/src/app/(admin)/complaints/new/page.tsx -> /complaints/new             | WORKING |
| Detail | apps/web/src/app/(admin)/complaints/[id]/page.tsx -> /complaints/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/complaints/[id]/edit/page.tsx -> /complaints/[id]/edit | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                                  | Route                        | API Used                           | Status  |
| --------------------------------------- | ---------------------------- | ---------------------------------- | ------- |
| Complaints list + create (5 photo URLs) | complaints_screen.dart       | GET complaints/my, POST complaints | WORKING |
| Complaint detail                        | complaint_detail_screen.dart | GET complaints/:id                 | WORKING |

### 2.3 Not Accessible

| Actor            | Blocked Surface             | Enforcement            |
| ---------------- | --------------------------- | ---------------------- |
| tenant, guardian | all /complaints Next routes | AdminLayout role guard |
| tenant           | others complaints           | ownership check, 404   |
| guardian/other   | POST complaints             | role guard, 403        |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                                | Element            | Status                                 |
| ------------------------------------------------------ | ------------------ | -------------------------------------- |
| Table + kanban (DnD) + 4 stat cards + byCategory chips | DataTable/StatCard | WORKING (chips added)                  |
| Search + status/category/priority/date filters         | Input/Select       | WORKING (date added, dashboard-linked) |
| Room column with bed                                   | DataTable          | WORKING (added)                        |
| CSV export with Bed/Floor                              | Button             | WORKING (added)                        |
| Severity pills via statusToVariant                     | StatusBadge        | WORKING (unified)                      |
| parseApiError on load/kanban/delete/export             | errorParser        | WORKING (added)                        |
| Custom SVG                                             | none               | NO CUSTOM SVG                          |

### 3.2 Create

| Feature                                                       | Element         | Status                                     |
| ------------------------------------------------------------- | --------------- | ------------------------------------------ |
| Reporter section (active-tenant picker + auto room)           | ResourceSelect  | WORKING (rebuilt from hand-rolled selects) |
| Details section (category/priority/title/desc + scale legend) | FormSection     | WORKING                                    |
| Evidence section (5 URLs) + detail-page hint                  | FormSection     | WORKING                                    |
| Category prefill (?category=) + push created detail           | useSearchParams | WORKING                                    |
| parseApiError                                                 | errorParser     | WORKING                                    |
| Custom SVG                                                    | none            | NO CUSTOM SVG                              |

### 3.3 Detail

| Feature                                       | Element               | Status                    |
| --------------------------------------------- | --------------------- | ------------------------- |
| Reporter card name/room/bed/floor/email/phone | DetailCard            | WORKING (bed/floor fixed) |
| Details card + photos + admin notes           | DetailCard            | WORKING                   |
| Status update form (status path)              | form + PUT :id/status | WORKING                   |
| Severity via statusToVariant                  | StatusBadge           | WORKING (helper deleted)  |
| parseApiError on load/submit                  | errorParser           | WORKING (added)           |
| Custom SVG                                    | none                  | NO CUSTOM SVG             |

### 3.4 Edit

| Feature                                       | Element     | Status                        |
| --------------------------------------------- | ----------- | ----------------------------- |
| Reporter card (bed resolves via API)          | DetailCard  | WORKING                       |
| Priority scale legend via StatusBadge         | badges      | WORKING (hand-rolled deleted) |
| Critical remap deleted (model never emits it) | —           | REMOVED                       |
| parseApiError on load/submit                  | errorParser | WORKING (added)               |
| Custom SVG                                    | none        | NO CUSTOM SVG                 |

## 4. Shared Components

| Component                                                                                                                                           | Path                    | Status  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| tenantLabel/roomLabel/roomSublabel                                                                                                                  | resource-select-presets | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea | ui/*                    | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/complaints.ts)

| Endpoint                                                          | Auth       | Status  |
| ----------------------------------------------------------------- | ---------- | ------- |
| POST / (role guard; tenant room forced server-side)               | authGuard  | WORKING |
| GET / (status/category/priority enum-checked; stay chain + floor) | adminOnly  | WORKING |
| GET /my (full stay populate + map)                                | tenantOnly | WORKING |
| GET /:id (owner/admin)                                            | authGuard  | WORKING |
| PUT /:id/status (terminal transition guard)                       | adminOnly  | WORKING |
| PUT /:id (transition guard + notify + audit)                      | adminOnly  | WORKING |
| POST /:id/photos (audit added)                                    | authGuard  | WORKING |
| DELETE /:id                                                       | adminOnly  | WORKING |

### 5.2 Database Models

| Model             | Relation                                                              | Status  |
| ----------------- | --------------------------------------------------------------------- | ------- |
| Complaint         | tenantId/roomId; category/priority/status enums; virtuals tenant/room | WORKING |
| Tenant/Room/Floor | bedId + floor mapped into tenant shape                                | WORKING |

## 6. Missing Custom Components

| Component | Need                                     | Status |
| --------- | ---------------------------------------- | ------ |
| none      | Kanban + timeline-less detail sufficient | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                                       | Status  |
| -------- | --------------------------------------------- | ------- |
| List     | Filters, Export, View/Edit/Delete, kanban DnD | WORKING |
| Detail   | Edit, status Save                             | WORKING |
| New/Edit | Submit/Save/Cancel                            | WORKING |

## 8. SVG Inventory

| Location            | SVG         | Status        |
| ------------------- | ----------- | ------------- |
| All complaint pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                        | Location            | Status  |
| ----------------------------- | ------------------- | ------- |
| Table + kanban + mobile cards | complaints/page.tsx | WORKING |
| CSV export (12 cols)          | complaints/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. List room col + chips + date filter + parsers + pill unification. 2. New ResourceSelect rebuild + push detail. 3. Detail bed/floor + pill + parsers. 4. Edit legend + remap + parsers. 5. API guards/transitions/populate/audit/enums.

## 11. Out of Scope for This Pass

1. Status-history timeline (only resolvedAt tracked; no history collection).
2. Complaint category <-> service key canonical map (service enricher falls back safely).
3. Flutter detail https-only (API accepts http URLs; unchanged by decision).

## 12. Pass 1 Fixes Applied

| Fix                                                               | Files                                                  | Status  |
| ----------------------------------------------------------------- | ------------------------------------------------------ | ------- |
| Stay populate + bedId/floor mapping (list/:id/my)                 | apps/api/src/routes/complaints.ts                      | WORKING |
| POST role guard + tenant room forcing                             | apps/api/src/routes/complaints.ts                      | WORKING |
| Terminal transition guard both PUTs + filter enums + photos audit | apps/api/src/routes/complaints.ts                      | WORKING |
| List room col + chips + date filter + parsers + pills             | apps/web/src/app/(admin)/complaints/page.tsx           | WORKING |
| New rebuilt with ResourceSelect + sections + push detail          | apps/web/src/app/(admin)/complaints/new/page.tsx       | WORKING |
| Detail bed/floor + pill + parsers                                 | apps/web/src/app/(admin)/complaints/[id]/page.tsx      | WORKING |
| Edit legend + remap + parsers                                     | apps/web/src/app/(admin)/complaints/[id]/edit/page.tsx | WORKING |
| Flutter 5 photo URLs + validation                                 | complaints_screen.dart                                 | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.
