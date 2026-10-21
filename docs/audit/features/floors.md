# Floors Module - Feature Listing

Module: floors
Scope: admin web + API + DB
Source verified: 2026-10-21 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/floors_audit_pass1_20260908-235500.md
Depth pass record: 2026-10-21, wave 6 (the four admin screens rebuilt against the three gates)

## Feature Listing

| Surface | Capability                                                                                                                                                                                                                                                                                                                                | Status  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| List    | floors board in the address bar (search, sort, service health, card or table view), the building band from GET /floors/overview (floors, beds taken, free beds, services not working), FloorCard with the bed map, the service health of each level, the delete guard in the confirm dialog and the server state reported after the write | WORKING |
| Detail  | the floor, its rooms with the bed map of every room, the services of the level with the per floor amenity definitions that have no row, the write trail from GET /audit-logs, the washers of the floor, and the four actions of the level (add a room, set a service up, rename the floor, retire a room)                                 | WORKING |
| Create  | the level filled in with the next free level of the building, the label presets, the duplicate level and label check, the building elevation preview, the floor the office is about to commit, and the panel that says what the save commits and what it refuses                                                                          | WORKING |
| Edit    | the label, the level and the per floor amenity counts, the duplicate level and label check, the building elevation preview, the floor as it stands, and the panel that says what the save commits and what it refuses                                                                                                                     | WORKING |
| API     | CRUD, GET /overview, GET /:id/rooms (tenant-enriched rooms + stats), POST /reseed-services, totalRooms stripped from PUT, delete guards                                                                                                                                                                                                   | WORKING |

## Acceptance checklist

- [x] Creating a floor with isPerFloor amenity defs yields matching ServiceStatus rows (`seedFloorServiceStatuses`)
- [x] FloorServiceGrid non-empty after floor create without visiting Services module
- [x] No monthlyRent/sharingType/beds fields on floor forms
- [x] amenityCounts only for isPerFloor amenities
- [x] The floor number is filled in with the next free level and a duplicate level or label is refused before the save
- [x] Every filter of the floors list lives in the address bar and the numbers name the scope they cover
- [x] A room of the floor links to the room page and a bed links to the record that holds it
- [x] The floor page shows the write trail of the floor
- [x] Deprecated amenities object not written from FE (FL-3)
- [x] Detail does not render phantom description unless model supports it (FL-4)

## Open gaps

| ID      | Severity | Gap                                                                                                                                                                       | Paths                                                                 |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| FL-D1   | P2       | The floor routes send no message: a floor that is renamed, or moved to another level, reaches nobody, and the residents of that level keep the old address until they ask | apps/api/src/routes/floors.ts                                         |
| FL-D2   | P2       | The service seed of a new floor is best effort: the handler swallows the failure, so the create response does not say whether the service rows were written               | apps/api/src/routes/floors.ts:270-274                                 |
| FL-D3   | P3       | The shared DUPLICATE_FLOOR message names the number, so a duplicate label is reported as a duplicate number                                                               | apps/web/src/lib/errorParser.ts:51, apps/api/src/routes/floors.ts:330 |
| FL-D4   | P3       | The server does not filter floors: the search and the health filter of the list narrow the screen and not the numbers, which stay over the whole set the server returns   | apps/api/src/routes/floors.ts:97-172                                  |
| FL-D5   | P3       | The room count of a floor is recounted best effort and a failure of the recount is swallowed, so the count on the floor record can drift from the rooms of the floor      | apps/api/src/models/room.ts:162-169                                   |
| FL-P3-1 | P3       | AmenityCountStepper lacks operational status context for provisioned machines                                                                                             | apps/web/src/components/ui/AmenityCountStepper.tsx                    |

## Closed

| Claim                                                                                     | Live status                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Floor edit workspace was a shallow 2-field form with no telemetry                         | CLOSED - rebuilt as executive workspace with stats and Room Roster per pass1 completion status (verified 2026-09-08)                            |
| Floor create lacked presets and client-side collision detection                           | CLOSED - presets and duplicate-number validation added per pass1 completion status (verified 2026-09-08)                                        |
| FloorStackPreview used raw -50/-700 classes failing dark-mode contrast                    | CLOSED - refactored to --badge-* tokens per pass1 completion status (verified 2026-09-08)                                                       |
| FloorCard lacked consistent theme hover border                                            | CLOSED - hover uses var(--color-field-border-hover) token in apps/web/src/components/ui/FloorCard.tsx                                           |
| The filters of the floors list lived in the state of the page, not in the address bar     | CLOSED - the search, the sort, the service health and the view are read from and written to the address bar (2026-10-21)                        |
| The floors list opened with the uniform four tile band of twenty four modules             | CLOSED - the band is one compact PageBand with the numbers of the building and the scope they cover (2026-10-21)                                |
| The floors list reported nothing after a delete                                           | CLOSED - the page reports the server state: the floor row is gone, the service rows went with it and the audit log holds the entry (2026-10-21) |
| The grid view of the floors list showed every floor and the table view showed twenty five | CLOSED - both views show the same filtered set (2026-10-21)                                                                                     |
| The empty state of the floors list said only "add your first floor"                       | CLOSED - the empty state says what the server writes, what it seeds and what is expected next (2026-10-21)                                      |
| The floor page hid the rooms that were out of service                                     | CLOSED - every room of the floor is listed with its state, in service or not (2026-10-21)                                                       |
| The floor page counted the active rooms with its own rule and dropped the server number   | CLOSED - the numbers of the band and of the rail are the figures the server reports (2026-10-21)                                                |
| The floor page had no write trail                                                         | CLOSED - the page reads the audit entries of the floor and names what each one did (2026-10-21)                                                 |
| The floor page could not act on the level it showed                                       | CLOSED - a room can be added, a service set up, the floor renamed and a room retired from the floor page (2026-10-21)                           |
| A bed of a floor linked nowhere                                                           | CLOSED - a bed with a resident links to that resident and a free bed links to the room that holds it (2026-10-21)                               |
| The create and the edit form told the office that basements use negative numbers          | CLOSED - the copy says what the server refuses: a level below 0 and a level or a label that is taken (2026-10-21)                               |
| The create and the edit form fetched their data into state from an effect                 | CLOSED - both read through the query stack and the form is filled from the server data (2026-10-21)                                             |
| The create and the edit form did not say what the save commits                            | CLOSED - both carry the panel that says what the save commits and what it refuses (2026-10-21)                                                  |
| The create page did not show the floor the office was about to commit                     | CLOSED - the rail names the level, the label, the room slots, the amenity units and the service rows to be seeded (2026-10-21)                  |
| The edit page opened with the uniform four tile band and a full room roster               | CLOSED - the edit page is a form with a rail that says where the floor stands (2026-10-21)                                                      |
| The create and the edit form checked a duplicate level but not a duplicate label          | CLOSED - both refuse a duplicate level and a duplicate label before the save (2026-10-21)                                                       |
| The feature doc had lost the acceptance checklist that the pipeline gate reads            | CLOSED - the checklist is back, with the line the field matrix gate looks for (2026-10-21)                                                      |
