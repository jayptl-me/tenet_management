# Floors Module - Feature Listing

Module: floors
Scope: admin web + API + DB
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/floors_audit_pass1_20260908-154456.md

## Feature Listing

| Surface     | Capability                                                    | Status  |
| ----------- | ------------------------------------------------------------- | ------- |
| List        | grid/table views + stat strip + occupancy ring + sort/search   | WORKING |
| Detail      | occupancy hero + bed-level room cards + services + amenities   | WORKING |
| Create      | steppers + live building-stack preview + async-safe defaults   | WORKING |
| Edit        | read-only room sync + conflict-aware preview                   | WORKING |
| API         | CRUD + service seeding + reseed-services endpoint              | WORKING |
