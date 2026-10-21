# Visitors Module - Feature Listing

Module: visitors
Scope: admin web + API + DB + shared types + Flutter visitor desk (read-only mapping)
Source verified: 2026-10-21 (depth rebuild of the four admin screens, wave 6)
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/visitors_audit_pass1_20260907-233246.md
Contract: packages/types/src/contracts/visitors.ts (state machine, truth contract, layout, next action)

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

| Feature                                                                                                              | Element                          | Status        |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------- |
| The gate desk in one band: the visitors on site right now, the ones expected, the passes in view, the ones that left | PageBand + StatusTabs            | WORKING       |
| Tab counts read from the server for the same filtered set the rows show                                              | useQueries over GET /visitors    | WORKING       |
| Every filter in the address bar (state, resident, visitor name or phone)                                             | useUrlState + useUrlSearch       | WORKING       |
| The clock of the pass: expected hour, overdue, in since, out at                                                      | At the gate column               | WORKING       |
| A visitor links to the resident who registered them and to the room                                                  | Link to /tenants/:id, /rooms/:id | WORKING       |
| The gate actions of the row, the ones the server allows for that state                                               | TableActions extra               | WORKING       |
| Export of the whole filtered set, with both numbers                                                                  | CSV walk of the pages            | WORKING       |
| Empty states per case (no gate, no expected list, no on-site list, no filter match)                                  | EmptyState                       | WORKING       |
| Pagination, row click, view/edit/delete, mobile cards                                                                | DataTable + TableActions         | WORKING       |
| Custom SVG                                                                                                           | none, lucide only                | NO CUSTOM SVG |

### 2.2 Create - visitors/new/page.tsx

| Feature                                                         | Element                          | Status        |
| --------------------------------------------------------------- | -------------------------------- | ------------- |
| Host picker (active tenants) + room/bed/floor preview           | ResourceSelect + preview card    | WORKING       |
| Visitor name/phone + normalizeInPhone                           | Input + zod                      | WORKING       |
| Purpose input + quick-pick chips                                | Input + chip buttons             | WORKING       |
| Expected arrival + summary + past-date block                    | datetime-local + summary panel   | WORKING       |
| What the save commits, what it refuses, what the resident hears | "What this save commits" section | WORKING       |
| Submit -> POST visitors (TENANT_INACTIVE mapped)                | parseApiError                    | WORKING       |
| Buttons Register Visitor/Cancel                                 | FormActions                      | WORKING       |
| Custom SVG                                                      | none                             | NO CUSTOM SVG |

### 2.3 Detail - visitors/[id]/page.tsx

| Feature                                                                   | Element                                    | Status        |
| ------------------------------------------------------------------------- | ------------------------------------------ | ------------- |
| Header title + pass code + badge + the gate actions + Edit                | FormPage + StatusBadge                     | WORKING       |
| The progression of the pass and the clock of the visit (the protagonist)  | StatusStepper + the window, duration, stay | WORKING       |
| The gate pass card (passcode + copy + print)                              | VisitorGatePassCard                        | WORKING       |
| The whole visit: visitor, host resident, room, bed, floor, why they came  | DetailCard + DetailList                    | WORKING       |
| What the resident was told, one line per thing that happened to this pass | Rail card                                  | WORKING       |
| The write trail of the pass (the audit entries of this record)            | Rail card, GET /audit-logs                 | WORKING       |
| The facts of the record (created, updated, approver, id, pass code)       | Rail card                                  | WORKING       |
| Link back to the passes on site right now                                 | Link with the state in the address bar     | WORKING       |
| Custom SVG                                                                | none, lucide only                          | NO CUSTOM SVG |
| Scripted layout                                                           | printable gate pass (print CSS)            | WORKING       |

### 2.4 Edit - visitors/[id]/edit/page.tsx

| Feature                                                                    | Element                          | Status        |
| -------------------------------------------------------------------------- | -------------------------------- | ------------- |
| The record read through the shared query stack and the form filled from it | useApiQuery + form values        | WORKING       |
| Host context card (tenant link + room/bed/floor/phone)                     | read-only card                   | WORKING       |
| Name/phone/purpose + chips                                                 | Input + chip buttons             | WORKING       |
| Schedule + old-vs-new arrival summary                                      | datetime-local + summary         | WORKING       |
| Status read-only (the gate owns the state)                                 | readout box                      | WORKING       |
| What the save commits and what the resident hears                          | "What this save commits" section | WORKING       |
| Save Changes/Cancel                                                        | FormActions                      | WORKING       |
| Custom SVG                                                                 | none                             | NO CUSTOM SVG |

## 3. Shared Components

| Component                                                                                                                                                                                | Path                                                   | Status  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------- |
| VisitorLifecycleActions (the gate actions the server allows, per state)                                                                                                                  | apps/web/src/components/ui/VisitorLifecycleActions.tsx | WORKING |
| StatusStepper (shared lifecycle stepper; replaced VisitorLifecycleStepper, removed 2026-10-21)                                                                                           | apps/web/src/components/ui/StatusStepper.tsx           | WORKING |
| VisitorGatePassCard (the printable pass, the pass code, the copy)                                                                                                                        | apps/web/src/components/ui/VisitorGatePassCard.tsx     | WORKING |
| ResourceSelect/DataTable/TableActions/StatusBadge/StatusTabs/PageBand/FilterChips/EmptyState/PageHeader/DetailCard/ContentFrame/FormPage/FormCard/FormSection/FormGrid/FormActions/Input | ui/*                                                   | WORKING |

## 4. API Routes (apps/api/src/routes/visitors.ts, requireFeature visitorManagementEnabled)

| Endpoint                                                        | Auth            | Status  |
| --------------------------------------------------------------- | --------------- | ------- |
| POST /visitors (inactive-tenant 409 on admin path)              | admin or tenant | WORKING |
| GET /visitors (search + tenantId + status, room/floor populate) | adminOnly       | WORKING |
| GET /visitors/my                                                | tenantOnly      | WORKING |
| GET /visitors/:id (user + room + floor populate)                | admin or owner  | WORKING |
| POST /visitors/:id/arrive (expected only, tells the resident)   | admin or owner  | WORKING |
| POST /visitors/:id/depart (arrived only, tells the resident)    | admin or owner  | WORKING |
| POST /visitors/:id/cancel (expected only, tells nobody)         | admin or owner  | WORKING |
| POST /visitors/:id/approve (cancelled only, tells the resident) | adminOnly       | WORKING |
| PUT /visitors/:id (status intentionally omitted)                | adminOnly       | WORKING |
| DELETE /visitors/:id                                            | adminOnly       | WORKING |

The state machine of the server: every route refuses a transition that is not on the ladder
(expected -> arrived -> departed, expected -> cancelled, cancelled -> expected) with
INVALID_TRANSITION, so a pass cannot be moved by a free write.

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

## Open gaps

The rows below are the findings of the depth pass of 2026-10-21 that the rebuild could not close,
because the gap sits in the API, in the model or in the shared types. The rows the rebuild closed
are recorded in the Closed section below with their date; their ids are the ones of the depth pass
(the section at the end of this file).

| ID        | Severity | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Path                            |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| VIS-D3-1  | P2       | A refused visit is silent. POST /visitors/:id/cancel sets the status to cancelled and writes an update entry in the audit log, and it pushes nothing to the resident who registered the visit (apps/api/src/routes/visitors.ts:569-583). The arrival, the departure and the re-approval do push a service_update to that resident (apps/api/src/routes/visitors.ts:428-439, :508-518, :351-356), so the refusal is the one hole in the loop. The pass page says so before the office presses it. | apps/api/src/routes/visitors.ts |
| VIS-D3-2  | P2       | Registering a pass for a resident is silent. POST /visitors writes the pass and a create entry in the audit log and sends nothing (apps/api/src/routes/visitors.ts:144-167). A resident who registered the visit themselves in the portal already knows, but when the office registers a pass on their behalf, nobody is told.                                                                                                                                                                   | apps/api/src/routes/visitors.ts |
| VIS-D3-3  | P2       | A change of the details of a pass is silent. PUT /visitors/:id writes the name, the phone, the purpose and the expected hour, and pushes nothing to the resident (apps/api/src/routes/visitors.ts:594-616). A rescheduled visit is therefore a surprise at the gate, and the edit page says so before the save.                                                                                                                                                                                  | apps/api/src/routes/visitors.ts |
| VIS-D3-4  | P2       | A delete is silent and final. DELETE /visitors/:id removes the record and keeps only a delete entry in the audit log (apps/api/src/routes/visitors.ts:624-641). The pass, and with it the arrival and the departure timestamps, are gone, and the resident keeps the message they were sent. There is no soft delete on a visitor pass, so a wrong delete cannot be undone from the product.                                                                                                     | apps/api/src/routes/visitors.ts |
| VIS-D3-5  | P2       | The server cannot count the passes by state in one call. GET /visitors takes one status at a time and returns the total of the whole filtered set (apps/api/src/routes/visitors.ts:191-233), so the counts behind the tabs are five count queries over the same filtered set. A status-counts endpoint, like the one the payments and the invoices module have, would make it one call.                                                                                                          | apps/api/src/routes/visitors.ts |
| VIS-D3-6  | P2       | The search of the list is a raw regular expression. GET /visitors puts the search term of the address bar straight into $regex (apps/api/src/routes/visitors.ts:200-206), so a term with regex characters searches something the operator did not type and can make the server work. An escaped term, or a text index, would close it.                                                                                                                                                           | apps/api/src/routes/visitors.ts |
| VIS-D3-7  | P3       | The server accepts a visit in the past. POST /visitors takes any date for the expected hour (apps/api/src/routes/visitors.ts:149) and the office form is the only thing that keeps it in the future. This is the row VIS-P2-1 of the pass 1 file, still open.                                                                                                                                                                                                                                    | apps/api/src/routes/visitors.ts |
| VIS-D3-8  | P3       | A visitor write answers with the record, not with a receipt. Every gate write returns the record after the write (apps/api/src/routes/visitors.ts:441, :520, :585) and the proof of the change lives in the audit log, which expires after 90 days. The pages show what the server returned and the trail; a server-issued receipt would make the write provable without the trail.                                                                                                              | apps/api/src/routes/visitors.ts |
| VIS-D3-9  | P3       | The write trail of a pass is not permanent evidence. The audit entries expire after 90 days (apps/api/src/models/auditLog.ts:82), so a refusal that reached nobody leaves no trace after a quarter.                                                                                                                                                                                                                                                                                              | apps/api/src/models/auditLog.ts |
| VIS-D3-10 | P3       | The list has no bulk actions and the pass has no photo. The model carries no field for a photo of the visitor (apps/api/src/models/visitor.ts:18-64) and there is no bulk endpoint, so the gate cannot pick several passes at once. This is the row VIS-P3-1 and VIS-P3-2 of the pass 1 file, still open.                                                                                                                                                                                        | apps/api/src/models/visitor.ts  |

## Closed

| Claim                                                                                                                                                                    | Live proof                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VIS-D2-1 - the module never answered its own question: nothing said who was on site right now and who was expected, and the only count was the total of the current page | CLOSED 2026-10-21 - the band carries the visitors on site right now, the ones expected, the passes in view and the ones that left, every number read from the server over the same filtered set the rows show                       |
| VIS-D2-2 - the office could not act from where it stood: the list offered view, edit and delete, so a pass that arrived could only be stamped by opening it              | CLOSED 2026-10-21 - every row carries the gate actions the server allows for that state (mark arrived, refuse the visit, mark departed, re-approve), and the detail page carries them in its header, within one viewport of the top |
| VIS-D2-3 - a visitor did not link to the resident who registered them or to the room                                                                                     | CLOSED 2026-10-21 - every row and the detail page link the resident and the room, so the office goes from the gate to the bed in one click                                                                                          |
| VIS-D2-4 - the filters were not all in the address bar and the state of the list was not a tab, so a view of the gate could not be linked or cited                       | CLOSED 2026-10-21 - the state of the gate, the resident and the search live in the address bar, the tabs read the counts of the same filtered set from the server, and the filter chips name what is in the view                    |
| VIS-D2-5 - the export wrote the page in view and said nothing about the rest of the set                                                                                  | CLOSED 2026-10-21 - the export walks the pages of the filtered set and reports the passes the server holds against the passes the file carries                                                                                      |
| VIS-D2-6 - a refused write was reported as a string, and a write that succeeded said nothing about what it committed                                                     | CLOSED 2026-10-21 - every gate write reports what the server committed (the state, the server clock, the audit entry) and what the resident was told                                                                                |
| VIS-D2-7 - the detail page opened with four statistic tiles and the progression of the pass was one card among five                                                      | CLOSED 2026-10-21 - the progression and the clock of the pass are the protagonist of the page, the four tiles are gone, and the facts of the record moved to the rail                                                               |
| VIS-D2-8 - the detail page never said what the resident was told                                                                                                         | CLOSED 2026-10-21 - the rail carries "What the resident was told", one line per thing that happened to this pass, each one saying whether the server sent a message                                                                 |
| VIS-D2-9 - the detail page had no write trail, although the audit route can filter by the record                                                                         | CLOSED 2026-10-21 - the rail shows the write trail of that pass, with the fields the server recorded and the 90 day life of the entries                                                                                             |
| VIS-D2-10 - the register form did not say what its save commits and did not say what happens to the resident                                                             | CLOSED 2026-10-21 - the form says what the server writes, what it refuses, and that the registration sends no message                                                                                                               |
| VIS-D2-11 - the edit form read the record with a hand written fetch outside the shared query stack and did not re-read the record after the write                        | CLOSED 2026-10-21 - the record is read with useApiQuery, the form is filled from it, the write invalidates the visitor queries and the page the operator lands on is the record re-read from the server                             |
| VIS-D2-12 - one empty state served every case, so an empty gate and an empty filter read the same                                                                        | CLOSED 2026-10-21 - the empty state names the case and the next step: register a pass, look at the expected list, look at the on-site list, or clear the filters                                                                    |
| VIS-D2-13 - the detail page had no way back to the rest of the gate sheet                                                                                                | CLOSED 2026-10-21 - the page ends with a link to the visitors on site right now, filtered on that state in the address bar                                                                                                          |
| VIS-D2-14 - the delete was a one line confirmation that said the action cannot be undone and nothing else                                                                | CLOSED 2026-10-21 - the confirmation states what the server does (the record and the pass are gone, the audit entry stays), that the resident is not told, and it warns when the visitor is on site right now                       |
| VisitorLifecycleStepper component was the visitor lifecycle stepper                                                                                                      | REMOVED 2026-10-21 - replaced by the shared StatusStepper                                                                                                                                                                           |

## Depth pass (2026-10-21): the four admin screens rebuilt to the depth standard

Pass: depth (wave 6 of the depth program).
Method: the three gates and the per-module contract of
`docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` (gate A truth, gate B flow, gate C layout), applied to
the admin screens of this module. Every claim below was read out of source on 2026-10-21 and is
cited as `file:line`.
Precedent: `docs/audit/features/visitors_audit_pass1_20260907-233246.md`.

### 1. Inventory

| Artifact          | Path                                                 | Lines | Notes                                         |
| ----------------- | ---------------------------------------------------- | ----- | --------------------------------------------- |
| Visitors (list)   | apps/web/src/app/(admin)/visitors/page.tsx           | 954   | The gate desk: band, tabs, filters, actions   |
| Visitor (detail)  | apps/web/src/app/(admin)/visitors/[id]/page.tsx      | 811   | The progression, the pass, the trail          |
| Visitor (create)  | apps/web/src/app/(admin)/visitors/new/page.tsx       | 394   | The form and what the save commits            |
| Visitor (edit)    | apps/web/src/app/(admin)/visitors/[id]/edit/page.tsx | 432   | The record, what the save moves               |
| API route         | apps/api/src/routes/visitors.ts                      | 643   | 9 endpoints, the ladder and the notifications |
| Model             | apps/api/src/models/visitor.ts                       | 98    | The status enum and the clock of the pass     |
| Shared vocabulary | packages/types/src/lifecycle.json                    | 254   | The visitor ladder, generated for both sides  |
| Contract          | packages/types/src/contracts/visitors.ts             | 342   | Ladder, truth contract, layout, next action   |

### 2. What the operator is doing here

The operator runs the gate. The question of this module is one question: who is at the gate right
now, and who is expected. The office reads the expected list, lets the visitor in, stamps the
arrival, and stamps the departure when the person leaves; a visit that will not happen is refused,
and a refused visit that is on again is approved back into the expected list. Done looks like:
every visitor who came carries a real arrival and a real departure timestamp on the pass, the
passes that are still expected are on the expected list with their hour, and the ones that will
not come are closed out. The money is not this module: nothing here is billed.

### 3. The findings of this pass

| ID        | Severity | Finding                                                                                                                                                                                   | How it ended                                                                                                                                                                   |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VIS-D2-1  | P2       | The module never answered its own question. The list had a status filter and nothing else: no band, no counts, no "who is on site" number.                                                | Closed by the rebuild: the band carries the four numbers of the gate, read from the server over the same filtered set the rows show.                                           |
| VIS-D2-2  | P2       | The office could not act from where it stood. The list offered view, edit and delete only, so the two actions the desk performs all day (arrive, depart) needed a detour into the record. | Closed by the rebuild: the row carries the gate actions the server allows for that state, and the detail page carries them in its header.                                      |
| VIS-D2-3  | P2       | A visitor did not link to the resident who registered them or to the room. Both were plain text, so the office could not go from the gate to the bed or to the resident record.           | Closed by the rebuild: the resident and the room are links, in the list and on the pass page.                                                                                  |
| VIS-D2-4  | P2       | The filters were not all in the address bar and the state of the list was not a tab, so a view of the gate could not be linked, shared or cited.                                          | Closed by the rebuild: the state, the resident and the search live in the address bar, with the tabs and the filter chips over them.                                           |
| VIS-D2-5  | P2       | The export wrote the page in view and said nothing about the rest of the set.                                                                                                             | Closed by the rebuild: the export walks the pages of the filtered set and reports both numbers.                                                                                |
| VIS-D2-6  | P2       | A write said nothing about what it committed. The detail page fired a request and moved on; the office never learned the server clock of the arrival, nor whether the resident was told.  | Closed by the rebuild: every gate write reports the state, the server clock, the audit entry and what the resident was told.                                                   |
| VIS-D2-7  | P2       | The detail page opened with four statistic tiles (window, duration, host stay, pass code) and the progression of the pass was one card among five.                                        | Closed by the rebuild: the progression and the clock are the protagonist, the tiles are gone, the facts of the record are in the rail.                                         |
| VIS-D2-8  | P2       | The detail page never said what the resident was told, although the resident is the one waiting for the verdict of the gate.                                                              | Closed by the rebuild: the rail carries "What the resident was told", one line per thing that happened to the pass.                                                            |
| VIS-D2-9  | P2       | The detail page had no write trail, although the audit route can filter by the record.                                                                                                    | Closed by the rebuild: the rail shows the write trail of the pass.                                                                                                             |
| VIS-D2-10 | P2       | The register form did not say what its save commits, and it did not say what happens to the resident.                                                                                     | Closed by the rebuild: the form says what the server writes, what it refuses and that the registration sends no message.                                                       |
| VIS-D2-11 | P2       | The edit form read the record with a hand written fetch in an effect, outside the shared query stack, and did not re-read the record after the write.                                     | Closed by the rebuild: the record is read with useApiQuery, the form is filled from it, and the write invalidates the visitor queries before the operator lands on the record. |
| VIS-D2-12 | P3       | One empty state served every case, so an empty gate and an empty filter read the same.                                                                                                    | Closed by the rebuild: the empty state names the case and the next step.                                                                                                       |
| VIS-D2-13 | P3       | The detail page had no way back to the rest of the gate sheet.                                                                                                                            | Closed by the rebuild: the page ends with the link to the passes on site right now, filtered in the address bar.                                                               |
| VIS-D2-14 | P3       | The delete confirmation said only "This action cannot be undone".                                                                                                                         | Closed by the rebuild: the confirmation states what the server does and that the resident is not told, and warns when the visitor is on site.                                  |
| VIS-D3-1  | P2       | A refused visit is silent.                                                                                                                                                                | Still open: it needs a notification on the cancel route. The pass page says so before the office presses it.                                                                   |
| VIS-D3-2  | P2       | Registering a pass for a resident is silent.                                                                                                                                              | Still open: it needs a notification on the create route. The register form says so.                                                                                            |
| VIS-D3-3  | P2       | A change of the details of a pass is silent.                                                                                                                                              | Still open: it needs a notification on the update route. The edit page says so.                                                                                                |
| VIS-D3-4  | P2       | A delete is silent and final.                                                                                                                                                             | Still open: it needs a soft delete or a notification on the delete route. The confirmation says so.                                                                            |
| VIS-D3-5  | P2       | The server cannot count the passes by state in one call.                                                                                                                                  | Still open: it needs a status-counts route. The band reads five counts over the same filtered set.                                                                             |
| VIS-D3-6  | P2       | The search of the list is a raw regular expression.                                                                                                                                       | Still open: it needs an escaped term in the route.                                                                                                                             |
| VIS-D3-7  | P3       | The server accepts a visit in the past.                                                                                                                                                   | Still open: it needs a rule in the route. The office form is the only guard today.                                                                                             |
| VIS-D3-8  | P3       | A visitor write answers with the record, not with a receipt.                                                                                                                              | Still open: it needs a receipt on the gate writes. The pages show the record and the trail.                                                                                    |
| VIS-D3-9  | P3       | The write trail of a pass expires after 90 days.                                                                                                                                          | Still open: it needs a longer life for the audit entries.                                                                                                                      |
| VIS-D3-10 | P3       | No bulk actions and no photo on the pass.                                                                                                                                                 | Still open: it needs a bulk endpoint and a field on the model.                                                                                                                 |

The rows that are still open are carried in `docs/audit/features/visitors.md` with their severity and
their paths; the rows that the rebuild closed are carried in the Closed section of the same file.

### 4. The contract

`packages/types/src/contracts/visitors.ts` now holds the ladder of the domain (expected, arrived,
departed, with cancelled as the branch off expected and the way back into expected), one truth
entry per action the office can take (register a pass, stamp the arrival, stamp the departure,
refuse a visit, approve a refused visit again, change the details of a pass, delete a pass, read
the gate sheet), the layout archetype with the grammar tokens and the module own number, and the
next best action per state and per empty state.

The contract names what the code really has, including the places where a person is still not told:
the registration of a pass for a resident, a change of the details of a pass and a refusal are
silent, while the arrival, the departure and the re-approval reach the resident who registered
the visit.

### 5. What was NOT done

- No API route, model or shared type was changed. Every gap that needs one is listed above as
  still open. The gate notifications on the arrival, the departure and the re-approval were
  landed by the parallel API unit of the same day and are read here, not written here.
- The mobile portal was not touched. The resident half of this module (the pass the resident reads
  on their phone) was not re-audited in this pass.
- The shared components were not changed. The visitors module uses the shared StatusStepper, the
  shared VisitorLifecycleActions, the shared VisitorGatePassCard and the shared frame.
- No screenshot and no browser run: every layout claim is read out of the component geometry and
  the width rule, not measured.
