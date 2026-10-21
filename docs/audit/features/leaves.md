# Leaves Module - Feature Listing

Module: leaves
Scope: admin web + API + DB + shared types + Flutter tenant portal (read-only mapping)
Source verified: 2026-10-21 (depth rebuild of the four admin screens, wave 6)
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/leaves_audit_pass1_20260907-234410.md
Contract: packages/types/src/contracts/leaves.ts (state machine, truth contract, layout, next best action)

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

### 2.1 List - leaves/page.tsx (the queue and the decided history)

| Feature                                                                                     | Element                        | Status  |
| ------------------------------------------------------------------------------------------- | ------------------------------ | ------- |
| The queue as the root: the waiting requests as cards, one per resident                      | LeaveQueueCard                 | WORKING |
| Approve, reject with a reason and cancel on the card, with the server answer in a banner    | Button + Textarea + Confirm    | WORKING |
| What the decision costs on every card: the days it writes, and the rent it does not touch    | inline panel                   | WORKING |
| The decided history as a ledger: resident, window, days, reason, decision, status            | DataTable                      | WORKING |
| Every filter in the address bar (status tab, resident name, resident, window)                 | useUrlSearch + useUrlState     | WORKING |
| The counts of the tabs, read for the same filtered set the rows show                         | useQueries over the list route | WORKING |
| The band: requests waiting for a decision, the leave days they cover, the leaves on record   | PageBand                       | WORKING |
| The queue card links the resident, the room and the leave                                    | Link                           | WORKING |
| An export that walks the pages the API clamps and reports both numbers                        | Button + Download              | WORKING |
| Filter aware empty states, one per view                                                      | EmptyState                     | WORKING |
| A delete whose confirm says that the resident is not told                                    | ConfirmModal                   | WORKING |
| Custom SVG                                                                                   | none, lucide only               | NO CUSTOM SVG |

### 2.2 Create - leaves/new/page.tsx

| Feature                                                                       | Element                       | Status  |
| ------------------------------------------------------------------------------ | ----------------------------- | ------- |
| Resident picker (active residents) and the stay preview read from the server   | ResourceSelect + useApiQuery  | WORKING |
| The window, the inclusive day count and the rule the server applies             | DatePicker + summary panel    | WORKING |
| The reason, the templates and the 500 counter                                   | Textarea + chips              | WORKING |
| What the save commits, and that the resident is told at the decision, not now  | FormSection                   | WORKING |
| The server refusals surfaced (overlap, range, inactive resident)                | parseApiError                 | WORKING |
| The created record is opened, not the list                                      | router.push                   | WORKING |
| Custom SVG                                                                      | none                          | NO CUSTOM SVG |

### 2.3 Detail - leaves/[id]/page.tsx

| Feature                                                                     | Element                    | Status  |
| ---------------------------------------------------------------------------- | -------------------------- | ------- |
| The leave, the days it covers and the decision the server committed          | DetailCard                 | WORKING |
| The attendance records the leave wrote: day, state, check in, method, note   | table over GET /attendance | WORKING |
| The notification the resident received, and whether they opened it          | GET /notifications         | WORKING |
| The write trail of the leave, with the 90 day life of the audit entries      | GET /audit-logs            | WORKING |
| The resident, their bed and the rent on their record                         | DetailCard + GET /tenants  | WORKING |
| The lifecycle, rendered from the shared vocabulary                           | StatusStepper              | WORKING |
| Approve, reject with a reason and cancel, in the header                     | FormPage actions            | WORKING |
| The write result of the decision, in the server's words                       | inline banner              | WORKING |
| Custom SVG                                                                    | none, lucide only          | NO CUSTOM SVG |

### 2.4 Review - leaves/[id]/edit/page.tsx

| Feature                                                          | Element                   | Status  |
| ----------------------------------------------------------------- | ------------------------- | ------- |
| The record read through the shared query stack                   | useApiQuery               | WORKING |
| The resident, the window, the reason and the attendance preview   | DetailCard + LeaveAttendanceImpact | WORKING |
| The three decisions and what each one does                       | FormSection + Button      | WORKING |
| The reason of the office, only where the server carries one      | Textarea                  | WORKING |
| The confirm of a cancellation                                    | ConfirmModal              | WORKING |
| Custom SVG                                                       | none, lucide only         | NO CUSTOM SVG |

## 3. Shared Components

| Component                                                                                                                                          | Path                                                 | Status  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| StatusStepper (the shared lifecycle stepper; the leave lifecycle comes from packages/types/src/lifecycle.json)                                            | apps/web/src/components/ui/StatusStepper.tsx         | WORKING |
| LeaveAttendanceImpact                                                                                                                              | apps/web/src/components/ui/LeaveAttendanceImpact.tsx | WORKING |
| PageBand, StatusTabs, FilterChips, ContentFrame                                                                                                     | ui/*                                                 | WORKING |
| DataTable, StatusBadge, StatusStepper, DetailCard, EmptyState, PageHeader, ErrorBanner                                                               | ui/*                                                 | WORKING |
| FormPage, FormCard, FormSection, FormActions, Textarea, Input, Button, ConfirmModal, TableActions, ResourceSelect, DatePicker, DateRangePicker      | ui/*                                                 | WORKING |

## 4. API Routes (apps/api/src/routes/leaves.ts, requireFeature attendanceEnabled)

| Endpoint                                                                 | Auth                   | Status  |
| ------------------------------------------------------------------------ | ---------------------- | ------- |
| POST /leaves (overlap 409, active-tenant, range 400, admin/tenant only)  | authGuard + role guard | WORKING |
| GET /leaves (status + tenantId + tenant-name search, bed/floor populate) | adminOnly              | WORKING |
| GET /leaves/my                                                           | tenantOnly             | WORKING |
| GET /leaves/:id (owner / ward / admin)                                   | authGuard              | WORKING |
| POST /leaves/:id/cancel (pending only, notifies the resident)            | authGuard              | WORKING |
| DELETE /leaves/:id (pending+cancelled only, silent)                      | adminOnly              | WORKING |
| PUT /leaves/:id/approve (pending only, overlap re-check, on_leave sync)  | adminOnly              | WORKING |
| PUT /leaves/:id/reject (pending only + adminNotes, notifies the resident) | adminOnly              | WORKING |

## 5. Database Models

| Model                                         | Relation                                                                                        | Status  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| LeaveApplication (models/leaveApplication.ts) | tenantId -> Tenant; YYYY-MM-DD range; reason 500; status enum; approvedBy/approvedAt/adminNotes | WORKING |
| Tenant                                        | Leave.tenantId -> Tenant; roomId -> Room; bedId A-D; the rent is raised from this record       | WORKING |
| Room                                          | beds[].tenantId -> Tenant; virtual floor                                                        | WORKING |
| Floor                                         | Room.floorId -> Floor                                                                           | WORKING |
| User                                          | host identity; approvedBy -> User                                                               | WORKING |
| Guardian                                      | ward scope for GET :id                                                                          | WORKING |
| AttendanceRecord                              | on_leave upserts, check-in preserving, race-tolerant                                            | WORKING |
| Notification                                   | the service_update the decision pushes, with the reason in the body                              | WORKING |
| AuditLog                                      | create/update/delete on all mutations, kept for 90 days                                          | WORKING |

## Open gaps

The rows below are the findings of the depth pass of 2026-10-21 that the rebuild could not close,
because the gap sits in the API, in the model or in the shared types. The rows the rebuild closed are
recorded in the Closed section below with their date; their ids are the ones of the depth pass (the
section at the end of this file).

| ID         | Severity | Gap                                                                                                                                                                                                                                                                                                                                                                                          | Path                                 |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| LVE-D3-1   | P2       | A hard delete is silent. DELETE /leaves/:id refuses a record that is neither pending nor cancelled, removes the row and writes a delete audit entry, and sends the resident nothing (apps/api/src/routes/leaves.ts:577-605). The confirm dialog says so before the write, and the resident is still never told.                                                                                     | apps/api/src/routes/leaves.ts         |
| LVE-D3-2   | P2       | An approval cannot carry a reason to the resident. PUT /leaves/:id/approve takes no body (apps/api/src/routes/leaves.ts:608-683), so adminNotes is never written on that path and the notification body carries no note (apps/api/src/routes/leaves.ts:193-201). The screens say so before the write: the office can only explain a refusal, never an approval.                                     | apps/api/src/routes/leaves.ts         |
| LVE-D3-3   | P2       | The attendance board does not say which leave wrote a row. The row the approval writes carries the state on_leave, the method manual and the note Leave approved, but no reference to the leave (apps/api/src/routes/leaves.ts:56-63), so an office cannot trace a row back to the request that wrote it and cannot undo it from the record.                                                                                     | apps/api/src/models/attendanceRecord.ts |
| LVE-D3-4   | P2       | The notifications route cannot filter by record. GET /notifications reads the type, the read state and the page only (apps/api/src/routes/notifications.ts:26-54), so the leave page reads the hundred most recent service updates and looks for its own. A decision older than that page reads as not told, although the server holds the notification.                                                          | apps/api/src/routes/notifications.ts  |
| LVE-D3-5   | P2       | The list route computes no aggregate over the pending requests, so the module own number, the leave days waiting for a decision, is counted by the screen over the first hundred pending rows the server returns (apps/api/src/routes/leaves.ts:329-411). A queue longer than one page undercounts the days, and the screen says so.                                                                                     | apps/api/src/routes/leaves.ts         |
| LVE-D3-6   | P3       | The list route sorts by the moment the request was filed and by nothing else (apps/api/src/routes/leaves.ts:395), so the office cannot ask for the request that waits longest, nor for the window that starts first.                                                                                                                                                                                                          | apps/api/src/routes/leaves.ts         |
| LVE-D3-7   | P3       | The leave model does not say who filed the request (apps/api/src/models/leaveApplication.ts:17-78), so the queue cannot tell a request the resident filed from one the office recorded on their behalf.                                                                                                                                                                                                    | apps/api/src/models/leaveApplication.ts |
| LVE-D3-8   | P3       | The write trail of a leave is not permanent evidence: the audit entries expire after 90 days (apps/api/src/models/auditLog.ts:82), so a decision that reached nobody leaves no trace after a quarter.                                                                                                                                                                                                              | apps/api/src/models/auditLog.ts       |
| LVE-D3-9   | P3       | There is no shared leave type. The four admin screens declare their own interfaces and packages/types/src has no leave module, so the shape of the leave on the screen can drift from the shape the API answers with.                                                                                                                                                                                                                                                    | packages/types/src                    |
| LVE-P3-1   | P3       | Printable leave letter layout absent (deferred, not blocking)                                                                                                                                                                                                                                                                                                                                                                                                   | apps/web/src/app/(admin)/leaves/[id]/page.tsx |
| LVE-P3-2   | P3       | Bulk approve and reject absent; no API surface backs it                                                                                                                                                                                                                                                                                                                                                                                                         | apps/api/src/routes/leaves.ts         |
| LVE-P3-3   | P3       | No guardian leaves list in the Flutter portal (deferred product decision)                                                                                                                                                                                                                                                                                                                                                                                       | mobile/lib/features/guardian          |

## Closed

| Claim                                                                                                                             | Live proof                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LVE-P2-1 - the pending queue summary strip was absent from the list and the list stayed table-first                                     | CLOSED 2026-10-21 - the root of the module is the queue: the waiting requests are cards that carry the decisions, and the decided ones are the ledger behind the tabs                                                                                                              |
| LVE-D2-1 - the filters did not live in the address bar, so a view of the module could not be linked or cited                           | CLOSED 2026-10-21 - the status tab, the resident name, the resident and the window all live in the address bar, so /leaves?status=pending lands on the queue and every view of the module is a link                                                                                                |
| LVE-D2-2 - the list had no band and no counts, so the office could not see how much was waiting                                    | CLOSED 2026-10-21 - the band names the scope of every number, the tabs carry the server counts of the same filtered set the rows show, and the module own number, the leave days waiting for a decision, is on the band                                                                   |
| LVE-D2-3 - the decision cost was not visible and nothing said that a leave does not change the rent                                | CLOSED 2026-10-21 - the queue card and the leave page state what an approval writes on the attendance board and that the bill is raised from the resident own record, so a leave is not a deduction                                                                                                        |
| LVE-D2-4 - the office could not decide from where it stood                                                                    | CLOSED 2026-10-21 - approve, reject with a reason and cancel sit on the queue card and on the leave page, and the server answer is written on the screen instead of a local success toast                                                                                                                         |
| LVE-D2-5 - the resident was not a link anywhere on the module                                                                    | CLOSED 2026-10-21 - every resident of the queue, the ledger, the leave page and the review screen is a link to the resident record                                                                                                                               |
| LVE-D2-6 - the CSV export asked for a thousand rows and the server clamps a page to a hundred                                     | CLOSED 2026-10-21 - the export walks the pages of the filtered set and reports the leaves the server holds against the leaves the file carries                                                                                                                                |
| LVE-D2-7 - the delete confirm did not say that the resident is not told                                                          | CLOSED 2026-10-21 - the confirm states that the server removes the record, writes the delete entry and sends the resident nothing, and that cancelling the request instead tells them                                                                                                           |
| LVE-D2-8 - the leave page opened with four statistic tiles and the decisions sat at the bottom of the page                        | CLOSED 2026-10-21 - the tile band is gone, the protagonist is what the decision does, and the three decisions sit in the header within one viewport of the top                                                                                                                  |
| LVE-D2-9 - the leave page showed the days of the window but not the attendance records the leave wrote                           | CLOSED 2026-10-21 - the leave page reads the attendance rows of the window and shows the state, the check in, the method and the note of every row                                                                                                                         |
| LVE-D2-10 - the office could not see whether the resident was told                                                               | CLOSED 2026-10-21 - the leave page reads the notification the server holds for the leave and says whether the resident has opened it                                                                                                                              |
| LVE-D2-11 - the leave page had no write trail although the audit route can filter by the record                                   | CLOSED 2026-10-21 - the leave page shows the write trail of that leave, with the 90 day life of the entries                                                                                                                                                 |
| LVE-D2-12 - the review screen read the record with a hand written fetch and pushed state from an effect                           | CLOSED 2026-10-21 - the record is read with the shared query stack, the screen is keyed by the record, and no state is pushed from an effect                                                                                                                          |
| LVE-D2-13 - a rejection could be sent with no reason, and the resident then reads a refusal with no explanation                     | CLOSED 2026-10-21 - a rejection cannot be sent without a reason, and the screens say that the reason travels in the notification body                                                                                                                            |
| LVE-D2-14 - the day count of a window was counted by the screen in local time and could differ from the server by one day         | CLOSED 2026-10-21 - every screen counts the window the way the server counts it, from the first day to the last day, in UTC                                                                                                                                    |
| LVE-D2-15 - the create form did not say what the save commits and the resident was never told about it                            | CLOSED 2026-10-21 - the form states that the save files the request, that the attendance board is not touched by it, and that the resident is told when the request is decided                                                                                                    |
| LVE-D2-16 - the create form read the stay of the resident outside the shared query stack                                         | CLOSED 2026-10-21 - the stay is read with useApiQuery, so the preview and the save read the same record                                                                                                                                                     |
| LVE-D2-17 - the module opened with four statistic tiles and no visual protagonist                                                | CLOSED 2026-10-21 - the queue of cards is the protagonist of the module root and the leave page leads with what the decision does                                                                                                                                 |

## Depth pass (2026-10-21): the four admin screens rebuilt to the depth standard

Pass: depth (wave 6 of the depth program).
Method: the three gates and the per-module contract of
`docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` (gate A truth, gate B flow, gate C layout), applied to
the admin screens of this module. Every claim below was read out of source on 2026-10-21 and is
cited as `file:line`.
Precedent: `docs/audit/features/tenants_audit_pass1_20260908-230000.md`.

### 1. Inventory

| Artifact          | Path                                               | Lines | Notes                                          |
| ----------------- | -------------------------------------------------- | ----- | ---------------------------------------------- |
| Leaves (root)     | apps/web/src/app/(admin)/leaves/page.tsx          | 1113  | The queue, the ledger, the band, the decisions  |
| Leave (detail)    | apps/web/src/app/(admin)/leaves/[id]/page.tsx     | 872   | The record, the rows it wrote, the notification |
| Leave (create)    | apps/web/src/app/(admin)/leaves/new/page.tsx      | 341   | The form and what the save commits              |
| Leave (review)    | apps/web/src/app/(admin)/leaves/[id]/edit/page.tsx | 400  | The decision screen with the reason             |
| API route         | apps/api/src/routes/leaves.ts                     | 753   | 8 endpoints, one notification helper           |
| Model             | apps/api/src/models/leaveApplication.ts           | 83    | Four statuses, the window, the office notes    |
| Contract          | packages/types/src/contracts/leaves.ts            | 291   | State machine, truth contract, layout, actions |

### 2. What the operator is doing here

The operator answers the absence requests residents filed. What is at stake is not a number of
requests but two things: the resident is waiting for an answer, and the answer writes the
attendance board, which is what the office pays and what the resident is marked against. The rent is
not part of it: the bill is raised from the resident own record, so no leave changes what anybody
owes. Done looks like: every request carries a decision, the approved days are marked on the
attendance board, and the resident has been told the outcome and the reason.

### 3. The findings of this pass

| ID        | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                  | How it ended                                                                                                                                     |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| LVE-D2-1  | P2       | The filters did not live in the address bar. The list read the status, the search, the resident and the dates into local state (the old leaves/page.tsx:73-89), so a view of the module could not be linked, shared or cited.                                                                                                                                            | Closed by the rebuild: every filter and the tab live in the address bar.                                                                       |
| LVE-D2-2  | P2       | The list had no band, no counts and no pending queue. It was one table of every request with a status select (the old leaves/page.tsx:271-322), so the office could not see how much was waiting and could not work the queue.                                                                                                                    | Closed by the rebuild: the queue is the root of the module and the band carries the numbers.                                                     |
| LVE-D2-3  | P2       | The decision cost was not visible. Nothing said what an approval writes on the attendance board, and nothing said that a leave does not change the rent (the bill is raised from the resident record, apps/api/src/services/invoice.service.ts:97).                                                                                                      | Closed by the rebuild: the card and the leave page state both.                                                                                  |
| LVE-D2-4  | P2       | The office could not decide from where it stood: the list carried View, Edit and Delete only (the old leaves/page.tsx:233-245), and the decisions sat at the bottom of the detail page (the old leaves/[id]/page.tsx:403-473).                                                            | Closed by the rebuild: the three decisions are on the card and in the header of the leave page.                                                  |
| LVE-D2-5  | P2       | The resident was not a link anywhere in the module (the old leaves/page.tsx:190-196), so the office could not reach the resident the request belonged to.                                                                                                                                                            | Closed by the rebuild: every resident is a link.                                                                                                |
| LVE-D2-6  | P2       | The CSV export asked for a thousand rows in one request (the old leaves/page.tsx:122) and the server clamps a page to a hundred (apps/api/src/lib/routeUtils.ts:16), so the file was silently short of the set.                                                                                                                      | Closed by the rebuild: the export walks the pages and reports both numbers.                                                                    |
| LVE-D2-7  | P2       | The delete confirm said only that the action could not be undone (the old leaves/page.tsx:390-392) and not that the resident is not told: DELETE /leaves/:id sends no message (apps/api/src/routes/leaves.ts:577-605).                                                                                                                | Closed by the rebuild: the confirm states the silence and points at the cancel.                                                                 |
| LVE-D2-8  | P3       | The leave page opened with four statistic tiles (the old leaves/[id]/page.tsx:193-224) and the decisions sat far below the fold.                                                                                                                                                                                                                                          | Closed by the rebuild: the tile band is gone and the decisions are in the header.                                                                |
| LVE-D2-9  | P2       | The leave page showed the days of the window as chips but not the attendance records the leave wrote, so the office could not see what the approval had done to the board.                                                                                                                                               | Closed by the rebuild: the records are read and shown.                                                                                          |
| LVE-D2-10 | P2       | The office could not see whether the resident was told: the API pushes the notification (apps/api/src/routes/leaves.ts:180-219) and no admin screen read it.                                                                                                                                                            | Closed by the rebuild: the leave page reads the notification and its read state.                                                                |
| LVE-D2-11 | P3       | The leave page had no write trail, although the audit route can filter by the record (apps/api/src/routes/audit.ts:13-52).                                                                                                                                                                                                                                                   | Closed by the rebuild: the trail is on the leave page.                                                                                            |
| LVE-D2-12 | P3       | The review screen read the record with a hand written fetch in an effect (the old leaves/[id]/edit/page.tsx:80-93) and pushed state from that effect, outside the shared query stack.                                                                                                                                        | Closed by the rebuild: the record is read with useApiQuery and the screen is keyed.                                                               |
| LVE-D2-13 | P2       | A rejection could be sent with no reason: the old detail page called the reason optional (the old leaves/[id]/page.tsx:443) and the notification body then says only that the leave was refused (apps/api/src/routes/leaves.ts:197-199).                                                                                                     | Closed by the rebuild: a rejection needs a reason.                                                                                               |
| LVE-D2-14 | P3       | The day count of a window was computed in local time with a ceiling (the old leaves/page.tsx:40-48 and the old leaves/[id]/edit/page.tsx:63-67), so the screen could show one day more or less than the server counts (apps/api/src/routes/leaves.ts:17-26).                                                                                              | Closed by the rebuild: every screen counts the window the way the server counts it.                                                             |
| LVE-D2-15 | P2       | The create form did not say what the save commits, and nothing said that the resident is told when the request is decided rather than when it is filed (POST /leaves sends no message, apps/api/src/routes/leaves.ts:228-326).                                                                                                              | Closed by the rebuild: the form states what the save commits.                                                                                   |
| LVE-D2-16 | P3       | The create form read the stay of the resident with a hand written fetch (the old leaves/new/page.tsx:105-131).                                                                                                                                                                                                                                                                 | Closed by the rebuild: the stay is read with useApiQuery.                                                                                        |
| LVE-D2-17 | P3       | The module had no visual protagonist: the root was the same table as every other ledger and the detail page was the same four tiles plus cards (the old leaves/[id]/page.tsx:193-368).                                                                                                                                                                                              | Closed by the rebuild: the queue of cards is the protagonist and the leave page leads with the decision.                                           |
| LVE-D3-1  | P2       | A hard delete is silent.                                                                                                                                                                                                                                                                                                                                                | Still open: it needs a notification on the leaves route. The confirm says so.                                                                   |
| LVE-D3-2  | P2       | An approval cannot carry a reason to the resident.                                                                                                                                                                                                                                                                                                                                               | Still open: it needs a body on the approve route. The screens say so.                                                                          |
| LVE-D3-3  | P2       | The attendance board does not say which leave wrote a row.                                                                                                                                                                                                                                                                                                                                       | Still open: it needs the leave id on the attendance row.                                                                                         |
| LVE-D3-4  | P2       | The notifications route cannot filter by record.                                                                                                                                                                                                                                                                                                                                                 | Still open: it needs a filter on the data of the notification.                                                                                   |
| LVE-D3-5  | P2       | The list route computes no aggregate over the pending requests.                                                                                                                                                                                                                                                                                                                                  | Still open: it needs an aggregate on the list route. The screen names its ceiling.                                                               |
| LVE-D3-6  | P3       | The list route sorts by the moment the request was filed and by nothing else.                                                                                                                                                                                                                                                                                                                                                             | Still open: it needs a sort on the list route.                                                                                                    |
| LVE-D3-7  | P3       | The leave model does not say who filed the request.                                                                                                                                                                                                                                                                                                                                               | Still open: it needs a field on the model.                                                                                                        |
| LVE-D3-8  | P3       | The write trail of a leave expires after 90 days.                                                                                                                                                                                                                                                                                                                                                | Still open: it needs a longer life for the audit entries.                                                                                        |
| LVE-D3-9  | P3       | There is no shared leave type.                                                                                                                                                                                                                                                                                                                                                                  | Still open: it needs a leave module in packages/types.                                                                                            |

The rows that are still open are carried in `docs/audit/features/leaves.md` with their severity and
their paths; the rows that the rebuild closed are carried in the Closed section of the same file.
The pass 1 row LVE-P2-1 (the missing pending queue) was closed by this pass and is recorded there.
