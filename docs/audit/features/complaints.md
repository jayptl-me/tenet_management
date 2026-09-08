# Complaints Module - Feature Listing

Module: complaints
Scope: admin web + API + DB + Flutter tenant (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/complaints_audit_pass1_20260908-003801.md

## Feature Listing

| Surface | Capability                                                       | Status  |
| ------- | ---------------------------------------------------------------- | ------- |
| List    | table + kanban + stat cards + category chips + date filter + CSV | WORKING |
| Create  | ResourceSelect sections + push detail                            | WORKING |
| Detail  | stay card bed/floor + status form                                | WORKING |
| Edit    | badge legend + transition-safe submit                            | WORKING |
| API     | guards, transitions, stay populate, photo audit, enum filters    | WORKING |
| Flutter | 5 photo URLs + validation                                        | WORKING |
