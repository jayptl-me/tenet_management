# Notifications Module - Feature Listing

Module: notifications
Scope: admin web + API + DB + Flutter tenant (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/notifications_audit_pass1_20260908-003801.md

## Feature Listing

| Surface           | Capability                                                  | Status  |
| ----------------- | ----------------------------------------------------------- | ------- |
| Compose + History | audience pickers + type/status filters + true counts        | WORKING |
| Detail/Edit       | metadata-only edit, history-tab redirects                   | WORKING |
| API               | type/status filters, emergency flag gate, ward-safe history | WORKING |
