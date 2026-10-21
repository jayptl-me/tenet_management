# Laundry Module - Audit Pass 1

Module: laundry (slots)
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

laundry slots (book/confirm/complete/cancel, facility cap 5, tenant uniqueness).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                     | Status  |
| ------ | ------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/laundry/page.tsx -> /laundry                     | WORKING |
| Create | apps/web/src/app/(admin)/laundry/new/page.tsx -> /laundry/new             | WORKING |
| Detail | apps/web/src/app/(admin)/laundry/[id]/page.tsx -> /laundry/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/laundry/[id]/edit/page.tsx -> /laundry/[id]/edit | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                                   | Route               | API Used                        | Status  |
| ---------------------------------------- | ------------------- | ------------------------------- | ------- |
| Slots list (items/notes) + book + cancel | laundry_screen.dart | GET laundry-slots, POST, cancel | WORKING |

### 2.3 Not Accessible

| Actor            | Blocked Surface          | Enforcement                |
| ---------------- | ------------------------ | -------------------------- |
| tenant, guardian | all /laundry Next routes | AdminLayout role guard     |
| tenant           | others slots; PUT        | ownership + adminOnly, 403 |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                         | Element                     | Status                      |
| ------------------------------- | --------------------------- | --------------------------- |
| Tenant cell with room/bed/floor | DataTable                   | WORKING (stay added)        |
| Status + date + tenant filters  | Select/Input/ResourceSelect | WORKING (date/tenant added) |
| Quick confirm + delete          | TableActions                | WORKING                     |
| CSV export with Bed/Floor       | Button                      | WORKING (added)             |
| parseApiError throughout        | errorParser                 | WORKING (added)             |
| Custom SVG                      | none                        | NO CUSTOM SVG               |

### 3.2 Create

| Feature                                    | Element        | Status                      |
| ------------------------------------------ | -------------- | --------------------------- |
| Resident/Schedule/Load sections with icons | FormSection    | WORKING (added)             |
| Active-tenants picker + capacity hint      | ResourceSelect | WORKING (fixed to isActive) |
| DUPLICATE_SLOT via parseApiError           | errorParser    | WORKING (pre-existing)      |
| Custom SVG                                 | none           | NO CUSTOM SVG               |

### 3.3 Detail

| Feature                                  | Element     | Status          |
| ---------------------------------------- | ----------- | --------------- |
| StatCards date/time/items + status badge | StatCard    | WORKING         |
| Tenant card with link + bed/floor/phone  | DetailCard  | WORKING (added) |
| Slot details + notes                     | DetailCard  | WORKING         |
| parseApiError on load                    | errorParser | WORKING (added) |
| Custom SVG                               | none        | NO CUSTOM SVG   |

### 3.4 Edit

| Feature                                           | Element     | Status          |
| ------------------------------------------------- | ----------- | --------------- |
| Status/dates/items/notes + DUPLICATE_SLOT mapping | FormSection | WORKING         |
| parseApiError on load/submit                      | errorParser | WORKING (added) |
| Custom SVG                                        | none        | NO CUSTOM SVG   |

## 4. Shared Components

| Component                                                                                                                                           | Path                    | Status  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| tenantLabel/tenantSublabel                                                                                                                          | resource-select-presets | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea | ui/*                    | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/laundry.ts)

| Endpoint                                          | Auth                | Status  |
| ------------------------------------------------- | ------------------- | ------- |
| GET / tenant branch (meta + pagination + status)  | authGuard           | WORKING |
| GET / admin (status/slotDate/tenantId validated)  | authGuard           | WORKING |
| GET /:id                                          | authGuard           | WORKING |
| POST / (past guard + cap 5 + DUPLICATE_SLOT)      | authGuard           | WORKING |
| PUT /:id (terminal transitions + past-date guard) | adminOnly           | WORKING |
| POST /:id/cancel, DELETE /:id                     | authGuard/adminOnly | WORKING |
| Bed/floor in tenant mapping everywhere            | mapLaundrySlot      | WORKING |

### 5.2 Database Models

| Model                     | Relation                                                    | Status  |
| ------------------------- | ----------------------------------------------------------- | ------- |
| LaundrySlot               | tenantId -> Tenant; unique tenant+date+time; virtual tenant | WORKING |
| generateLaundrySlots stub | unreferenced                                                | REMOVED |

## 6. Missing Custom Components

| Component | Need                                   | Status |
| --------- | -------------------------------------- | ------ |
| none      | StatCards + tables cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                              | Status  |
| -------- | ------------------------------------ | ------- |
| List     | Book, Export, confirm/delete actions | WORKING |
| Detail   | Edit                                 | WORKING |
| New/Edit | Book/Save/Cancel                     | WORKING |

## 8. SVG Inventory

| Location          | SVG         | Status        |
| ----------------- | ----------- | ------------- |
| All laundry pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location         | Status  |
| ------------------------- | ---------------- | ------- |
| List table + mobile cards | laundry/page.tsx | WORKING |
| CSV export (11 cols)      | laundry/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. Tenant GET meta/status/pagination. 2. Admin slotDate/tenantId filters. 3. PUT transitions + past guard. 4. Stub deletion. 5. Bed/floor mapping. 6. List filters + stay cell + CSV + parsers. 7. New sections + active picker. 8. Detail link + bed/floor + parser. 9. Edit parsers. 10. Flutter items/notes + 300 chars + tenantId omit.

## 11. Out of Scope for This Pass

1. Laundry-machine linkage (independent systems by design; double-booking possible and accepted).
2. Slot generation automation (manual booking is the product).

## 12. Pass 1 Fixes Applied

| Fix                                                                   | Files                                               | Status  |
| --------------------------------------------------------------------- | --------------------------------------------------- | ------- |
| Tenant branch meta/pagination/status; admin slotDate/tenantId filters | apps/api/src/routes/laundry.ts                      | WORKING |
| PUT terminal transitions + past-date guard                            | apps/api/src/routes/laundry.ts                      | WORKING |
| generateLaundrySlots stub + barrel export deleted                     | apps/api/src/models/laundrySlot.ts, index.ts        | REMOVED |
| Bed/floor tenant mapping (6 populates)                                | apps/api/src/routes/laundry.ts                      | WORKING |
| List filters + stay cell + CSV + parsers                              | apps/web/src/app/(admin)/laundry/page.tsx           | WORKING |
| New sections + active picker                                          | apps/web/src/app/(admin)/laundry/new/page.tsx       | WORKING |
| Detail link + bed/floor + parser                                      | apps/web/src/app/(admin)/laundry/[id]/page.tsx      | WORKING |
| Edit parsers                                                          | apps/web/src/app/(admin)/laundry/[id]/edit/page.tsx | WORKING |
| Flutter items/notes + 300 chars + tenantId omit                       | laundry_screen.dart, tenant_repository.dart         | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.

## Open gaps

No open gap findings recorded in this file.

## Closed

| Claim                                                                 | Live status                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Tenant branch meta/pagination/status; admin slotDate/tenantId filters | FIXED - WORKING - apps/api/src/routes/laundry.ts                      |
| PUT terminal transitions + past-date guard                            | FIXED - WORKING - apps/api/src/routes/laundry.ts                      |
| generateLaundrySlots stub + barrel export deleted                     | FIXED - removed - apps/api/src/models/laundrySlot.ts, index.ts        |
| Bed/floor tenant mapping (6 populates)                                | FIXED - WORKING - apps/api/src/routes/laundry.ts                      |
| List filters + stay cell + CSV + parsers                              | FIXED - WORKING - apps/web/src/app/(admin)/laundry/page.tsx           |
| New sections + active picker                                          | FIXED - WORKING - apps/web/src/app/(admin)/laundry/new/page.tsx       |
| Detail link + bed/floor + parser                                      | FIXED - WORKING - apps/web/src/app/(admin)/laundry/[id]/page.tsx      |
| Edit parsers                                                          | FIXED - WORKING - apps/web/src/app/(admin)/laundry/[id]/edit/page.tsx |
| Flutter items/notes + 300 chars + tenantId omit                       | FIXED - WORKING - laundry_screen.dart, tenant_repository.dart         |

## Depth pass (2026-10-21): the four admin screens rebuilt to the depth standard

Pass: depth (wave 6 of the depth program).
Method: the three gates and the per-module contract of
`docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` (gate A truth, gate B flow, gate C layout), applied
to the admin screens of this module. Every claim below was read out of source on 2026-10-21 and is
cited as `file:line`.
Precedent: `docs/audit/features/tenants_audit_pass1_20260908-230000.md`.

### 1. Inventory

| Artifact      | Path                                                | Lines | Notes                                                       |
| ------------- | --------------------------------------------------- | ----- | ----------------------------------------------------------- |
| Slots (list)  | apps/web/src/app/(admin)/laundry/page.tsx           | 965   | URL filters, the band, the load of a slot time, the writes  |
| Slot (detail) | apps/web/src/app/(admin)/laundry/[id]/page.tsx      | 779   | The slot, the resident, the queue, what was told, the trail |
| Slot (create) | apps/web/src/app/(admin)/laundry/new/page.tsx       | 203   | The form, what the save commits, what the server refuses    |
| Slot (edit)   | apps/web/src/app/(admin)/laundry/[id]/edit/page.tsx | 254   | The record, the moves the server takes, what the save moves |
| API route     | apps/api/src/routes/laundry.ts                      | 582   | Six endpoints, one message, three guards                    |
| Model         | apps/api/src/models/laundrySlot.ts                  | 77    | Four statuses, the unique booking, no machine               |
| Shared types  | packages/types/src/laundry.ts                       | 41    | No importer anywhere in the repository                      |
| Contract      | packages/types/src/contracts/laundry.ts             | 283   | State machine, truth contract, layout, next best action     |

### 2. What the operator is doing here

The operator keeps the queue of the shared machines fair: seeing which slot times are free, who
holds the place, and closing the bookings that were used. There is no money in this module: a
laundry slot carries no charge, no rate and no invoice, so every number on these screens is a
count. Done looks like: every booked slot was confirmed, used or given up, every resident who
holds a place knows the time they have to come down, and no slot time carries more than the five
places the server allows.

### 3. The findings of this pass

| ID            | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                           | How it ended                                                                                                                                                                                                                              |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LAUNDRY-D2-1  | P2       | The filters of the module did not live in the address bar. The status, the day and the resident were local state of the page (the old list page), so a queue could not be linked, cited or shared, and a link that carried a query parameter landed on an unfiltered list.                                                                                                                        | Closed by the rebuild: the status, the day and the resident live in the address bar, so /laundry?slotDate=2026-10-22 lands filtered.                                                                                                      |
| LAUNDRY-D2-2  | P2       | The day filter never worked. The picker hands its callback a change event whose target carries the day (apps/web/src/components/ui/DatePicker.tsx:202-221), and the old handler typed the callback as a string, so the filter state held an event object and the list asked the server for slotDate=[object Object], which the route refuses with a 400 (apps/api/src/routes/laundry.ts:186-191). | Closed by the rebuild: the picker reads the day out of the event, a broken parameter is dropped instead of asked for, and the day filter narrows the rows and the band.                                                                   |
| LAUNDRY-D2-3  | P2       | The module never answered its own question. Nothing on the screen showed how many places a slot time held against the five the server allows (apps/api/src/routes/laundry.ts:274-292), so "when are the machines free" was nowhere on the page and the list carried no number of its own.                                                                                                         | Closed by the rebuild: the band carries the busiest slot time with the places it takes of the five and the places still free, and every row carries the load of its own time.                                                             |
| LAUNDRY-D2-4  | P2       | A booking did not link to the resident who held it. The list showed a name and the detail showed a card, but neither carried a link to the resident record, so the office could not act on the person from the booking.                                                                                                                                                                           | Closed by the rebuild: the resident is a link to their record on the row and on the slot page, which names the room, the bed, the floor and the phone.                                                                                    |
| LAUNDRY-D2-5  | P2       | A status write said nothing. The confirm, the close and the cancel of the old list wrote the status and invalidated the list, and the screen showed no word about what the server committed or about the resident.                                                                                                                                                                                | Closed by the rebuild: every write renders the state the server committed and the message it did or did not push, and the table is re-read from the server afterwards.                                                                    |
| LAUNDRY-D2-6  | P2       | The detail page opened with three statistic tiles (the date, the time, the items) and two cards, and never showed the queue of the slot time, the progression, what the resident was told or the write trail, so it read like every other record page of the app.                                                                                                                                 | Closed by the rebuild: the tiles are gone. The page carries the slot, the resident, the queue of that time, the progression with its routes, what the resident was told and the write trail.                                              |
| LAUNDRY-D2-7  | P2       | The create page promised what the server does not do. It said "Only active residents can hold slots" while the route checks no state of the resident (apps/api/src/routes/laundry.ts:257-292), and it never said what the save commits nor that the resident is told nothing on a booking.                                                                                                        | Closed by the rebuild: the panel names what the server commits, that no message reaches the resident on a booking, and the three rules the server refuses a booking by. The false claim about the residents who are in the house is gone. |
| LAUNDRY-D2-8  | P2       | The edit page offered a move the server refuses and never named the guard. A closed slot can only be reopened to booked (apps/api/src/routes/laundry.ts:359-374) and every write on a slot whose day has passed is refused (apps/api/src/routes/laundry.ts:376-381), and the page said neither.                                                                                                   | Closed by the rebuild: a closed slot shows only the moves the server takes, the panel names the past date guard and the duplicate guard, and the page says the resident is told only on a confirmation.                                   |
| LAUNDRY-D2-9  | P3       | The export asked for limit=1000, which the server clamps to 100 (apps/api/src/lib/routeUtils.ts:16), so the file was silently short of the set and said nothing about it.                                                                                                                                                                                                                         | Closed by the rebuild: the export walks the pages of the filtered set and reports the slots the server holds against the slots the file carries.                                                                                          |
| LAUNDRY-D2-10 | P3       | The empty state was one dead end for every case ("Book your first laundry slot to get started"), so it never said what is expected next and never said that the filters were what emptied the view.                                                                                                                                                                                               | Closed by the rebuild: a filtered view that holds nothing offers to clear the filters, and an empty module says what happens next: a booking, a confirmation that tells the resident, and a close after the laundry.                      |
| LAUNDRY-D2-11 | P2       | A refusal lost its reason. The shared parser maps every 400 to one generic sentence (apps/web/src/lib/errorParser.ts:41-81) and the laundry route puts the reason in the message of the body (apps/api/src/routes/laundry.ts:186-197, :269-272, :376-381), so the office never read why the server said no.                                                                                       | Closed by the rebuild: the four screens read the message of the server first, so the office reads the reason the route gives: the slot is full, the day has passed, the booking is a duplicate.                                           |
| LAUNDRY-D2-12 | P2       | The office could not act on a slot without a detour. The three actions lived only in the row menu of the list, and the detail page carried an Edit button only.                                                                                                                                                                                                                                   | Closed by the rebuild: confirm, close and give up are on the slot page itself and on every row of the list, and the delete says what the server does with the record.                                                                     |
| LAUNDRY-D2-13 | P2       | The list carried no band, no legend and no scope for its numbers, so no number on the screen could be placed, and the module had no number of its own (the layout gate, rule 17 of the strict standard).                                                                                                                                                                                          | Closed by the rebuild: the band names the scope of every number, the legend says what the places count and what the status filter does not change, and the filters of the view live in the address bar.                                   |
| LAUNDRY-D3-1  | P2       | The office cannot close a slot after its day. PUT compares the date the write carries with the server's today and refuses the whole write when the day has passed (apps/api/src/routes/laundry.ts:376-381), so a confirmed slot of yesterday stays confirmed, cannot be corrected and still holds its place at that time.                                                                         | Still open: it needs a guard that refuses only a move into the past. The slot page says so before the write.                                                                                                                              |
| LAUNDRY-D3-2  | P2       | A completed slot still holds a place. The capacity count excludes only the cancelled bookings (apps/api/src/routes/laundry.ts:276-280), so a slot whose laundry is already finished refuses a new booking at that same time.                                                                                                                                                                      | Still open: it needs a capacity count over the bookings that are still to come. The list says that a finished slot still holds its place.                                                                                                 |
| LAUNDRY-D3-3  | P2       | The server accepts a slot for a resident who has left: the route checks no state of the resident (apps/api/src/routes/laundry.ts:257-292), so a booking can hold a place of the five for nobody.                                                                                                                                                                                                  | Still open: it needs a check of the resident on the booking route. The create page says that the server does not check.                                                                                                                   |
| LAUNDRY-D3-4  | P2       | A booking the office makes for a resident is silent. The server sends one message only when a slot is confirmed (apps/api/src/routes/laundry.ts:434-443).                                                                                                                                                                                                                                         | Still open: it needs a message on the booking. The create page says that the resident is told nothing until the slot is confirmed.                                                                                                        |
| LAUNDRY-D3-5  | P3       | The laundry domain has no entry in the shared lifecycle vocabulary (packages/types/src/lifecycle.json), so the shared stepper cannot render the ladder of a slot and the portal cannot show the progression.                                                                                                                                                                                      | Still open: it needs a domain and a status union in the vocabulary, and the generated Dart. The slot page draws the ladder of the module itself until then.                                                                               |
| LAUNDRY-D3-6  | P3       | The shared status map gives a completed slot and a cancelled slot the same neutral tone (packages/types/src/tokens.ts:97-101), while the portal paints them differently (mobile/lib/features/shared/widgets/portal_widgets.dart:210-239).                                                                                                                                                         | Still open: it needs a tone of its own for each state of a slot. The label of the badge still names the state.                                                                                                                            |
| LAUNDRY-D3-7  | P3       | The shared error parser has no entry for the codes the laundry route refuses with (INVALID_SLOT_DATE, INVALID_DATE, INVALID_TENANT, INVALID_STATUS) and maps every 400 to one generic sentence (apps/web/src/lib/errorParser.ts:41-81).                                                                                                                                                           | Still open: it needs an entry per code. The four screens of this module read the message of the server themselves.                                                                                                                        |
| LAUNDRY-D3-8  | P3       | A slot names no machine (apps/api/src/models/laundrySlot.ts:15-47), so the office cannot tell a resident which washer to use. Pass 1 declared the linkage out of scope and it stays out of scope.                                                                                                                                                                                                 | Still open: it needs a machine reference on the model. The slot page says that a slot is a place in the queue of that time.                                                                                                               |
| LAUNDRY-D3-9  | P3       | The server cannot filter on a slot time, only on a day (apps/api/src/routes/laundry.ts:176-198), so the queue of a time has to be picked out of the day by the screen.                                                                                                                                                                                                                            | Still open: it needs a filter on the time. The slot page names the ceiling of the day it reads.                                                                                                                                           |
| LAUNDRY-D3-10 | P3       | The load of a slot time is not a number the server holds: the API has no aggregate of the places of a time, so the band and the column of the list are computed by the screen from the rows it read.                                                                                                                                                                                              | Still open: it needs an aggregate on the list route. The list says where the number comes from.                                                                                                                                           |
| LAUNDRY-D3-11 | P3       | The shared laundry DTOs of packages/types/src/laundry.ts have no importer in the repository: the API uses its own model interface and the four admin screens declare their own interfaces.                                                                                                                                                                                                        | Still open: it needs the screens to use the shared types.                                                                                                                                                                                 |
| LAUNDRY-D3-12 | P3       | The write trail of a slot is not permanent evidence: the audit entries expire after 90 days (apps/api/src/models/auditLog.ts:81-82), so a change that reached nobody leaves no trace after a quarter.                                                                                                                                                                                             | Still open: it needs a longer life for the audit entries. The slot page says how long the trail lasts.                                                                                                                                    |

The rows that are still open are carried in `docs/audit/features/laundry.md` with their severity and
their paths; the rows that the rebuild closed are carried in the Closed section of the same file.

### 4. The contract

`packages/types/src/contracts/laundry.ts` now holds the ladder of the domain (booked, confirmed,
completed, with cancelled as the branch), the dwell of every state that the code gives a clock for
(the slot time is the clock of this module), one truth entry per action the office can take
(confirm, close, give up, book, edit, delete, read the queue of a day), the layout archetype with
the grammar tokens and the module own number (the busiest slot time of the set against the five
places the server allows), and the next best action per status and per empty state.

The contract names what the code really has, including the places where a person is still not told:
a booking the office makes for a resident, a slot that is closed and a slot that is given up reach
nobody, and only a confirmation reaches the resident.

### 5. What was NOT done

- No API route, model or shared type was changed. Every gap that needs one is listed above as
  still open.
- The mobile portal was not touched. The resident half of this module (the laundry screen of the
  portal and the chip it paints) was read for the truth of the contract, not re-audited in this
  pass; pass 1 above still stands.
- No shared component was changed. The domain has no entry in the shared lifecycle vocabulary
  (packages/types/src/lifecycle.json), so the slot page draws the ladder of the module itself
  until the domain is added; that is a second stepper of its own and it is listed as an open gap.
- No screenshot and no browser run: every layout claim is read out of the component geometry and
  the width rule, not measured.
