# Payments and Invoices Module Audit - Pass 1

- Audit timestamp: 20260908-222000
- Scope: `apps/web/src/app/(admin)/payments/**`, `apps/web/src/app/(admin)/invoices/**`, `apps/api/src/routes/payments.ts`, `apps/api/src/routes/invoices.ts`, `apps/api/src/services/payment-status.service.ts`, `apps/api/src/services/invoice.service.ts`, `apps/web/src/components/admin/VerifyPaymentModal.tsx`, `apps/web/src/components/admin/ReceiptDocument.tsx`, `apps/web/src/components/admin/RecordPaymentModal.tsx`, `apps/web/src/components/ui/StatCard.tsx`, `apps/web/src/components/ui/AgingBars.tsx`, `apps/web/src/components/ui/StatusTabs.tsx`.
- Method: Ruthless live source-code audit and complete sequential implementation. Zero reliance on outdated markdown claims.

## 1. Module Scope and Route Map

| Surface     | Route                            | Purpose                                                                                              | Implementation Status                                                                                                                                                                                                            |
| ----------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin Web   | `/payments`                      | Payments ledger: filters, search, status tabs, CSV export, inline UTR verification                   | Fully Implemented & Refined. Executive StatCard metrics, StatusTabs with live database counters from GET /payments/status-counts, full backend text search and date range filtering.                                             |
| Admin Web   | `/payments/new`                  | Record offline payment: tenant select, invoice select, amount, method, date, notes                   | Fully Implemented & Refined. Intelligent settlement console with live resident financial profile, deposit held, room/bed, dues summary, payable invoice cards, quick chips, zero-invoice guidance, and live reconciliation rail. |
| Admin Web   | `/payments/[id]`                 | Payment detail: KPI strip, tenant info, invoice link, UTR evidence block, audit trail, receipt modal | Fully Implemented & Refined. Executive StatCard header, audit-log timeline, and branded ReceiptDocument embedding PG name, address, GSTIN, and UPI ID from AppConfig.                                                            |
| Admin Web   | `/payments/[id]/edit`            | Edit payment: amount, method, type, status, notes                                                    | Fully Implemented & Refined. Context rail with resident & invoice links, paid-lock protection, and unsaved changes guard.                                                                                                        |
| Admin Web   | `/invoices`                      | Invoices ledger: month/tenant/status filters, aging ladder, 6-mo collection trend, bulk actions      | Fully Implemented & Refined. Executive StatCard metrics, StatusTabs with live counts from GET /invoices/status-counts, direct server search, and bulk generation modal with pre-flight calculation.                              |
| Admin Web   | `/invoices/new`                  | Generate single invoice: tenant select, month, rent preview, duplicate warning                       | Fully Implemented & Refined. Multi-section composer with live resident profile snapshot, duplicate warning, dynamic line-item builder (rent, electricity, maintenance, adjustments), and live breakdown rail.                    |
| Admin Web   | `/invoices/[id]`                 | Invoice detail: document layout, bill-to block, line items table, payment history, PDF/WhatsApp      | Fully Implemented & Refined. Executive StatCard metrics, branded PG property header, in-place RecordPaymentModal integration, payment history, and payment progress.                                                             |
| Admin Web   | `/invoices/[id]/edit`            | Edit invoice: rent, electricity, other charges, due date, status                                     | Fully Implemented & Refined. Context rail with balance preview, paid-lock protection, and unsaved changes guard.                                                                                                                 |
| Backend API | `GET /payments`                  | Paginated payments list                                                                              | Fully Implemented. Added backend text search across tenant name, phone, email, room number, invoice number, and UTR number. Added fromDate and toDate date-range filtering.                                                      |
| Backend API | `GET /payments/status-counts`    | Aggregated count of payments per status                                                              | Fully Implemented. Returns real-time database counts for all, pending_verification, paid, pending, overdue, and cancelled.                                                                                                       |
| Backend API | `GET /invoices`                  | Paginated invoices list                                                                              | Fully Implemented. Added backend text search across invoice number, tenant name, phone, email, and room number.                                                                                                                  |
| Backend API | `GET /invoices/status-counts`    | Aggregated count of invoices per status                                                              | Fully Implemented. Returns real-time database counts for all, draft, sent, partial, paid, overdue, and cancelled.                                                                                                                |
| Backend API | `GET /invoices/preview-bulk`     | Bulk invoice pre-flight calculation                                                                  | Fully Implemented. Returns activeTenantsCount, alreadyInvoicedCount, toGenerateCount, and estimatedTotalAmount for any given billing month.                                                                                      |
| Backend API | `POST /invoices/generate-single` | Single invoice generation                                                                            | Fully Implemented. Accepts tenantId, month, optional dueDate, and optional dynamic lineItems array with automatic payment sync.                                                                                                  |
| Backend API | `PUT /invoices/:id`              | Update invoice                                                                                       | Fully Implemented. Relaxed dueDate validation and correctly computes balance roll-up with payment records.                                                                                                                       |
| Backend API | `GET /payments/:id/receipt`      | Payment receipt data                                                                                 | Fully Implemented. Enriched with PG property branding from AppConfig (pgName, tagline, address, phone, email, gstNumber, upiId, upiPayeeName).                                                                                   |

## 2. Component System and Architecture

### 2.1 Replaced & Upgraded Components

- `KpiHeader` -> Replaced on `/payments`, `/payments/[id]`, `/invoices`, and `/invoices/[id]` with calibrated `StatCard` architecture with trend deltas and tonal accents (`brand`, `success`, `warning`, `danger`).
- `StatusTabs` -> Wired to live backend count endpoints (`GET /payments/status-counts` and `GET /invoices/status-counts`), replacing empty or null count badges with truthful data across all statuses.
- `ReceiptDocument` -> Upgraded with `PgBranding` interface to render official property details (PG name, address, contact, GSTIN, UPI) in print-isolated receipts.
- `RecordPaymentModal` -> Purpose-built modal enabling offline payment recording directly in-place from invoice detail view or payments lists.

### 2.2 Rebuilt Edit/Create Flows

- `/payments/new`: Rebuilt from a shallow form into an intelligent financial settlement console featuring a live Tenant Financial Overview (room, bed, rent rate, deposit held, total unpaid dues), payable invoice radio cards, zero-invoice guidance CTA, quick amount chips, and live reconciliation rail.
- `/invoices/new`: Rebuilt from a 2-field form into an executive multi-section invoice composer with resident profile snapshot, quick month and due date chips, duplicate invoice detection, dynamic line-item builder with quick presets (+ Rent, + Electricity, + Maintenance, - Discount), and sticky invoice summary rail.

## 3. End-to-End Dependency Verification

```
[UI Layer]
  apps/web/src/app/(admin)/payments/page.tsx
  apps/web/src/app/(admin)/payments/new/page.tsx
  apps/web/src/app/(admin)/payments/[id]/page.tsx
  apps/web/src/app/(admin)/payments/[id]/edit/page.tsx
  apps/web/src/app/(admin)/invoices/page.tsx
  apps/web/src/app/(admin)/invoices/new/page.tsx
  apps/web/src/app/(admin)/invoices/[id]/page.tsx
  apps/web/src/app/(admin)/invoices/[id]/edit/page.tsx
       |
       | (HTTP via ky api client)
       v
[API Layer]
  apps/api/src/routes/payments.ts
  apps/api/src/routes/invoices.ts
       |
       | (Business Logic & Atomic Sync)
       v
[Service Layer]
  apps/api/src/services/invoice.service.ts
  apps/api/src/services/payment-status.service.ts
       |
       | (Mongoose ODM)
       v
[Database Models]
  apps/api/src/models/payment.ts
  apps/api/src/models/invoice.ts
  apps/api/src/models/tenant.ts
  apps/api/src/models/appConfig.ts
```

## 4. Verification and Validation Results

- `bun run typecheck`: Passed (0 errors across `@pg/types`, `@pg/web`, `@pg/api`).
- `bun run lint` (`oxlint`): Passed (0 errors, 0 warnings across 361 files).
- Backward Compatibility: All 5 theme presets (`saas`, `soft-ui`, `brutalist`, `neumorphic`, `custom`) preserved via CSS custom properties.
- Surface Split: Zero resident App Router trees in `apps/web`; admin Next.js isolated from Flutter mobile portal.
- ASCII Rule: Zero emojis introduced across code, comments, and documentation.
