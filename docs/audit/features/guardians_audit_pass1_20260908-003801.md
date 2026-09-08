# Guardians Module - Audit Pass 1

Module: guardians
Scope: admin web + API + DB + Flutter guardian portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

guardians (linked contacts with portal login, ward scope, checkout coupling).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                         | Status  |
| ------ | ----------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/guardians/page.tsx -> /guardians                     | WORKING |
| Create | apps/web/src/app/(admin)/guardians/new/page.tsx -> /guardians/new             | WORKING |
| Detail | apps/web/src/app/(admin)/guardians/[id]/page.tsx -> /guardians/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/guardians/[id]/edit/page.tsx -> /guardians/[id]/edit | WORKING |

### 2.2 End-User Guardian (mobile, role guardian only)

| Screen                       | Route                        | API Used                          | Status  |
| ---------------------------- | ---------------------------- | --------------------------------- | ------- |
| Ward overview                | ward_screen.dart             | GET guardians/me/ward             | WORKING |
| Ward attendance + date range | ward_attendance_screen.dart  | ward/attendance (from/to wired)   | WORKING |
| Ward notices + pin chip      | guardian_notices_screen.dart | GET notices (unwrapped)           | WORKING |
| Profile + password           | guardian_profile_screen.dart | auth/me (ward-enriched), password | WORKING |

### 2.3 Not Accessible

| Actor            | Blocked Surface            | Enforcement            |
| ---------------- | -------------------------- | ---------------------- |
| tenant, guardian | all /guardians Next routes | AdminLayout role guard |
| guardian         | other wards                | ward match, 403        |
| tenant           | guardian mutations         | adminOnly, 403         |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                             | Element     | Status          |
| ----------------------------------- | ----------- | --------------- |
| Table + tenantId prefilter + search | DataTable   | WORKING         |
| Room + Email columns                | DataTable   | WORKING (added) |
| parseApiError on load/delete        | errorParser | WORKING (added) |
| Custom SVG                          | none        | NO CUSTOM SVG   |

### 3.2 Create

| Feature                                | Element               | Status            |
| -------------------------------------- | --------------------- | ----------------- |
| Linked resident section + stay preview | ResourceSelect        | WORKING (rebuilt) |
| Guardian details section with icons    | FormSection           | WORKING           |
| Temp credentials dialog                | TempCredentialsDialog | WORKING (adopted) |
| Active-tenants picker + parseApiError  | errorParser           | WORKING           |
| Custom SVG                             | none                  | NO CUSTOM SVG     |

### 3.3 Detail

| Feature                                                  | Element     | Status                                   |
| -------------------------------------------------------- | ----------- | ---------------------------------------- |
| Personal + status cards; tenant link with room/bed/floor | DetailCard  | WORKING (dead notes removed, stay added) |
| Record timestamps                                        | muted text  | WORKING                                  |
| parseApiError on load                                    | errorParser | WORKING (added)                          |
| Custom SVG                                               | none        | NO CUSTOM SVG                            |

### 3.4 Edit

| Feature                                       | Element     | Status                           |
| --------------------------------------------- | ----------- | -------------------------------- |
| Contact + flags sections; emergency hint text | FormSection | WORKING (dead checkbox replaced) |
| Custom SVG                                    | none        | NO CUSTOM SVG                    |

## 4. Shared Components

| Component                                                                                                                                  | Path                    | Status  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------- |
| tenantLabel/tenantSublabel                                                                                                                 | resource-select-presets | WORKING |
| TempCredentialsDialog                                                                                                                      | ui/*                    | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select | ui/*                    | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/guardians.ts)

| Endpoint                                       | Auth            | Status  |
| ---------------------------------------------- | --------------- | ------- |
| POST / (temp password once)                    | adminOnly       | WORKING |
| GET / (search/tenantId; bed/floor mapping)     | adminOnly       | WORKING |
| GET /:id, PUT /:id (User sync), DELETE /:id    | adminOnly       | WORKING |
| GET /me/ward, /me/ward/attendance (flag-gated) | guardian + flag | WORKING |

### 5.2 Database Models

| Model    | Relation                                                                          | Status  |
| -------- | --------------------------------------------------------------------------------- | ------- |
| Guardian | userId unique -> User; tenantId -> Tenant; isActive flipped on checkout/reinstate | WORKING |
| User     | guardian login + reset; secrets stripped in toPublicJSON                          | WORKING |

## 6. Missing Custom Components

| Component | Need                      | Status |
| --------- | ------------------------- | ------ |
| none      | Cards cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                                 | Status  |
| -------- | --------------------------------------- | ------- |
| List     | Add, Clear Filter, View/Edit/Deactivate | WORKING |
| Detail   | Edit, View Tenant                       | WORKING |
| New/Edit | Save/Cancel                             | WORKING |

## 8. SVG Inventory

| Location           | SVG         | Status        |
| ------------------ | ----------- | ------------- |
| All guardian pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location           | Status  |
| ------------------------- | ------------------ | ------- |
| List table + mobile cards | guardians/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. Guardian.isActive flips + tenant audits. 2. Floor mapping. 3. List columns + parsers. 4. New rebuild. 5. Detail stay + dead removal + parser. 6. Edit hint. 7. Flutter notices/date/enrichment.

## 11. Out of Scope for This Pass

1. Guardian address/notes fields (model has none; dead UI removed, not added).
2. Guardian Flutter leaves list (no guardian leaves UI; API ward read stays).

## 12. Pass 1 Fixes Applied

| Fix                                        | Files                                                                               | Status  |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | ------- |
| Guardian.isActive checkout/reinstate flips | apps/api/src/routes/tenants.ts                                                      | WORKING |
| Tenant create/delete/reinstate audits      | apps/api/src/routes/tenants.ts                                                      | WORKING |
| Checkout pending-payments block            | apps/api/src/routes/tenants.ts                                                      | WORKING |
| Floor mapping (5 populates + mapper)       | apps/api/src/routes/guardians.ts                                                    | WORKING |
| List room/email columns + parsers          | apps/web/src/app/(admin)/guardians/page.tsx                                         | WORKING |
| New rebuilt with preview + dialog          | apps/web/src/app/(admin)/guardians/new/page.tsx                                     | WORKING |
| Detail stay + dead notes removed + parser  | apps/web/src/app/(admin)/guardians/[id]/page.tsx                                    | WORKING |
| Edit emergency hint                        | apps/web/src/app/(admin)/guardians/[id]/edit/page.tsx                               | WORKING |
| toPublicJSON secret strip                  | apps/api/src/models/user.ts                                                         | WORKING |
| auth/me ward enrichment                    | apps/api/src/routes/auth.ts                                                         | WORKING |
| Flutter notices unwrap + ward dates        | guardian_repository.dart, ward_attendance_screen.dart, guardian_notices_screen.dart | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.
