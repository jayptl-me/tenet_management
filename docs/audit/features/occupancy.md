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
| Core API Room Availability      | Authenticated   | Bun + Hono (`apps/api`) | `GET /api/v1/rooms/available`, `GET /api/v1/rooms`                              | `authGuard`                                                                                          |
| Core API Room Mutations         | `admin` only    | Bun + Hono (`apps/api`) | `POST /api/v1/rooms`, `PUT /:id`, `DELETE /:id`                                 | `authGuard` + `adminOnly` middleware                                                                 |
| Core API Tenant Bed Allocations | `admin` only    | Bun + Hono (`apps/api`) | `POST /api/v1/tenants`, `PUT /:id`, `POST /:id/checkout`, `POST /:id/reinstate` | `authGuard` + `adminOnly` middleware                                                                 |

---

## 2. Source Code Map

| Layer                         | File Path                                                     | Responsibilities & Status                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Room Model                    | `apps/api/src/models/room.ts`                                 | Schema definition, `IBedSubdoc` (`bedId`, `isOccupied`, `tenantId`), `generateBeds()` static generator, `pre('save')` occupancyCount calculation, `post('save')` and `post('findOneAndDelete')` floor sync.              |
| Floor Model                   | `apps/api/src/models/floor.ts`                                | Tracks `totalRooms` synced by room lifecycle hooks.                                                                                                                                                                      |
| Tenant Model                  | `apps/api/src/models/tenant.ts`                               | Foreign keys `roomId` and `bedId`, `unique_active_room_bed` partial unique compound index on `{ roomId: 1, bedId: 1 }` where `isActive: true`.                                                                           |
| Rooms API Route               | `apps/api/src/routes/rooms.ts`                                | Available rooms endpoint (`/available`), room list (`/`), room detail (`/:id`), create room (`POST /`), atomic sharing downsize/rebuild (`PUT /:id`), soft deletion with occupant guard (`DELETE /:id`).                 |
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
  - `{ 'beds.isOccupied': 1 }`: Powers `/available` vacancy queries.
- `Tenant`:
  - `unique_active_room_bed`: `{ roomId: 1, bedId: 1 }` with `{ unique: true, partialFilterExpression: { isActive: true } }`. Guarantees no double occupancy at the database engine level.

---

## 4. API Endpoints Status

| Method   | Endpoint                              | Allowed Roles | Description                                                                                  | Status  |
| -------- | ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- | ------- |
| `GET`    | `/api/v1/rooms`                       | All auth      | Paginated list of rooms with populated floor details                                         | WORKING |
| `GET`    | `/api/v1/rooms/available`             | All auth      | Filtered query for rooms with vacant bed slots (`beds.isOccupied: false`)                    | WORKING |
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
