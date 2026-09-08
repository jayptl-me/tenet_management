# Attendance Module - Audit Pass 1

Module: attendance (daily check-in/out, manual marking, corrections, today board, tenant self history, guardian ward history, leave sync)
Scope: admin web + API + DB + shared types + Flutter tenant/guardian portal (read-only mapping)
Source verified: 2026-09-07 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant/guardian routes

## 1. Selected Module

attendance (list, manual create, detail, edit, today summary, tenant self check-in/out + history, guardian ward history, leave-approval sync)

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page               | Route                                                                           | Status            |
| ------------------ | ------------------------------------------------------------------------------- | ----------------- |
| List + today board | apps/web/src/app/(admin)/attendance/page.tsx -> /attendance                     | WORKING WITH GAPS |
| Create manual      | apps/web/src/app/(admin)/attendance/new/page.tsx -> /attendance/new             | WORKING WITH GAPS |
| Detail             | apps/web/src/app/(admin)/attendance/[id]/page.tsx -> /attendance/[id]           | WORKING WITH GAPS |
| Edit               | apps/web/src/app/(admin)/attendance/[id]/edit/page.tsx -> /attendance/[id]/edit | WORKING WITH GAPS |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                  | Route                                       | API Used                                            | Status            |
| ----------------------- | ------------------------------------------- | --------------------------------------------------- | ----------------- |
| Today check-in/out card | /tenant/attendance (attendance_screen.dart) | POST attendance/check-in, POST attendance/check-out | WORKING WITH GAPS |
| Recent history list     | /tenant/attendance history section          | GET attendance/my                                   | WORKING WITH GAPS |
| Month calendar          | /tenant/attendance (none)                   | none (API has no range)                             | MISSING           |
| Date filter             | /tenant/attendance (none)                   | none                                                | MISSING           |

### 2.3 End-User Guardian (mobile, role guardian only)

| Screen                   | Route                                                      | API Used                         | Status                               |
| ------------------------ | ---------------------------------------------------------- | -------------------------------- | ------------------------------------ |
| Ward attendance list     | /guardian/attendance (ward_attendance_screen.dart)         | GET guardians/me/ward/attendance | WORKING WITH GAPS                    |
| Ward attendance calendar | /guardian/attendance (none, ward_screen promises calendar) | none                             | MISSING (promise text unimplemented) |
| Ward context header      | /guardian/attendance (none)                                | none                             | MISSING                              |

### 2.4 Not Accessible

| Actor               | Blocked Surface                                                                             | Enforcement                                          |
| ------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| tenant, guardian    | all /attendance Next routes                                                                 | AdminLayout role guard, redirects to /login          |
| admin               | all /tenant + /guardian Flutter routes                                                      | app_router.dart redirects admin to /login            |
| tenant              | POST /attendance/manual, GET /attendance, GET /attendance/today, PUT/DELETE /attendance/:id | adminOnly middleware, 403                            |
| guardian            | all /attendance/* direct (must use /guardians/me/ward/attendance)                           | role checks in GET /:id + guardians route guard, 403 |
| tenant (other)      | GET /attendance/:id of another tenant                                                       | owner check tenant.userId vs authUser.sub, 403       |
| guardian (non-ward) | GET /attendance/:id of non-ward tenant                                                      | ward check Guardian.tenantId vs record tenantId, 403 |
| visitor desk        | all attendance surfaces                                                                     | no route, no API access                              |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List - attendance/page.tsx

| Feature                                                          | Element                                                              | Status                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Header + Mark Attendance button                                  | PageHeader + Button/Plus -> /attendance/new                          | WORKING                                                      |
| Today summary board                                              | TodayAttendanceBoard selectedStatus -> statusFilter                  | WORKING                                                      |
| Search by tenant name                                            | Input -> search query (API User.name regex -> Tenant lookup)         | WORKING                                                      |
| Status filter All/Present/Absent/On Leave/Not Returned           | Select -> status query                                               | WORKING                                                      |
| Single date filter                                               | Input type=date -> date query                                        | WORKING WITH GAP (no from/to range; API supports only ?date) |
| Tenant picker filter                                             | none (API supports ?tenantId)                                        | MISSING                                                      |
| Method filter manual/app/qr                                      | none                                                                 | MISSING                                                      |
| Date-range filter with presets                                   | none (DateRangePicker exists but 0 usages)                           | MISSING                                                      |
| Month calendar view                                              | none (HeatmapCalendar exists but wired only to dashboard complaints) | MISSING (required custom calendar)                           |
| Export CSV                                                       | none (tenants list has it)                                           | MISSING (inconsistent)                                       |
| Bulk mark panel                                                  | none                                                                 | MISSING                                                      |
| Table columns Tenant/Room/Date/Status/Check In/Check Out/Actions | DataTable                                                            | WORKING                                                      |
| Room fallback                                                    | tenant.room.roomNumber ?? N/A (no roomId fallback)                   | WORKING WITH GAP                                             |
| Check In/Out render                                              | checkInTime/checkOutTime mapped aliases -> toLocaleTimeString        | WORKING                                                      |
| Pagination page/perPage/total                                    | DataTable pagination                                                 | WORKING                                                      |
| Row click -> detail                                              | onRowClick -> /attendance/:id                                        | WORKING                                                      |
| View/Edit/Delete actions                                         | TableActions                                                         | WORKING                                                      |
| Mobile cards actions                                             | TableActions showDelete=false                                        | PARTIAL (delete hidden on mobile cards only)                 |
| Delete confirm                                                   | ConfirmModal + DELETE attendance/:id                                 | WORKING                                                      |
| Empty state                                                      | EmptyState + ClipboardCheck + Mark Attendance CTA                    | WORKING                                                      |
| Custom SVG                                                       | none, lucide only                                                    | NO CUSTOM SVG                                                |
| Scripted layout                                                  | responsive table + mobile cards only; no print roster                | MISSING (calendar grid required, print deferred)             |

### 3.2 Create - attendance/new/page.tsx

| Feature                          | Element                                                           | Status                                                              |
| -------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| Tenant picker                    | ResourceSelect endpoint tenants?isActive=true + Room/Bed sublabel | WORKING WITH GAP (first page only, no pagination/limit param)       |
| Date                             | Input type=date                                                   | WORKING (native only, no calendar picker, no past/future guard)     |
| Status                           | Select present/absent/on_leave/not_returned                       | WORKING                                                             |
| Check-in/out time                | Input type=time                                                   | WORKING WITH GAP (no out<in block, no duration preview unlike edit) |
| Method                           | Select manual/app only (comment: QR not implemented for admin)    | WORKING WITH GAP (API accepts qr, UI omits it)                      |
| Notes                            | Textarea rows=3                                                   | WORKING (no max-500 hint; API enforces)                             |
| Duplicate date pre-check         | none (API 400 ALREADY_RECORDED only)                              | WORKING WITH GAP                                                    |
| Submit -> POST attendance/manual | api.post attendance/manual                                        | WORKING                                                             |
| Buttons Record Attendance/Cancel | FormActions                                                       | WORKING                                                             |
| Custom SVG                       | none                                                              | NO CUSTOM SVG                                                       |
| Calendar picker                  | native Input type=date only                                       | MISSING (custom calendar required)                                  |

### 3.3 Detail - attendance/[id]/page.tsx

| Feature                                  | Element                                                                  | Status                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Header title/badge/actions               | FormPage + StatusBadge + Edit/Delete Buttons                             | WORKING                                                              |
| StatCards Date/Status/Check-in/Check-out | StatCard + Calendar/CheckCircle/Clock icons                              | WORKING                                                              |
| Tenant Information card                  | DetailCard name/room/date                                                | WORKING WITH GAP (no bedId, no phone/email, no link to /tenants/:id) |
| Attendance Details card                  | DetailCard status + times                                                | WORKING                                                              |
| Recording Info Method/Recorded By        | methodIcons manual/qr/app + Monitor fallback + recordedBy.name ?? System | WORKING                                                              |
| Notes card                               | DetailCard warning variant (hidden when empty)                           | WORKING                                                              |
| Created/Updated footer                   | formatDateTime createdAt/updatedAt                                       | WORKING                                                              |
| Duration display                         | none (edit computes it, detail does not show)                            | MISSING                                                              |
| Leave linkage for on_leave rows          | none (no leaveId stored, no link)                                        | MISSING                                                              |
| Day prev/next nav                        | none                                                                     | MISSING                                                              |
| Month context / calendar strip           | none                                                                     | MISSING (required custom calendar)                                   |
| Tenant history timeline                  | none                                                                     | MISSING                                                              |
| Delete confirm                           | ConfirmModal + DELETE -> /attendance                                     | WORKING                                                              |
| Buttons Edit/Delete                      | Button outline/danger + Pencil/Trash2                                    | WORKING                                                              |
| Custom SVG                               | none, lucide only                                                        | NO CUSTOM SVG                                                        |
| Scripted layout                          | StatCards + 2-col DetailCards only; no print layout                      | MISSING (print deferred)                                             |

### 3.4 Edit - attendance/[id]/edit/page.tsx (shallow)

| Feature                              | Element                                                                  | Status                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Load GET attendance/:id + reset form | useForm zodResolver                                                      | WORKING                                                                         |
| Tenant read-only card                | DetailCard name + room/bed (dual-shape tenant vs tenantId, bedId ?? N/A) | WORKING WITH GAP (no tenant picker by design, no link to tenant)                |
| Date                                 | Input type=date + CalendarDays icon                                      | WORKING (native only, no calendar, no duplicate-date-on-change guard)           |
| Status                               | Select any of 4 (no FSM)                                                 | WORKING WITH GAP (on_leave editable with no leave link; any transition allowed) |
| Check-in/out time                    | Input type=time + Clock icons, optional                                  | WORKING WITH GAP (no required-when-present rule)                                |
| Duration calculator                  | useEffect display box (Xh Ym / Invalid (out<in))                         | WORKING WITH GAP (display-only, does not block submit)                          |
| Notes                                | Textarea rows=2                                                          | WORKING (no max hint)                                                           |
| Sections                             | single FormSection Attendance (vs tenants 5 sections)                    | WORKING WITH GAP (shallow)                                                      |
| Save Changes/Cancel                  | FormActions                                                              | WORKING                                                                         |
| Audit display                        | none (PUT writes audit, UI never shows)                                  | MISSING                                                                         |
| Delete in edit                       | none (delete only on list/detail)                                        | PARTIAL                                                                         |
| Custom SVG                           | none                                                                     | NO CUSTOM SVG                                                                   |
| Calendar picker                      | native Input type=date only                                              | MISSING (custom calendar required)                                              |

## 4. Shared Components Used by Attendance

| Component                                                                                                                                                | Path                                                | Status                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| TodayAttendanceBoard                                                                                                                                     | apps/web/src/components/ui/TodayAttendanceBoard.tsx | WORKING (Active/Present/Absent/Not Marked cards + click-to-filter + skeleton + error; omits On Leave card -> PARTIAL) |
| HeatmapCalendar                                                                                                                                          | apps/web/src/components/ui/HeatmapCalendar.tsx      | WORKING (generic month SVG grid; wired only to dashboard complaintHeatmap; not attendance-aware)                      |
| DateRangePicker                                                                                                                                          | apps/web/src/components/ui/DateRangePicker.tsx      | WORKING (2x native date inputs; 0 usages repo-wide -> dead)                                                           |
| TenantStayCalendar                                                                                                                                       | apps/web/src/components/ui/TenantStayCalendar.tsx   | OUT OF SCOPE (tenancy stay ranges, not attendance)                                                                    |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/StatCard/DetailCard/Input/Select/Textarea | ui/*                                                | WORKING                                                                                                               |
| ResourceSelect                                                                                                                                           | ResourceSelect.tsx (tenants?isActive=true on new)   | WORKING WITH GAP (first page only)                                                                                    |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes

| Endpoint                                                                              | Auth                                                                                        | Status                                                                                                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST /attendance/check-in {tenantId, method}                                          | authGuard (tenant self-enforced via Tenant.userId vs sub)                                   | WORKING (PG-TZ 5-23 window CHECKIN_WINDOW_CLOSED; duplicate guard + 11000 ALREADY_RECORDED; recordedBy admin only else null)                       |
| POST /attendance/check-out {tenantId}                                                 | authGuard (tenant self-enforced)                                                            | WORKING (requires today row NO_CHECKIN; rejects double ALREADY_CHECKED_OUT; forces status present even over on_leave -> WORKING WITH GAP)          |
| POST /attendance/manual {tenantId, date, status, checkIn, checkOut, method, notes}    | authGuard + adminOnly                                                                       | WORKING (duplicate guard + 11000; audit create; HH:mm -> Date parse; no out<in validation -> GAP)                                                  |
| GET /attendance?page/limit/status/date/tenantId/search                                | authGuard + adminOnly                                                                       | WORKING (search via User name regex -> Tenant ids -> filter; no fromDate/toDate, no method/floor/room filter -> MISSING range)                     |
| GET /attendance/today                                                                 | authGuard + adminOnly                                                                       | WORKING (summary total/present/absent/onLeave/notReturned; notReturned = active - records.length; mobile cannot call it -> MISSING portal summary) |
| GET /attendance/my?page/limit                                                         | authGuard (resolves Tenant by userId)                                                       | WORKING (no date/status/range filter; returns aliases checkInTime/checkOutTime without tenant populate -> MISSING range)                           |
| GET /attendance/:id                                                                   | authGuard + owner/ward boundary                                                             | WORKING (tenant own check, guardian ward check via Guardian.tenantId)                                                                              |
| PUT /attendance/:id {date, status, checkInTime/checkIn, checkOutTime/checkOut, notes} | authGuard + adminOnly                                                                       | WORKING (ISO + HH:mm parse; no out<in block; no duplicate-date-on-change guard; audit update)                                                      |
| DELETE /attendance/:id                                                                | authGuard + adminOnly                                                                       | WORKING (audit delete)                                                                                                                             |
| GET /guardians/me/ward/attendance?page/limit                                          | authGuard + guardian role + attendanceEnabled (plus guardianPortalEnabled via /me/*)        | WORKING (no range; lean + time aliases; no tenant populate -> MISSING context)                                                                     |
| Feature flags                                                                         | requireFeature attendanceEnabled on all attendance + leaves; guardianPortalEnabled on /me/* | WORKING (attendanceEnabled default false in AppConfig model + seed; mobile hides nav via GET /app-config)                                          |

### 5.2 Database Models

| Model                    | File                       | Relation to Attendance                                                                                                                                                                               | Status                                                           |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| AttendanceRecord         | models/attendanceRecord.ts | tenantId ObjectId ref Tenant required; date YYYY-MM-DD regex; checkIn/checkOut Date/null; status present/absent/on_leave/not_returned; method manual/qr/app; recordedBy ref User/null; notes max 500 | WORKING                                                          |
| AttendanceRecord indexes | same                       | unique {tenantId, date}; {date, status}                                                                                                                                                              | WORKING                                                          |
| Tenant                   | models/tenant.ts           | AttendanceRecord.tenantId -> Tenant._id; display needs Tenant -> User.name + Room.roomNumber double populate                                                                                         | WORKING WITH GAP (no floor/room/bed denorm; null room shows N/A) |
| LeaveApplication         | models/leaveApplication.ts | no leaveId on AttendanceRecord; leave approval upserts on_leave rows with notes Leave approved                                                                                                       | BROKEN (no traceability; see 5.3)                                |
| Guardian                 | models/guardian.ts         | ward attendance resolves Guardian(userId) -> tenantId -> AttendanceRecord match                                                                                                                      | WORKING                                                          |
| User                     | models/user.ts             | recordedBy -> User; tenant self resolve via Tenant.userId                                                                                                                                            | WORKING                                                          |

### 5.3 Shared Entity Relationships (tenant-room-bed-tenant + attendance-leave-guardian)

| Association                                                        | Direction                                                                                         | Enforcement                                                                                                                                                                        | Status                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AttendanceRecord.tenantId -> Tenant -> User.name + Room.roomNumber | read via double populate in list/detail/today/:id; raw + time aliases in /my + ward               | mapRecord tenant object vs raw dual shape                                                                                                                                          | WORKING WITH GAP (mobile needs ?? chains for checkInTime/checkIn; room null -> N/A with no roomId fallback)                                                                                                    |
| Tenant.userId <-> User backref for self flows                      | GET /my resolves Tenant by authUser.sub; check-in/out compares Tenant.userId vs sub               | owner checks + ensureTenantId self-heal on mobile                                                                                                                                  | WORKING                                                                                                                                                                                                        |
| Tenant.roomId+bedId -> Room.beds occupancy                         | transfers/checkout/delete free beds; attendance reads room for context only                       | txn + partial unique index on active room+bed; transfer pre-check outside txn (TOCTOU) + in-txn recheck + 11000 backstop; old-bed free paths lack ownership check except reinstate | WORKING WITH GAP (stale Tenant.roomId/bedId can clear another bed; attendance list then shows N/A room; strictly required fix lives in tenants pass; attendance must handle null room + link to tenant detail) |
| Guardian.tenantId -> Tenant (ward header)                          | mapGuardian builds tenant {_id, user, room} dropping bedId/isActive                               | none                                                                                                                                                                               | BROKEN (ward_screen bed shows -- and status always inactive; strictly required fix for guardian attendance context header)                                                                                     |
| Leave approval -> AttendanceRecord on_leave                        | markAttendanceOnLeave eachDateInclusive upsert per day, skips present-with-checkIn, 11000 swallow | internal only, no API range query on leaves or attendance                                                                                                                          | WORKING WITH GAP (no leaveId stored so detail cannot link leave; checkout/manual present silently overwrites on_leave; attendance calendar needs fromDate/toDate on both routers)                              |
| Room.occupancyCount stored vs live beds count                      | writers recount manually; readers (dashboard, BedOccupancyGrid) sum live                          | pre-save only on doc.save, skipped by findByIdAndUpdate; some saves omit markModified                                                                                              | WORKING WITH GAP (attendance today total uses Tenant.count active so unaffected; note only)                                                                                                                    |
| Check-in window vs device clock                                    | API uses PG-TZ todayInTZ/currentHourInTZ; mobile matches today via device DateTime string prefix  | none                                                                                                                                                                               | WORKING WITH GAP (TZ mismatch can mislabel today card near midnight; calendar must use API date strings)                                                                                                       |

## 6. Missing Custom Components

| Component                           | Need                                                                                                                                                                                                                                                                                                                        | Status                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AttendanceMonthCalendar             | Month grid calendar: status color per day (present/absent/on_leave/not_returned/unmarked), today ring, prev/next + Today controls, legend, click day -> day detail + deep-link to filtered list / record detail; theme tokens only, keyboard accessible buttons; reusable by admin list + detail + tenant + guardian shells | MISSING (HeatmapCalendar generic not wired; TodayAttendanceBoard summary only; DateRangePicker dead native inputs; ward_screen calendar promise unimplemented) |
| AttendanceRangeFilter               | Visual from/to picker with presets Today/Last 7/This month + clear, wired to new API fromDate/toDate query params                                                                                                                                                                                                           | MISSING (list has single date input only; /my + ward have no date query at all)                                                                                |
| AttendanceDayDetail                 | Selected-day panel: records + leave link + duration + method + recorded-by + links to record/tenant/leave                                                                                                                                                                                                                   | MISSING                                                                                                                                                        |
| Tenant picker filter for admin list | Searchable tenant select with room/bed sublabel reusing ResourceSelect pattern, wired to ?tenantId                                                                                                                                                                                                                          | MISSING (only new page has picker)                                                                                                                             |
| Export CSV                          | Parity with tenants list export                                                                                                                                                                                                                                                                                             | MISSING                                                                                                                                                        |
| Bulk mark panel                     | Date + multi-tenant select + status + times, one POST batch                                                                                                                                                                                                                                                                 | MISSING (deferred if batch API not added; single manual only)                                                                                                  |

## 7. Buttons Inventory (attendance scope)

| Location                   | Buttons                                                                               | Status                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Admin list header          | Mark Attendance                                                                       | WORKING                                                                            |
| Admin list board           | Active/Present/Absent/Not Marked (click-to-filter; no On Leave card)                  | PARTIAL                                                                            |
| Admin list rows            | View, Edit, Delete (mobile cards hide Delete)                                         | PARTIAL                                                                            |
| Admin list empty           | Mark Attendance                                                                       | WORKING                                                                            |
| Admin delete modal         | Confirm/Cancel                                                                        | WORKING                                                                            |
| Create footer              | Record Attendance, Cancel                                                             | WORKING                                                                            |
| Detail header              | Edit, Delete                                                                          | WORKING                                                                            |
| Edit footer                | Save Changes, Cancel                                                                  | WORKING                                                                            |
| Tenant today card          | Check In (disabled unless todayStatus null), Check Out (enabled only when checked_in) | WORKING WITH GAP (blocks re-check after auto absent/on_leave rows with no checkIn) |
| Guardian attendance header | Refresh, Sign out                                                                     | WORKING                                                                            |
| Guardian ward card         | Ward Attendance nav (promises calendar), PG Notices nav                               | PARTIAL (calendar promise unimplemented)                                           |

## 8. SVG Inventory (attendance scope)

| Location                         | SVG                                                                                                                                                                                  | Status                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Admin list/board/detail/edit/new | lucide-react only (Plus, ClipboardCheck, Users, CheckCircle, XCircle, Clock, Calendar, MapPin, QrCode, Smartphone, Monitor, FileText, Pencil, Trash2, UserRound, Hash, CalendarDays) | WORKING (no custom SVG required; calendar legend uses CSS dots, not SVG files) |
| Tenant/guardian attendance       | Material icons + StatusChip dots                                                                                                                                                     | WORKING (no custom SVG required)                                               |

## 9. Scripted Layouts Inventory (attendance scope)

| Layout                               | Location                   | Status                                                            |
| ------------------------------------ | -------------------------- | ----------------------------------------------------------------- |
| Responsive list table + mobile cards | attendance/page.tsx        | WORKING                                                           |
| Summary board grid                   | TodayAttendanceBoard.tsx   | WORKING                                                           |
| FormCard single-section create/edit  | attendance/new + [id]/edit | WORKING WITH GAP (shallow: 1 section; rebuild to visual sections) |
| Detail StatCards + DetailCards grid  | attendance/[id]            | WORKING                                                           |
| Month calendar grid layout           | none                       | MISSING (required AttendanceMonthCalendar)                        |
| Print roster layout                  | none                       | MISSING (deferred, not blocking flow)                             |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. Add API date-range support strictly for attendance flows: GET /attendance accepts fromDate/toDate (YYYY-MM-DD, $gte/$lte on date, keep ?date single-day working); GET /attendance/my accepts fromDate/toDate + status; GET /guardians/me/ward/attendance accepts fromDate/toDate; keep pagination + existing filters intact.
2. Add API attendance month summary strictly for calendar: GET /attendance/summary?fromDate&toDate (admin) returns per-day counts by status for populated tenant scope; reuse for tenant self + ward via existing /my + ward range (no new roles).
3. Build AttendanceMonthCalendar component in apps/web/src/components/ui (theme tokens, Mon-Sun grid, status colors, today ring, prev/next + Today, legend, onDayClick, keyboard accessible buttons) + AttendanceRangeFilter presets + AttendanceDayDetail panel; integrate into /attendance list above table and into /attendance/[id] as month-context card; wire day click to dateFilter/range + record links.
4. Rebuild admin list: add tenant picker filter (?tenantId), method filter, range filter, Export CSV parity with tenants, On Leave board card, empty-state CTAs intact, mobile cards show Delete parity.
5. Rebuild admin create: calendar-backed date pick, out<in block with duration preview, method includes qr, notes max-500 hint, duplicate-date inline message from API code, keep tenant picker + sublabels.
6. Rebuild admin detail: duration row, tenant link to /tenants/:id, leave-context line for on_leave (lookup leave covering date strictly via existing leaves API), day prev/next nav, month-context calendar card, recorded audit line.
7. Rebuild admin edit to feature-rich: visual sections (Record, Timing, Notes), calendar-backed date, FSM hint for on_leave (link leave), out<in hard block, duplicate-date-on-change guard message, audit line, keep read-only tenant card + add tenant link.
8. Fix guardian ward context strictly required for attendance header: include bedId + isActive in ward tenant payload (guardians.ts mapGuardian) so guardian attendance + ward screens show Bed + status correctly; no other guardian changes.
9. Handle null-room attendance rows: link to tenant detail, show roomId fallback text instead of bare N/A; no tenant/room schema changes in this pass.
10. Mirror calendar on Flutter strictly for attendance: tenant month strip + history filters via new range params; guardian month list grouping via new range params; keep Dio repos + role guards + feature-disabled widgets intact.
11. Keep portal boundaries: no Next tenant/guardian routes; no API source imports in web/Flutter; HTTP only.
12. Run bun run lint with zero warnings/errors; no test execution.

## 11. Out of Scope for This Pass

1. Leaves full module pass (only range + leave-lookup strictly for on_leave context).
2. Tenants/rooms/floors/guardians full passes (only ward bedId/isActive + null-room handling strictly for attendance context).
3. Meals/laundry/menus calendar reuse (AttendanceMonthCalendar built reusable, wiring deferred).
4. Bulk-mark batch API + print roster layout (deferred).
5. QR scan flow + User.tenantId stale-pointer cleanup (separate passes).

## 12. Addendum 2026-09-08 (all-modules sweep, source-verified)

| Severity          | Finding                                                       | Fix                                                                                            | Files                                                  | Status  |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------- |
| BROKEN            | check-in/check-out let guardian mark any tenant               | admin/tenant-self only, 403 others                                                             | apps/api/src/routes/attendance.ts                      | WORKING |
| BROKEN            | manual checkIn/checkOut free strings stored null/Invalid Date | HH:mm regex in manualSchema                                                                    | apps/api/src/routes/attendance.ts                      | WORKING |
| SHALLOW           | GET list status/method/date unvalidated                       | enum + YYYY-MM-DD checks                                                                       | apps/api/src/routes/attendance.ts                      | WORKING |
| SHALLOW           | new date regex + hand-rolled errors/labels                    | YYYY-MM-DD regex + parseApiError + tenantLabel                                                 | apps/web/src/app/(admin)/attendance/new/page.tsx       | WORKING |
| SHALLOW           | edit generic errors                                           | parseApiError                                                                                  | apps/web/src/app/(admin)/attendance/[id]/edit/page.tsx | WORKING |
| STALE (corrected) | Prior pass1 called new/edit shallow                           | Spot-check 2026-09-08: 3 FormSections, icons, duration preview, clash check — rich, no rebuild | apps/web/src/app/(admin)/attendance/new + [id]/edit    | WORKING |

Verification: bun run lint clean; bun run typecheck clean; no tests executed; no emojis.
