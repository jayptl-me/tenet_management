# Meals Feedback Module - Feature Listing

Module: meals
Scope: admin web + API + DB + Flutter tenant (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/meals_audit_pass1_20260908-003801.md

## Feature Listing

| Surface            | Capability                                               | Status  |
| ------------------ | -------------------------------------------------------- | ------- |
| List               | summary strip + search + meal/rating/date/status filters | WORKING |
| Create/Edit/Detail | preset picker + unified tenant shape + bed/floor         | WORKING |
| API                | unified mapper + upsert reset + status filter + parseId  | WORKING |
| Flutter            | 4-slot menu parse, dead branches removed                 | WORKING |
