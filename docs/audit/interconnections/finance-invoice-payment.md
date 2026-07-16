# Interconnection: Finance (Invoices, Payments, Electricity)

**Last verified:** 2026-07-16

## Flow diagram or steps (ASCII ok)

```
Monthly generation
  POST /invoices/generate-bulk | generate-single
    -> invoice.service generateMonthlyInvoices / generateSingleInvoice
    -> lineItems: rent (+ electricity share if finalized|distributed bill for month)
    -> status "sent"; pre-save totalAmount = rent + electricity + other
    -> auto Payment row: status pending, amount = invoice.totalAmount

Admin offline payment
  POST /payments/offline
    -> validate invoice payable (draft|sent|partial|overdue)
    -> amount <= remaining balance
    -> mark open pending row paid (or create paid); cancel extra open rows
    -> if residual > 0: new pending row for remainder (partial support)
    -> updateInvoicePaymentStatus -> paid | partial | sent/overdue

Tenant UTR
  POST /payments/submit-utr
    -> pending_verification on open payment (or create)
  POST /payments/verify-utr/:id | POST /payments/:id/verify
    -> paid or reject back to pending
    -> updateInvoicePaymentStatus

Admin GET invoice detail / payment-status
  -> paidAmount, balance from paid payments

Electricity
  draft bill -> POST finalize -> status finalized
  POST distribute:
    per room active tenants share
    if invoice exists for month:
      set electricityAmount + line item; re-sync pending residual; recompute status
    else:
      generateSingleInvoice (pulls share from finalized bill via calculateElectricityShare)
    mark bill distributed

Checkout coupling (tenant-lifecycle)
  unpaid invoices sent|partial|overdue block checkout
  payments pending_verification|overdue block checkout
```

## Code paths (source files)

| Concern | Path |
|---------|------|
| Invoice routes | `apps/api/src/routes/invoices.ts` |
| Invoice model + pre-save total | `apps/api/src/models/invoice.ts` |
| Invoice generation | `apps/api/src/services/invoice.service.ts` |
| Payment routes | `apps/api/src/routes/payments.ts` |
| Invoice status from payments | `apps/api/src/services/payment-status.service.ts` |
| Electricity routes | `apps/api/src/routes/electricity.ts` |
| Electricity model | `apps/api/src/models/electricityBill.ts` |
| Checkout dues / guards | `apps/api/src/routes/tenants.ts` |
| Tests | `apps/api/src/__tests__/invoice-payment.test.ts`, module-http-e2e finance paths |
| Admin FE | `apps/web/src/app/(admin)/invoices/**`, `payments/**`, `electricity/**` |
| Flutter money | `mobile/lib/features/tenant/presentation/invoices_screen.dart`, payments, invoice_detail |
| Feature audits | `docs/audit/features/invoices.md`, `payments.md`, `electricity.md` |

### Invoice routes (verified)

- GET list (admin filters status), GET `/my` (tenant), GET `/:id` (paidAmount + balance + payments)
- POST `/generate-bulk`, POST `/generate-single`
- PUT `/:id` admin: amounts/status with locks on paid; resync pending residual after total change
- GET `/:id/pdf`, DELETE (blocks paid), GET `/:id/payment-status`
- Duplicate invoice handling via 11000 / service skip if month exists

### Payment routes (verified)

- GET list, `/summary`, `/my`, `/qr-code`, `/pending-verification`
- POST `/offline` (admin partial-aware)
- POST `/submit-utr`, POST `/verify-utr/:paymentId`, POST `/:id/verify`
- PUT `/:id`, DELETE (blocks delete of paid), GET receipt / by id
- UTR duplicate -> `DUPLICATE_UTR`

### payment-status.service

- Sums non-cancelled payments with status `paid` vs `invoice.totalAmount`
- Cancels excess pending / pending_verification rows beyond first viable residual
- Sets invoice: `paid` if totalPaid >= total; `partial` if totalPaid > 0; else preserves sent/overdue (or prior)

### Electricity distribute (verified)

- Requires status `finalized`
- Splits room entry amount across active tenants in room
- Updates existing invoice electricity line + residual pending payment amount
- Or generates single invoice when none for month
- Sets bill `distributed`; distributed bills cannot be deleted

### Partial payments and balance

- Offline: rejects amount > balance (`AMOUNT_EXCEEDS_BALANCE`); leaves new `pending` for remainder
- Invoice GET and `/payment-status` expose paidAmount/remaining
- Invoice PUT recalculates residual pending when line totals change (if not paid/cancelled)

## What works

- Generate creates invoice + pending obligation payment in one service call.
- Offline collection marks paid and rolls invoice to paid/partial; partial remainder pending.
- UTR submit + admin verify path updates invoice status via shared service.
- Electricity share can attach at generate time (`finalized|distributed` bills) and/or distribute onto existing invoices.
- Checkout finance guards align with invoice/payment status enums.
- Admin list/detail/new/edit shells exist for invoices, payments, electricity.
- Invoice pre-save recomputes `totalAmount` from rent + electricity + otherCharges.

## Gaps / half-baked

| Severity | Gap | Proof |
|----------|-----|-------|
| P1 | Electricity distribute when creating new invoice via `generateSingleInvoice` does not re-run the "existing invoice" residual payment re-sync path in the same branch shape (relies on generate creating pending = full total including elec) | electricity.ts create branch vs update branch |
| P1 | `updateInvoicePaymentStatus` when totalPaid==0 leaves status as current paid/partial without always forcing `sent` on payment delete/reversal edge (partial branch keeps paid/partial if no paid rows in some paths) | payment-status.service.ts lines ~70-74 |
| P2 | FE error surfaces for `DUPLICATE_UTR`, `AMOUNT_EXCEEDS_BALANCE`, `DUPLICATE_INVOICE` vary by page | admin payments/invoices forms |
| P2 | Checkout dues `totalDue` uses max(invoiceTotal, paymentDue) not net residual after partials per invoice | tenants.ts dues |
| P2 | Electricity distribute not transactional across all rooms (per-tenant try/catch; partial distribute possible before bill marked distributed) | electricity.ts loop |

## Acceptance for fix agents

- [x] Generate bulk/single produces sent invoice + pending payment matching total
- [x] Offline full payment -> invoice paid; partial -> invoice partial + pending remainder
- [x] Verify UTR paid rolls invoice status; reject returns pending
- [x] Invoice PUT cannot freely edit locked paid invoices; total recomputes on save
- [x] Electricity finalize then distribute attaches line items without silent double rent
- [x] Checkout blocked on unpaid/partial invoices and pending_verification payments
- [ ] FE shows structured API error codes for finance duplicates / overpay
- [ ] Distribute multi-room is all-or-nothing or reports per-room failure without marking distributed when errors > 0
- [ ] Dues endpoint residual matches sum of (invoice total - paid) for open invoices

## Remediation log

| Date | Change | Status |
|------|--------|--------|
| ongoing | Offline payment + payment-status.service partial support | Live |
| ongoing | Electricity distribute updates existing invoices + residual pending | Live |
| 2026-07-16 | Full route/service re-verify; interconnection MD rewritten to match source | Docs synced |
