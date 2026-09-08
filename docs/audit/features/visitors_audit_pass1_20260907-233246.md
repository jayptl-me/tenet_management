# Visitors Module - Audit Pass 1

Module: visitors
Scope: admin web + API + DB + shared types + Flutter visitor desk (read-only mapping)
Source verified: 2026-09-07 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant/guardian routes

## 1. Selected Module

visitors (guest pre-registration, gate pass, expected -> arrived -> departed lifecycle with cancelled/approve branch).
Selected first because: legacy docs/audit/features/visitors.md has no pass1 timestamp file; tenants/rooms/attendance already carry pass1 files; visitors new (130 lines) and edit (171 lines) are the shallowest single-section admin flows in source; the tenant -> room -> bed -> tenant display chain is concretely broken in this flow (list populate omits room, detail omits bed/floor).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                       | Status            |
| ------ | --------------------------------------------------------------------------- | ----------------- |
| List   | apps/web/src/app/(admin)/visitors/page.tsx -> /visitors                     | WORKING WITH GAPS |
| Create | apps/web/src/app/(admin)/visitors/new/page.tsx -> /visitors/new             | SHALLOW           |
| Detail | apps/web/src/app/(admin)/visitors/[id]/page.tsx -> /visitors/[id]           | WORKING WITH GAPS |
| Edit   | apps/web/src/app/(admin)/visitors/[id]/edit/page.tsx -> /visitors/[id]/edit | SHALLOW           |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen           | Route                                                                                                    | API Used                                                  | Status                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Visitors tab     | /tenant/visitors (visitors_tab_screen.dart, 30 lines, embeds VisitorHomeScreen + FAB)                    | GET visitors/my                                           | WORKING                                                      |
| My visitors list | /visitor (visitor_home_screen.dart)                                                                      | GET visitors/my                                           | WORKING WITH GAPS (rows omit expected-arrival date)          |
| Register visitor | /visitor/register (visitor_register_screen.dart)                                                         | POST visitors (tenantId self-resolved, server overrides)  | WORKING (plain form, no purpose chips, no host-room context) |
| Pass and status  | /visitor/status (visitor_status_screen.dart, 396 lines, digital gate pass + copy + arrive/depart/cancel) | GET visitors/:id, POST :id/arrive, :id/depart, :id/cancel | WORKING (richest visitor screen, reference for admin parity) |

### 2.3 End-User Guardian (mobile, role guardian only)

| Screen       | Route                                        | Status                   |
| ------------ | -------------------------------------------- | ------------------------ |
| Visitor desk | none (visitor shell is tenant-authenticated) | NOT ACCESSIBLE BY DESIGN |

### 2.4 Not Accessible

| Actor            | Blocked Surface                                           | Enforcement                                         |
| ---------------- | --------------------------------------------------------- | --------------------------------------------------- |
| tenant, guardian | all /visitors Next routes                                 | AdminLayout role guard, redirects to /login         |
| admin            | all /visitor Flutter routes                               | app_router.dart redirects admin to /login           |
| tenant           | GET /visitors, POST :id/approve, PUT/DELETE /visitors/:id | adminOnly middleware, 403                           |
| tenant           | other tenants visitors on :id/arrive/depart/cancel        | tenant ownership check vs active Tenant.userId, 403 |
| guardian         | all /visitors API routes                                  | role guard, 403                                     |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List - visitors/page.tsx

| Feature                                                                    | Element                                    | Status                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Table columns Visitor/Phone/Purpose/Tenant/CheckIn/CheckOut/Status/Actions | DataTable                                  | WORKING                                                               |
| Room column                                                                | none (CSV exports Room but table hides it) | MISSING                                                               |
| Room value in CSV                                                          | v.tenant?.room?.roomNumber                 | BROKEN (list API populates tenant.user only, room always renders N/A) |
| Search by visitor name/phone                                               | none (API has no search param)             | MISSING                                                               |
| Tenant filter                                                              | none (API has no tenantId param)           | MISSING                                                               |
| Status filter expected/arrived/departed/cancelled                          | StatusFilterSelect                         | WORKING                                                               |
| Pagination page/perPage/total                                              | DataTable pagination                       | WORKING                                                               |
| Row click -> detail                                                        | onRowClick                                 | WORKING                                                               |
| View/Edit/Delete actions                                                   | TableActions                               | WORKING                                                               |
| Register Visitor button                                                    | Button + Plus icon -> /visitors/new        | WORKING                                                               |
| Export CSV RFC4180 + formula guard                                         | Button + Download icon                     | WORKING WITH GAP (Room column always N/A, see above)                  |
| Empty state                                                                | EmptyState + DoorOpen lucide icon          | WORKING                                                               |
| Mobile cards name/status/purpose/tenant                                    | mobileCardRenderer                         | WORKING WITH GAP (no room, no dates)                                  |
| Delete confirm                                                             | ConfirmModal + DELETE visitors/:id         | WORKING                                                               |
| Summary strip (expected today, inside now)                                 | none                                       | MISSING                                                               |
| Custom SVG                                                                 | none, lucide only                          | NO CUSTOM SVG (acceptable, no gap)                                    |
| Scripted layout                                                            | CSV export only                            | WORKING (no print layout; gate pass print covered in detail tasks)    |

### 3.2 Create - visitors/new/page.tsx (SHALLOW: 130 lines, one un-sectioned div, no FormSection)

| Feature                                                        | Element                                                    | Status                                                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tenant picker                                                  | ResourceSelect endpoint tenants, tenantLabel (name + Room) | WORKING WITH GAP (endpoint includes checked-out tenants; leaves/new uses tenants?isActive=true) |
| Tenant sublabel                                                | tenantSublabel (rent per month)                            | WORKING WITH GAP (rent is noise for hosting; room/bed/floor context not shown)                  |
| Selected-tenant context preview (room/bed/floor)               | none                                                       | MISSING                                                                                         |
| Visitor name/phone/purpose/expectedArrival                     | Input + zod + normalizeInPhone                             | WORKING                                                                                         |
| Purpose quick-pick chips (Family Visit, Delivery, Maintenance) | none, free text only                                       | MISSING                                                                                         |
| Arrival summary (relative day, lead time)                      | none                                                       | MISSING                                                                                         |
| Past-date guard on expectedArrival                             | none (schema min(1) only; API accepts any date)            | MISSING                                                                                         |
| Submit -> POST visitors                                        | api.post visitors                                          | WORKING                                                                                         |
| Error reporting                                                | generic string (no parseApiError code mapping)             | SHALLOW (edit page uses parseApiError)                                                          |
| Sectioned layout with icons/descriptions                       | none (plain div.space-y-5)                                 | MISSING (theme standard is FormSection + icon, cf tenants/new 4 sections)                       |
| Buttons Register Visitor/Cancel                                | FormActions                                                | WORKING                                                                                         |
| Custom SVG                                                     | none                                                       | NO CUSTOM SVG                                                                                   |

### 3.3 Detail - visitors/[id]/page.tsx (236 lines vs tenants detail 913)

| Feature                                                                        | Element                                                       | Status                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------- |
| Header title + status badge + Edit Visitor CTA                                 | FormPage + StatusBadge + Button/Pencil                        | WORKING                                                    |
| Lifecycle buttons expected->arrive/cancel, arrived->depart, cancelled->approve | VisitorLifecycleActions                                       | WORKING                                                    |
| Lifecycle stepper visualisation (expected/arrived/departed + cancelled branch) | none                                                          | MISSING                                                    |
| StatCards (visit day countdown, on-premise duration, terminal state)           | none                                                          | MISSING                                                    |
| Visitor info name/phone/purpose                                                | DetailCard/User                                               | WORKING                                                    |
| Host tenant name                                                               | DetailRow tenant.user.name                                    | WORKING                                                    |
| Host tenant contact + link to /tenants/:id                                     | none (name text only)                                         | MISSING                                                    |
| Host room number                                                               | DetailRow tenant.room.roomNumber                              | WORKING WITH GAP (populated on :id only)                   |
| Host bed + floor label                                                         | none (bedId sits unread on tenant doc; floor never populated) | BROKEN CHAIN (see 5.3)                                     |
| Gate pass card (short passcode + copy, admin parity with Flutter)              | none (raw Mongo ID in description)                            | MISSING                                                    |
| Print gate pass                                                                | none                                                          | MISSING                                                    |
| WhatsApp host / Copy pass details                                              | none (tenants detail has both patterns)                       | MISSING                                                    |
| Timeline expected/check-in/check-out/status                                    | DetailCard/Clock plain rows                                   | WORKING WITH GAP (no visit duration, no overdue highlight) |
| Record meta created/updated/approvedBy                                         | none (createdAt in interface, never rendered)                 | MISSING                                                    |
| Custom SVG                                                                     | none, lucide only                                             | NO CUSTOM SVG                                              |
| Scripted layout                                                                | none printable                                                | MISSING (gate pass print in tasks)                         |

### 3.4 Edit - visitors/[id]/edit/page.tsx (SHALLOW: single FormSection, 171 lines)

| Feature                                                              | Element                                                   | Status                        |
| -------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------- |
| Load GET visitors/:id + datetime-local remap                         | useForm zodResolver                                       | WORKING                       |
| Host context card (tenant/room/bed/floor read-only)                  | none (edits blind to hosting)                             | MISSING                       |
| Visitor name/phone/purpose/expectedArrival                           | Input + UserRound/Phone/DoorOpen icons + normalizeInPhone | WORKING                       |
| Purpose quick-pick chips                                             | none                                                      | MISSING                       |
| Arrival change summary (old vs new)                                  | none                                                      | MISSING                       |
| Past-date warning                                                    | none                                                      | MISSING                       |
| Status read-only box + FSM guidance                                  | styled div, status cannot be set                          | WORKING (P1-V1 guard correct) |
| Save Changes/Cancel                                                  | FormActions                                               | WORKING                       |
| Sectioned layout (host + details + schedule + status vs one section) | one FormSection only                                      | SHALLOW                       |
| Custom SVG                                                           | none                                                      | NO CUSTOM SVG                 |

## 4. Shared Components Used by Visitors

| Component                                                                                                                                        | Path                                                   | Status                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| VisitorLifecycleActions                                                                                                                          | apps/web/src/components/ui/VisitorLifecycleActions.tsx | WORKING (expected->arrive/cancel, arrived->depart, cancelled->approve, per-button loading) |
| VisitorLifecycleStepper                                                                                                                          | apps/web/src/components/ui/VisitorLifecycleStepper.tsx | MISSING (linear stepper + cancelled branch, theme tokens, aria-current)                    |
| VisitorGatePassCard                                                                                                                              | apps/web/src/components/ui/VisitorGatePassCard.tsx     | MISSING (short passcode from _id, host/purpose/timeline rows, copy + print, print CSS)     |
| ResourceSelect/SearchableSelect                                                                                                                  | ResourceSelect.tsx / SearchableSelect.tsx              | WORKING                                                                                    |
| DataTable/TableActions/StatusBadge/StatusFilterSelect/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormGrid/FormActions/Input | ui/*                                                   | WORKING                                                                                    |
| STATUS_COLOR_MAP expected info / arrived success / departed neutral / cancelled neutral                                                          | packages/types/src/tokens.ts                           | WORKING                                                                                    |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/visitors.ts, 515 lines, requireFeature visitorManagementEnabled)

| Endpoint                                                         | Auth                                                                    | Status                                                                                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| POST /visitors                                                   | admin or tenant (tenant tenantId server-overridden from active profile) | WORKING WITH GAP (admin path accepts checked-out tenant: findById without isActive check; tenant path requires active) |
| GET /visitors?page/limit/status                                  | adminOnly                                                               | WORKING WITH GAPS (no search, no tenantId filter; populates tenant.user only, no room)                                 |
| GET /visitors/my                                                 | tenantOnly, mounted before /:id                                         | WORKING (no tenant populate; own rows only)                                                                            |
| GET /visitors/:id                                                | admin or owner (IDOR vs active Tenant)                                  | WORKING WITH GAP (populates tenant.user + tenant.room(roomNumber); no floor; bedId unread by FE)                       |
| POST /visitors/:id/arrive (expected only, stamps actualArrival)  | admin or owner                                                          | WORKING (audit action update + details.transition arrive)                                                              |
| POST /visitors/:id/depart (arrived only, stamps actualDeparture) | admin or owner                                                          | WORKING (audit action update + details.transition depart)                                                              |
| POST /visitors/:id/cancel (expected only)                        | admin or owner                                                          | WORKING (audit action update + details.transition cancel)                                                              |
| POST /visitors/:id/approve (cancelled -> expected + approvedBy)  | adminOnly                                                               | WORKING (audit action visitor_approve)                                                                                 |
| PUT /visitors/:id (name/phone/purpose/expectedArrival only)      | adminOnly                                                               | WORKING (status intentionally omitted; P1-V1 closed in source)                                                         |
| DELETE /visitors/:id (hard delete)                               | adminOnly                                                               | WORKING                                                                                                                |

### 5.2 Database Models

| Model    | File              | Relation to Visitor                                                                                                                                                                                         | Status                                                                                                                                        |
| -------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor  | models/visitor.ts | tenantId -> Tenant._id required; status enum expected/arrived/departed/cancelled default expected; indexes (tenantId,expectedArrival),(status),(expectedArrival); virtual tenant; toJSON aliases name/phone | WORKING                                                                                                                                       |
| Tenant   | models/tenant.ts  | Visitor.tenantId -> Tenant._id; Tenant.roomId -> Room._id; Tenant.bedId A-D; virtuals user + room                                                                                                           | WORKING                                                                                                                                       |
| Room     | models/room.ts    | Tenant.roomId -> Room._id; beds[].tenantId -> Tenant._id; virtual floor                                                                                                                                     | WORKING                                                                                                                                       |
| Floor    | models/floor.ts   | Room.floorId -> Floor._id                                                                                                                                                                                   | WORKING                                                                                                                                       |
| User     | models/user.ts    | Tenant.userId -> User._id (host identity for visitor UI)                                                                                                                                                    | WORKING                                                                                                                                       |
| AuditLog | via writeAuditLog | create/update/delete/visitor_approve + update-with-transition on arrive/depart/cancel                                                                                                                       | WORKING (transition actions share update action; legacy docs claiming visitor_arrive/visitor_depart/visitor_cancel codes are stale vs source) |

### 5.3 Shared Entity Relationships (tenant-room-bed-tenant in visitor flow)

| Association                                            | Direction                                                        | Enforcement                      | Status                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| Visitor.tenantId -> Tenant (+ user + room) on list     | GET /visitors populate tenant.user only                          | none for room                    | BROKEN (FE reads tenant.room.roomNumber; always undefined; CSV Room always N/A)        |
| Visitor.tenantId -> Tenant (+ user + room) on detail   | GET /visitors/:id populate tenant.user + tenant.room(roomNumber) | populate present                 | WORKING WITH GAP (bedId present on tenant doc but FE ignores; floor never populated)   |
| Tenant.bedId -> Room.beds[bedId] display in visitor UI | read-only display                                                | none                             | MISSING (new/edit/detail show no bed)                                                  |
| Room.floorId -> Floor label display in visitor UI      | nested populate room.floor                                       | none                             | MISSING (no visitor endpoint populates floor)                                          |
| Admin registers visitor for checked-out tenant         | POST /visitors admin path                                        | no isActive check                | BROKEN (tenants PUT uses TENANT_INACTIVE 409 pattern; visitors POST has no equivalent) |
| Tenant-scoped visitor history                          | GET /visitors/my + ownership checks                              | active-Tenant lookup per request | WORKING                                                                                |

## 6. Missing Custom Components

| Component               | Need                                                                                                                                                                                                               | Status  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| VisitorLifecycleStepper | Horizontal stepper Expected -> Arrived -> Departed with Cancelled branch node; current-step highlight via theme tokens; aria-current; compact prop for cards                                                       | MISSING |
| VisitorGatePassCard     | Pass header + short uppercase passcode (last 6 of _id, Flutter parity), visitor/host/purpose/timeline rows, Copy details (clipboard), Print (window.print + print CSS isolating pass), theme tokens only, no emoji | MISSING |

## 7. Buttons Inventory (visitors scope)

| Location         | Buttons                                                                             | Status                                                           |
| ---------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| List header      | Register Visitor, Export CSV                                                        | WORKING                                                          |
| List rows        | View, Edit, Delete                                                                  | WORKING                                                          |
| List empty       | Register Visitor                                                                    | WORKING                                                          |
| List filter bar  | status select only                                                                  | PARTIAL (no search, no tenant filter)                            |
| Detail header    | Edit Visitor                                                                        | WORKING                                                          |
| Detail lifecycle | Mark Arrived, Cancel, Mark Departed, Re-approve (contextual)                        | WORKING                                                          |
| Detail extras    | none                                                                                | MISSING (Copy pass, Print pass, WhatsApp host, View host tenant) |
| New footer       | Register Visitor, Cancel                                                            | WORKING                                                          |
| Edit footer      | Save Changes, Cancel                                                                | WORKING                                                          |
| New/edit forms   | no quick-pick chips                                                                 | MISSING (purpose chips)                                          |
| Flutter register | Register visitor submit                                                             | WORKING                                                          |
| Flutter status   | Mark arrived, Cancel pass, Mark departed, copy pass, All visitors, Register another | WORKING                                                          |

## 8. SVG Inventory (visitors scope)

| Location                  | SVG                                                                                                                       | Status                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| All visitor admin pages   | lucide-react only (DoorOpen, Plus, Download, User, Phone, Home, Calendar, Clock, CheckCircle, Pencil, LogIn, LogOut, Ban) | WORKING (no custom SVG required) |
| Stepper/gate-pass visuals | CSS + lucide dots/cards                                                                                                   | NO CUSTOM SVG (by design)        |
| Flutter visitor screens   | Material icons only                                                                                                       | WORKING (no custom SVG)          |

## 9. Scripted Layouts Inventory (visitors scope)

| Layout                                               | Location                       | Status                                            |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------- |
| Responsive list table + mobile cards                 | visitors/page.tsx              | WORKING WITH GAP (mobile cards omit room/dates)   |
| CSV export layout (10 cols, RFC4180 + formula guard) | visitors/page.tsx handleExport | WORKING WITH GAP (Room always N/A pre-fix)        |
| FormCard create/edit                                 | visitors/new + [id]/edit       | SHALLOW (single/no sections)                      |
| Detail cards grid                                    | visitors/[id]                  | WORKING WITH GAPS (no stats, no stepper, no pass) |
| Printable gate pass layout                           | none                           | MISSING (VisitorGatePassCard print in tasks)      |
| Flutter digital pass card                            | visitor_status_screen.dart     | WORKING (reference layout)                        |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. API list: populate tenant.user(name email phone) + tenant.room(roomNumber floor) with nested floor(label floorNumber); add search (visitorName/name regex) + tenantId filters; keep pagination/sort/meta.
2. API detail: extend tenant.room populate with nested floor(label floorNumber); keep user select; no contract break (additive).
3. API create: admin path rejects checked-out tenant with TENANT_INACTIVE 409 (mirrors tenants PUT pattern); tenant self-path unchanged.
4. Build VisitorLifecycleStepper + VisitorGatePassCard under apps/web/src/components/ui (theme tokens, lucide only, no emoji); register both in .sixthrules/workflows/codebase-index.md + .claude/rules mirror.
5. Rebuild visitors/new: FormSections Host (ResourceSelect tenants?isActive=true + selected-tenant room/bed/floor preview), Visit details (purpose chips + inputs), Schedule (datetime-local + arrival summary + past-date warning); parseApiError errors; keep normalizeInPhone + POST visitors.
6. Rebuild visitors/[id]/edit: read-only host context card (tenant link, room/bed/floor) + metadata section + schedule section with old-vs-new arrival summary + status readout section; keep PUT shape (no status).
7. Enrich visitors/[id] detail: StatCards (visit-day state, on-premise duration, terminal/pending), stepper, gate pass card, host card (contact + tenant link + room/bed/floor), timeline with duration + overdue highlight, record meta (created/updated/approvedBy), Copy/WhatsApp/Print actions.
8. Enrich visitors list: search input (name/phone), tenant filter (ResourceSelect), Room column (populated), mobile cards room + expected date, keep CSV (Room now resolves) + status filter + pagination.
9. Keep portal boundaries: no Next tenant/guardian routes; no API source imports in web; Flutter read-only this pass.
10. Run bun run lint with zero warnings/errors; no test execution.

## 11. Out of Scope for This Pass

1. tenants/rooms/floors/guardians full module passes (only visitor-flow populate/display fixes above; no Tenant/Room/Floor schema changes).
2. Flutter visitor screens edits (audit mapping only; status screen stays the visual reference).
3. Admin list bulk actions; visitor photo capture; gate QR codes (no API fields back them).
4. Past-date hard block at API (FE warning only; Flutter picker already future-bounds).

## 12. Pass 1 Fixes Applied

| Fix                                                                                                                                                                                                                                                      | Files                                                   | Status  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------- |
| List/detail/create populate tenant.user + tenant.room(roomNumber floor) + nested floor(label floorNumber)                                                                                                                                                | apps/api/src/routes/visitors.ts (visitorTenantPopulate) | WORKING |
| List search (visitorName/phone regex) + tenantId filters                                                                                                                                                                                                 | apps/api/src/routes/visitors.ts GET /visitors           | WORKING |
| Admin create rejects checked-out tenant (TENANT_INACTIVE 409, mirrors tenants PUT)                                                                                                                                                                       | apps/api/src/routes/visitors.ts POST /visitors          | WORKING |
| VisitorLifecycleStepper component (linear stepper + cancelled branch, aria-current)                                                                                                                                                                      | apps/web/src/components/ui/VisitorLifecycleStepper.tsx  | WORKING |
| VisitorGatePassCard component (passcode parity, host/purpose/timeline, copy + print CSS)                                                                                                                                                                 | apps/web/src/components/ui/VisitorGatePassCard.tsx      | WORKING |
| Rebuilt register form: host section (active-tenants picker + room/bed/floor preview), details section (purpose chips), schedule section (arrival summary + past-date block), parseApiError                                                               | apps/web/src/app/(admin)/visitors/new/page.tsx          | WORKING |
| Rebuilt edit form: read-only host context card (tenant link + room/bed/floor/phone), details + purpose chips, schedule with old-vs-new summary, status readout section                                                                                   | apps/web/src/app/(admin)/visitors/[id]/edit/page.tsx    | WORKING |
| Enriched detail: StatCards (window/duration/host stay/pass code), stepper + lifecycle actions, gate pass card, host card (tenant link + contact + room/bed/floor), WhatsApp visitor, timeline duration, record meta (created/updated/approvedBy/ID copy) | apps/web/src/app/(admin)/visitors/[id]/page.tsx         | WORKING |
| Enriched list: search input, tenant filter, Room column (populated), Expected column, mobile cards room + expected date, CSV Bed + Floor columns (now resolve)                                                                                           | apps/web/src/app/(admin)/visitors/page.tsx              | WORKING |
| Trimmed legacy visitors.md to structured listings + working status only                                                                                                                                                                                  | docs/audit/features/visitors.md                         | WORKING |

Verification: bun run lint clean (oxlint 0 warnings/errors); no tests executed; no emojis; portal boundaries respected (no Next tenant routes, no API source imports in web, Flutter read-only).
