# Invoices Module - Audit Pass 1

Module: invoices
Scope: admin web + API + DB + shared types + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

invoices (generate single/bulk, edit locked states, PDF, payment-status, WhatsApp share).

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
| GET /:id/payment-status (canAccessInvoice added)                               | authGuard  | WORKING |
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

1. List tenant filter + parsers. 2. Create rent preview + duplicate warning + push detail. 3. Detail bed row + parser. 4. Edit floor row + parsers. 5. API payment-status guard + cancel balance guard + status enum + list floor populate.

## 11. Out of Scope for This Pass

1. Draft-invoice checkout blocking (drafts are not dues by product decision).
2. Invoice :id inline paid/balance math (verified equivalent to getInvoiceBalance).
3. Flutter invoice screens edits beyond list chips + stay card (read-only otherwise).

## 12. Pass 1 Fixes Applied

| Fix                                                           | Files                                                | Status  |
| ------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| payment-status canAccessInvoice guard                         | apps/api/src/routes/invoices.ts                      | WORKING |
| Cancel with balance 409 INVOICE_HAS_BALANCE                   | apps/api/src/routes/invoices.ts                      | WORKING |
| List status enum + floor nested populate                      | apps/api/src/routes/invoices.ts                      | WORKING |
| List tenant filter + parsers                                  | apps/web/src/app/(admin)/invoices/page.tsx           | WORKING |
| Create rebuilt with preview + duplicate warning + push detail | apps/web/src/app/(admin)/invoices/new/page.tsx       | WORKING |
| Detail bed row + parser                                       | apps/web/src/app/(admin)/invoices/[id]/page.tsx      | WORKING |
| Edit floor row + parsers                                      | apps/web/src/app/(admin)/invoices/[id]/edit/page.tsx | WORKING |
| Flutter list balance + status chips; detail stay card         | invoices_screen.dart, invoice_detail_screen.dart     | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.
