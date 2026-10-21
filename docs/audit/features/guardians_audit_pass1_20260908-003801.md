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

## Open gaps

No open gap findings recorded in this file.

## Closed

| Claim                                      | Live status                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Guardian.isActive checkout/reinstate flips | FIXED - WORKING - apps/api/src/routes/tenants.ts                                                      |
| Tenant create/delete/reinstate audits      | FIXED - WORKING - apps/api/src/routes/tenants.ts                                                      |
| Checkout pending-payments block            | FIXED - WORKING - apps/api/src/routes/tenants.ts                                                      |
| Floor mapping (5 populates + mapper)       | FIXED - WORKING - apps/api/src/routes/guardians.ts                                                    |
| List room/email columns + parsers          | FIXED - WORKING - apps/web/src/app/(admin)/guardians/page.tsx                                         |
| New rebuilt with preview + dialog          | FIXED - WORKING - apps/web/src/app/(admin)/guardians/new/page.tsx                                     |
| Detail stay + dead notes removed + parser  | FIXED - WORKING - apps/web/src/app/(admin)/guardians/[id]/page.tsx                                    |
| Edit emergency hint                        | FIXED - WORKING - apps/web/src/app/(admin)/guardians/[id]/edit/page.tsx                               |
| toPublicJSON secret strip                  | FIXED - WORKING - apps/api/src/models/user.ts                                                         |
| auth/me ward enrichment                    | FIXED - WORKING - apps/api/src/routes/auth.ts                                                         |
| Flutter notices unwrap + ward dates        | FIXED - WORKING - guardian_repository.dart, ward_attendance_screen.dart, guardian_notices_screen.dart |

## Depth pass (2026-10-21): the four admin screens rebuilt to the depth standard

Pass: depth (wave 6 of the depth program).
Method: the three gates and the per-module contract of
`docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` (gate A truth, gate B flow, gate C layout),
applied to the admin screens of this module. Every claim below was read out of source on
2026-10-21 and is cited as `file:line`.
Precedent: `docs/audit/features/payments_depth_pass1_20260930.md`,
`docs/audit/features/invoices_audit_pass1_20260908-003801.md`.
Nothing above this section was changed: the findings of pass 1 stand as they were written.

### 1. Inventory

| Artifact         | Path                                                  | Notes                                                                   |
| ---------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Roster (list)    | apps/web/src/app/(admin)/guardians/page.tsx           | URL filters, the ward money, the reach state, the legend                |
| Contact (detail) | apps/web/src/app/(admin)/guardians/[id]/page.tsx      | Protagonist, the money number, the ward, the bills, the other contacts  |
| Add (create)     | apps/web/src/app/(admin)/guardians/new/page.tsx       | Resident picker, the contact, the panel that says what the save commits |
| Change (edit)    | apps/web/src/app/(admin)/guardians/[id]/edit/page.tsx | Read through the query stack, the fixed ward, the panel on the save     |
| API route        | apps/api/src/routes/guardians.ts                      | 7 endpoints, 2 of them resident readable                                |
| Model            | apps/api/src/models/guardian.ts                       | No status field, one flag (isActive), one resident (tenantId)           |
| Shared types     | packages/types/src/guardian.ts                        | No importer anywhere in the repository                                  |
| Contract         | packages/types/src/contracts/guardians.ts             | State machine, truth contract, layout, next best action                 |

### 2. What the operator is doing here

The operator keeps the people who stand behind a resident reachable, and answers the one question
about money that matters in this module: whose money is this and what is owed. A guardian is the
payer, not the resident: the module owns the contact, the resident it stands behind and the reach
of that contact. The money itself belongs to the invoice and the payment modules, and the office
reads it through the ward's dues summary, which is built from the same money helper the guardian's
own summary uses (apps/api/src/routes/guardians.ts:323-366). Done looks like: every resident who has
a guardian has one live contact with a phone number that works, every guardian in view names the
resident they pay for and what that resident owes, and a contact that was switched off says so on
the row.

### 3. The findings of this pass

| ID       | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | How it ended                                                                                                                                                                                                          |
| -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GU-D2-1  | P2       | The module where a relative pays for someone showed no money at all. The API has had a dues summary for the guardian for a long time (apps/api/src/routes/guardians.ts:323-366) and the Flutter ward screen renders it (mobile/lib/features/guardian/presentation/ward_screen.dart:93-96), but the admin roster had no amount, no invoice count and no open cycle, so the office had to open the resident to learn what was owed.                                                                                                                           | Closed by the rebuild: the roster reads the ward's dues summary from the server and shows the total, the open invoice count and the oldest open cycle.                                                                |
| GU-D2-2  | P2       | The contact page had no money either. It read the invoices of the ward (apps/web/src/app/(admin)/guardians/[id]/page.tsx:98-102) and drew their gross totals into a stay calendar, with no balance and no total due anywhere on the page.                                                                                                                                                                                                                                                                                                                   | Closed by the rebuild: the money number of the record is the server's dues summary, and the invoices behind it are listed with the balance the server computed for each.                                              |
| GU-D2-3  | P2       | The roster could be filtered by nothing but the name, and the resident filter was read out of the address bar but never written by a control on the page (apps/web/src/app/(admin)/guardians/page.tsx:46,55-59): the only way into it was a link from the resident page, and the office could not ask for the contacts of one resident.                                                                                                                                                                                                                     | Closed by the rebuild: the search, the resident and the contact state live in the address bar, and every filter is removable from the band.                                                                           |
| GU-D2-4  | P2       | The roster said nothing about what its columns meant. The search matches the guardian name only (apps/api/src/routes/guardians.ts:247-249) and the emergency contact is derived from the relation, never stored (apps/api/src/routes/guardians.ts:102).                                                                                                                                                                                                                                                                                                     | Closed by the rebuild: a legend under the table names the scope of the search, of the money column, of the reach column and of the contact state filter.                                                              |
| GU-D2-5  | P2       | The empty state said "Add your first guardian to get started" (apps/web/src/app/(admin)/guardians/page.tsx:206-210). It did not say what a guardian is, what the save commits, or what is expected next, and an empty filter looked exactly like an empty roster.                                                                                                                                                                                                                                                                                           | Closed by the rebuild: the empty state names what the server does when the contact is added, and the filtered view says that the server holds nothing for these filters.                                              |
| GU-D2-6  | P2       | The create page said "creates login credentials" and nothing else (apps/web/src/app/(admin)/guardians/new/page.tsx:130-131). The office did not know what the save commits, that the temporary password is shown once and never again, that nobody is told, or what happens to the resident's own portal access (nothing at all: the resident keeps their own login, their own bills and their own dues view).                                                                                                                                              | Closed by the rebuild: the panel on the page names the five things the save does and does not do, including that the resident's portal access does not change, and it warns when the guardian portal is switched off. |
| GU-D2-7  | P2       | The contact page carried two actions, Edit and View Tenant. There was no way to switch a contact off, no way to add a second contact for the same resident and no way to see the other contacts of that resident, so "who stands behind this resident" was answerable only by opening every record.                                                                                                                                                                                                                                                         | Closed by the rebuild: the header carries the reach switch, the edit, the other contacts and the resident, and the page lists every other contact of the same resident with its own state.                            |
| GU-D2-8  | P2       | The edit page was the only screen of the module outside the shared query stack: a hand written fetch inside an effect (apps/web/src/app/(admin)/guardians/[id]/edit/page.tsx:60-93), no cache, and nothing invalidated after the save, so the page kept the values it had fetched before the write.                                                                                                                                                                                                                                                         | Closed by the rebuild: the record is read with useApiQuery, the write invalidates the guardian queries and the page hands over to the contact page, which re-reads the record.                                        |
| GU-D2-9  | P2       | The edit page did not say what the save commits. It did not say that the same fields are written onto the portal login (apps/api/src/routes/guardians.ts:496-509), so changing a phone number changes the login as well, and it did not say that a contact cannot be moved to another resident (the update schema holds no resident field, apps/api/src/routes/guardians.ts:48-58).                                                                                                                                                                         | Closed by the rebuild: the panel on the page names the four consequences of the save and the fixed link to the resident.                                                                                              |
| GU-D2-10 | P2       | The switch-off confirmation said the contact "will be marked inactive and lose portal access" (apps/web/src/app/(admin)/guardians/page.tsx:239) but not that the record is kept, that the write is an audit entry, or that nobody is told.                                                                                                                                                                                                                                                                                                                  | Closed by the rebuild: the confirmation names what the server keeps, what it switches off, what it writes and who is not told.                                                                                        |
| GU-D2-11 | P2       | Nothing on the contact page said whether the resident still lives here. The mapper puts the resident and the resident's own flag on the record (apps/api/src/routes/guardians.ts:68-104), so the state was available and unused: a contact for a resident who left looked like a contact for a resident in house.                                                                                                                                                                                                                                           | Closed by the rebuild: the reach column and the ward card both name the stay of the resident, and the grid cell is named on the row.                                                                                  |
| GU-D2-12 | P3       | The roster opened with a bare search box and no band: the number of contacts in view was never on the screen, so an empty filter and an empty roster could not be told apart, and the page had no scope for any number it did show.                                                                                                                                                                                                                                                                                                                         | Closed by the rebuild: the band carries the count the server reports for the set and the three numbers about the page, each with its scope.                                                                           |
| GU-D3-1  | P2       | GET /guardians cannot filter on the active flag (apps/api/src/routes/guardians.ts:241-286): the filter is the name and the resident only. So the office cannot ask the server for the contacts whose login is off, and the contact state filter of the roster narrows the page in view instead of the set.                                                                                                                                                                                                                                                  | Still open: it needs a filter on the list route. The roster says so in the legend and in the empty state.                                                                                                             |
| GU-D3-2  | P2       | The money of a ward is computed twice, in two functions: the office reads GET /tenants/:id/dues (apps/api/src/routes/tenants.ts:1808-1929) and the guardian reads GET /guardians/me/ward (apps/api/src/routes/guardians.ts:323-366). Both use the one money helper (apps/api/src/services/payment-status.service.ts:78-93), but they treat an invoice whose total the server cannot compute differently: the guardian total adds the whole total of that invoice, the office total leaves the amount out of the sum and keeps the invoice in the open list. | Still open: it needs one shared dues function. The office page shows the server's total and names the invoice whose balance is not reported, so the number is never silently different.                               |
| GU-D3-3  | P2       | A check out flips every guardian of that resident to isActive=false and switches their portal logins off (apps/api/src/routes/tenants.ts:827-843) and sends no notification, so neither the resident nor the person who pays is ever told that the contact was switched off.                                                                                                                                                                                                                                                                                | Still open: it is an API change. The roster names the cell (a contact off while the resident is still in house) and the contract carries the truth entry.                                                             |
| GU-D3-4  | P3       | The reach of a contact has two doors: DELETE /guardians/:id writes an audit entry with the action delete (apps/api/src/routes/guardians.ts:546-555) and PUT /guardians/:id with isActive false writes the action update (apps/api/src/routes/guardians.ts:511-520). The same state change therefore leaves two different trails.                                                                                                                                                                                                                            | Still open: it is an API change. One action for one state would close it.                                                                                                                                             |
| GU-D3-5  | P3       | The guardian search is an unescaped regular expression (apps/api/src/routes/guardians.ts:247-249), so a search with a bracket or a parenthesis makes the query fail. The invoice route escapes its search (apps/api/src/routes/invoices.ts:211); the guardians route does not.                                                                                                                                                                                                                                                                              | Still open: it is an API change.                                                                                                                                                                                      |
| GU-D3-6  | P3       | The User model holds no last login field (apps/api/src/models/user.ts), so the office cannot tell whether a guardian ever signed in with the temporary password it handed over, and a contact that never signed in looks exactly like one that did.                                                                                                                                                                                                                                                                                                         | Still open: it needs a field on the model. The create page names the handover as the office's own step.                                                                                                               |
| GU-D3-7  | P3       | The shared guardian DTOs of packages/types/src/guardian.ts have no importer in the repository, as the tenant DTOs had before the tenants rebuild.                                                                                                                                                                                                                                                                                                                                                                                                           | Still open: the four screens declare their own interfaces, as in the invoices, the payments and the tenants module.                                                                                                   |

The rows that are still open are carried in `docs/audit/features/guardians.md` with their severity
and their paths; the rows that the rebuild closed are carried in the Closed section of the same
file.

### 4. The contract

`packages/types/src/contracts/guardians.ts` now holds the grid of the domain (the guardian model
has no status field, so the grid is `isActive` of the contact times the stay of the ward), one
truth entry per action the admin can take (add, change, switch off, switch on, read the dues) and
the entry the check out of a resident makes from outside the module, the layout archetype with the
grammar tokens and the module's own number, and the next best action per grid cell and per empty
state.

### 5. What was NOT done

- No API route, model or shared type was changed. Every gap that needs one is listed above as
  still open.
- The mobile portal was not touched. The resident half of this module (the ward view) was not
  re-audited in this pass; pass 1 above still stands.
- No CSV export was added: the module holds a contact list, not a ledger, and the export of the
  payments, the invoices, the tenants and the rooms modules is the pattern for the modules that do.
- No screenshot and no browser run: every layout claim is read out of the component geometry and
  the width rule, not measured.
