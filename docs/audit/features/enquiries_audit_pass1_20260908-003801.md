# Enquiries Module - Audit Pass 1

Module: enquiries
Scope: admin web + API + DB (public landing create; no Flutter surface)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; public POST rate-limited

## 1. Selected Module

enquiries (lead pipeline new -> contacted -> converted/lost + tenant conversion).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                         | Status  |
| ------ | ----------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/enquiries/page.tsx -> /enquiries                     | WORKING |
| Create | apps/web/src/app/(admin)/enquiries/new/page.tsx -> /enquiries/new             | WORKING |
| Detail | apps/web/src/app/(admin)/enquiries/[id]/page.tsx -> /enquiries/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/enquiries/[id]/edit/page.tsx -> /enquiries/[id]/edit | WORKING |

### 2.2 Public / Other

| Actor           | Surface                   | Enforcement                                                   |
| --------------- | ------------------------- | ------------------------------------------------------------- |
| anyone          | POST /enquiries (landing) | publicLimiter; source forced landing_page unless admin source |
| tenant/guardian | Next + admin API          | role guards, 403                                              |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                              | Element     | Status               |
| ---------------------------------------------------- | ----------- | -------------------- |
| StatCards + debounced search + status/source filters | StatCard    | WORKING              |
| Status with converted-tenant link                    | DataTable   | WORKING (link added) |
| tel/mailto links                                     | anchors     | WORKING              |
| parseApiError on load/delete                         | errorParser | WORKING (added)      |
| Custom SVG                                           | none        | NO CUSTOM SVG        |

### 3.2 Create

| Feature                                       | Element     | Status          |
| --------------------------------------------- | ----------- | --------------- |
| Contact/Requirement/Notes sections with icons | FormSection | WORKING (added) |
| parseApiError                                 | errorParser | WORKING (added) |
| Custom SVG                                    | none        | NO CUSTOM SVG   |

### 3.3 Detail

| Feature                                              | Element     | Status                            |
| ---------------------------------------------------- | ----------- | --------------------------------- |
| StatCards + outreach + conversion card               | cards       | WORKING                           |
| Converted-tenant link (populated) with name/room/bed | Button      | WORKING (phone fallback replaced) |
| Name search fallback for unlinked converts           | router      | WORKING (fixed from phone)        |
| Deduped Source/Sharing rows                          | DetailCard  | WORKING (duplicates removed)      |
| Status form with pinned/convert guards               | form        | WORKING                           |
| parseApiError on load/submit                         | errorParser | WORKING (added)                   |
| Custom SVG                                           | none        | NO CUSTOM SVG                     |

### 3.4 Edit

| Feature                                            | Element     | Status          |
| -------------------------------------------------- | ----------- | --------------- |
| Contact/follow-up sections                         | FormSection | WORKING         |
| Converted hidden as manual target + pinned disable | Select      | WORKING (added) |
| parseApiError on load/submit                       | errorParser | WORKING (added) |
| Custom SVG                                         | none        | NO CUSTOM SVG   |

## 4. Shared Components

| Component                                                                                                                                                | Path | Status  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/Select/Textarea/StatCard/DetailCard | ui/* | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/enquiries.ts)

| Endpoint                                                                  | Auth          | Status  |
| ------------------------------------------------------------------------- | ------------- | ------- |
| POST / (public; audit when authed)                                        | publicLimiter | WORKING |
| GET /stats, GET / (status/source enum-checked; convertedTenant populated) | adminOnly     | WORKING |
| GET /:id (convertedTenant populated)                                      | adminOnly     | WORKING |
| PUT /:id/status (transition guard)                                        | adminOnly     | WORKING |
| PUT /:id (transition guard)                                               | adminOnly     | WORKING |
| DELETE /:id                                                               | adminOnly     | WORKING |

### 5.2 Database Models

| Model   | Relation                                             | Status  |
| ------- | ---------------------------------------------------- | ------- |
| Enquiry | convertedTenantId -> Tenant; status/source enums     | WORKING |
| Tenant  | POST links enquiry converted in-txn; invalid id 400s | WORKING |

## 6. Missing Custom Components

| Component | Need                                            | Status |
| --------- | ----------------------------------------------- | ------ |
| none      | StatCards + conversion card cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                                         | Status  |
| -------- | ----------------------------------------------- | ------- |
| List     | New, View/Edit/Delete                           | WORKING |
| Detail   | Call/WhatsApp/Email, Edit, Convert, status Save | WORKING |
| New/Edit | Save/Cancel                                     | WORKING |

## 8. SVG Inventory

| Location          | SVG         | Status        |
| ----------------- | ----------- | ------------- |
| All enquiry pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                  | Location           | Status  |
| ----------------------- | ------------------ | ------- |
| List table + stat cards | enquiries/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. List converted link + parsers. 2. Detail link + fallback + dedup + guards + parsers. 3. Edit convert guard + parsers. 4. New sections + parsers. 5. API transition guards + populate + filter enums. 6. tenants POST invalid enquiryId 400 + drop redundant convert PUT.

## 11. Out of Scope for This Pass

1. temp-password dialog navigation (verified: onClose already pushes enquiry context; agent claim was wrong).
2. Anonymous-create audit (public route intentionally unaudited without actor).

## 12. Pass 1 Fixes Applied

| Fix                                                             | Files                                                 | Status  |
| --------------------------------------------------------------- | ----------------------------------------------------- | ------- |
| Transition guards both PUTs + filter enums + converted populate | apps/api/src/routes/enquiries.ts                      | WORKING |
| Invalid enquiryId 400 in tenants POST                           | apps/api/src/routes/tenants.ts                        | WORKING |
| Redundant markEnquiryConverted removed (+ unused toast import)  | apps/web/src/app/(admin)/tenants/new/page.tsx         | REMOVED |
| List converted link + parsers                                   | apps/web/src/app/(admin)/enquiries/page.tsx           | WORKING |
| Detail link + fallback + dedup + guards + parsers               | apps/web/src/app/(admin)/enquiries/[id]/page.tsx      | WORKING |
| Edit convert guard + parsers                                    | apps/web/src/app/(admin)/enquiries/[id]/edit/page.tsx | WORKING |
| New sections + parsers                                          | apps/web/src/app/(admin)/enquiries/new/page.tsx       | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; no tests executed; no emojis; portal boundaries respected.
