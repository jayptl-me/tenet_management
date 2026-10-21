# Floors Module - Feature Listing

Module: floors
Scope: admin web + API + DB
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/floors_audit_pass1_20260908-235500.md

## Feature Listing

| Surface | Capability                                                                                                                                                                                                                                                                  | Status  |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| List    | grid/table views with server aggregate (GET /floors/overview: stats, beds, service health), search/sort, FloorCard hover using var(--color-field-border-hover), delete guards (FLOOR_HAS_ROOMS / FLOOR_HAS_MACHINES 409s)                                                     | WORKING |
| Detail  | room cards with BedMiniGrid, FloorServiceGrid with report-issue modal, deep-link to filtered rooms (/rooms?floorId=)                                                                                                                                                          | WORKING |
| Create  | executive intake: auto next floor number, 1-click label presets, client-side duplicate floor-number collision check, blueprint projection, auto-seeds per-floor ServiceStatus (seedFloorServiceStatuses)                                                                      | WORKING |
| Edit    | executive workspace: StatCard telemetry (occupancy rate, active rooms, available beds, monthly yield), label presets, live collision check with submit blocking, interactive Room Roster with direct /rooms/:id links, dirty-state handling                                    | WORKING |
| API     | CRUD, GET /overview, GET /:id/rooms (tenant-enriched rooms + stats), POST /reseed-services, totalRooms stripped from PUT, delete guards                                                                                                                                      | WORKING |

## Open gaps

| ID      | Severity | Gap                                                                            | Paths                                                    |
| ------- | -------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| FL-P3-1 | P3       | AmenityCountStepper lacks operational status context for provisioned machines   | apps/web/src/components/ui/AmenityCountStepper.tsx        |

## Closed

| Claim                                                                   | Live status                                                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Floor edit workspace was a shallow 2-field form with no telemetry       | CLOSED - rebuilt as executive workspace with stats and Room Roster per pass1 completion status (verified 2026-09-08)                                     |
| Floor create lacked presets and client-side collision detection         | CLOSED - presets and duplicate-number validation added per pass1 completion status (verified 2026-09-08)                                                 |
| FloorStackPreview used raw -50/-700 classes failing dark-mode contrast  | CLOSED - refactored to --badge-* tokens per pass1 completion status (verified 2026-09-08)                                                                |
| FloorCard lacked consistent theme hover border                          | CLOSED - hover uses var(--color-field-border-hover) token in apps/web/src/components/ui/FloorCard.tsx                                                     |
