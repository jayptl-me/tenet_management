# Invoices Module - Feature Listing

Module: invoices
Scope: admin web + API + DB + Flutter tenant (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/invoices_audit_pass1_20260908-003801.md

## Feature Listing

| Surface | Capability                                                                                               | Status  |
| ------- | -------------------------------------------------------------------------------------------------------- | ------- |
| List    | /invoices table + month/status/tenant filters + bulk generate + CSV                                      | WORKING |
| Create  | rent preview + duplicate-month warning + push detail                                                     | WORKING |
| Detail  | StatCards + record-payment CTA + tenant bed/floor + timeline + PDF                                       | WORKING |
| Edit    | paid/partial locks + stay card + floor                                                                   | WORKING |
| API     | generate/single/bulk, list filters, :id + payment-status guards, PUT balance guard, void-adjacent verify | WORKING |
| Flutter | list balance + status chips; detail stay card                                                            | WORKING |
