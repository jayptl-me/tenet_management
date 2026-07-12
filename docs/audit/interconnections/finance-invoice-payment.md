# Interconnection: Finance (Invoices, Payments, Electricity)

## Flow

```
Jobs generate invoices (rent + extras)
  -> Invoice status sent
  -> Tenant/admin payment submit / UTR
  -> Admin verification
  -> Invoice payment-status / totals
Electricity bill finalize + distribute
  -> May create/adjust invoice line items (verify in electricity.ts distribute)
```

## Verified routes

- `invoices.ts`: list, my, get, put, pdf, delete, payment-status; 11000 duplicate handling
- `payments.ts`: list, summary, my, qr, submit-utr, pending-verification, receipt, get, put, delete; UTR duplicate
- `electricity.ts`: CRUD, finalize, distribute; DUPLICATE_BILL

## Integrity notes

- Checkout depends on invoice + payment statuses (tenant-lifecycle.md).
- Invoice total derivation on PUT -- verify recompute if line items change (agent must re-read put handler when touching finance).
- Payment-invoice FK consistency on verify path -- ensure paid amount rolls into invoice status.

## FE completeness

- Admin list/detail/new/edit shells present for invoices, payments, electricity.
- Design: native Select on forms (design batch).
- Priority P2 relative to P0 dead modules -- finance appears more complete from route inventory.

## Agent checklist before editing finance

1. Read full put handlers for totalAmount recalculation.
2. Do not break checkout status enums.
3. Keep Zod strictObject payloads matched to FE.

## Gaps to verify when remediating

- [ ] Invoice edit does not desync totalAmount
- [ ] Payment verify transitions invoice status correctly
- [ ] Electricity distribute creates intended invoice charges without duplicates
- [ ] FE shows API errors for DUPLICATE_UTR / DUPLICATE_INVOICE
