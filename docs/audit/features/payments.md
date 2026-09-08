# Payments Module - Feature Listing

Module: payments
Scope: admin web + API + DB + Flutter tenant (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/payments_audit_pass1_20260908-003801.md

## Feature Listing

| Surface | Capability                                                     | Status  |
| ------- | -------------------------------------------------------------- | ------- |
| List    | summary cards + filters + verify modal + full CSV + bed column | WORKING |
| Create  | sections + balance labels + push detail                        | WORKING |
| Detail  | receipt modal + approve/reject + void + timeline + bed/floor   | WORKING |
| Edit    | paid lock + linked header, no paid-via-PUT                     | WORKING |
| API     | offline/verify/void/PUT-guarded/receipt/my-populate            | WORKING |
| Flutter | UTR screenshot + balance labels                                | WORKING |
