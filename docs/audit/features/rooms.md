# Rooms and Inventory - Feature Listing

Module: rooms
Scope: admin web + API + DB
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Implementation spec: docs/audit/features/tenants-rooms_audit_pass1_20260908-192930.md

## Feature Listing

| Surface | Capability                                                                                                                                                                                                                                                                                       | Status  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| List    | table + Bed Matrix toggle, filter-aware server-aggregated KPI strip (occupancy ring, active rooms, vacant beds, tenants housed, potential rent), floor deep-link (?floorId=), filters (search/sharing/status/floor/availability), CSV export, reconcile dry-run + apply with conflict drill-down | WORKING |
| Detail  | occupancy donut, current tenants, bed allocation cards with Assign Tenant CTAs, floor service health (FloorServiceGrid + report-issue), notes, photos                                                                                                                                            | WORKING |
| Create  | ResourceSelect floor picker, rent auto-default from AppConfig roomPricing, amenity status pickers                                                                                                                                                                                                | WORKING |
| Edit    | sharingType rebuild with downsize guard, backHref/cancelHref/success return to detail                                                                                                                                                                                                            | WORKING |
| API     | paginated list with tenantName-enriched beds + full-set meta.stats, /available (unconsumed), reconcile-occupancy GET/POST, detail, create, transactional sharing update, soft delete                                                                                                             | WORKING |
