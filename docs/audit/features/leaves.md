# Leaves Module - Feature Listing

Module: leaves
Scope: admin web + API + DB + shared types + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-07 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/leaves_audit_pass1_20260907-234410.md

## 1. Admin vs End-User Access Map

### 1.1 Admin (apps/web, role admin only)

| Page   | Route                                                                   | Status  |
| ------ | ----------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/leaves/page.tsx -> /leaves                     | WORKING |
| Create | apps/web/src/app/(admin)/leaves/new/page.tsx -> /leaves/new             | WORKING |
| Detail | apps/web/src/app/(admin)/leaves/[id]/page.tsx -> /leaves/[id]           | WORKING |
| Review | apps/web/src/app/(admin)/leaves/[id]/edit/page.tsx -> /leaves/[id]/edit | WORKING |

### 1.2 End-User Tenant (mobile, role tenant only)

| Screen              | Route                               | API Used                              | Status  |
| ------------------- | ----------------------------------- | ------------------------------------- | ------- |
| Leave list + cancel | /tenant/leaves (leaves_screen.dart) | GET leaves/my, POST leaves/:id/cancel | WORKING |
| Create sheet        | _LeaveCreateSheet bottom sheet      | POST leaves                           | WORKING |

### 1.3 Not Accessible

| Actor            | Blocked Surface                         | Enforcement                  |
| ---------------- | --------------------------------------- | ---------------------------- |
| tenant, guardian | all /leaves Next routes                 | AdminLayout role guard       |
| admin            | all /tenant Flutter routes              | app_router.dart redirect     |
| tenant           | GET /leaves, PUT approve/reject, DELETE | adminOnly middleware, 403    |
| tenant           | other tenants leaves                    | ownership check, 403         |
| guardian         | ward-external leaves on :id             | Guardian ward check, 403     |
| guardian         | POST /leaves, GET /my                   | tenantOnly / role guard, 403 |

## 2. Admin Page-by-Page Feature Listing

### 2.1 List - leaves/page.tsx

| Feature                                                   | Element                          | Status        |
| --------------------------------------------------------- | -------------------------------- | ------------- |
| Columns Tenant/Room/Period/Days/Reason/Status/Actions     | DataTable                        | WORKING       |
| Search by tenant name (server)                            | Input -> search query            | WORKING       |
| Tenant filter                                             | ResourceSelect -> tenantId query | WORKING       |
| Status filter                                             | Select -> status query           | WORKING       |
| Pagination                                                | DataTable pagination             | WORKING       |
| Row click -> detail                                       | onRowClick                       | WORKING       |
| View/Edit/Delete (pending-only)                           | TableActions                     | WORKING       |
| New Leave + Export CSV (11 cols, RFC4180 + formula guard) | Button + Plus/Download           | WORKING       |
| Empty state + mobile cards (period + room)                | EmptyState + mobileCardRenderer  | WORKING       |
| Delete confirm + parseApiError                            | ConfirmModal                     | WORKING       |
| Custom SVG                                                | none, lucide only                | NO CUSTOM SVG |

### 2.2 Create - leaves/new/page.tsx

| Feature                                                    | Element                       | Status        |
| ---------------------------------------------------------- | ----------------------------- | ------------- |
| Applicant picker (active tenants) + room/bed/floor preview | ResourceSelect + preview card | WORKING       |
| From/To dates + duration preview + from<=to block          | date inputs + summary panel   | WORKING       |
| Reason templates + 500 counter                             | chips + Textarea maxLength    | WORKING       |
| Overlap 409 via parseApiError; push created detail         | api.post                      | WORKING       |
| Buttons Save Leave/Cancel                                  | FormActions                   | WORKING       |
| Custom SVG                                                 | none                          | NO CUSTOM SVG |

### 2.3 Detail - leaves/[id]/page.tsx

| Feature                                                   | Element                | Status        |
| --------------------------------------------------------- | ---------------------- | ------------- |
| Header title + badge + Review CTA                         | FormPage + StatusBadge | WORKING       |
| StatCards start/end/duration/status                       | StatCard               | WORKING       |
| Lifecycle stepper                                         | LeaveLifecycleStepper  | WORKING       |
| Tenant card (link, phone, room/bed/floor) + WhatsApp/copy | DetailCard             | WORKING       |
| Leave Details + decided-by row                            | DetailCard             | WORKING       |
| Attendance impact panel                                   | LeaveAttendanceImpact  | WORKING       |
| Reason + Admin Notes cards                                | DetailCard             | WORKING       |
| Approve/Reject with notes + parseApiError                 | Buttons + Textarea     | WORKING       |
| Record timestamps line                                    | muted text             | WORKING       |
| Custom SVG                                                | none, lucide only      | NO CUSTOM SVG |

### 2.4 Review - leaves/[id]/edit/page.tsx

| Feature                                             | Element                     | Status        |
| --------------------------------------------------- | --------------------------- | ------------- |
| Applicant card (tenant link, phone, room/bed/floor) | DetailCard                  | WORKING       |
| Period + duration tiles + StatusBadge + decided-by  | tiles                       | WORKING       |
| Attendance impact preview                           | LeaveAttendanceImpact       | WORKING       |
| Reason + admin notes editor (500 counter)           | Textarea                    | WORKING       |
| Approve/Reject + parseApiError                      | FormActions leading buttons | WORKING       |
| Existing admin notes section                        | FormSection                 | WORKING       |
| Stale Suspense wrapper / hand-rolled pill           | deleted                     | REMOVED       |
| Custom SVG                                          | none                        | NO CUSTOM SVG |

## 3. Shared Components

| Component                                                                                                                                                                          | Path                                                 | Status  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| LeaveLifecycleStepper                                                                                                                                                              | apps/web/src/components/ui/LeaveLifecycleStepper.tsx | WORKING |
| LeaveAttendanceImpact                                                                                                                                                              | apps/web/src/components/ui/LeaveAttendanceImpact.tsx | WORKING |
| StatusBadge/statusToVariant                                                                                                                                                        | StatusBadge.tsx + tokens.ts                          | WORKING |
| ResourceSelect/DataTable/TableActions/Select/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormGrid/FormFullWidth/FormActions/Input/Textarea/DetailCard/StatCard | ui/*                                                 | WORKING |

## 4. API Routes (apps/api/src/routes/leaves.ts, requireFeature attendanceEnabled)

| Endpoint                                                                 | Auth                   | Status  |
| ------------------------------------------------------------------------ | ---------------------- | ------- |
| POST /leaves (overlap 409, active-tenant, range 400, admin/tenant only)  | authGuard + role guard | WORKING |
| GET /leaves (status + tenantId + tenant-name search, bed/floor populate) | adminOnly              | WORKING |
| GET /leaves/my                                                           | tenantOnly             | WORKING |
| GET /leaves/:id (owner / ward / admin)                                   | authGuard              | WORKING |
| POST /leaves/:id/cancel (pending only)                                   | authGuard              | WORKING |
| DELETE /leaves/:id (pending+cancelled only)                              | adminOnly              | WORKING |
| PUT /leaves/:id/approve (pending only, overlap re-check, on_leave sync)  | adminOnly              | WORKING |
| PUT /leaves/:id/reject (pending only + adminNotes)                       | adminOnly              | WORKING |

## 5. Database Models

| Model                                         | Relation                                                                                        | Status  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| LeaveApplication (models/leaveApplication.ts) | tenantId -> Tenant; YYYY-MM-DD range; reason 500; status enum; approvedBy/approvedAt/adminNotes | WORKING |
| Tenant                                        | Leave.tenantId -> Tenant; roomId -> Room; bedId A-D                                             | WORKING |
| Room                                          | beds[].tenantId -> Tenant; virtual floor                                                        | WORKING |
| Floor                                         | Room.floorId -> Floor                                                                           | WORKING |
| User                                          | host identity; approvedBy -> User                                                               | WORKING |
| Guardian                                      | ward scope for GET :id                                                                          | WORKING |
| AttendanceRecord                              | on_leave upserts, check-in preserving, race-tolerant                                            | WORKING |

## 6. Tenant-Room-Bed-Tenant Chain (leaves flow)

| Association                                                                 | Status  |
| --------------------------------------------------------------------------- | ------- |
| List/detail populate tenant.user + tenant.room + nested floor; bedId mapped | WORKING |
| Approve -> attendance on_leave sync per day                                 | WORKING |
| Overlap invariant at create + approve re-check                              | WORKING |
| Range invariant from<=to (400 LEAVE_INVALID_RANGE)                          | WORKING |
