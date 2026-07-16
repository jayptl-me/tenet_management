# Invoices -- Feature Audit

**Last verified:** 2026-07-16  
**Admin grade:** A-  
**Priority of remaining work:** P2  
**Surface:** Admin `apps/web` only; tenant list/detail/PDF via Flutter + shared API

Code is truth. Re-verified against models, routes, invoice service, and admin FE pages.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/invoice.ts` |
| Routes | `apps/api/src/routes/invoices.ts` |
| Generation | `apps/api/src/services/invoice.service.ts` |
| Counter | `apps/api/src/models/counter.ts` (`INV-YYYYMM-NNN`) |
| PDF template | `apps/api/src/templates/InvoicePdf.js` (via React-PDF) |
| Payment status | `apps/api/src/services/payment-status.service.ts` |
| Shared types | `packages/types/src/invoice.ts` |
| Admin list | `apps/web/src/app/(admin)/invoices/page.tsx` |
| Admin detail | `apps/web/src/app/(admin)/invoices/[id]/page.tsx` |
| Admin new | `apps/web/src/app/(admin)/invoices/new/page.tsx` |
| Admin edit | `apps/web/src/app/(admin)/invoices/[id]/edit/page.tsx` |
| Flutter | `mobile/lib/features/tenant/**` (`invoices/my`, detail) |

---

## Model truth

| Field | Type / enum | Notes |
|-------|-------------|-------|
| invoiceNumber | `INV-YYYYMM-NNN` unique | Atomic counter per month |
| tenantId | ObjectId Tenant required | |
| month | YYYY-MM required | Unique compound with tenantId |
| generatedAt | Date default now | |
| lineItems[] | { description, amount } | Rebuilt on amount edit if lineItems omitted |
| rentAmount | number required min 0 | |
| electricityAmount | number default 0 | From electricity share when generating |
| otherCharges | number default 0 | |
| totalAmount | number required | **pre-save** = rent + electricity + other |
| dueDate | Date \| null | Generation sets 5th of month (or next if past); legacy null OK |
| status | draft \| sent \| paid \| partial \| overdue \| cancelled | Default draft; generation sets **sent** |
| Indexes | tenantId, month, status, **unique (tenantId, month)** | |

No `notes` field on model (detail FE still renders `invoice.notes` if present -- dead path).

---

## API surface

| Method | Path | Auth | Admin FE | Notes |
|--------|------|------|:--------:|-------|
| GET | `/invoices` | admin | **Wired** | Filters month, status, tenantId; populate tenant |
| GET | `/invoices/my` | tenant | n/a (Flutter) | Portal |
| POST | `/invoices/generate-bulk` | admin | **Wired** | `{ month }` -> generated/skipped/errors |
| POST | `/invoices/generate-single` | admin | **Wired** | `{ tenantId, month }`; creates pending Payment |
| GET | `/invoices/:id` | JWT | **Wired** | paidAmount, balance, payments[], whatsAppUrl, shareText |
| PUT | `/invoices/:id` | admin | **Wired** | Amounts/status/dueDate; **paid locked**; no paid/partial in status enum |
| GET | `/invoices/:id/pdf` | JWT | **Wired** | Auth blob download (not window.open) |
| DELETE | `/invoices/:id` | admin | **Wired** | Blocks paid (422); cascade Payment.deleteMany |
| GET | `/invoices/:id/payment-status` | JWT | **Unused** | totalPaid/remaining/payments. Detail already embeds balance. **P2 wire-or-drop** |

### Generation side-effects (`generateSingleInvoice`)

1. Load active tenant + room; rent from `tenant.monthlyRent`.
2. Electricity share via `calculateElectricityShare` if bill status in `finalized|distributed`.
3. Create invoice status **sent**, dueDate 5th (or next month if past).
4. Create Payment: type rent, method upi, status pending, amount = total.

### PUT rules (code-verified)

- `status === 'paid'` -> 400 `INVOICE_LOCKED` (no field edits).
- `cancelled` can only reopen to draft/sent.
- Editable statuses: draft, sent, partial, overdue.
- Status body enum **excludes** paid/partial (payment-driven).
- Amount change without lineItems rebuilds default line items (rent / electricity / other).
- Open pending payment amount re-synced to residual balance.

### API vs FE Zod drift

| Contract | API | Admin FE | Drift |
|----------|-----|----------|-------|
| generate-single | tenantId, month YYYY-MM | Same | **Aligned** |
| generate-bulk | month YYYY-MM | Free text YYYY-MM (no FE zod) | Soft -- relies on API |
| PUT | rent/electricity/other, lineItems?, status draft\|sent\|overdue\|cancelled, dueDate datetime?, month?, tenantId? | rent/electricity/other, dueDate date->ISO, status only when not partial | **Aligned** intent; FE omits month/tenantId/lineItems (API rebuilds lines) |
| paid/partial status | Not in PUT schema | Not sent for partial; paid blocked client+server | **Fixed** partial clobber |

---

## FE page matrix

| Page | Stack | API calls | Verdict |
|------|-------|-----------|---------|
| List | PageHeader, DataTable, TableActions, StatusBadge, mobileCardRenderer, bulk generate card | GET list; DELETE; POST generate-bulk | **PASS** |
| Detail | FormPage, StatCard, DonutChart, DetailCard, Timeline | GET :id; GET :id/pdf blob; WhatsApp client-side | **PASS** |
| New | FormPage generate-single | POST generate-single | **PASS** |
| Edit | FormPage amounts + dueDate + status; paid lock banner | GET :id; PUT :id | **PASS** with polish gaps |

### Special FE behaviors (verified)

| Behavior | Status |
|----------|--------|
| Bulk generate | **Wired** on list |
| Single generate | **Wired** on new |
| PDF download with JWT blob | **Wired** (comment notes window.open 401) |
| Edit status partial clobber fix | **Wired** -- does not send status when invoice is partial; does not coerce paid/partial into status select default that overwrites |
| Paid lock | **Wired** API + client submit block; **fields disabled** when paid (`disabled={isPaidLocked}`); hideSubmit |
| WhatsApp share | Client-built summary (API whatsAppUrl unused) |

---

## Field coverage (model vs forms)

| Field | New | Edit | Detail | Notes |
|-------|:---:|:----:|:------:|-------|
| invoiceNumber | auto | -- | Y | |
| tenantId | Y (generate) | read-only panel | Y | |
| month | Y | -- | Y | Not editable on edit form (API allows) |
| rentAmount | auto | Y | Y | |
| electricityAmount | auto share | Y | Y | |
| otherCharges | 0 auto | Y | Y | |
| lineItems | auto | rebuilt on amount change | Y table | No manual line editor |
| totalAmount | pre-save | auto display | Y | |
| dueDate | auto gen | Y (date) | Y | ISO on submit |
| status | sent (gen) | Y if not paid/partial | Y | paid/partial payment-driven |
| notes | n/a | n/a | dead UI | Not on model |

---

## Lifecycle: generate / pay / PDF

```
Admin bulk or single generate
  -> Invoice sent + Payment pending
  -> Optional electricity line if bill finalized/distributed

Tenant pays (UTR / admin offline)
  -> updateInvoicePaymentStatus
  -> invoice partial | paid (or stays sent)

Admin edit amounts (not paid)
  -> pre-save total
  -> rebuild lineItems if needed
  -> re-sync open pending payment amount

Admin download PDF
  -> GET /invoices/:id/pdf with Bearer via ky
  -> React-PDF buffer, Content-Disposition inline filename

Delete unpaid invoice
  -> deleteMany payments then invoice
Delete paid
  -> 422 INVOICE_PAID
```

---

## Design

| Check | Result |
|-------|--------|
| Token colors (no gray/slate under invoices/*) | **PASS** |
| StatusBadge | **PASS** list + detail |
| FormPage stack new/edit | **PASS** |
| mobileCardRenderer | **PASS** |
| List delete affordance for paid invoices | **PASS** -- `showDelete` / `onDelete` gated with `status !== 'paid'` (desktop + mobile) |

---

## Open gaps

### P0

None for core invoice generate / PDF / paid lock.

### P1

_None open._ INV-P1-1 closed 2026-07-16 (list gates delete when paid).

### P2

| ID | Gap | Paths |
|----|-----|-------|
| INV-P2-1 | `GET /:id/payment-status` unused -- wire or drop | `routes/invoices.ts` |
| INV-P2-2 | API `whatsAppUrl` / `shareText` unused; FE rebuilds text | `invoices/[id]/page.tsx` |
| INV-P2-3 | Paid edit: inputs still enabled; only submit blocked | `invoices/[id]/edit/page.tsx` |
| INV-P2-4 | Detail shows `notes` card but model has no notes | `invoices/[id]/page.tsx`, `models/invoice.ts` |
| INV-P2-5 | List missing month filter (API supports) | `invoices/page.tsx` |
| INV-P2-6 | Bulk month input is free text without FE format validation | `invoices/page.tsx` |
| INV-P2-7 | Floor name on detail expects `roomId.floor` but populate is `floorId` -- floor often N/A | `invoices/[id]/page.tsx` vs route populate |

---

## Closed (do not re-file)

| Claim | Live status |
|-------|-------------|
| PDF auth broken (window.open) | **Closed** -- ky `.blob()` + download |
| Edit partial status clobber to sent | **Closed** -- skip status in payload when partial |
| Paid invoices freely editable | **Closed** -- API INVOICE_LOCKED + client guard |
| List always offers Delete for paid (INV-P1-1) | **Closed** -- `showDelete={row.status !== 'paid'}` desktop+mobile; API still 422 |
| PUT total not re-derived | **Closed** -- pre-save + lineItems rebuild |
| Generate-single / bulk missing | **Closed** |
| Unique tenant+month | **Closed** -- index + generation skip |

---

## Acceptance checklist

- [ ] Generate single for tenant+month -> invoice sent + pending payment
- [ ] Bulk generate month -> toast counts; skip existing
- [ ] Duplicate tenant+month generation fails gracefully
- [ ] Download PDF while logged in succeeds; unauth 401
- [ ] Edit rent on sent invoice -> total + line items + pending amount update
- [ ] Edit partial invoice without changing status field -> status remains partial
- [ ] Paid invoice edit submit blocked client + API
- [ ] Delete unpaid removes payments; delete paid 422
- [ ] Detail paidAmount/balance match sum of paid payments
- [ ] Flutter invoices/my and detail still load

---

## Remediation log

| Date | Change | Result |
|------|--------|--------|
| 2026-07-16 | Full code re-audit; rewrite this MD | Grade **A-**; residual P2 polish |
| 2026-07-16 | Reconcile vs worktree | **INV-P1-1 CLOSED** -- paid delete gated on list |
| Prior | Auth PDF blob; partial clobber fix; paid lock | Closed prior P0/P1 integrity claims |
