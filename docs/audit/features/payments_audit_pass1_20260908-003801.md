# Payments Module - Audit Pass 1

Module: payments
Scope: admin web + API + DB + shared types + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

payments (offline record, UTR submit/verify, receipt, void, month summary).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                       | Status  |
| ------ | --------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/payments/page.tsx -> /payments                     | WORKING |
| Create | apps/web/src/app/(admin)/payments/new/page.tsx -> /payments/new             | WORKING |
| Detail | apps/web/src/app/(admin)/payments/[id]/page.tsx -> /payments/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/payments/[id]/edit/page.tsx -> /payments/[id]/edit | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                          | Route                | API Used                             | Status  |
| ------------------------------- | -------------------- | ------------------------------------ | ------- |
| Payments list + UTR submit + QR | /tenant/payments     | GET payments/my, submit-utr, qr-code | WORKING |
| Receipt bottom sheet (settled)  | payments_screen.dart | GET payments/:id/receipt             | WORKING |

### 2.3 Not Accessible

| Actor           | Blocked Surface                                  | Enforcement                |
| --------------- | ------------------------------------------------ | -------------------------- |
| tenant          | GET /payments, offline, verify, void, PUT/DELETE | adminOnly, 403             |
| tenant/guardian | others payments                                  | ownership/ward checks, 403 |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                                    | Element             | Status                    |
| ---------------------------------------------------------- | ------------------- | ------------------------- |
| Summary StatCards collected/expected/pending               | StatCard            | WORKING                   |
| Filters method/type/status + pending-verification shortcut | Select + Button     | WORKING                   |
| Verify modal (approve/reject + notes)                      | modal + POST verify | WORKING                   |
| Room column with bed; mobile cards                         | DataTable           | WORKING (bed added)       |
| Full-set CSV export (1000-row fetch, Bed column)           | Button              | WORKING (fixed page-only) |
| parseApiError on load/verify/delete/export                 | errorParser         | WORKING (added)           |
| Custom SVG                                                 | none                | NO CUSTOM SVG             |

### 3.2 Create

| Feature                                                 | Element                 | Status                              |
| ------------------------------------------------------- | ----------------------- | ----------------------------------- |
| Tenant picker + payable invoice select (balance labels) | ResourceSelect + Select | WORKING (sections + labels rebuilt) |
| Balance auto-fill + tenant prefill + invoice prefill    | watchers                | WORKING                             |
| Push created detail                                     | router                  | WORKING (added)                     |
| parseApiError                                           | errorParser             | WORKING                             |
| Custom SVG                                              | none                    | NO CUSTOM SVG                       |

### 3.3 Detail

| Feature                                                                    | Element             | Status                                            |
| -------------------------------------------------------------------------- | ------------------- | ------------------------------------------------- |
| Amount hero + StatCards + status badge                                     | DetailCard/StatCard | WORKING                                           |
| Tenant card name/room/bed/floor + phone/WhatsApp                           | DetailCard          | WORKING (bed/floor added)                         |
| Invoice reference links + notes + screenshot                               | DetailCard          | WORKING                                           |
| Approve/Reject verify + Void paid + receipt modal + timeline               | Buttons + Timeline  | WORKING (void added)                              |
| parseApiError on load/verify/reject/receipt/void                           | errorParser         | WORKING (added)                                   |
| Receipt gating: paid/approved/completed + pending_verification record view | canShowReceipt      | WORKING (decision: submitted proof stays visible) |
| Custom SVG                                                                 | none                | NO CUSTOM SVG                                     |

### 3.4 Edit

| Feature                                           | Element     | Status                 |
| ------------------------------------------------- | ----------- | ---------------------- |
| Paid lock banner + fieldset disable               | banner      | WORKING                |
| Linked records header (tenant + invoice + amount) | FormSection | WORKING (added)        |
| Status enum without paid + verify hint            | Select      | WORKING (paid removed) |
| parseApiError                                     | errorParser | WORKING (pre-existing) |
| Custom SVG                                        | none        | NO CUSTOM SVG          |

## 4. Shared Components

| Component                                                                                                                                                    | Path          | Status                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | --------------------------------- |
| tenantDisplayName/tenantRoomNumber/tenantBedId (+floor in api-shapes)                                                                                        | api-shapes.ts | WORKING (bed/floor helpers added) |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea/Timeline | ui/*          | WORKING                           |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/payments.ts)

| Endpoint                                                            | Auth            | Status          |
| ------------------------------------------------------------------- | --------------- | --------------- |
| GET / (filters + tenant/room + invoice populate)                    | adminOnly       | WORKING         |
| GET /summary, /pending-verification                                 | adminOnly       | WORKING         |
| GET /my (tenant populate added)                                     | tenantOnly      | WORKING         |
| POST /offline (paid + verifiedBy + residual pending)                | adminOnly       | WORKING         |
| POST /submit-utr (screenshotUrl supported)                          | tenant + guards | WORKING         |
| POST /:id/verify (paid/rejected + notes append)                     | adminOnly       | WORKING         |
| PUT /:id (paid rows locked; paid removed from schema)               | adminOnly       | WORKING         |
| POST /:id/void (paid -> cancelled + invoice re-sync)                | adminOnly       | WORKING (added) |
| DELETE /:id (unverified only)                                       | adminOnly       | WORKING         |
| GET /:id, /:id/receipt (ownership/ward guards; room floor populate) | authGuard       | WORKING         |
| GET /qr-code                                                        | authGuard       | WORKING         |

### 5.2 Database Models

| Model   | Relation                                         | Status  |
| ------- | ------------------------------------------------ | ------- |
| Payment | tenantId/invoiceId; verifiedBy; UTR + screenshot | WORKING |
| Invoice | status re-synced via updateInvoicePaymentStatus  | WORKING |

## 6. Missing Custom Components

| Component | Need                                         | Status |
| --------- | -------------------------------------------- | ------ |
| none      | Timeline + receipt modal cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                                                       | Status  |
| -------- | ------------------------------------------------------------- | ------- |
| List     | Record, Export, verify shortcut, View/Edit/Delete, Verify UTR | WORKING |
| Detail   | Edit, Approve/Reject, Void, Receipt, WhatsApp                 | WORKING |
| New/Edit | Record/Save/Cancel                                            | WORKING |

## 8. SVG Inventory

| Location          | SVG         | Status        |
| ----------------- | ----------- | ------------- |
| All payment pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location          | Status  |
| ------------------------- | ----------------- | ------- |
| List table + mobile cards | payments/page.tsx | WORKING |
| CSV export (9 cols)       | payments/page.tsx | WORKING |
| Printable receipt modal   | payments/[id]     | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. PUT paid removal (schema + FE enum + context header). 2. Void endpoint + detail button. 3. List parsers + full CSV + bed. 4. New sections + balance labels + push detail. 5. Detail bed/floor + parsers. 6. /my tenant populate + receipt/pending-verification floor populate + mapPayment bed/floor.

## 11. Out of Scope for This Pass

1. Receipt gating unification (web shows submitted proof; Flutter shows settled proof; both intentional).
2. Unused summary/qr API surfaces (P2).
3. Dual pending-verification populate shape (works; cosmetic).

## 12. Pass 1 Fixes Applied

| Fix                                                                                                | Files                                                | Status  |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| paid removed from PUT schema (verify-only)                                                         | apps/api/src/routes/payments.ts                      | WORKING |
| POST /:id/void endpoint                                                                            | apps/api/src/routes/payments.ts                      | WORKING |
| /my tenant populate; floor populate on list/:id/pending-verification/receipt; mapPayment bed/floor | apps/api/src/routes/payments.ts                      | WORKING |
| List parsers + full-set CSV + Bed column                                                           | apps/web/src/app/(admin)/payments/page.tsx           | WORKING |
| New sections + tenantLabel + balance labels + push detail                                          | apps/web/src/app/(admin)/payments/new/page.tsx       | WORKING |
| Detail bed/floor + parsers + void button                                                           | apps/web/src/app/(admin)/payments/[id]/page.tsx      | WORKING |
| Edit paid removal + linked header                                                                  | apps/web/src/app/(admin)/payments/[id]/edit/page.tsx | WORKING |
| api-shapes bed/floor helpers                                                                       | apps/web/src/lib/api-shapes.ts                       | WORKING |
| Flutter UTR screenshot field + balance labels                                                      | payments_screen.dart, tenant_repository.dart         | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.
