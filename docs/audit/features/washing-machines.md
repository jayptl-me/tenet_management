# Washing Machines Module - Feature Listing

Module: washing-machines
Scope: admin web + API + DB + Flutter tenant (read-only)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/washing-machines_audit_pass1_20260908-003801.md

## Feature Listing

| Surface | Capability                                                  | Status  |
| ------- | ----------------------------------------------------------- | ------- |
| List    | floor/status/claimant/timer + release + full CSV            | WORKING |
| Create  | placement/configuration sections                            | WORKING |
| Detail  | claim + timer cards                                         | WORKING |
| Edit    | in_use claim preservation                                   | WORKING |
| API     | claim/release guards, single-claim limit, in_use delete 409 | WORKING |
| Flutter | single-hop list + fallback + countdown                      | WORKING |
