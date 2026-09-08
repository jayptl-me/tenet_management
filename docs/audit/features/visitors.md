# Visitors Module - Feature Listing

Module: visitors
Scope: admin web + API + DB + shared types + Flutter visitor desk (read-only mapping)
Source verified: 2026-09-07 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/visitors_audit_pass1_20260907-233246.md

## 1. Admin vs End-User Access Map

### 1.1 Admin (apps/web, role admin only)

| Page   | Route                                                                       | Status  |
| ------ | --------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/visitors/page.tsx -> /visitors                     | WORKING |
| Create | apps/web/src/app/(admin)/visitors/new/page.tsx -> /visitors/new             | WORKING |
| Detail | apps/web/src/app/(admin)/visitors/[id]/page.tsx -> /visitors/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/visitors/[id]/edit/page.tsx -> /visitors/[id]/edit | WORKING |

### 1.2 End-User Tenant (mobile, role tenant only)

| Screen           | Route                                            | API Used                                                  | Status  |
| ---------------- | ------------------------------------------------ | --------------------------------------------------------- | ------- |
| Visitors tab     | /tenant/visitors (visitors_tab_screen.dart)      | GET visitors/my                                           | WORKING |
| My visitors list | /visitor (visitor_home_screen.dart)              | GET visitors/my                                           | WORKING |
| Register visitor | /visitor/register (visitor_register_screen.dart) | POST visitors                                             | WORKING |
| Pass and status  | /visitor/status (visitor_status_screen.dart)     | GET visitors/:id, POST :id/arrive, :id/depart, :id/cancel | WORKING |

### 1.3 Not Accessible

| Actor            | Blocked Surface                                           | Enforcement                           |
| ---------------- | --------------------------------------------------------- | ------------------------------------- |
| tenant, guardian | all /visitors Next routes                                 | AdminLayout role guard                |
| admin            | all /visitor Flutter routes                               | app_router.dart redirect              |
| tenant           | GET /visitors, POST :id/approve, PUT/DELETE /visitors/:id | adminOnly middleware, 403             |
| tenant           | other tenants visitors                                    | ownership check vs active Tenant, 403 |
| guardian         | all /visitors API routes                                  | role guard, 403                       |

## 2. Admin Page-by-Page Feature Listing

### 2.1 List - visitors/page.tsx

| Feature                                                                            | Element                          | Status        |
| ---------------------------------------------------------------------------------- | -------------------------------- | ------------- |
| Columns Visitor/Phone/Purpose/Tenant/Room/Expected/CheckIn/CheckOut/Status/Actions | DataTable                        | WORKING       |
| Search by name/phone                                                               | Input -> search query            | WORKING       |
| Tenant filter                                                                      | ResourceSelect -> tenantId query | WORKING       |
| Status filter                                                                      | StatusFilterSelect               | WORKING       |
| Pagination                                                                         | DataTable pagination             | WORKING       |
| Row click -> detail                                                                | onRowClick                       | WORKING       |
| View/Edit/Delete actions                                                           | TableActions                     | WORKING       |
| Register Visitor + Export CSV (12 cols, RFC4180 + formula guard)                   | Button + Plus/Download           | WORKING       |
| Empty state + mobile cards (room + expected date)                                  | EmptyState + mobileCardRenderer  | WORKING       |
| Delete confirm                                                                     | ConfirmModal                     | WORKING       |
| Custom SVG                                                                         | none, lucide only                | NO CUSTOM SVG |

### 2.2 Create - visitors/new/page.tsx

| Feature                                               | Element                        | Status        |
| ----------------------------------------------------- | ------------------------------ | ------------- |
| Host picker (active tenants) + room/bed/floor preview | ResourceSelect + preview card  | WORKING       |
| Visitor name/phone + normalizeInPhone                 | Input + zod                    | WORKING       |
| Purpose input + quick-pick chips                      | Input + chip buttons           | WORKING       |
| Expected arrival + summary + past-date block          | datetime-local + summary panel | WORKING       |
| Submit -> POST visitors (TENANT_INACTIVE mapped)      | parseApiError                  | WORKING       |
| Buttons Register Visitor/Cancel                       | FormActions                    | WORKING       |
| Custom SVG                                            | none                           | NO CUSTOM SVG |

### 2.3 Detail - visitors/[id]/page.tsx

| Feature                                                 | Element                                           | Status        |
| ------------------------------------------------------- | ------------------------------------------------- | ------------- |
| Header title + pass code + badge + Edit CTA             | FormPage + StatusBadge                            | WORKING       |
| StatCards window/duration/host stay/pass code           | StatCard                                          | WORKING       |
| Lifecycle stepper + contextual actions                  | VisitorLifecycleStepper + VisitorLifecycleActions | WORKING       |
| Visitor info + WhatsApp                                 | DetailCard                                        | WORKING       |
| Host tenant link + phone + room/bed/floor + View tenant | DetailCard                                        | WORKING       |
| Gate pass card (passcode + copy + print)                | VisitorGatePassCard                               | WORKING       |
| Timeline + duration                                     | DetailCard                                        | WORKING       |
| Record meta created/updated/approvedBy/ID               | DetailCard                                        | WORKING       |
| Custom SVG                                              | none, lucide only                                 | NO CUSTOM SVG |
| Scripted layout                                         | printable gate pass (print CSS)                   | WORKING       |

### 2.4 Edit - visitors/[id]/edit/page.tsx

| Feature                                                | Element                  | Status        |
| ------------------------------------------------------ | ------------------------ | ------------- |
| Host context card (tenant link + room/bed/floor/phone) | read-only card           | WORKING       |
| Name/phone/purpose + chips                             | Input + chip buttons     | WORKING       |
| Schedule + old-vs-new arrival summary                  | datetime-local + summary | WORKING       |
| Status read-only (FSM guard)                           | readout box              | WORKING       |
| Save Changes/Cancel                                    | FormActions              | WORKING       |
| Custom SVG                                             | none                     | NO CUSTOM SVG |

## 3. Shared Components

| Component                                                                                                                                                       | Path                                                   | Status  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------- |
| VisitorLifecycleActions                                                                                                                                         | apps/web/src/components/ui/VisitorLifecycleActions.tsx | WORKING |
| VisitorLifecycleStepper                                                                                                                                         | apps/web/src/components/ui/VisitorLifecycleStepper.tsx | WORKING |
| VisitorGatePassCard                                                                                                                                             | apps/web/src/components/ui/VisitorGatePassCard.tsx     | WORKING |
| ResourceSelect/DataTable/TableActions/StatusBadge/StatusFilterSelect/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormGrid/FormActions/Input | ui/*                                                   | WORKING |

## 4. API Routes (apps/api/src/routes/visitors.ts, requireFeature visitorManagementEnabled)

| Endpoint                                                        | Auth            | Status  |
| --------------------------------------------------------------- | --------------- | ------- |
| POST /visitors (inactive-tenant 409 on admin path)              | admin or tenant | WORKING |
| GET /visitors (search + tenantId + status, room/floor populate) | adminOnly       | WORKING |
| GET /visitors/my                                                | tenantOnly      | WORKING |
| GET /visitors/:id (user + room + floor populate)                | admin or owner  | WORKING |
| POST /visitors/:id/arrive (expected only)                       | admin or owner  | WORKING |
| POST /visitors/:id/depart (arrived only)                        | admin or owner  | WORKING |
| POST /visitors/:id/cancel (expected only)                       | admin or owner  | WORKING |
| POST /visitors/:id/approve (cancelled only)                     | adminOnly       | WORKING |
| PUT /visitors/:id (no status field)                             | adminOnly       | WORKING |
| DELETE /visitors/:id                                            | adminOnly       | WORKING |

## 5. Database Models

| Model                       | Relation                                                            | Status  |
| --------------------------- | ------------------------------------------------------------------- | ------- |
| Visitor (models/visitor.ts) | tenantId -> Tenant; status enum; virtual tenant; name/phone aliases | WORKING |
| Tenant                      | Visitor.tenantId -> Tenant._id; roomId -> Room; bedId A-D           | WORKING |
| Room                        | beds[].tenantId -> Tenant; virtual floor                            | WORKING |
| Floor                       | Room.floorId -> Floor                                               | WORKING |
| User                        | host identity via Tenant.userId                                     | WORKING |

## 6. Tenant-Room-Bed-Tenant Chain (visitor flow)

| Association                                                                     | Status  |
| ------------------------------------------------------------------------------- | ------- |
| List populate tenant.user + tenant.room + nested floor                          | WORKING |
| Detail populate tenant.user + tenant.room + nested floor; bedId from tenant doc | WORKING |
| Admin create blocked for checked-out tenant (TENANT_INACTIVE)                   | WORKING |
| Tenant-scoped history + ownership checks                                        | WORKING |
