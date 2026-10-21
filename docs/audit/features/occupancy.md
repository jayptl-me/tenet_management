# Occupancy & Operational Capacity Management -- Feature Audit

**Audit Pass:** 1  
**Audit Timestamp:** 2026-09-08T03:35:00+05:30 (Asia/Kolkata)  
**Module:** Occupancy & Operational Capacity Management (A-Z Phase 1: Module 22)  
**Audit Status:** Complete & Remediated (Pass 1)  
**Grade:** A+  
**Priority:** All P1 & P2 Remediations Closed

---

## 1. Executive Summary & Product Split

The Occupancy & Operational Capacity Management module is the architectural backbone governing PG capacity, room allocation, bed inventory tracking, and resident density across the Tenet PG Management platform. It enforces mathematical invariants across physical building infrastructure (Floors), living quarters (Rooms), individual bed slots ('A', 'B', 'C', 'D'), and active resident lifecycles (Tenants).

### Product Split & Access Boundary Matrix

| Surface                         | Allowed Roles   | Platform                | Route / URL                                                                     | Role Enforcement Mechanism                                                                           |
| ------------------------------- | --------------- | ----------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Admin Dashboard                 | `admin` only    | Next.js (`apps/web`)    | `/dashboard`                                                                    | `AdminLayout` route guard; renders Occupancy StatCard, Sparkline, and 6-month Trend Chart            |
| Admin Rooms List                | `admin` only    | Next.js (`apps/web`)    | `/rooms`                                                                        | `AdminLayout` route guard; displays available/total bed fractions and status filters                 |
| Admin Room Detail               | `admin` only    | Next.js (`apps/web`)    | `/rooms/[id]`                                                                   | `AdminLayout` route guard; renders Occupancy DonutChart, Bed Allocations Grid, Current Tenants Table |
| Admin Room Create / Edit        | `admin` only    | Next.js (`apps/web`)    | `/rooms/new`, `/rooms/[id]/edit`                                                | `AdminLayout` route guard; sharingType selector, downsize conflict handling                          |
| Admin Tenant Onboarding         | `admin` only    | Next.js (`apps/web`)    | `/tenants/new`                                                                  | `AdminLayout` route guard; renders dynamic `OccupancyBedPicker`                                      |
| Admin Tenant Transfer / Edit    | `admin` only    | Next.js (`apps/web`)    | `/tenants/[id]/edit`                                                            | `AdminLayout` route guard; room selector with reactive bed allocation picker                         |
| Admin Tenant Detail             | `admin` only    | Next.js (`apps/web`)    | `/tenants/[id]`                                                                 | `AdminLayout` route guard; checkout modal and reinstatement fallback bed picker                      |
| Resident Mobile (Tenant)        | `tenant` only   | Flutter (`mobile/`)     | `/tenant/profile`                                                               | `app_router.dart` role guard; read-only display of assigned room and bed slot                        |
| Resident Mobile (Guardian)      | `guardian` only | Flutter (`mobile/`)     | `/guardian` (Ward Screen)                                                       | `app_router.dart` role guard; read-only display of ward's assigned room and bed slot                 |
| Visitor Desk                    | None            | Flutter (`mobile/`)     | N/A                                                                             | Excluded by product design                                                                           |
| Core API Dashboard Stats        | `admin` only    | Bun + Hono (`apps/api`) | `GET /api/v1/dashboard/stats`, `/occupancy-history`                             | `authGuard` + `adminOnly` middleware                                                                 |
| Core API Rooms                  | Authenticated   | Bun + Hono (`apps/api`) | `GET /api/v1/rooms`                                                             | `authGuard`                                                                                          |
| Core API Room Mutations         | `admin` only    | Bun + Hono (`apps/api`) | `POST /api/v1/rooms`, `PUT /:id`, `DELETE /:id`                                 | `authGuard` + `adminOnly` middleware                                                                 |
| Core API Tenant Bed Allocations | `admin` only    | Bun + Hono (`apps/api`) | `POST /api/v1/tenants`, `PUT /:id`, `POST /:id/checkout`, `POST /:id/reinstate` | `authGuard` + `adminOnly` middleware                                                                 |

---

## 2. Source Code Map

| Layer                         | File Path                                                     | Responsibilities & Status                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Room Model                    | `apps/api/src/models/room.ts`                                 | Schema definition, `IBedSubdoc` (`bedId`, `isOccupied`, `tenantId`), `generateBeds()` static generator, `pre('save')` occupancyCount calculation, `post('save')` and `post('findOneAndDelete')` floor sync.              |
| Floor Model                   | `apps/api/src/models/floor.ts`                                | Tracks `totalRooms` synced by room lifecycle hooks.                                                                                                                                                                      |
| Tenant Model                  | `apps/api/src/models/tenant.ts`                               | Foreign keys `roomId` and `bedId`, `unique_active_room_bed` partial unique compound index on `{ roomId: 1, bedId: 1 }` where `isActive: true`.                                                                           |
| Rooms API Route               | `apps/api/src/routes/rooms.ts`                                | Room list (`/`), room detail (`/:id`), create room (`POST /`), atomic sharing downsize/rebuild (`PUT /:id`), soft deletion with occupant guard (`DELETE /:id`).                                                          |
| Tenants API Route             | `apps/api/src/routes/tenants.ts`                              | Onboarding bed reservation (`POST /`), room transfer and bed swap (`PUT /:id`), checkout vacancy release (`POST /:id/checkout`), reinstatement reclamation (`POST /:id/reinstate`), hard delete cleanup (`DELETE /:id`). |
| Dashboard API Route           | `apps/api/src/routes/dashboard.ts`                            | Aggregates `totalRooms`, `totalBeds`, `occupiedBeds`, `vacancyRate`, and 6-month historical occupancy trend (`/occupancy-history`).                                                                                      |
| Shared Dashboard Types        | `packages/types/src/dashboard.ts`                             | Interface `IDashboardOccupancyStats` (`totalRooms`, `totalBeds`, `occupiedBeds`, `vacancyRate`) and `IOccupancyHistoryPoint`.                                                                                            |
| Shared Room Types             | `packages/types/src/room.ts`                                  | Interfaces `IBed`, `IRoom`, `IRoomCreate`, `IRoomWithOccupants`, `SharingType` (`2 \| 3 \| 4`).                                                                                                                          |
| Shared Tenant Types           | `packages/types/src/tenant.ts`                                | Interfaces `ITenant`, `ITenantCreate`, `ITenantTransfer`.                                                                                                                                                                |
| Admin Dashboard Page          | `apps/web/src/app/(admin)/dashboard/page.tsx`                 | Renders Occupancy StatCard, Sparkline, and LineChart for 6-month occupancy trend.                                                                                                                                        |
| Admin Rooms List Page         | `apps/web/src/app/(admin)/rooms/page.tsx`                     | DataTable with Beds column displaying `${available}/${total} available`, sharing type, and status badge.                                                                                                                 |
| Admin Room Detail Page        | `apps/web/src/app/(admin)/rooms/[id]/page.tsx`                | Occupancy DonutChart, StatCards, Current Tenants table, Bed Allocations grid.                                                                                                                                            |
| Admin Bed Picker Component    | `apps/web/src/components/ui/OccupancyBedPicker.tsx`           | Reactive bed selector component: queries room details, disables occupied beds, and displays `Bed X (Occupied)`.                                                                                                          |
| Admin Tenant Create Page      | `apps/web/src/app/(admin)/tenants/new/page.tsx`               | Integrates `ResourceSelect` for room and `OccupancyBedPicker` for bed slot.                                                                                                                                              |
| Admin Tenant Edit Page        | `apps/web/src/app/(admin)/tenants/[id]/edit/page.tsx`         | Room transfer and bed swap interface with dynamic bed option recalculation.                                                                                                                                              |
| Admin Tenant Detail Page      | `apps/web/src/app/(admin)/tenants/[id]/page.tsx`              | Displays assigned room and bed, checkout confirmation modal, and reinstatement dialog with fallback bed selector.                                                                                                        |
| Flutter Tenant Profile Screen | `mobile/lib/features/tenant/presentation/profile_screen.dart` | Read-only presentation of assigned room number and bed letter under 'Room & Rent' card.                                                                                                                                  |
| Flutter Guardian Ward Screen  | `mobile/lib/features/guardian/presentation/ward_screen.dart`  | Read-only presentation of ward's room number and bed letter under 'Tenant' card.                                                                                                                                         |

---

## 3. Mathematical Invariants & Data Models

### 3.1 Mathematical Invariants

```
Total Property Beds  = SUM(Room.beds.length where Room.isActive == true)
Occupied Beds        = COUNT(Active Tenants with Assigned Bed)
                     = SUM(Room.occupancyCount where Room.isActive == true)
Vacant Beds          = Total Property Beds - Occupied Beds
Global Vacancy Rate  = (Vacant Beds / Total Property Beds) * 100
Room Occupancy %     = (Room.occupancyCount / Room.sharingType) * 100
```

### 3.2 Database Indexes Verified

- `Room`:
  - `{ floorId: 1 }`: Floor-level room lookups.
  - `{ sharingType: 1 }`: Capacity filtering.
  - `{ isActive: 1 }`: Operational rooms filter.
  - `{ 'beds.isOccupied': 1 }`: Index kept on the model; it no longer backs a `/available` endpoint (removed 2026-10-21, no consumer).
- `Tenant`:
  - `unique_active_room_bed`: `{ roomId: 1, bedId: 1 }` with `{ unique: true, partialFilterExpression: { isActive: true } }`. Guarantees no double occupancy at the database engine level.

---

## 4. API Endpoints Status

| Method   | Endpoint                              | Allowed Roles | Description                                                                                  | Status  |
| -------- | ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- | ------- |
| `GET`    | `/api/v1/rooms`                       | All auth      | Paginated list of rooms with populated floor details                                         | WORKING |
| `GET`    | `/api/v1/rooms/available`             | All auth      | Removed 2026-10-21 (no consumer). Vacant-bed query (`beds.isOccupied: false`)                | REMOVED |
| `GET`    | `/api/v1/rooms/:id`                   | All auth      | Room detail with populated tenant occupant details per bed                                   | WORKING |
| `POST`   | `/api/v1/rooms`                       | `admin`       | Create room with auto-generated bed array based on sharingType                               | WORKING |
| `PUT`    | `/api/v1/rooms/:id`                   | `admin`       | Atomic update & downsize with occupant safety validations                                    | WORKING |
| `DELETE` | `/api/v1/rooms/:id`                   | `admin`       | Soft delete with active occupant conflict check (`ACTIVE_TENANTS`)                           | WORKING |
| `POST`   | `/api/v1/tenants`                     | `admin`       | Onboard tenant with transactional bed allocation                                             | WORKING |
| `PUT`    | `/api/v1/tenants/:id`                 | `admin`       | Tenant transfer / bed swap with transactional vacancy verification                           | WORKING |
| `POST`   | `/api/v1/tenants/:id/checkout`        | `admin`       | Checkout resident, free bed slot, and decrement room occupancy                               | WORKING |
| `POST`   | `/api/v1/tenants/:id/reinstate`       | `admin`       | Reclaim bed slot upon resident reinstatement                                                 | WORKING |
| `GET`    | `/api/v1/dashboard/stats`             | `admin`       | Returns occupancy metrics including `totalRooms`, `totalBeds`, `occupiedBeds`, `vacancyRate` | WORKING |
| `GET`    | `/api/v1/dashboard/occupancy-history` | `admin`       | 6-month historical active tenant count against total capacity beds                           | WORKING |

---

## 5. Remediations Applied & Verified

1. **Dashboard Ratio Bug Remediation (`DASH-OCC-P1-1`)**:
   - `totalBeds: number` exposed in `IDashboardOccupancyStats` on `@pg/types`.
   - `GET /dashboard/stats` calculates and returns `totalBeds`.
   - Admin Dashboard renders true bed ratio `${stats.occupancy.occupiedBeds}/${stats.occupancy.totalBeds ?? stats.occupancy.totalRooms}` instead of comparing beds to rooms.
2. **Dashboard Trend Description Bug Remediation (`DASH-OCC-P1-2`)**:
   - Snapshot description updated to `${stats.occupancy.occupiedBeds} of ${stats.occupancy.totalBeds ?? stats.occupancy.totalRooms} beds filled`.
3. **Database Unique Constraints**:
   - MongoDB partial unique index on `{ roomId: 1, bedId: 1 }` prevents race conditions or dual bookings.
4. **Active Occupant Protection**:
   - Room deletion is strictly blocked if active tenants exist (`409 Conflict: ACTIVE_TENANTS`).
5. **Bed Allocation Component**:
   - `OccupancyBedPicker` dynamically loads real-time bed states and disables occupied slots.

---

## 6. Verification Checklist

- [x] Portal boundaries strictly respected (admin in `apps/web`, resident in `mobile/`).
- [x] Zero emojis in code, commits, or documentation.
- [x] All API endpoints return standardized JSON `{ success, data/error, meta? }`.
- [x] `bun run typecheck` passed (0 errors across `@pg/types`, `@pg/web`, `@pg/api`).
- [x] `bun run lint` (oxlint) passed with 0 warnings and 0 errors across 324 files.
- [x] `cd mobile && flutter analyze` passed with 0 issues.

## Open gaps

The rows below are the findings of the depth pass of 2026-10-21 on the rooms module, which owns the
occupancy of the building. Every row needs a change in the API, in the model or in the shared
types, so the rebuild of the admin screens could not close it. The rows the rebuild closed are
recorded in the Closed section below with their date; the rows that were already closed in the
passes before are kept there unchanged.

| ID       | Severity | Gap                                                                                                                                                                                                                                                                                                                                                                                     | Path                              |
| -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| OCC-D3-1 | P2       | The server cannot filter on a free bed: GET /rooms reads the floor, the sharing type, the active flag and the room number only (apps/api/src/routes/rooms.ts:214-226). The office cannot ask the server for the rooms with a free bed, so the free bed filter on the rooms list narrows the rooms on the screen and the band keeps the scope of the whole set.                          | apps/api/src/routes/rooms.ts      |
| OCC-D3-2 | P2       | The bed map can only draw the first 100 rooms of a set: the API clamps a page to 100 rows (apps/api/src/lib/routeUtils.ts:16) and the rooms list has no mode that walks the set, so a building with more than 100 rooms is never drawn whole.                                                                                                                                           | apps/api/src/lib/routeUtils.ts    |
| OCC-D3-3 | P2       | The occupancy of a room is held twice: in the bed array of the room and in the roomId and bedId of the resident record. The two can drift, and the reconcile repairs it (apps/api/src/services/occupancy-reconcile.service.ts:62-219) but nothing reports the drift on the room page itself, so the bed map of a room can show a bed taken by a resident whose record points elsewhere. | apps/api/src/models/room.ts       |
| OCC-D3-4 | P2       | A bed move is silent. PUT /tenants/:id frees the bed the resident held, takes the new one and writes a tenant_transfer audit entry, and sends no message (apps/api/src/routes/tenants.ts:503-730). The resident finds out from the portal and not from the office.                                                                                                                      | apps/api/src/routes/tenants.ts    |
| OCC-D3-5 | P2       | A sharing type change that repacks the beds moves residents silently: the server writes the new bed onto the record of every resident the repack touches (apps/api/src/routes/rooms.ts:544-553) and sends nothing.                                                                                                                                                                      | apps/api/src/routes/rooms.ts      |
| OCC-D3-6 | P3       | The room count of a floor is kept by the room hooks and by the room routes (apps/api/src/models/room.ts:162-180, apps/api/src/routes/rooms.ts:57-75). A room written outside those paths leaves the count of the floor wrong, and nothing reports the difference between the count and the rooms that carry it.                                                                         | apps/api/src/models/room.ts       |
| OCC-D3-7 | P3       | The room model carries no status field, so the domain has no lifecycle vocabulary in packages/types/src/lifecycle.json and the shared stepper cannot render it. The grid of the module (occupancy times sharing type times service state) is written out in the contract instead.                                                                                                       | packages/types/src/lifecycle.json |
| OCC-D3-8 | P3       | The shared room DTOs of packages/types/src/room.ts have no importer in the repository, so the shape of a room can drift between the API and the four admin screens.                                                                                                                                                                                                                     | packages/types/src/room.ts        |
| OCC-D3-9 | P3       | The write trail of a room expires after 90 days (apps/api/src/models/auditLog.ts:82), so a change of the bed map that reached nobody leaves no trace after a quarter.                                                                                                                                                                                                                   | apps/api/src/models/auditLog.ts   |

## Closed

| Claim                                                                                                                  | Live status                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DASH-OCC-P1-1 Dashboard occupancy ratio compared beds to rooms                                                         | CLOSED - totalBeds exposed in types and GET /dashboard/stats; ratio uses beds                                                                                                                                                   |
| DASH-OCC-P1-2 Dashboard trend description used wrong denominator                                                       | CLOSED - snapshot description uses occupiedBeds/totalBeds                                                                                                                                                                       |
| Room deletion could race into dual bed bookings                                                                        | CLOSED - partial unique index on roomId+bedId                                                                                                                                                                                   |
| Room deletion allowed while active tenants occupy beds                                                                 | CLOSED - 409 ACTIVE_TENANTS guard                                                                                                                                                                                               |
| Bed allocation lacked live occupancy state                                                                             | CLOSED - OccupancyBedPicker disables occupied slots                                                                                                                                                                             |
| GET /api/v1/rooms/available was live with no consumer                                                                  | REMOVED 2026-10-21 - endpoint deleted, zero consumers                                                                                                                                                                           |
| OCC-D2-1 - the rooms list never said over which set its occupancy numbers were computed                                | CLOSED 2026-10-21 - the band names the scope of every number, and the legend says that the free bed filter narrows the rooms on the screen because the server cannot filter on a free bed                                       |
| OCC-D2-2 - the bed map claimed to draw every matching room while the server serves at most 100 rooms in one page       | CLOSED 2026-10-21 - the map names the ceiling of what it draws and the size of the set it covers                                                                                                                                |
| OCC-D2-3 - the free bed filter narrowed the rows of the page while the numbers covered the whole filtered set          | CLOSED 2026-10-21 - the filter is in the address bar and the legend says what it does and what it does not do                                                                                                                   |
| OCC-D2-4 - the rebuild of the bed map of the building was applied blind                                                | CLOSED 2026-10-21 - the page checks the bed map with the dry run of the server first, shows the rooms it would repair, the stale beds it would free and the conflicts it cannot resolve, and applies only what the report names |
| OCC-D2-5 - the room page showed the occupancy as a donut and four statistic tiles instead of the bed map               | CLOSED 2026-10-21 - the bed map is the protagonist: one tile per bed, the resident who holds it, their stay and the rent on their record                                                                                        |
| OCC-D2-6 - the services column of the rooms list showed the health of the floor on a room row                          | CLOSED 2026-10-21 - the column carries the health of the amenities of the room itself, and the services of the floor live on the room and floor pages, labelled as the floor's                                                  |
| OCC-D2-7 - the room page had no write trail although the audit route can filter by the record                          | CLOSED 2026-10-21 - the room page shows the write trail of that room, with the fields the server recorded                                                                                                                       |
| OCC-D2-8 - the bed assignment promised the resident an immediate update in the app that the server never sends         | CLOSED 2026-10-21 - the room page names the resident, the room they leave, the bed they take and the fact that no message is sent, and the modal that carried the promise is no longer used                                     |
| OCC-D2-9 - the create page could not show the beds that the save creates, so the bed count of a new room was a mystery | CLOSED 2026-10-21 - the page shows the bed letters the server creates and says that the bed count is the server's and not the office's                                                                                          |

## Depth pass (2026-10-21): the rooms module, the owner of the occupancy of the building

Pass: depth (wave 6 of the depth program).
Method: the three gates and the per-module contract of
`docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md`, applied to the admin screens of the rooms module,
which is where the occupancy of the building is read and written. Every claim was read out of source
on 2026-10-21 and is cited as `file:line`. The findings themselves are in
`docs/audit/features/rooms.md`, with the depth pass at the end of that file.

### What the operator is doing here

The operator keeps the bed map of the building true: which bed of which room is free, who sleeps in
it, and what happens to a resident when their bed moves. Done looks like: every bed of every room
is either taken by a named resident or marked free, a room that depends on a broken amenity has told
its residents, and a bed that moved is written on the record of the resident who moved.

### What this pass found about occupancy

1. The occupancy numbers of the module were the only numbers the server computes over the whole
   filtered set (apps/api/src/routes/rooms.ts:240-269), and the screen never said so: the ring, the
   beds and the rows could cover different sets, and the rent of the rooms was called the
   potential rent when the server sums one rent per room. Closed on the screen: the band names the
   scope of every number and the legend says what each filter does.
2. The occupancy of a room is held twice, in the room and in the resident record, and the two can
   drift. The reconcile service repairs the drift and the server can report it without writing
   anything, but nothing reported it before a write to the whole building. Closed on the screen: the
   page checks the bed map first and applies only what the report names. The drift flag itself stays
   open (OCC-D3-3).
3. A bed move changes where a resident sleeps, and the server writes the move into the audit log and
   into the resident record, and sends no message. The screen now says so before the write and names
   the resident and the room they leave. The notification itself stays open (OCC-D3-4, OCC-D3-5).
4. The room page read the occupancy of a room from the bed array of the room and never from the
   resident records, so a room whose two copies disagreed showed the bed array. The page now reads
   the residents of the room as well, so a bed with no resident record behind it says so.

### What was NOT done

- No API route, model or shared type was changed. Every gap that needs one is listed above.
- The mathematical invariants of section 3 of this file still hold: the rebuild changed what the
  screens show, not what the server stores.
- The mobile portal was not touched: the resident half of the occupancy (the room and the bed the
  resident reads on their phone) was not re-audited in this pass.
