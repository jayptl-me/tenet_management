# Washing Machines Module - Audit Pass 1

Module: washing-machines
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

washing machines (floor machines, tenant claim with timer, single-claim limit, release).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                                       | Status  |
| ------ | ------------------------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/washing-machines/page.tsx -> /washing-machines                     | WORKING |
| Create | apps/web/src/app/(admin)/washing-machines/new/page.tsx -> /washing-machines/new             | WORKING |
| Detail | apps/web/src/app/(admin)/washing-machines/[id]/page.tsx -> /washing-machines/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/washing-machines/[id]/edit/page.tsx -> /washing-machines/[id]/edit | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                                     | Route                        | API Used                      | Status  |
| ------------------------------------------ | ---------------------------- | ----------------------------- | ------- |
| Floor machines + claim/release + countdown | washing_machines_screen.dart | GET washing-machines (scoped) | WORKING |

### 2.3 Not Accessible

| Actor            | Blocked Surface                   | Enforcement                  |
| ---------------- | --------------------------------- | ---------------------------- |
| tenant, guardian | all /washing-machines Next routes | AdminLayout role guard       |
| tenant           | others claims; admin mutations    | ownership/adminOnly, 403/400 |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                            | Element            | Status                        |
| -------------------------------------------------- | ------------------ | ----------------------------- |
| Table floor/status/claimant/timer + Release action | DataTable + Button | WORKING (raw button replaced) |
| Status filter                                      | Select             | WORKING                       |
| Full-set CSV export                                | Button             | WORKING (fixed page-only)     |
| parseApiError on load/release/delete/export        | errorParser        | WORKING (added)               |
| Custom SVG                                         | none               | NO CUSTOM SVG                 |

### 3.2 Create

| Feature                                       | Element     | Status          |
| --------------------------------------------- | ----------- | --------------- |
| Placement + Configuration sections with icons | FormSection | WORKING (added) |
| parseApiError                                 | errorParser | WORKING (added) |
| Custom SVG                                    | none        | NO CUSTOM SVG   |

### 3.3 Detail

| Feature                       | Element             | Status                   |
| ----------------------------- | ------------------- | ------------------------ |
| Machine + claim + timer cards | DetailCard/StatCard | WORKING                  |
| Status via statusToVariant    | StatusBadge         | WORKING (helper deleted) |
| parseApiError on load         | errorParser         | WORKING (added)          |
| Custom SVG                    | none                | NO CUSTOM SVG            |

### 3.4 Edit

| Feature                                                           | Element          | Status              |
| ----------------------------------------------------------------- | ---------------- | ------------------- |
| In-use claim preservation (status unset; explicit release choice) | Select + warning | WORKING (400 fixed) |
| Status omitted from payload when untouched                        | payload strip    | WORKING             |
| parseApiError on load/submit                                      | errorParser      | WORKING (added)     |
| Custom SVG                                                        | none             | NO CUSTOM SVG       |

## 4. Shared Components

| Component                                                                                                                                                               | Path                    | Status  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| floorLabel                                                                                                                                                              | resource-select-presets | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea/DetailCard/StatCard | ui/*                    | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/washingMachines.ts)

| Endpoint                                              | Auth      | Status          |
| ----------------------------------------------------- | --------- | --------------- |
| GET / (tenant floor auto-scope)                       | authGuard | WORKING         |
| GET /floor/:floorId, GET /:id                         | authGuard | WORKING         |
| POST / (floor ownership, unique number)               | adminOnly | WORKING         |
| PUT /:id (claim cleared on non-in_use)                | adminOnly | WORKING         |
| POST /:id/claim (available guard, single-claim limit) | authGuard | WORKING         |
| POST /:id/release (owner/admin)                       | authGuard | WORKING         |
| DELETE /:id (in_use 409)                              | adminOnly | WORKING (added) |

### 5.2 Database Models

| Model          | Relation                                       | Status  |
| -------------- | ---------------------------------------------- | ------- |
| WashingMachine | floorId -> Floor; currentUser -> Tenant; timer | WORKING |

## 6. Missing Custom Components

| Component | Need                              | Status |
| --------- | --------------------------------- | ------ |
| none      | Timer + cards cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                                | Status  |
| -------- | -------------------------------------- | ------- |
| List     | Add, Export, Release, View/Edit/Delete | WORKING |
| Detail   | Edit, Claim/Release                    | WORKING |
| New/Edit | Save/Cancel                            | WORKING |

## 8. SVG Inventory

| Location          | SVG         | Status        |
| ----------------- | ----------- | ------------- |
| All machine pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location                  | Status  |
| ------------------------- | ------------------------- | ------- |
| List table + mobile cards | washing-machines/page.tsx | WORKING |
| CSV export (8 cols)       | washing-machines/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. Edit in_use preservation. 2. List Button + parsers + full CSV. 3. Detail variant + parser. 4. New sections + parser. 5. DELETE in_use 409. 6. Flutter single-hop list + fallback.

## 11. Out of Scope for This Pass

1. Cross laundry-machine booking link (independent systems by design).
2. Claim timer push notifications (no scheduler surface for it).

## 12. Pass 1 Fixes Applied

| Fix                                                | Files                                                        | Status  |
| -------------------------------------------------- | ------------------------------------------------------------ | ------- |
| DELETE in_use 409 MACHINE_IN_USE                   | apps/api/src/routes/washingMachines.ts                       | WORKING |
| Edit in_use preservation + payload strip + parsers | apps/web/src/app/(admin)/washing-machines/[id]/edit/page.tsx | WORKING |
| List Button + parsers + full CSV                   | apps/web/src/app/(admin)/washing-machines/page.tsx           | WORKING |
| Detail variant + parser                            | apps/web/src/app/(admin)/washing-machines/[id]/page.tsx      | WORKING |
| New sections + parser                              | apps/web/src/app/(admin)/washing-machines/new/page.tsx       | WORKING |
| Flutter single-hop myWashingMachines + fallback    | washing_machines_screen.dart, tenant_repository.dart         | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.

## 13. Depth Pass 2 (2026-10-21)

Module: washing-machines
Source verified: live source code, 2026-10-21
Method: the three gates and the per-module contract of
docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md section 4, wave 6 of the depth program. The audit was
written first and the rebuild closed what it proved.
Scope of the pass: the four admin screens of this module and the contract of this module. The API
routes, the shared components, the Flutter portal and every other module were not touched.
Exclusions honored: the machine number, the floor, the timer length, the state enum, the claim
rules, the audit entries and every permission stay exactly as the code has them.

### 13.1 What the module is

A washing machine is a physical unit on a floor with a timer on it. A resident of that floor claims
it, the machine is held for the window the claim carries, and the timer releases it when the window
runs out. The four states of the model are available, in_use, under_maintenance and down
(apps/api/src/models/washingMachine.ts:37-41). The claim is written by the resident and by nobody
else: the claim route refuses a caller that is not a tenant
(apps/api/src/routes/washingMachines.ts:337-340).

The channel of the module is the machine list. A resident reads the list of their own floor right
before they claim, the server refuses a claim on a machine that is not available
(apps/api/src/routes/washingMachines.ts:385-419), and the module sends no notification at all. The
residents are pulled, not pushed. That fact is what the contract has to record, and every screen
has to say it.

### 13.2 Inventory (before the rebuild)

| Artifact      | Path                                                                 | Notes                                                                                |
| ------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| List          | apps/web/src/app/(admin)/washing-machines/page.tsx                   | A DataTable with a state filter in component state, a CSV export and no floor filter |
| Create        | apps/web/src/app/(admin)/washing-machines/new/page.tsx               | CrudFormPage, placement and configuration sections                                   |
| Detail        | apps/web/src/app/(admin)/washing-machines/[id]/page.tsx              | Four StatCards, two DetailCards, a release button, no links, no claim history        |
| Edit          | apps/web/src/app/(admin)/washing-machines/[id]/edit/page.tsx         | Hand-rolled fetch in an effect, a raw PUT and the in_use claim preserved             |
| API route     | apps/api/src/routes/washingMachines.ts                               | 8 endpoints, 4 states, one claim per resident, a timer release every minute          |
| Model         | apps/api/src/models/washingMachine.ts                                | The four states, the claim fields, the timer fields, one machine number per floor    |
| Contract      | packages/types/src/contracts/washing-machines.ts                     | Two truth entries, no own number, no per-state action for the two broken states      |
| Resident side | mobile/lib/features/tenant/presentation/washing_machines_screen.dart | The list of the floor, the claim, the release and a countdown on the timer           |

### 13.3 The findings, with the evidence

| ID       | Severity | Finding                                                                                                                                                                                                                                     | Evidence                                                                                                                                                                                                      | Closed by                                                                                                                                                   |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WM-D2-1  | P2       | The state filter lived in the component, not in the address bar, so the view could not be linked, shared or cited, and any link that carried a state landed on the whole list                                                               | The list page held the filter in a useState and had no useSearchParams; the API has always read a state and a floor from the query (apps/api/src/routes/washingMachines.ts:94-107)                            | The state and the floor live in the address bar, the state tabs and the floor picker write them, the chips show them                                        |
| WM-D2-2  | P2       | The list was a plain table, so the module had no shape of its own and was interchangeable with the other ledgers of the app, while the question of the module is per floor: which machines are free, who is using them and which are broken | The list page rendered a DataTable of machine rows with no grouping                                                                                                                                           | The list is a board: the machines are grouped by the floor they stand on and each machine is a tile with its state, its holder and its timer                |
| WM-D2-3  | P2       | The office could act on a release only, and only for a release: reporting a machine down and bringing it back meant opening the edit page and picking a state, with no confirmation that said what the server would do                      | The list page had a release button and a delete button; the state writes were only reachable from the edit form (apps/api/src/routes/washingMachines.ts:273-327)                                              | Release, report down, bring back, edit and delete sit on the tile, each behind a confirmation that states what the server commits and who is told           |
| WM-D2-4  | P2       | No machine linked to its floor or to the resident who held it, so the office could not reach the resident or the floor from the machine                                                                                                     | The list and the detail page carried the floor and the claimant as plain text; the API hands the office both the floor id and the tenant id (apps/api/src/routes/washingMachines.ts:49-77)                    | The floor of the board links to /floors/[id] and the resident holding the machine links to /tenants/[id]                                                    |
| WM-D2-5  | P2       | The detail page showed the machine but not its claims: the history of the claims and the releases was in the audit trail of the record and nothing in the module read it                                                                    | The audit trail holds a claim entry and a release entry for every machine (apps/api/src/routes/washingMachines.ts:421-427, :466-472) and the audit route reads it by record (apps/api/src/routes/audit.ts:19) | The detail page reads the trail of the record and renders the claim history as a timeline                                                                   |
| WM-D2-6  | P3       | The detail page wore the shared four-tile band and had no protagonist, so the screen said the same thing as the detail page of every other module                                                                                           | The four StatCard band, the same band 15 pages share (docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md section 2 L2)                                                                                              | The state of the machine is the protagonist, the machine record and the claim history sit below it, the office actions moved into the rail                  |
| WM-D2-7  | P3       | The writes of the detail page reported no outcome: the release button called the route and the page showed nothing about what the server committed and who was told                                                                         | The route answers with the machine it wrote (apps/api/src/routes/washingMachines.ts:474-488) and the page used that answer for nothing                                                                        | The banner after a write reports the state the server returned and says the resident was not told                                                           |
| WM-D2-8  | P3       | The writes of the list page reported no outcome either, so two screens of the same module wrote the same record in two different ways                                                                                                       | The list page fired the release and invalidated the query, and said nothing                                                                                                                                   | The same banner on the board: the machine, the state the server returned, the claim that was cleared and the fact that nobody was messaged                  |
| WM-D2-9  | P3       | The CSV export asked for one page of 100 and never compared it with the total the server reports, and it dropped the state filter, so the file could be short of the set and could hold the wrong machines                                  | The API clamps a page to 100 (apps/api/src/lib/routeUtils.ts:16) and the export read one page                                                                                                                 | The export sends the filters of the view, walks the pages of the filtered set and reports the rows the file carries against the machines the server reports |
| WM-D2-10 | P3       | The edit page was the only page of the module outside the React Query stack: it read the record with a raw useEffect and an api.get and pushed the server state into the form from inside that effect                                       | The house pattern for that is the CrudFormPage shell with a load and a module-level mapper (apps/web/src/components/ui/CrudFormPage.tsx:166-174)                                                              | The edit page runs on the shell, so the record is read once and the form is reset from the cache                                                            |
| WM-D2-11 | P3       | Neither form said what the save commits, and neither said that the residents are not told                                                                                                                                                   | The forms carried the fields and nothing else; the API sends no message on any of the writes                                                                                                                  | Both forms carry a "What this save commits" panel                                                                                                           |
| WM-D2-12 | P3       | The empty state of the list did not say what is expected next, it only said to add a machine                                                                                                                                                | The old empty state read "Add your first washing machine for a floor"                                                                                                                                         | The empty state says what a machine is for, that the residents claim it from their own list, that they are not told, and it offers the action               |
| WM-D2-13 | P3       | The list had no loading state of its own, so the page showed an empty building while the server answered                                                                                                                                    | The old list page rendered the table with no rows and no skeleton                                                                                                                                             | The board renders the shape of a machine tile while the server answers                                                                                      |
| WM-D2-14 | P3       | The same state was called three different things across the module, and the state badge showed the raw status string                                                                                                                        | The list showed the status with the underscores replaced, the detail page showed it again and the forms offered a third wording                                                                               | One vocabulary everywhere: free to claim, running, in maintenance and down                                                                                  |
| WM-D2-15 | P3       | The contract named the routes but not the refusals, the codes the refusals really travel with, the channel of the module or the number the module owns                                                                                      | The refusals of the module are raised with the conflict and the validation helpers, which carry their own code (apps/api/src/lib/routeUtils.ts:18-30, apps/api/src/lib/errors.ts:40-80)                       | The contract carries the codes and the messages, the pull channel, the own number and the next best action per state and per empty state                    |

### 13.4 The two findings that stay open

| ID       | Severity | Finding                                                                                                                                                                      | Why it stays open                                                                                                                                                                           |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WM-D2-16 | P3       | Reporting a machine down or bringing it back sends no message, so a resident who is not reading the machine list does not learn that a machine they meant to claim is broken | The machine list is the channel of this module and the contract declares the notification as not required. The fix is a server change, and the office reads the board                       |
| WM-D2-17 | P3       | The board draws the first 100 machines the server returns, and it carries no page control                                                                                    | The API clamps a page to 100 (apps/api/src/lib/routeUtils.ts:16). The notice under the band names the floor filter as the way to narrow the set, and the floor filter is in the address bar |

### 13.5 What the rebuild changed, and what it did not

Changed: the four admin screens of this module and the contract of this module. The list became a
board with the filters in the address bar, the counts read for the same set the board draws, the
writes on the tile with a confirmation that says what the server commits and who is told, the
export that walks the pages, the detail page with the state as its protagonist, the claim history
and the links to the floor and to the resident, and the two forms with a panel that says what the
save commits.

Not changed: every route, every permission, every field, the state enum, the claim rules, the
audit entries, the timer release of the scheduler, the Flutter portal and every other module. The
office still cannot write a claim, because the server refuses a claim from anyone but a tenant, and
the screens now say so instead of leaving the office to guess.

## Open gaps

| ID       | Severity | Gap                                                                                                                                                                                         | Paths                                                                                    |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| WM-P3-1  | P3       | Claim timer push notifications absent; no scheduler surface for it                                                                                                                          | apps/api/src/routes/washingMachines.ts                                                   |
| WM-D2-16 | P3       | Reporting a machine down or bringing it back sends no message to the residents of the floor; the machine list is the channel, so a resident who is not reading it meets the refusal instead | apps/api/src/routes/washingMachines.ts; packages/types/src/contracts/washing-machines.ts |
| WM-D2-17 | P3       | The board draws the first 100 machines the server returns in one page and carries no page control; the notice under the band names the floor filter as the way to narrow the set            | apps/web/src/app/(admin)/washing-machines/page.tsx; apps/api/src/lib/routeUtils.ts:16    |

WM-P3-1 stays open and is narrower than it was: the scheduler surface it asked for now exists
(apps/api/src/jobs/scheduler.ts:227-250) and releases the machine on its own every minute, but it
still sends no message, so a resident who is not looking at the machine list does not learn that
their machine was released.

## Closed

| Claim                                                                                        | Live status                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DELETE in_use 409 MACHINE_IN_USE                                                             | FIXED - WORKING - apps/api/src/routes/washingMachines.ts                                                                                                                                                                                                                 |
| Edit in_use preservation + payload strip + parsers                                           | FIXED - WORKING - apps/web/src/app/(admin)/washing-machines/[id]/edit/page.tsx                                                                                                                                                                                           |
| List Button + parsers + full CSV                                                             | FIXED - WORKING - apps/web/src/app/(admin)/washing-machines/page.tsx                                                                                                                                                                                                     |
| Detail variant + parser                                                                      | FIXED - WORKING - apps/web/src/app/(admin)/washing-machines/[id]/page.tsx                                                                                                                                                                                                |
| New sections + parser                                                                        | FIXED - WORKING - apps/web/src/app/(admin)/washing-machines/new/page.tsx                                                                                                                                                                                                 |
| Flutter single-hop myWashingMachines + fallback                                              | FIXED - WORKING - washing_machines_screen.dart, tenant_repository.dart                                                                                                                                                                                                   |
| WM-D2-1 - the state filter lived in the component, not in the address bar                    | CLOSED 2026-10-21 - the state and the floor live in the address bar, the state tabs and the floor picker write them, and the active filters show as removable chips                                                                                                      |
| WM-D2-2 - the list was a plain table with no floor grouping                                  | CLOSED 2026-10-21 - the list is a board: the machines are grouped by the floor they stand on, each floor names its own mix of states, and each machine is a tile that carries its state, its holder and its timer                                                        |
| WM-D2-3 - the office could act only on a release, and only on the detail page for the rest   | CLOSED 2026-10-21 - release, report down, bring back, edit and delete sit on the tile of every machine, each behind a confirmation that states what the server commits and who is told                                                                                   |
| WM-D2-4 - no machine linked to its floor or to the resident who held it                      | CLOSED 2026-10-21 - the floor of the board links to /floors/[id] and the resident holding the machine links to /tenants/[id], in the board and on the detail page                                                                                                        |
| WM-D2-5 - the detail page showed the machine but never its claims                            | CLOSED 2026-10-21 - the detail page reads the audit trail of the record and renders the claim history as a timeline: who claimed it, for how long, who released it and every state change the server wrote                                                               |
| WM-D2-6 - the detail page wore the shared four-tile band and had no protagonist              | CLOSED 2026-10-21 - the state of the machine is the protagonist of the page, the machine record and the claim history sit below it, and the office actions moved into the rail                                                                                           |
| WM-D2-7 - the writes of the detail page reported no outcome                                  | CLOSED 2026-10-21 - the banner after a write reports the state the server returned and says that the resident was not told                                                                                                                                               |
| WM-D2-8 - the writes of the list page reported no outcome either                             | CLOSED 2026-10-21 - the same banner on the board: it names the machine, the state the server returned, the claim that was cleared and the fact that nobody was messaged                                                                                                  |
| WM-D2-9 - the CSV export asked for one page of 100 and never checked the total               | CLOSED 2026-10-21 - the export sends the filters of the view, walks the pages of the filtered set and reports the rows the file carries against the machines the server reports                                                                                          |
| WM-D2-10 - the edit page was the only page of the module outside the React Query stack       | CLOSED 2026-10-21 - the edit page runs on the CrudFormPage shell with a load and a module-level mapper, so the record is read once and the form is reset from the cache                                                                                                  |
| WM-D2-11 - neither form said what the save commits                                           | CLOSED 2026-10-21 - both forms carry a "What this save commits" panel: the fields the server writes, the claim a state change releases, the refusal of a duplicate number and the fact that the residents are not told                                                   |
| WM-D2-12 - the empty state of the list did not say what is expected next                     | CLOSED 2026-10-21 - the empty state says what a machine is for, that the residents of the floor claim it from their own list, that they are not told, and it offers the register action                                                                                  |
| WM-D2-13 - the list had no loading state of its own                                          | CLOSED 2026-10-21 - the board renders the shape of a machine tile while the server answers, so the page does not flash an empty building                                                                                                                                 |
| WM-D2-14 - the same state was called three different things across the module                | CLOSED 2026-10-21 - one vocabulary: free to claim, running, in maintenance and down, on the board, on the detail page, in the forms and in the legend                                                                                                                    |
| WM-D2-15 - the contract named the routes but not the refusals, the channel or the own number | CLOSED 2026-10-21 - the contract carries the four states with their inbound trigger, one truth entry per admin action, the codes and the messages the refusals really travel with, the pull channel of the module and the next best action per state and per empty state |
