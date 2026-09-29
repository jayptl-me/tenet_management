# Complaints Module - Feature Listing

Module: complaints
Scope: admin web + API + DB + Flutter tenant (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/complaints_audit_pass1_20260908-003801.md

## Feature Listing

| Surface | Capability                                                       | Status  |
| ------- | ---------------------------------------------------------------- | ------- |
| List    | table + kanban + quick resolve modal + stat cards + filter + CSV | WORKING |
| Create  | ResourceSelect sections + live photo thumbnail preview grid      | WORKING |
| Detail  | stay card bed/floor + quick resolve modal + photo lightbox links | WORKING |
| Edit    | badge legend + transition-safe submit                            | WORKING |
| API     | guards, transitions, stay populate, photo audit, enum filters    | WORKING |
| Flutter | modal bottom sheet, category visual grid, urgency chips, filters | WORKING |
