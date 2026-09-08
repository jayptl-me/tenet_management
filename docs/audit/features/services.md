# Services Module - Feature Listing

Module: services
Scope: admin web + API + DB + Flutter tenant (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/services_audit_pass1_20260908-003801.md

## Feature Listing

| Surface     | Capability                                                         | Status  |
| ----------- | ------------------------------------------------------------------ | ------- |
| List        | summary + status/floor filters + full CSV                          | WORKING |
| Create/Edit | strict isPerFloor options; floor read-only on edit                 | WORKING |
| Detail      | health + complaints + notes                                        | WORKING |
| API         | tenant floor scope, note audits, batched enricher, reseed endpoint | WORKING |
| Flutter     | services list unwrap + category map                                | WORKING |
