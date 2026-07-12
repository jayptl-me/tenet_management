# Payments -- Gap Analysis

**Priority:** P2

## Status

Routes rich: list, summary, my, qr, submit-utr, pending-verification, receipt, get, put, delete. UTR duplicate handled.

## Gaps

- [ ] FE edit payload must match updatePaymentSchema exactly (strictObject)
- [ ] Verify status transitions with invoice payment-status
- [ ] Native Select design
- [ ] Error surfaces for DUPLICATE_UTR

## Cross-ref

`interconnections/finance-invoice-payment.md`, checkout guards in tenant-lifecycle.
