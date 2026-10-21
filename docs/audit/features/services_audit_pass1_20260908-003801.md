# Services Module - Audit Pass 1

Module: services
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

services (floor ServiceStatus health: operational/degraded/down + complaint counts).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                       | Status  |
| ------ | --------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/services/page.tsx -> /services                     | WORKING |
| Create | apps/web/src/app/(admin)/services/new/page.tsx -> /services/new             | WORKING |
| Detail | apps/web/src/app/(admin)/services/[id]/page.tsx -> /services/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/services/[id]/edit/page.tsx -> /services/[id]/edit | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                        | Route                | API Used                          | Status  |
| ----------------------------- | -------------------- | --------------------------------- | ------- |
| Floor services + report issue | services_screen.dart | floor/with-complaints (unwrapped) | WORKING |

### 2.3 Not Accessible

| Actor          | Blocked Surface                | Enforcement                 |
| -------------- | ------------------------------ | --------------------------- |
| tenant         | other floors services (report) | floor-membership check, 403 |
| guardian/other | PUT services                   | role guard, 403             |
| tenant         | operational restore            | PERMISSION_DENIED, 400      |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                                | Element                        | Status                       |
| -------------------------------------- | ------------------------------ | ---------------------------- |
| Summary cards + status + floor filters | StatCard/Select/ResourceSelect | WORKING (floor filter added) |
| Variants via statusToVariant           | StatusBadge                    | WORKING (helper deleted)     |
| Full-set CSV export                    | Button                         | WORKING (fixed page-only)    |
| parseApiError                          | errorParser                    | WORKING (added)              |
| Custom SVG                             | none                           | NO CUSTOM SVG                |

### 3.2 Create

| Feature                                         | Element     | Status          |
| ----------------------------------------------- | ----------- | --------------- |
| Strict isPerFloor === true options (API mirror) | Select      | WORKING (fixed) |
| parseApiError                                   | errorParser | WORKING (added) |
| Custom SVG                                      | none        | NO CUSTOM SVG   |

### 3.3 Detail

| Feature                           | Element    | Status        |
| --------------------------------- | ---------- | ------------- |
| Health + complaints + notes cards | DetailCard | WORKING       |
| Duplicate Edit CTA removed        | —          | REMOVED       |
| Custom SVG                        | none       | NO CUSTOM SVG |

### 3.4 Edit

| Feature                                                     | Element               | Status                    |
| ----------------------------------------------------------- | --------------------- | ------------------------- |
| Strict isPerFloor options; floor read-only (schema dropped) | Select/ResourceSelect | WORKING (fixed)           |
| Notes section simplified                                    | Textarea              | WORKING (nesting removed) |
| parseApiError on load/submit                                | errorParser           | WORKING (added)           |
| Custom SVG                                                  | none                  | NO CUSTOM SVG             |

## 4. Shared Components

| Component                                                                                                                                     | Path                           | Status  |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------- |
| floorLabel/roomLabel                                                                                                                          | resource-select-presets        | WORKING |
| FloorServiceGrid                                                                                                                              | ui (floor detail + rooms list) | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Select/Textarea/ResourceSelect | ui/*                           | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/services.ts)

| Endpoint                                                            | Auth                | Status                |
| ------------------------------------------------------------------- | ------------------- | --------------------- |
| GET /summary, GET /, GET /floor/:floorId/with-complaints            | authGuard           | WORKING               |
| POST / (isPerFloor enforcement)                                     | adminOnly           | WORKING               |
| PUT /:id (tenant own-floor scope; note audits)                      | authGuard           | WORKING               |
| PUT /:id/full (INVALID_SERVICE_TYPE guard)                          | adminOnly           | WORKING               |
| GET /:id, DELETE /:id                                               | authGuard/adminOnly | WORKING               |
| Batched complaint-count enricher (rooms + aggregate)                | internal            | WORKING (N+1 removed) |
| Floor create seeds statuses; POST /floors/reseed-services backfills | floors.ts           | WORKING (added)       |

### 5.2 Database Models

| Model         | Relation                              | Status  |
| ------------- | ------------------------------------- | ------- |
| ServiceStatus | floorId -> Floor; unique floor+type   | WORKING |
| AppConfig     | amenityDefinitions isPerFloor catalog | WORKING |

## 6. Missing Custom Components

| Component | Need                                      | Status |
| --------- | ----------------------------------------- | ------ |
| none      | Summary cards + grids cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                       | Status  |
| -------- | ----------------------------- | ------- |
| List     | Add, Export, View/Edit/Delete | WORKING |
| Detail   | Edit                          | WORKING |
| New/Edit | Save/Cancel                   | WORKING |

## 8. SVG Inventory

| Location          | SVG         | Status        |
| ----------------- | ----------- | ------------- |
| All service pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location          | Status  |
| ------------------------- | ----------------- | ------- |
| List table + mobile cards | services/page.tsx | WORKING |
| CSV export (6 cols)       | services/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. List floor filter + variant + CSV + parsers. 2. New strict filter + parser. 3. Edit strict filter + read-only floor + parsers. 4. Detail duplicate CTA removal. 5. API tenant scope + note audits + parseId + batched enricher. 6. reseed-services endpoint. 7. Flutter services unwrap + category map.

## 11. Out of Scope for This Pass

1. Room-amenity complaint category mapping (enricher falls back safely; services rows are per-floor only).
2. Amenity-def flip/delete migration (catalog versioning; separate product decision).

## 12. Pass 1 Fixes Applied

| Fix                                                                   | Files                                                | Status  |
| --------------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| Tenant own-floor PUT scope + note audits + parseId + batched enricher | apps/api/src/routes/services.ts                      | WORKING |
| POST /floors/reseed-services                                          | apps/api/src/routes/floors.ts                        | WORKING |
| List floor filter + variant + full CSV + parsers                      | apps/web/src/app/(admin)/services/page.tsx           | WORKING |
| New strict isPerFloor + parser                                        | apps/web/src/app/(admin)/services/new/page.tsx       | WORKING |
| Edit strict filter + read-only floor + parsers                        | apps/web/src/app/(admin)/services/[id]/edit/page.tsx | WORKING |
| Detail duplicate CTA removed                                          | apps/web/src/app/(admin)/services/[id]/page.tsx      | REMOVED |
| Flutter services unwrap + complaint category map                      | services_screen.dart, tenant_repository.dart         | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.

## Open gaps

No open gap findings recorded in this file.

Pass 1 recorded no open gap of its own. The findings of the depth pass of 2026-10-21 are listed in
the last section of this file, and the ones that are still open live in
docs/audit/features/services.md.

## Closed

| Claim                                                                 | Live status                                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Tenant own-floor PUT scope + note audits + parseId + batched enricher | FIXED - WORKING - apps/api/src/routes/services.ts                      |
| POST /floors/reseed-services                                          | FIXED - WORKING - apps/api/src/routes/floors.ts                        |
| List floor filter + variant + full CSV + parsers                      | FIXED - WORKING - apps/web/src/app/(admin)/services/page.tsx           |
| New strict isPerFloor + parser                                        | FIXED - WORKING - apps/web/src/app/(admin)/services/new/page.tsx       |
| Edit strict filter + read-only floor + parsers                        | FIXED - WORKING - apps/web/src/app/(admin)/services/[id]/edit/page.tsx |
| Detail duplicate CTA removed                                          | FIXED - removed - apps/web/src/app/(admin)/services/[id]/page.tsx      |
| Flutter services unwrap + complaint category map                      | FIXED - WORKING - services_screen.dart, tenant_repository.dart         |

## Depth pass (2026-10-21): the four admin screens rebuilt to the depth standard

Pass: depth (wave 6 of the depth program).
Method: the three gates and the per-module contract of
`docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` (gate A truth, gate B flow, gate C layout),
applied to the admin screens of this module. Every claim below was read out of source on
2026-10-21 and is cited as `file:line`.
Precedent: `docs/audit/features/rooms_audit_pass1_20260908-192930.md`,
`docs/audit/features/tenants_audit_pass1_20260908-230000.md`.
Nothing above this section was changed: the findings of pass 1 stand as they were written.

### 1. Inventory

| Artifact         | Path                                                 | Lines | Notes                                                        |
| ---------------- | ---------------------------------------------------- | ----- | ------------------------------------------------------------ |
| Board (list)     | apps/web/src/app/(admin)/services/page.tsx           | 1025  | The floor board, the URL filters, the band, the action panel |
| Service (detail) | apps/web/src/app/(admin)/services/[id]/page.tsx      | 626   | The action, the floor, the residents, the write trail        |
| Service (create) | apps/web/src/app/(admin)/services/new/page.tsx       | 367   | The form, what the save commits, the bulk run                |
| Service (edit)   | apps/web/src/app/(admin)/services/[id]/edit/page.tsx | 270   | The record, the two write paths                              |
| API route        | apps/api/src/routes/services.ts                      | 599   | 8 endpoints, one of them the notification of the floor       |
| Model            | apps/api/src/models/serviceStatus.ts                 | 79    | One floor, one service type, three states                    |
| Contract         | packages/types/src/contracts/services.ts             | 313   | The grid, the truth contract, the layout, the next action    |

### 2. What the operator is doing here

The operator holds the health of the building: what is working and what is not on every floor, and
puts a broken service back when it is repaired. The money belongs to the invoice module and the
payments module; what this module owns is the floor, the service type and the state the floor is
told. Done looks like: every floor carries the state of every service the office tracks on it, a
broken service says who lives above it, and the residents of that floor have been told.

A service belongs to a FLOOR, not to a room: the model carries a floorId and no room, and the
unique index is the floor and the service type. The residents a service reaches are the residents
of that floor, and the server resolves them from the service through the rooms of the floor and the
tenant records.

### 3. The findings of this pass

| ID        | Severity | Finding                                                                                                                                                                                                                                                                                                                                                            | How it ended                                                                                                                                                                                                                 |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SVC-D2-1  | P2       | The filters of the list lived in local state (the old services/page.tsx:135-136), so a view of the module could not be linked, shared or cited, and a link with a query parameter landed on the whole set.                                                                                                                                                         | Closed by the rebuild: the floor, the service and the state live in the address bar.                                                                                                                                         |
| SVC-D2-2  | P2       | The list answered "which service rows exist", not "what is working and what is not on each floor". It was a flat table sorted by service type, the floor was a column of text, and a floor that carried no row at all was invisible.                                                                                                                               | Closed by the rebuild: the board shows one line per floor and one tile per service type, names the tiles the server does not hold, and names the floors with no row.                                                         |
| SVC-D2-3  | P2       | The office could not act from where it stood. Setting a state meant a detour to the edit page, and the edit page wrote through PUT /services/:id/full, which pushes no notification and does not stamp the record (apps/api/src/routes/services.ts:480-569).                                                                                                       | Closed by the rebuild: a tile opens the action panel, and the write goes through the path that reaches the residents.                                                                                                        |
| SVC-D2-4  | P2       | The page never said who was told. The tiles showed a state and nothing about the residents above it, and the resident half of the module was invisible from the office.                                                                                                                                                                                            | Closed by the rebuild: the board names the residents of every floor, the service page lists them by name and room, and every write says what the server pushed.                                                              |
| SVC-D2-5  | P2       | The numbers had no scope. The tiles came from GET /services/summary, which counts every row of the building with no filter, while the table below showed one page of the filtered set (the old services/page.tsx:404-438 against apps/api/src/routes/services.ts:200-209).                                                                                         | Closed by the rebuild: the band is the server's own count over the floors in view, every number names its scope, and the count on every tab is the number of tiles that tab shows.                                           |
| SVC-D2-6  | P2       | The edit page wrote the state through the path that reaches nobody. PUT /services/:id/full pushes no notification and leaves the stamp of the record stale, so an admin who repaired a broken service from the edit page left the residents uninformed and the record stamped with the office that wrote the row before (apps/api/src/routes/services.ts:480-569). | Closed by the rebuild: the state and the note go through PUT /services/:id, and a service type change keeps the other path. The page says what each path does and does not do.                                               |
| SVC-D2-7  | P2       | The removal of a row asked "are you sure you want to delete this service status? This action cannot be undone" (the old services/page.tsx:541) and never said what the server does with the row or with the residents.                                                                                                                                             | Closed by the rebuild: the dialog states that the row is deleted for good, that the floor loses the service until the seed creates it again, and that the residents are not told.                                            |
| SVC-D2-8  | P2       | The create page did not say what provisioning writes, and the bulk run built its own sentence per floor ("created by the server", "already existed on the server") instead of reporting the answer of the server (the old services/new/page.tsx:118-150).                                                                                                          | Closed by the rebuild: the page names what the save commits, what it refuses including a floor that already has the service, and that a created row reaches nobody. The bulk run reports the answer of the server per floor. |
| SVC-D2-9  | P2       | The detail page opened with three statistic tiles and repeated the state three times (the old services/[id]/page.tsx:133-158), and it carried neither the residents of the floor nor the write trail of the record.                                                                                                                                                | Closed by the rebuild: the page opens with the state of the service and the action that moves it, and carries the floor, the residents and the write trail.                                                                  |
| SVC-D2-10 | P3       | The edit page read the record with a hand written fetch, outside the shared query stack, and navigated away without re-reading the record (the old services/[id]/edit/page.tsx:69-114).                                                                                                                                                                            | Closed by the rebuild: the record is read with useApiQuery, the form is filled from it, and the write invalidates the service queries.                                                                                       |
| SVC-D2-11 | P3       | The CSV export carried only the page in view and never said so (the old services/page.tsx:247-289).                                                                                                                                                                                                                                                                | Closed by the rebuild: the export carries the set the board shows and reports the rows the server holds against the rows the file carries.                                                                                   |
| SVC-D2-12 | P3       | The floor of a service was text in a table cell and the office could not get from a floor to its rooms.                                                                                                                                                                                                                                                            | Closed by the rebuild: every floor on the board links to the floor page, to its rooms filtered in the address bar, and to the action that provisions a service it does not carry.                                            |
| SVC-D3-1  | P2       | Creating a service row reaches nobody.                                                                                                                                                                                                                                                                                                                             | Still open: it needs a notification on the create path. The page says so before the write.                                                                                                                                   |
| SVC-D3-2  | P2       | A service type change reaches nobody and leaves the stamp of the record stale.                                                                                                                                                                                                                                                                                     | Still open: it needs a notification and a stamp on the full update path. The edit page names what that path does.                                                                                                            |
| SVC-D3-3  | P2       | Removing a service row reaches nobody.                                                                                                                                                                                                                                                                                                                             | Still open: it needs a notification on the delete path. The dialog says that the residents are not told.                                                                                                                     |
| SVC-D3-4  | P2       | The server cannot filter on a service type.                                                                                                                                                                                                                                                                                                                        | Still open: it needs a filter on the list route. The legend says that the filter narrows the board on the screen.                                                                                                            |
| SVC-D3-5  | P2       | The list route serves at most 100 rows in one page and there is no endpoint that returns the whole set.                                                                                                                                                                                                                                                            | Still open: it needs a page size above 100 or an endpoint that returns the set. The board walks the pages and names the size of the set it holds.                                                                            |
| SVC-D3-6  | P2       | The summary route has no consumer: the board reads the per floor counts of GET /floors/overview instead.                                                                                                                                                                                                                                                           | Still open: it is an API decision to delete the route or to give it a reader.                                                                                                                                                |
| SVC-D3-7  | P2       | The residents the server tells and the residents the board counts are two different counts.                                                                                                                                                                                                                                                                        | Still open: it needs one count on the server. The board names the count it shows.                                                                                                                                            |
| SVC-D3-8  | P3       | The floor of a service cannot be changed and the server has no endpoint that moves a row to another floor.                                                                                                                                                                                                                                                         | Still open: it needs a move endpoint or a model change. The create and edit pages say that the floor is fixed.                                                                                                               |
| SVC-D3-9  | P3       | The history of a service lives only in the audit log, whose entries expire after 90 days.                                                                                                                                                                                                                                                                          | Still open: it needs a longer life for the entries or a history on the model. The service page shows the trail.                                                                                                              |
| SVC-D3-10 | P3       | The shared service DTOs of packages/types/src/service.ts have no importer in the repository.                                                                                                                                                                                                                                                                       | Still open: the four screens declare their own interfaces, as in the invoices, the tenants and the rooms module.                                                                                                             |
| SVC-D3-11 | P3       | The code of a refusal is lost on the create path.                                                                                                                                                                                                                                                                                                                  | Still open: the helper drops the code it is given, so the client reads the message. The create page reads the message.                                                                                                       |

The rows that are still open are carried in `docs/audit/features/services.md` with their severity and
their paths; the rows that the rebuild closed are carried in the Closed section of the same file.

### 4. The contract

`packages/types/src/contracts/services.ts` now holds the grid of the domain (a state on a floor, a
service type as the column and the floor as the line), one truth entry per action the admin can take
(report a service as degraded or down, put it back to operational, change the note, provision a
service, provision every floor, change the service type, remove the row, seed the missing rows, read
the board), the layout archetype with the grammar tokens and the module own number, and the next
best action per state and per empty state.

The contract names what the code really has, including the places where a person is still not told:
a row that is created, a service type that changes and a row that is removed all reach nobody.

### 5. What was NOT done

- No API route, model or shared type was changed. Every gap that needs one is listed above as still
  open.
- The mobile portal was not touched. The resident half of this module (the floor services the
  resident reads on their phone) was not re-audited in this pass; pass 1 above still stands.
- The shared components were not changed. The board draws its own tiles because the module needs a
  floor per line and a service per tile, which no shared component draws.
- The page no longer uses the arbitrary pixel widths the type scale allowlist excused for it
  (`max-w-[200px]` and `w-[130px]` in scripts/audit/check-type-scale.ts). The gate still passes,
  because a stale allowlist entry is printed and not failed, but those entries belong to the owner
  of that script and should be deleted there.
- No screenshot and no browser run: every layout claim is read out of the component geometry and the
  width rule, not measured. The layout gate stubs every service route with an empty array, so the
  screens treat an answer that is not a service as "the server reports no service" and render their
  error state instead of an empty record.
