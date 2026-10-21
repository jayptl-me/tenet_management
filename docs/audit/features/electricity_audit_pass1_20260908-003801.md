# Electricity Module - Audit Pass 1

Module: electricity
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

electricity (room submeter bills: draft -> finalized -> distributed -> invoice shares).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                             | Status  |
| ------ | --------------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/electricity/page.tsx -> /electricity                     | WORKING |
| Create | apps/web/src/app/(admin)/electricity/new/page.tsx -> /electricity/new             | WORKING |
| Detail | apps/web/src/app/(admin)/electricity/[id]/page.tsx -> /electricity/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/electricity/[id]/edit/page.tsx -> /electricity/[id]/edit | WORKING |

### 2.2 End-User (mobile)

| Screen                            | Route                   | API Used                             | Status  |
| --------------------------------- | ----------------------- | ------------------------------------ | ------- |
| Tenant readings + share + history | electricity_screen.dart | GET electricity/my                   | WORKING |
| Guardian ward readings            | same screen via ward    | GET electricity/my (ward mode added) | WORKING |
| Bill detail (room-scoped)         | deep links              | GET electricity/:id (room-scoped)    | WORKING |

### 2.3 Not Accessible

| Actor           | Blocked Surface                       | Enforcement                    |
| --------------- | ------------------------------------- | ------------------------------ |
| tenant/guardian | all /electricity Next routes          | AdminLayout role guard         |
| tenant/guardian | other rooms bills                     | room-entry coverage check, 403 |
| tenant          | create/finalize/distribute/PUT/DELETE | adminOnly, 403                 |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                              | Element        | Status                |
| ---------------------------------------------------- | -------------- | --------------------- |
| Columns Month/Total/Rooms/Units/Status/Notes/Actions | DataTable      | WORKING (Units added) |
| Month + status filters                               | Input + Select | WORKING               |
| Summary StatCards billed/units/distributed/count     | StatCard       | WORKING (added)       |
| Full-set CSV export                                  | Button         | WORKING (added)       |
| Draft-only edit, non-distributed delete              | TableActions   | WORKING               |
| parseApiError on load/delete/export                  | errorParser    | WORKING (added)       |
| Custom SVG                                           | none           | NO CUSTOM SVG         |

### 3.2 Create

| Feature                                                     | Element           | Status                      |
| ----------------------------------------------------------- | ----------------- | --------------------------- |
| Month + total + room entries + readings + reconcile preview | FormSections      | WORKING (pre-existing rich) |
| Bill image upload                                           | Cloudinary widget | WORKING                     |
| Custom SVG                                                  | none              | NO CUSTOM SVG               |

### 3.3 Detail

| Feature                                                   | Element     | Status                               |
| --------------------------------------------------------- | ----------- | ------------------------------------ |
| StatCards total/rooms/units/room-total/variance + warning | StatCard    | WORKING                              |
| Finalize/Distribute/View Invoices actions                 | Button      | WORKING (View Invoices pre-existing) |
| Room entries table with floor column + room links         | table       | WORKING (floor added)                |
| Bill image/PDF viewer + upload/replace/remove             | DetailCard  | WORKING                              |
| parseApiError on load/finalize/distribute                 | errorParser | WORKING (added)                      |
| Custom SVG                                                | none        | NO CUSTOM SVG                        |

### 3.4 Edit

| Feature                                               | Element      | Status                      |
| ----------------------------------------------------- | ------------ | --------------------------- |
| Locked-state guard + readings editor + reconcile gate | FormSections | WORKING (pre-existing rich) |
| Custom SVG                                            | none         | NO CUSTOM SVG               |

## 4. Shared Components

| Component                                                                                                                                                               | Path | Status  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea/StatCard/DetailCard | ui/* | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/electricity.ts)

| Endpoint                                                  | Auth              | Status  |
| --------------------------------------------------------- | ----------------- | ------- |
| GET / (month/status; floor populate everywhere)           | adminOnly         | WORKING |
| GET /my (tenant + guardian ward mode)                     | authGuard + roles | WORKING |
| GET /:id (room-entry coverage for tenant/guardian)        | authGuard         | WORKING |
| POST / (reconcile hard block)                             | adminOnly         | WORKING |
| PUT /:id (locked-state guard)                             | adminOnly         | WORKING |
| POST /:id/finalize, /distribute (atomic claim + rollback) | adminOnly         | WORKING |
| POST/DELETE /:id/image (Cloudinary)                       | adminOnly         | WORKING |
| FSM exemplary; kept as pattern reference                  | —                 | WORKING |

### 5.2 Database Models

| Model           | Relation                                                    | Status  |
| --------------- | ----------------------------------------------------------- | ------- |
| ElectricityBill | roomEntries.roomId -> Room; variance snapshot; month unique | WORKING |
| Invoice/Payment | distribute writes electricity shares; balance-aware         | WORKING |

## 6. Missing Custom Components

| Component | Need                                   | Status |
| --------- | -------------------------------------- | ------ |
| none      | StatCards + tables cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                                                  | Status  |
| -------- | -------------------------------------------------------- | ------- |
| List     | Record, Export, View/Edit/Delete                         | WORKING |
| Detail   | Edit, Finalize, Distribute, View Invoices, image actions | WORKING |
| New/Edit | Save/Cancel                                              | WORKING |

## 8. SVG Inventory

| Location              | SVG         | Status        |
| --------------------- | ----------- | ------------- |
| All electricity pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location             | Status  |
| ------------------------- | -------------------- | ------- |
| List table + mobile cards | electricity/page.tsx | WORKING |
| CSV export (6 cols)       | electricity/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. List StatCards + Units column + CSV + parsers. 2. Detail floor column + parsers. 3. API floor populate everywhere. 4. Guardian /my ward mode + :id room coverage. 5. Flutter bill proof viewer.

## 11. Out of Scope for This Pass

1. distribute/generateSingleInvoice share derivation unification (verified consistent).
2. Checkout draft handling (drafts are not dues).

## 12. Pass 1 Fixes Applied

| Fix                                          | Files                                              | Status  |
| -------------------------------------------- | -------------------------------------------------- | ------- |
| List StatCards + Units + CSV + parsers       | apps/web/src/app/(admin)/electricity/page.tsx      | WORKING |
| Detail floor column + parsers                | apps/web/src/app/(admin)/electricity/[id]/page.tsx | WORKING |
| Floor populate on list/create/PUT responses  | apps/api/src/routes/electricity.ts                 | WORKING |
| Guardian /my ward mode; :id room-scoped read | apps/api/src/routes/electricity.ts                 | WORKING |
| Flutter bill proof image + external open     | electricity_screen.dart                            | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.

## Open gaps

No open gap findings recorded in this file.

Pass 1 recorded no open gap of its own. The findings of the depth pass of 2026-10-21 are listed
in the last section of this file, and the ones that are still open live in
docs/audit/features/electricity.md.

## Closed

| Claim                                        | Live status                                                          |
| -------------------------------------------- | -------------------------------------------------------------------- |
| List StatCards + Units + CSV + parsers       | FIXED - WORKING - apps/web/src/app/(admin)/electricity/page.tsx      |
| Detail floor column + parsers                | FIXED - WORKING - apps/web/src/app/(admin)/electricity/[id]/page.tsx |
| Floor populate on list/create/PUT responses  | FIXED - WORKING - apps/api/src/routes/electricity.ts                 |
| Guardian /my ward mode; :id room-scoped read | FIXED - WORKING - apps/api/src/routes/electricity.ts                 |
| Flutter bill proof image + external open     | FIXED - WORKING - electricity_screen.dart                            |

## Depth pass 1 (2026-10-21) - the rebuild of the four admin screens

This pass added to the record of pass 1; it removes nothing from it. The standard is
`docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` and the contract that came out of it is
`packages/types/src/contracts/electricity.ts`. The four screens are
`apps/web/src/app/(admin)/electricity/page.tsx`, `.../electricity/new/page.tsx`,
`.../electricity/[id]/page.tsx` and `.../electricity/[id]/edit/page.tsx`.

Every claim below was read out of source on 2026-10-21. The line numbers in the Finding column
point at the code as it stood before this pass; the last column describes the code after it.

| ID        | Severity | Finding                                                                                                                                                                                                                                                                                                                                      | Where it stands after this pass                                                                                                                                                                                                                                                                                                                                                                                  |
| --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ELE-D1-1  | P2       | The list ignored its own address bar. The status and the month filters were local state (`electricity/page.tsx:59-60`), so a filtered view could not be shared, cited or reviewed, and a link that named a status landed on the whole ledger.                                                                                                | Closed. The status and the month live in the address bar (`useUrlState`), so /electricity?status=finalized&month=2026-10 is a link that lands on the bills it names, with the chips and the clear-all beside them.                                                                                                                                                                                               |
| ELE-D1-2  | P2       | The list showed a badge and four tiles and no progression, so a bill that was one step away from being charged looked the same as one that was already charged (`electricity/page.tsx:186-194`).                                                                                                                                             | Closed. Every row draws the three states as a progression, the status tabs carry the counts the server reports for the same filtered set, and the band names the bills that are still drafts.                                                                                                                                                                                                                    |
| ELE-D1-3  | P2       | No screen read the variance the server computes when it saves a bill (`apps/api/src/models/electricityBill.ts:138-148`), so the office had to add up the readings and the utility total itself. The list had no verdict at all and the detail showed the variance as one number among five (`electricity/[id]/page.tsx:344-379`).            | Closed. The band counts the bills in view whose readings do not add up, every row says whether the readings match the utility total and by how much they differ, and the detail leads with the three server numbers and the verdict.                                                                                                                                                                             |
| ELE-D1-4  | P2       | The link between a bill and the invoices it produced exists in the API (GET /electricity/:id returns linkedInvoices, `apps/api/src/routes/electricity.ts:435-487`) but no screen read it, so the share a resident carries was invisible in the module that computes it.                                                                      | Closed. A distributed row reads that server link and shows the residents charged with their share, each share linking to the invoice it became, and the detail shows the share beside the invoice, its total, its status and its due date.                                                                                                                                                                       |
| ELE-D1-5  | P2       | The list added up the money of the page on the client (the billed and the distributed tiles, `electricity/page.tsx:98-110`) and the export asked for limit=1000, which the API clamps to 100 (`apps/api/src/lib/routeUtils.ts:16`), so the file was silently short.                                                                          | Closed. The band shows counts and single server numbers, never a total the client made up, and the export walks the pages of the filtered set and reports the bills the server holds against the rows the file carries.                                                                                                                                                                                          |
| ELE-D1-6  | P2       | The detail page showed the room entries and the resident invoices as two tables with nothing between them, and never said how a room amount becomes the share a resident pays. The share column existed but nothing named the residents the server charged and the room each share came from.                                                | Closed. The room table carries the readings, the rate, the room amount and how many residents carry it; the resident table carries the share the server wrote, the invoice it became and the invoice state; and the page says that the server splits a room between the residents who were in it during the billing month.                                                                                       |
| ELE-D1-7  | P2       | The office could finalize a bill whose readings did not add up. POST /electricity/:id/finalize checks nothing about the variance (`apps/api/src/routes/electricity.ts:644-689`) and the screen offered the button in every case (`electricity/[id]/page.tsx:312-316`).                                                                       | Closed on the screen, open on the API. The finalize action is refused while the readings do not add up and no reason is written down, the page names the difference and says that the server does not check it. The API gap is ELE-D2-2.                                                                                                                                                                         |
| ELE-D1-8  | P2       | No screen said what the residents are told. The distribute pushes an electricity_bill notification (`apps/api/src/routes/electricity.ts:855-864`) and the finalize pushes nothing, but the office could not see which was which, and the residents the server skips were invisible.                                                          | Closed. A rail card states who is told when, and names the residents the server skipped (a cancelled invoice, or one already paid with electricity): they are neither charged nor notified.                                                                                                                                                                                                                      |
| ELE-D1-9  | P3       | The detail page reported the distribution in its own words whatever the server answered ("Distribution complete: N invoice(s) updated, E error(s)", `electricity/[id]/page.tsx:225`), so a partial run looked like a complete one, and the bill was not re-read after the write.                                                             | Closed. The page shows the server message and the server counts, says whether the bill reads distributed or was left as finalized so the run can be repeated, and re-reads the bill and the ledger.                                                                                                                                                                                                              |
| ELE-D1-10 | P3       | A write was only visible as a badge change afterwards: the list had no outcome line at all and the detail used a green banner of its own wording (`electricity/[id]/page.tsx:338-342`).                                                                                                                                                      | Closed. The list and the detail report the outcome of the write in a plain line that says what the server committed, and neither of them raises a toast.                                                                                                                                                                                                                                                         |
| ELE-D1-11 | P3       | The new form never said what finalizing and distributing do. It opened with "Save Bill" (`electricity/new/page.tsx:207`), and the office learned the rules only after a write was refused or after the residents were charged. The form also previewed the room sum but never said what the server would do with it.                         | Closed. The consequence panel says that the save writes a draft that charges nobody, that finalizing locks the readings, that distributing splits every room between the residents who were in it during the month and writes the share onto their invoice, that the invoice it opens is due on the 5th, and that every charged resident is notified. The form also previews what each resident will be charged. |
| ELE-D1-12 | P3       | The edit page said nothing about what an edit does, and it read the bill outside the shared query stack (`electricity/[id]/edit/page.tsx:111-156`), so a save could be made against a copy that was already stale.                                                                                                                           | Closed. The page reads the bill through the shared query stack, re-reads it after the save, states that a draft edit charges nobody, and names the server lock (BILL_LOCKED) that keeps a finalized or distributed bill read only, with its money on the resident invoices.                                                                                                                                      |
| ELE-D1-13 | P3       | The empty state always said that there were no bills yet (`electricity/page.tsx:310-317`), even when the view was filtered to a status or a month that held nothing.                                                                                                                                                                         | Closed. The empty state answers the question that was asked: a filtered view and the whole ledger each get their own wording and their own next action.                                                                                                                                                                                                                                                          |
| ELE-D2-1  | P2       | POST /electricity/:id/distribute skips a cancelled invoice and an invoice that is already paid and already carries electricity, without counting an error and without charging them (`apps/api/src/routes/electricity.ts:774-787`). The bill still reads distributed, so the month looks collected while those residents were never charged. | Open. The bill detail names the invoices that carry no share and why, but the server still charges nobody and tells nobody.                                                                                                                                                                                                                                                                                      |
| ELE-D2-2  | P2       | POST /electricity/:id/finalize checks nothing about the variance (`apps/api/src/routes/electricity.ts:644-689`), so a direct call finalizes a bill whose readings do not add up to the utility total.                                                                                                                                        | Open. The office screen refuses it and says that the server does not check it; the API needs the same check.                                                                                                                                                                                                                                                                                                     |
| ELE-D2-3  | P3       | GET /electricity/:id links a bill to the invoices of every tenant of its rooms, not of the residents who were in the room during the billing month (`apps/api/src/routes/electricity.ts:450-467`), so an invoice of somebody else appears in the list with no share.                                                                         | Open. The page names the difference between the residents the server charged and the invoices that carry no share; the API needs the month window on the link.                                                                                                                                                                                                                                                   |
| ELE-D2-4  | P3       | The shared lifecycle vocabulary carries no electricity domain (`packages/types/src/lifecycle.json`), so the module cannot use the shared StatusStepper that the invoice and the payment modules draw.                                                                                                                                        | Open. The module draws the progression from the model enum and the two routes. Closing it means adding the domain to the shared vocabulary, which also regenerates the portal file and is outside this module.                                                                                                                                                                                                   |
| ELE-D2-5  | P3       | The shared electricity DTOs of `packages/types/src/electricity.ts` have no importer and do not describe the API response: the lean rows of GET /electricity carry _id and not id, and the detail adds the linked invoices.                                                                                                                   | Open. The four screens keep their own interfaces until the shared DTO describes the API.                                                                                                                                                                                                                                                                                                                         |
