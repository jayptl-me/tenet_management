# Invoices Module - Audit Pass 1

Module: invoices
Scope: admin web + API + DB + shared types + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

invoices (generate single/bulk, edit locked states, PDF, WhatsApp share).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                       | Status  |
| ------ | --------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/invoices/page.tsx -> /invoices                     | WORKING |
| Create | apps/web/src/app/(admin)/invoices/new/page.tsx -> /invoices/new             | WORKING |
| Detail | apps/web/src/app/(admin)/invoices/[id]/page.tsx -> /invoices/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/invoices/[id]/edit/page.tsx -> /invoices/[id]/edit | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                                     | Route                | API Used         | Status  |
| ------------------------------------------ | -------------------- | ---------------- | ------- |
| Invoices list + status chips + due display | /tenant/invoices     | GET invoices/my  | WORKING |
| Invoice detail + stay card + pay/UTR link  | /tenant/invoices/:id | GET invoices/:id | WORKING |

### 2.3 Not Accessible

| Actor           | Blocked Surface                     | Enforcement           |
| --------------- | ----------------------------------- | --------------------- |
| tenant          | GET /invoices, generate, PUT/DELETE | adminOnly, 403        |
| tenant/guardian | others invoices                     | canAccessInvoice, 403 |
| guardian        | GET /invoices (admin list)          | adminOnly, 403        |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                                 | Element                    | Status          |
| ------------------------------------------------------- | -------------------------- | --------------- |
| Columns Invoice/Tenant/Room/Month/Amount/Status/Actions | DataTable                  | WORKING         |
| Month + status filters                                  | Input month + Select       | WORKING         |
| Tenant filter                                           | ResourceSelect -> tenantId | WORKING (added) |
| Bulk generate month + per-row delete (paid hidden)      | Button + ConfirmModal      | WORKING         |
| Export CSV (1000-row fetch)                             | Button + Download          | WORKING         |
| parseApiError on load/bulk/export/delete                | errorParser                | WORKING (added) |
| Custom SVG                                              | none                       | NO CUSTOM SVG   |

### 3.2 Create

| Feature                                                         | Element                         | Status            |
| --------------------------------------------------------------- | ------------------------------- | ----------------- |
| Tenant picker (active) + rent preview + duplicate-month warning | ResourceSelect + preview panels | WORKING (rebuilt) |
| Month YYYY-MM + push created detail                             | api.post generate-single        | WORKING           |
| parseApiError                                                   | errorParser                     | WORKING           |
| Custom SVG                                                      | none                            | NO CUSTOM SVG     |

### 3.3 Detail

| Feature                                          | Element               | Status              |
| ------------------------------------------------ | --------------------- | ------------------- |
| StatCards total/paid/balance + status badge      | StatCard              | WORKING             |
| Record payment CTA (balance-gated) + Edit        | Button                | WORKING             |
| Tenant card name/room/bed/floor + phone/WhatsApp | DetailCard            | WORKING (bed added) |
| Payments timeline + PDF download                 | Timeline + blob fetch | WORKING             |
| parseApiError on load                            | errorParser           | WORKING (added)     |
| Custom SVG                                       | none                  | NO CUSTOM SVG       |

### 3.4 Edit

| Feature                                        | Element     | Status                |
| ---------------------------------------------- | ----------- | --------------------- |
| Paid lock + partial banner                     | ErrorBanner | WORKING               |
| Tenant stay card name/room/bed/floor           | surfaceCard | WORKING (floor added) |
| Amounts/due-date/status (partial omits status) | FormSection | WORKING               |
| parseApiError on load/submit                   | errorParser | WORKING (added)       |
| Custom SVG                                     | none        | NO CUSTOM SVG         |

## 4. Shared Components

| Component                                                                                                                                  | Path                                 | Status  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------- |
| tenantLabel/tenantDisplayName/tenantRoomNumber                                                                                             | resource-select-presets / api-shapes | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select | ui/*                                 | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/invoices.ts)

| Endpoint                                                                       | Auth       | Status  |
| ------------------------------------------------------------------------------ | ---------- | ------- |
| POST /generate-single, /generate-bulk                                          | adminOnly  | WORKING |
| GET / (month/status/tenantId; status enum-checked; room floor nested populate) | adminOnly  | WORKING |
| GET /my                                                                        | tenantOnly | WORKING |
| GET /:id (canAccessInvoice; inline paid/balance math)                          | authGuard  | WORKING |
| GET /:id/payment-status (removed 2026-10-21, no consumer)                      | authGuard  | REMOVED |
| GET /:id/pdf, /:id/whatsapp                                                    | authGuard  | WORKING |
| PUT /:id (paid/cancelled guards; INVOICE_HAS_BALANCE on cancel added)          | adminOnly  | WORKING |
| DELETE /:id                                                                    | adminOnly  | WORKING |

### 5.2 Database Models

| Model             | Relation                                                          | Status  |
| ----------------- | ----------------------------------------------------------------- | ------- |
| Invoice           | tenantId -> Tenant; month unique per tenant; pre-save totalAmount | WORKING |
| Payment           | invoiceId -> Invoice; paid-only sums via getInvoiceBalance        | WORKING |
| Tenant/Room/Floor | stay chain populated on list + detail                             | WORKING |

## 6. Missing Custom Components

| Component | Need                                   | Status |
| --------- | -------------------------------------- | ------ |
| none      | StatCards/timeline cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                                               | Status  |
| -------- | ----------------------------------------------------- | ------- |
| List     | Generate, Export, View/Edit/Delete, bulk Generate All | WORKING |
| Detail   | Record payment, Edit, PDF, WhatsApp                   | WORKING |
| New/Edit | Generate/Save/Cancel                                  | WORKING |

## 8. SVG Inventory

| Location          | SVG         | Status        |
| ----------------- | ----------- | ------------- |
| All invoice pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location                            | Status  |
| ------------------------- | ----------------------------------- | ------- |
| List table + mobile cards | invoices/page.tsx                   | WORKING |
| CSV export (8 cols)       | invoices/page.tsx                   | WORKING |
| Invoice PDF               | InvoicePdf template + blob download | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. List tenant filter + parsers. 2. Create rent preview + duplicate warning + push detail. 3. Detail bed row + parser. 4. Edit floor row + parsers. 5. API canAccessInvoice guard on GET /:id + cancel balance guard + status enum + list floor populate.

## 11. Out of Scope for This Pass

1. Draft-invoice checkout blocking (drafts are not dues by product decision).
2. Invoice :id inline paid/balance math (verified equivalent to getInvoiceBalance).
3. Flutter invoice screens edits beyond list chips + stay card (read-only otherwise).

## 12. Pass 1 Fixes Applied

| Fix                                                           | Files                                                | Status  |
| ------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| payment-status canAccessInvoice guard (removed 2026-10-21)    | apps/api/src/routes/invoices.ts                      | REMOVED |
| Cancel with balance 409 INVOICE_HAS_BALANCE                   | apps/api/src/routes/invoices.ts                      | WORKING |
| List status enum + floor nested populate                      | apps/api/src/routes/invoices.ts                      | WORKING |
| List tenant filter + parsers                                  | apps/web/src/app/(admin)/invoices/page.tsx           | WORKING |
| Create rebuilt with preview + duplicate warning + push detail | apps/web/src/app/(admin)/invoices/new/page.tsx       | WORKING |
| Detail bed row + parser                                       | apps/web/src/app/(admin)/invoices/[id]/page.tsx      | WORKING |
| Edit floor row + parsers                                      | apps/web/src/app/(admin)/invoices/[id]/edit/page.tsx | WORKING |
| Flutter list balance + status chips; detail stay card         | invoices_screen.dart, invoice_detail_screen.dart     | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.

## Open gaps

No open gap findings recorded in this file.

Pass 1 recorded no open gap of its own. The findings of the depth pass of 2026-10-21 are listed
in the last section of this file, and the ones that are still open live in
docs/audit/features/invoices.md.

## Closed

| Claim                                                         | Live status                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| payment-status guard, endpoint removed 2026-10-21             | REMOVED 2026-10-21 - deleted, no consumer; guard now on GET /:id       |
| Cancel with balance 409 INVOICE_HAS_BALANCE                   | FIXED - WORKING - apps/api/src/routes/invoices.ts                      |
| List status enum + floor nested populate                      | FIXED - WORKING - apps/api/src/routes/invoices.ts                      |
| List tenant filter + parsers                                  | FIXED - WORKING - apps/web/src/app/(admin)/invoices/page.tsx           |
| Create rebuilt with preview + duplicate warning + push detail | FIXED - WORKING - apps/web/src/app/(admin)/invoices/new/page.tsx       |
| Detail bed row + parser                                       | FIXED - WORKING - apps/web/src/app/(admin)/invoices/[id]/page.tsx      |
| Edit floor row + parsers                                      | FIXED - WORKING - apps/web/src/app/(admin)/invoices/[id]/edit/page.tsx |
| Flutter list balance + status chips; detail stay card         | FIXED - WORKING - invoices_screen.dart, invoice_detail_screen.dart     |

## Depth pass 1 (2026-10-21) - the rebuild of the four admin screens

This pass added to the record of pass 1; it removes nothing from it. The standard is
`docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` and the contract that came out of it is
`packages/types/src/contracts/invoices.ts`. The four screens are
`apps/web/src/app/(admin)/invoices/page.tsx`, `.../invoices/new/page.tsx`,
`.../invoices/[id]/page.tsx` and `.../invoices/[id]/edit/page.tsx`.

Every claim below was read out of source on 2026-10-21. The line numbers in the Finding column
point at the code as it stood before this pass; the last column describes the code after it.

| ID        | Severity | Finding                                                                                                                                                                                                                                                                                                                                                         | Where it stands after this pass                                                                                                                                                              |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-D1-1  | P2       | The ledger ignored its own address bar. The status, the resident and the search were local state and the month was read once at mount (`invoices/page.tsx:200-205`), so a filtered view could not be shared, cited or reviewed.                                                                                                                                 | Closed. All four filters live in the address bar (`useUrlState`, `useUrlSearch`), so /invoices?status=overdue&month=2026-10 is a link that lands on the rows it names.                       |
| INV-D1-2  | P2       | The tab counts came from GET /invoices/status-counts, which is global and reads the month only (`apps/api/src/routes/invoices.ts:280-310`), while the table was filtered by status, month, resident and search. A tab could read 12 and the click show 3 rows.                                                                                                  | Closed. Every count is read from GET /invoices for the same filtered set the table shows.                                                                                                    |
| INV-D1-3  | P2       | The CSV export asked for limit=1000 (`invoices/page.tsx:377`), but parsePagination clamps a page to 100 (`apps/api/src/lib/routeUtils.ts:16`), and it never sent the search or the resident filter. The file was silently short and the operator believed it held the ledger.                                                                                   | Closed. The export walks the pages of the filtered set, sends every filter including the search, and reports how many invoices the server holds against the rows the file carries.           |
| INV-D1-4  | P3       | The ledger rows were not navigable: the invoice number and the resident name were plain text (`invoices/page.tsx:555-580`), so the office could not reach the invoice, the resident or the room from the ledger.                                                                                                                                                | Closed. The invoice number links to /invoices/[id], the resident to /tenants/[id] and the room to /rooms/[id], in the table and in the mobile card.                                          |
| INV-D1-5  | P3       | The empty state always said "No invoices yet" (`invoices/page.tsx:772-779`), even when the view was filtered to a status that holds nothing.                                                                                                                                                                                                                    | Closed. The empty state answers the question that was asked: a status, a filter or the whole ledger each get their own wording and their own next action.                                    |
| INV-D1-6  | P2       | The detail page showed a badge and a progress bar but no progression, although the shared vocabulary already carries the invoice ladder (`packages/types/src/lifecycle.json`, the invoice domain).                                                                                                                                                              | Closed. The detail page renders the shared StatusStepper for the invoice domain and names who moves the record and when.                                                                     |
| INV-D1-7  | P2       | The office could only cancel a bill from the edit page, where the balance is not on screen, and the server refuses a cancel that still carries a balance (409 INVOICE_HAS_BALANCE, `apps/api/src/routes/invoices.ts:727-747`).                                                                                                                                  | Closed. Cancel invoice sits in the header and in the rail of the detail page, writes through the same route, re-reads the invoice and shows the refusal of the server.                       |
| INV-D1-8  | P3       | The payment history had an onRowClick handler but no cell said so, and the columns carried neither the date nor the UTR (`invoices/[id]/page.tsx:195-217`).                                                                                                                                                                                                     | Closed. Every row links to /payments/[id] and the table carries the date, the amount, the method and the status.                                                                             |
| INV-D1-9  | P3       | The detail page never showed the resident's own picture: what the resident owes across their other invoices is only on GET /tenants/:id/dues (`apps/api/src/routes/tenants.ts:1920-1930`), which this page did not read.                                                                                                                                        | Closed. A rail card reads the dues summary of the resident and shows the total, the open invoices and the balance of each.                                                                   |
| INV-D1-10 | P3       | The contract promised the proof of an invoice write on /invoices/[id], but no screen rendered a trail, and GET /audit-logs cannot filter by record id (`apps/api/src/routes/audit.ts:16-24`).                                                                                                                                                                   | Closed on the screen, open on the API. The detail page renders the activity trail of the invoice and states that it is the trail inside the newest invoice entries; the API gap is INV-D2-1. |
| INV-D1-11 | P2       | The compose form warned that a second invoice "will create a separate invoice record" (`invoices/new/page.tsx:157`), while the model keeps one invoice per resident and month (unique index, `apps/api/src/models/invoice.ts:112`), so the write was refused by the database with a generic error.                                                              | Closed. A duplicate is a wall: the write is blocked, the existing invoice is named and linked, and the reason is given.                                                                      |
| INV-D1-12 | P2       | The compose form offered a discount preset of -500 (`invoices/new/page.tsx:459`) while the server accepts only non-negative amounts (`apps/api/src/routes/invoices.ts:179-181`), so the write failed with a validation error the form never predicted.                                                                                                          | Closed. The preset is gone and the form says how a discount is applied.                                                                                                                      |
| INV-D1-13 | P3       | The compose form did not say what the server would do: that the bill is issued as sent (`apps/api/src/services/invoice.service.ts:161`), that a pending payment row is opened for the full amount (`:165-174`), that the resident is notified (`:179-202`) and that the lines are split into rent, electricity and other charges by their wording (`:101-113`). | Closed. The rail names the consequence before the write.                                                                                                                                     |
| INV-D1-14 | P3       | The edit page never said that an edit moves what the resident owes, nor that the resident is told (`apps/api/src/routes/invoices.ts:899-910`), so the office could move a bill in silence.                                                                                                                                                                      | Closed. The rail states what the save does: a moved amount notifies the resident with the old and the new number, a cancellation notifies them too, and sending a draft does not.            |
| INV-D2-1  | P3       | GET /audit-logs cannot filter by record id (`apps/api/src/routes/audit.ts:16-24`), so a trail of one record can only be assembled from the newest entries of the resource.                                                                                                                                                                                      | Open. The invoice page works around it and says so; the API needs the filter.                                                                                                                |
| INV-D2-2  | P2       | DELETE /invoices/:id removes the bill and writes an audit log, but tells the resident nothing (`apps/api/src/routes/invoices.ts:1068-1084`).                                                                                                                                                                                                                    | Open. The admin screen says so before the delete; the resident is still not reached.                                                                                                         |
| INV-D2-3  | P2       | PUT /invoices/:id with status=sent moves a draft or reopens a cancelled bill without notifying the resident (`apps/api/src/routes/invoices.ts:774-936`).                                                                                                                                                                                                        | Open. The edit screen says so before the save; the resident is still not reached.                                                                                                            |
| INV-D2-4  | P3       | The shared invoice DTOs of `packages/types/src/invoice.ts` have no importer and do not describe the response: the lean rows of GET /invoices carry _id and not id (`apps/api/src/routes/invoices.ts:244-270`).                                                                                                                                                  | Open. The four screens keep their own interfaces until the shared DTO describes the API.                                                                                                     |
| INV-D2-5  | P3       | The aging report counts by days past the due date while the status tab reads the status the sweep wrote, so a past due invoice that the sweep has not reached is in the bars and not in the tab (`apps/api/src/routes/invoices.ts:435-503`).                                                                                                                    | Open. The page names the difference under the bars; a due date filter on GET /invoices would close it.                                                                                       |
