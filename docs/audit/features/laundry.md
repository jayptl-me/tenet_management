# Laundry Slots Module - Feature Listing

Module: laundry
Scope: admin web + API + DB + Flutter tenant (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/laundry_audit_pass1_20260908-003801.md

## Feature Listing

| Surface | Capability                                                            | Status  |
| ------- | --------------------------------------------------------------------- | ------- |
| List    | status/date/tenant filters + stay cell + CSV                          | WORKING |
| Create  | resident/schedule/load sections                                       | WORKING |
| Detail  | stay link + bed/floor + phone                                         | WORKING |
| Edit    | transition-safe form                                                  | WORKING |
| API     | tenant meta/pagination, admin filters, PUT transitions, bed/floor map | WORKING |
| Flutter | items/notes cards + 300 chars + tenantId omit                         | WORKING |
