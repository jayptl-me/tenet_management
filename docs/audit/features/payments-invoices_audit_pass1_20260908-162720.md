# Payments & Invoices Module Audit — Pass 1

- Audit date: 2026-09-08 16:27 (pass1 timestamp marker)
- Implementation: 2026-09-08 — full rebuild completed, `bun lint` 0 warnings, monorepo typecheck green.
- Design direction (owner-approved): Linear/Stripe ledger. Token-based so all 5 theme presets keep working; sidebar untouched.

## Implemented in this pass

API (additive, backwards compatible):
- `GET /payments/summary?month=YYYY-MM` — optional month param (default current).
- `GET /payments/trend?months=N` — collected vs expected per month (1-12, default 6).
- `GET /invoices/aging` — AR buckets current/1-30/31-60/61-90/90+ with counts and totals.

New components:
- `KpiHeader` — Stripe-style KPI strip with prev-period deltas and tone accents.
- `AgingBars` — receivables aging ladder; bucket click filters the list.
- `StatusTabs` — underlined status tab strip with counts.
- `FilterChips` — removable active-filter chips with clear-all.
- `VerifyPaymentModal` (admin) — UTR verify with copy, screenshot preview + zoom, notes.
- `ReceiptDocument` (admin) — print-isolated receipt (`.receipt-print-area` CSS in globals.css).
- `Modal` — shared themed modal shell.
- `useUnsavedGuard` / `useUnsavedGuardState` — unsaved-changes navigation guard.

Upgraded primitives (backward compatible):
- `DataTable` — row selection + contextual bulk-action bar, toolbar slot, sticky header, selected-row tint.
- `Input` — clearable affordance; `StatCard` — shared arrow map.

Rebuilt pages:
- `/invoices` — KPI strip, aging bars, 6-month collection trend, search (client-side fallback), month/tenant/status filters as chips, bulk mark-sent/export/delete with partial-success toasts, bulk-generate modal.
- `/payments` — KPI strip with deltas, status tabs, search, date-range filters, filter chips, shared verify modal (screenshot + UTR copy), UTR + invoice columns in table and CSV.
- `/payments/new` — payable-invoice picker cards with balances, quick-amount chips, visual method picker, live balance-breakdown summary rail.
- `/payments/[id]/edit` — context rail (tenant/invoice/status/UTR), status help text, unsaved-changes guard, richer paid-lock messaging.
- `/payments/[id]` — ledger KPI header, UTR evidence block with copy, audit-log-driven activity timeline (`GET /audit-logs?resource=payment&resourceId=`), print-isolated receipt, shared verify modal.
- `/invoices/new` — month quick chips, rent-seed preview card, duplicate warning.
- `/invoices/[id]/edit` — live total delta + balance-impact warning, context rail with paid/balance, unsaved-changes guard.
- `/invoices/[id]` — document-style invoice (bill-to block, ruled line items, subtotal/amount-due totals, payment progress stub), overdue banner, KPI strip, print button.

## 1. Feature map (what is accessible)
- Scope: `apps/web/src/app/(admin)/payments/**`, `apps/web/src/app/(admin)/invoices/**`, backend `apps/api/src/routes/payments.ts`, `apps/api/src/routes/invoices.ts`, models `payment.ts` / `invoice.ts`, shared UI components, theme system.
- Method: source-code only. No existing docs used for findings.

## 1. Feature map (what is accessible)

| Route | Purpose | Status |
|---|---|---|
| `/payments` | Payments list: filters (method/type/status), pending-verification toggle, CSV export, verify-UTR modal, delete, pagination | Built, shallow UI |
| `/payments/new` | Record offline payment: tenant select -> payable invoice select -> amount (auto-fills balance), method, paidAt, notes | Built, shallow UI |
| `/payments/[id]` | Payment detail: amount/method/status stat cards, tenant info, invoice link, UTR, screenshot, verify/void/receipt/WhatsApp actions, 2-event timeline | Built, shallow UI |
| `/payments/[id]/edit` | Edit non-paid payment: amount, method, type, status (paid excluded), notes; paid rows locked | Built, shallow UI |
| `/invoices` | Invoices list: month/tenant/status filters, bulk generate by month, CSV export, delete | Built, shallow UI |
| `/invoices/new` | Generate single invoice: tenant + month, duplicate warning, rent preview | Built, shallow UI |
| `/invoices/[id]` | Invoice detail: stat cards, paid/balance donut, breakdown tiles, line items table, payment history table + timeline, tenant card, PDF/WhatsApp/record-payment actions | Built, shallow UI |
| `/invoices/[id]/edit` | Edit line amounts, due date, status (paid locked; partial status hidden); auto-total display | Built, shallow UI |

## 2. Fully built vs pending

Fully built (functional end-to-end, and rebuilt this pass):
- Offline payment recording with balance reconciliation (API reconciles pending rows, cancels extras, creates residual pending row).
- UTR verification flow (approve/reject with notes, `$unset` of UTR on reject).
- Payment void (paid -> cancelled + invoice re-sync), delete (non-paid only), paid-row lock.
- Invoice generation single + bulk (month), duplicate protection (tenant+month unique), PDF render, WhatsApp share text, payment-status recompute service.
- CSV exports on both list pages (formula-injection escaped).

Pending / weak (remaining for a later pass):
- List-page search is client-side over the current page only; server-side `search` query param on GET /payments and GET /invoices would make it exhaustive.
- Status tab counts are computed only for the filtered status (pending-verification); full per-status counts need a counts endpoint or aggregated meta.
- Receipt branding (PG name/logo from app-config) is not yet on `ReceiptDocument`.
- Invoice line items are still the 3 fixed amount fields (rent/electricity/other) in edit; a free-form line-item editor is a larger change (API supports `lineItems` already).
- Bulk operations run sequentially client-side; a single bulk API endpoint would be more efficient for large sets.

## 3. Cross-cutting dependencies (end-to-end)

Backend routes consumed by this module:
- `GET /payments` (filters: status, month, tenantId, roomId, method, type; pagination; populates tenant.user/room.floor + invoice)
- `GET /payments/summary` (current month collected/expected/pending)
- `GET /payments/pending-verification`, `GET /payments/:id`, `GET /payments/:id/receipt`
- `POST /payments/offline`, `POST /payments/:id/verify`, `POST /payments/:id/void`, `PUT /payments/:id`, `DELETE /payments/:id`
- `GET /invoices` (month/status/tenantId), `GET /invoices/:id` (returns paidAmount, balance, payments[], whatsAppUrl, shareText), `GET /invoices/:id/pdf`
- `POST /invoices/generate-bulk`, `POST /invoices/generate-single`, `PUT /invoices/:id`, `DELETE /invoices/:id`
- Tenant-scoped: `GET /tenants/:id/payments`, `GET /tenants/:id/invoices`, `GET /tenants/:id/dues` (used by tenant detail page, not this module)

Database models:
- `Payment`: tenantId, invoiceId, amount, type (rent/electricity/deposit/laundry/other), method (upi/cash/bank_transfer/other), status (pending/pending_verification/paid/overdue/cancelled), month (YYYY-MM), dueDate, paidAt, utrNumber (unique sparse), verifiedBy, screenshotUrl, notes.
- `Invoice`: invoiceNumber (INV-YYYYMM-NNN, unique), tenantId, month, lineItems[{description, amount}], rentAmount, electricityAmount, otherCharges, totalAmount (pre-save sum), dueDate, status (draft/sent/paid/partial/overdue/cancelled). Unique index (tenantId, month).

Entity relationships:
- Invoice 1—N Payment (payments carry invoiceId; invoice status is derived via `payment-status.service`: paid when balance<=0, partial when 0<paid<total).
- Payment N—1 Tenant (populated user/room/floor); Tenant N—1 Room/Floor.
- Electricity bills distribute charges into invoices (`electricityAmount`); laundry/other via `otherCharges`/lineItems.
- UPI QR generation (`payments/qr-code`) is tenant-portal-facing; admin web does not use it.
- Audit log entries: `payment_verify`, invoice create/update/delete — visible in `/audit-logs` module.
- SSE events `payment_received` / `payment_verified` feed the notification bell.

Shared UI components used: DataTable, StatCard, StatusBadge, TableActions, ConfirmModal, PageHeader, ErrorBanner, EmptyState, FormPage/FormCard/FormSection/FormActions, ResourceSelect, DatePicker, Select, Input, Textarea, Timeline, DonutChart, Button.

Theme system: 5 presets (`saas`, `brutalist`, `neumorphic`, `soft-ui`, `custom`) driven by CSS variables in `apps/web/src/themes/*.css`; components consume tokens (`--color-brand-*`, `--color-card-bg`, `--radius-*`, `--shadow-*`). Any rebuild must stay token-based to keep all themes working.

## 4. Cross-cutting notes for implementation agents

- All new components consume CSS variables only (`--color-*`, `--radius-*`, `--shadow-*`, `--font-*`); no hardcoded hex in TSX. Theme switching (saas/brutalist/neumorphic/soft-ui/custom) applies automatically.
- `DataTable` selection keys use `keyExtractor`; bulk actions receive the selected `Set<string>` of ids.
- Verify flow contract: `POST /payments/:id/verify { approved, notes? }`; reject `$unset`s UTR. Never set `paid` via PUT.
- Invoice status is derived: do not send `status` for partial invoices on PUT; `paid` is locked server-side.
- Aging endpoint counts only invoices in sent/partial/overdue with balance > 0; `current` bucket means not yet past due.
- Print isolation: `.receipt-print-area` (receipt/invoice documents) and `.visitor-pass-print-area` (gate pass) patterns in globals.css; screen-only controls use the `*-no-print` classes.

## 5. Remaining backlog (next passes)

1. Server-side search param for payments/invoices list endpoints.
2. Per-status count endpoint for full StatusTabs counts.
3. Receipt/invoice document branding from app-config (PG name, address, UPI id).
4. Free-form line-item editor on invoice edit (API `lineItems` already supports it).
5. Server-side bulk endpoints for invoice mark-sent/delete.
6. Apply the same KpiHeader/AgingBars/StatusTabs/FilterChips system to dashboard and electricity modules.
