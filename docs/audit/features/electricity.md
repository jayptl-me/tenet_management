# Electricity Module - Feature Listing

Module: electricity
Scope: admin web + API + DB + Flutter tenant/guardian (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/electricity_audit_pass1_20260908-003801.md

## Feature Listing

| Surface     | Capability                                                  | Status  |
| ----------- | ----------------------------------------------------------- | ------- |
| List        | StatCards + Units col + CSV + filters                       | WORKING |
| Create/Edit | readings editor + reconcile gate + image upload             | WORKING |
| Detail      | StatCards + finalize/distribute + floor col + image viewer  | WORKING |
| API         | FSM finalize/distribute, guardian ward read, floor populate | WORKING |
| Flutter     | readings + share + bill proof viewer                        | WORKING |
