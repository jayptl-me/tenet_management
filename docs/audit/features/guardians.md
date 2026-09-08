# Guardians Module - Feature Listing

Module: guardians
Scope: admin web + API + DB + Flutter guardian (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/guardians_audit_pass1_20260908-003801.md

## Feature Listing

| Surface | Capability                                          | Status  |
| ------- | --------------------------------------------------- | ------- |
| List    | room/email columns + tenant prefilter               | WORKING |
| Create  | resident preview + credentials dialog               | WORKING |
| Detail  | tenant link + room/bed/floor                        | WORKING |
| Edit    | emergency hint text                                 | WORKING |
| API     | isActive coupling, floor mapping, audits            | WORKING |
| Flutter | notices unwrap + ward dates + pin + ward enrichment | WORKING |
