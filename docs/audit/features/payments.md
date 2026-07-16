# Payments -- Feature Audit

**Last verified:** 2026-07-16  
**Admin grade:** A-  
**Priority of remaining work:** P2  
**Surface:** Admin `apps/web` only for staff flows; tenant UTR submit is Flutter (`mobile/`)

Code is truth. Re-verified against models, routes, and admin FE pages.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/payment.ts` |
| Routes | `apps/api/src/routes/payments.ts` |
| Status service | `apps/api/src/services/payment-status.service.ts` |
| Shared types | `packages/types/src/payment.ts` |
| Admin list | `apps/web/src/app/(admin)/payments/page.tsx` |
| Admin detail | `apps/web/src/app/(admin)/payments/[id]/page.tsx` |
| Admin new (offline) | `apps/web/src/app/(admin)/payments/new/page.tsx` |
| Admin edit | `apps/web/src/app/(admin)/payments/[id]/edit/page.tsx` |
| Tenant deep-link | `apps/web/src/app/(admin)/tenants/[id]/page.tsx` -> `/payments/new?tenantId=` |
| Flutter portal | `mobile/lib/features/tenant/data/tenant_repository.dart` (`payments/my`, `submit-utr`) |

---

## Model truth

| Field | Type / enum | Notes |
|-------|-------------|-------|
| tenantId | ObjectId Tenant, required | Indexed |
| invoiceId | ObjectId Invoice, required | Indexed; offline path enforces match |
| amount | number min 0 | Offline min 0.01 via Zod |
| type | rent \| electricity \| deposit \| laundry \| other | Invoice generation always creates `rent` |
| method | upi \| cash \| bank_transfer \| other | Offline excludes `upi` |
| status | pending \| pending_verification \| paid \| overdue \| cancelled | Default `pending` |
| month | YYYY-MM | Required |
| dueDate | Date required | From invoice / fallback 5th of month |
| paidAt | Date \| null | Set on offline + verify approve |
| utrNumber | sparse unique, 6-22 A-Z0-9 | Tenant UTR submit |
| verifiedBy | ObjectId User \| null | Admin id on verify/offline |
| screenshotUrl | string \| null | Optional UTR path |
| notes | max 500 | Optional |
| Indexes | tenantId, invoiceId, month, status, dueDate, tenant+month | No unique (tenant, month) |

Virtuals: `tenant`, `invoice`. Detail GET uses `mapPayment` to flatten `tenant.user` / `tenant.room` / `invoiceNumber`.

---

## API surface

| Method | Path | Auth | Admin FE | Notes |
|--------|------|------|:--------:|-------|
| GET | `/payments` | admin | **Wired** | Filters: status, month, tenantId, roomId, method, type. Populate tenant+invoice. **No** `mapPayment` (raw populate). |
| GET | `/payments/summary` | admin | **Unused** | Current month collected / expected / pending. **P2 wire-or-drop** |
| GET | `/payments/my` | tenant | n/a (Flutter) | Portal list |
| POST | `/payments/offline` | admin | **Wired** | Cash/bank/other; balance guard; reuses open pending row; audit `payment_verify` |
| GET | `/payments/qr-code?invoiceId=` | JWT | **Unused** | UPI QR + WhatsApp share. **P2 wire-or-drop** (admin or Flutter) |
| POST | `/payments/submit-utr` | JWT | n/a (Flutter) | Sets `pending_verification`; 409 DUPLICATE_UTR |
| POST | `/payments/verify-utr/:paymentId` | admin | **Unused** | Body `{ status: paid\|rejected }`. Duplicates `/:id/verify`. **P2 wire-or-drop** |
| GET | `/payments/pending-verification` | admin | **Unused** | Paginated queue; list uses status filter instead. **P2 wire-or-drop** |
| GET | `/payments/:id/receipt` | JWT | **Wired** | Detail modal; raw lean (tenantId.userId shape) |
| GET | `/payments/:id` | JWT | **Wired** | `mapPayment`; tenant self-check |
| PUT | `/payments/:id` | admin | **Wired** | amount, method, type, status, notes. Does **not** set `paidAt` when status->paid |
| POST | `/payments/:id/verify` | admin | **Wired** | `{ approved, notes? }`; approve sets paid+paidAt; reject clears UTR |
| DELETE | `/payments/:id` | admin | **Wired** | Blocks `paid` (422 PAYMENT_VERIFIED); resyncs invoice |

Invoice status always recomputed via `updateInvoicePaymentStatus` after offline / verify / put / delete.

### API vs FE Zod drift

| Contract | API | Admin FE | Drift |
|----------|-----|----------|-------|
| Offline create | `strictObject`: tenantId, invoiceId, amount>0, method cash\|bank_transfer\|other, paidAt ISO datetime, notes? | Same fields; `paidAt` as datetime-local then `toISOString()` | **Aligned** (FE does not use strictObject but payload matches) |
| Update | amount?, method (incl upi), type?, status (all 5), notes? | Same enums | **Aligned** |
| Verify | `{ approved: boolean, notes? }` | Same | **Aligned** |
| verify-utr | `{ status: paid\|rejected }` | Not used | n/a |

---

## FE page matrix

| Page | Stack | API calls | Verdict |
|------|-------|-----------|---------|
| List | PageHeader, DataTable, TableActions, StatusBadge, mobileCardRenderer, ConfirmModal, filters | GET list; DELETE | **PASS** |
| Detail | FormPage, DetailCard, StatCard, Timeline, receipt modal | GET :id; POST :id/verify; GET :id/receipt | **PASS** (verify + receipt wired) |
| New | FormPage, FormCard, ResourceSelect tenant, invoice Select, offline POST | GET invoices?tenantId; GET invoices/:id balance; POST offline | **PASS** offline path; **PASS** `?tenantId=` / `?invoiceId=` prefill |
| Edit | FormPage, FormSection, amount/method/type/status/notes | GET :id; PUT :id | **PASS** functional |

### Special FE behaviors (verified)

| Behavior | Status |
|----------|--------|
| Verify CTA (approve/reject) when `pending_verification` | **Wired** on detail |
| Offline create | **Wired** on new; methods cash/bank/other only |
| mobileCardRenderer | **Present** on list |
| Receipt API | **Used** on detail for paid / pending_verification (+ legacy approved/completed checks) |
| QR API | **Not used** in admin FE |
| Summary API | **Not used** in admin FE |
| `?tenantId=` prefill | **Wired** -- `useSearchParams` sets `prefillTenantId` / `prefillInvoiceId` defaultValues + invoice load |

---

## Field coverage (model vs forms)

| Field | New (offline) | Edit | Detail | Notes |
|-------|:-------------:|:----:|:------:|-------|
| tenantId | Y | -- | Y | Required; linked to invoice |
| invoiceId | Y | -- | Y (link) | Payable filter: draft/sent/partial/overdue |
| amount | Y (prefill balance) | Y | Y | Offline balance from invoice GET |
| method | Y (no upi) | Y (incl upi) | Y | |
| type | forced rent (API) | Y | Y | Offline always type rent server-side |
| status | paid (API) | Y | Y | Edit can set paid without paidAt (**P2**) |
| month / dueDate | from invoice | -- | partial | Not editable on forms |
| paidAt | Y | -- | Y | |
| utrNumber | -- | -- | Y | From UTR submit |
| screenshotUrl | -- | -- | Y | Link/img if present |
| notes | Y | Y | Y | |
| verifiedBy | API | -- | -- | Not shown on detail |

---

## Lifecycle: pay and verify

```
Invoice generate
  -> Payment row status=pending, amount=invoice.total, type=rent, method=upi

Tenant UPI path (Flutter):
  POST submit-utr -> pending_verification (+ utr/screenshot)
  Admin detail POST :id/verify approved=true
    -> status=paid, paidAt=now, verifiedBy
    -> updateInvoicePaymentStatus -> invoice paid|partial|sent

Admin offline path:
  POST /payments/offline
    -> mutates first open pending/pending_verification to paid
    -> cancels extra open rows
    -> if residual balance, creates new pending residual
    -> updateInvoicePaymentStatus
    -> audit payment_verify source=offline

Reject path:
  approved=false OR verify-utr rejected
    -> status=pending, utr cleared
```

**Integrity notes (code-verified):**

1. Offline refuses amount > remaining balance (`AMOUNT_EXCEEDS_BALANCE`).
2. Offline refuses non-payable invoice statuses (`INVOICE_NOT_PAYABLE`); draft is allowed intentionally.
3. DELETE paid blocked; unpaid delete resyncs invoice.
4. PUT status=`paid` does **not** set `paidAt` or `verifiedBy` -- weaker than verify/offline.

---

## Design

| Check | Result |
|-------|--------|
| CSS tokens (no gray/slate hardcode under payments/*) | **PASS** |
| StatusBadge + statusToVariant | **PASS** |
| FormPage / FormCard / FormSection on new+edit | **PASS** |
| mobileCardRenderer | **PASS** |
| Alert for verify errors | Weak (browser `alert`) -- polish only |

---

## Open gaps

### P1

_None open._ PAY-P1-1 closed 2026-07-16 (`useSearchParams` prefill for tenantId/invoiceId).

### P2

| ID | Gap | Paths |
|----|-----|-------|
| PAY-P2-1 | `GET /payments/summary` unused -- wire dashboard/list stats or drop | `routes/payments.ts`, no FE consumer |
| PAY-P2-2 | `GET /payments/qr-code` unused in admin (and not confirmed on Flutter invoice pay UX beyond UTR) | `routes/payments.ts` |
| PAY-P2-3 | `GET /payments/pending-verification` unused; list filter is sufficient | `routes/payments.ts`, `payments/page.tsx` |
| PAY-P2-4 | Dual verify: `POST /:id/verify` (FE) vs `POST /verify-utr/:id` (unused) -- consolidate or document | `routes/payments.ts` |
| PAY-P2-5 | PUT can set `status=paid` without `paidAt` / `verifiedBy` | `routes/payments.ts` update handler, `payments/[id]/edit/page.tsx` |
| PAY-P2-6 | List lacks month / tenantId / roomId filters though API supports them | `payments/page.tsx` |
| PAY-P2-7 | Mobile card hides delete (desktop allows non-paid delete) -- intentional asymmetry | `payments/page.tsx` |

No open **P0** found for payments (offline + verify + invoice status path is sound).

---

## Closed (do not re-file)

| Claim | Live status |
|-------|-------------|
| Offline create missing | **Closed** -- full form + balance prefill |
| Verify CTA missing | **Closed** -- detail approve/reject |
| mobileCardRenderer missing | **Closed** |
| Receipt endpoint unused | **Closed** -- detail modal + print |
| UTR duplicate 409 | **Closed** API-side |
| List status filter for pending verification | **Closed** |
| `?tenantId=` prefill ignored (PAY-P1-1) | **Closed** -- `useSearchParams` + defaultValues + invoice load |

---

## Acceptance checklist

- [ ] Record offline cash for payable invoice -> payment paid, invoice status updates
- [ ] Partial offline amount -> residual pending row; invoice `partial`
- [ ] Overpay offline -> 400 AMOUNT_EXCEEDS_BALANCE
- [ ] Tenant UTR submit -> admin sees pending_verification -> approve -> paid + invoice paid/partial
- [ ] Reject verification -> status pending, UTR cleared
- [ ] Delete unpaid OK; delete paid 422
- [ ] Receipt modal loads for paid payment
- [x] From tenant detail, Record Payment pre-selects tenant (PAY-P1-1 closed)
- [ ] Flutter: payments/my + submit-utr still work

---

## Remediation log

| Date | Change | Result |
|------|--------|--------|
| 2026-07-16 | Full code re-audit; rewrite this MD | Residual P2 unused endpoints |
| 2026-07-16 | Reconcile vs worktree | **PAY-P1-1 CLOSED** -- searchParams prefill |
| Prior | Offline reconcile open pending rows; verify CTAs; receipt UI | Closed major admin gaps |
