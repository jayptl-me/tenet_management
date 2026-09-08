# Rooms & Inventory Management -- Feature Audit

**Audit Pass:** 1  
**Audit Timestamp:** 2026-09-08T02:40:00+05:30 (Asia/Kolkata)  
**Module:** Rooms & Inventory Management  
**Audit Status:** Complete & Remediated (Pass 1)  
**Grade:** A+  
**Priority:** All P1 & P2 remediations closed

---

## 1. Product Split & Role Access Boundary Matrix

| Surface                     | Allowed Roles   | Platform                | Route / Endpoint                                   | Role Enforcement Mechanism                                                                 |   Status    |
| --------------------------- | --------------- | ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ | :---------: |
| Admin Web List              | `admin` only    | Next.js (`apps/web`)    | `/rooms`                                           | `AdminLayout` route guard (`user.role === 'admin'`). Non-admin redirects to `/login`.      | **WORKING** |
| Admin Web Bed Matrix        | `admin` only    | Next.js (`apps/web`)    | `/rooms` (Matrix view)                             | Integrated `BedOccupancyGrid` grouped by floor with real-time occupancy stats.             | **WORKING** |
| Admin Web Create            | `admin` only    | Next.js (`apps/web`)    | `/rooms/new`                                       | `AdminLayout` guard; `ResourceSelect` floor picker; dynamic rent prefill from `AppConfig`. | **WORKING** |
| Admin Web Detail            | `admin` only    | Next.js (`apps/web`)    | `/rooms/[id]`                                      | `AdminLayout` guard; DonutChart, amenity health, tenant links, direct bed assignment CTA.  | **WORKING** |
| Admin Web Edit              | `admin` only    | Next.js (`apps/web`)    | `/rooms/[id]/edit`                                 | `AdminLayout` guard; `ResourceSelect` floor picker, atomic sharing reconfiguration guard.  | **WORKING** |
| Resident Mobile (Tenant)    | `tenant` only   | Flutter (`mobile/`)     | Profile & Home Screens                             | Read-only room and bed metadata displayed in `HomeScreen` badge and `ProfileScreen`.       | **WORKING** |
| Resident Mobile (Guardian)  | `guardian` only | Flutter (`mobile/`)     | `/guardian`                                        | Read-only room and bed metadata displayed in `GuardianWardScreen`.                         | **WORKING** |
| Visitor Desk Surface        | Visitor Staff   | Flutter (`mobile/`)     | `/visitor/status`                                  | Read-only host resident room reference displayed on visitor badges.                        | **WORKING** |
| Core API (List & Available) | Authenticated   | Bun + Hono (`apps/api`) | `GET /api/v1/rooms`, `GET /api/v1/rooms/available` | Protected by `authGuard`. All authenticated sessions can read inventory.                   | **WORKING** |
| Core API (Detail)           | Authenticated   | Bun + Hono (`apps/api`) | `GET /api/v1/rooms/:id`                            | Protected by `authGuard`. Populates floor and bed tenant names.                            | **WORKING** |
| Core API (Create)           | `admin` only    | Bun + Hono (`apps/api`) | `POST /api/v1/rooms`                               | Protected by `authGuard` + `adminOnly`. Emits audit log `action: 'create'`.                | **WORKING** |
| Core API (Update)           | `admin` only    | Bun + Hono (`apps/api`) | `PUT /api/v1/rooms/:id`                            | Protected by `authGuard` + `adminOnly`. Transactional sharing rebuild + audit log.         | **WORKING** |
| Core API (Delete)           | `admin` only    | Bun + Hono (`apps/api`) | `DELETE /api/v1/rooms/:id`                         | Protected by `authGuard` + `adminOnly`. Blocks if tenants active + audit log.              | **WORKING** |

---

## 2. Source Code Architecture & Assets Map

| Layer                   | File Path                                                                                                                                                   | Responsibilities & Coverage                                                                                                                                                                                 |   Status    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------: |
| Data Model              | [room.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/models/room.ts)                                       | Mongoose schema, bed subdocument schema, amenity subdocument schema, unique roomNumber, sharingType `[2, 3, 4]`, static `generateBeds`, pre-save occupancy calculation, post-save `Floor.totalRooms` hooks. | **WORKING** |
| Core Routes             | [rooms.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/routes/rooms.ts)                                     | Hono router mounted at `/api/v1/rooms`: paginated list, vacant rooms lookup, detail with tenant name resolution, admin create, transactional sharing update with bed remap, soft delete, audit logging.     | **WORKING** |
| Shared Types            | [room.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/room.ts)                                        | TypeScript interfaces: `SharingType`, `RoomAmenityStatus`, `IBed`, `IRoom`, `IRoomCreate`, `IRoomWithOccupants`.                                                                                            | **WORKING** |
| Admin List Page         | [page.tsx](<file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/app/(admin)/rooms/page.tsx>)                        | DataTable with search input, sharing filter, status filter, Table vs Bed Matrix view switcher, deactivation modal.                                                                                          | **WORKING** |
| Bed Matrix UI           | [BedOccupancyGrid.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/ui/BedOccupancyGrid.tsx)      | Visual bed occupancy matrix grouped by building floor, counter stat cards, bed availability badges, quick assignment links.                                                                                 | **WORKING** |
| Admin Create Page       | [page.tsx](<file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/app/(admin)/rooms/new/page.tsx>)                    | FormPage with `ResourceSelect` floor picker, dynamic `roomPricing` prefill from `AppConfig`, room amenity status pickers.                                                                                   | **WORKING** |
| Admin Detail Page       | [page.tsx](<file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/app/(admin)/rooms/[id]/page.tsx>)                   | StatCards, DonutChart occupancy, Current Tenants table, visual Bed Allocations grid with direct "Assign Tenant" CTA, photo gallery.                                                                         | **WORKING** |
| Admin Edit Page         | [page.tsx](<file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/app/(admin)/rooms/[id]/edit/page.tsx>)              | FormPage with `ResourceSelect` floor picker, sharing type reconfiguration with occupancy conflict warning, active toggle, amenity status.                                                                   | **WORKING** |
| Bed Selector UI         | [OccupancyBedPicker.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/ui/OccupancyBedPicker.tsx)  | Visual bed picker embedded during tenant onboarding (`/tenants/new`).                                                                                                                                       | **WORKING** |
| Resident Mobile Display | [home_screen.dart](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/features/tenant/presentation/home_screen.dart) | Tenant home screen displays current assigned Room Number and Bed ID badge.                                                                                                                                  | **WORKING** |

---

## 3. Data Model & Schema Details

### Schema: `Room` (`apps/api/src/models/room.ts`)

| Field            | Type     | Constraints & Defaults                    | Description                                         |    Status    |
| ---------------- | -------- | ----------------------------------------- | --------------------------------------------------- | :----------: |
| `roomNumber`     | String   | Required, unique, uppercase, trim, max 20 | Room identifier (e.g. `101`, `G2`)                  | **VERIFIED** |
| `floorId`        | ObjectId | Ref: `Floor`, Required                    | Building floor foreign key                          | **VERIFIED** |
| `sharingType`    | Number   | Enum: `[2, 3, 4]`, Required               | Bed capacity (2-sharing, 3-sharing, 4-sharing)      | **VERIFIED** |
| `monthlyRent`    | Number   | Min 1000, Max 50000, Required             | Base rent charged per bed                           | **VERIFIED** |
| `isActive`       | Boolean  | Default `true`                            | Soft deactivation flag                              | **VERIFIED** |
| `description`    | String   | Max 500 chars, optional                   | Furnishings or orientation notes                    | **VERIFIED** |
| `photos`         | String[] | Default `[]`                              | Public image URLs of room interior                  | **VERIFIED** |
| `beds`           | Subdoc[] | Array matching `sharingType`              | Subdocuments with `bedId`, `isOccupied`, `tenantId` | **VERIFIED** |
| `roomAmenities`  | Subdoc[] | Array matching `AppConfig` defs           | Non-per-floor amenity operational health            | **VERIFIED** |
| `occupancyCount` | Number   | Default `0`                               | Auto-derived count of occupied beds                 | **VERIFIED** |

- **Indexes Verified**:
  - `{ roomNumber: 1 }` (unique: true)
  - `{ floorId: 1 }`
  - `{ sharingType: 1 }`
  - `{ isActive: 1 }`
  - `{ 'beds.isOccupied': 1 }`
  - `{ 'roomAmenities.amenityKey': 1 }`

---

## 4. API Endpoints & Operational Status

All endpoints mounted under `/api/v1/rooms`:

| Method   | Route        | Auth Guard |  Role   | Description                                                                            |   Status    |
| -------- | ------------ | :--------: | :-----: | -------------------------------------------------------------------------------------- | :---------: |
| `GET`    | `/`          |    Yes     |   All   | Paginated room directory with search, floor, and sharing filters                       | **WORKING** |
| `GET`    | `/available` |    Yes     |   All   | Returns active rooms containing at least one unoccupied bed slot                       | **WORKING** |
| `GET`    | `/:id`       |    Yes     |   All   | Single room details with populated floor and bed tenant names                          | **WORKING** |
| `POST`   | `/`          |    Yes     | `admin` | Creates room, materializes beds, recounts floor, records audit log                     | **WORKING** |
| `PUT`    | `/:id`       |    Yes     | `admin` | Updates room; executes transactional bed rebuild on sharing change; records audit log  | **WORKING** |
| `DELETE` | `/:id`       |    Yes     | `admin` | Verifies zero active tenants; soft-deactivates room; recounts floor; records audit log | **WORKING** |

---

## 5. Closed Remediations Summary

- **RM-P1-1: Administrative Audit Logging**:
  - Implemented `writeAuditLog` across `POST /rooms` (`action: 'create'`), `PUT /rooms/:id` (`action: 'update'`), and `DELETE /rooms/:id` (`action: 'delete'`) in `apps/api/src/routes/rooms.ts`.
- **RM-P1-2: MongoDB Session Transaction on Sharing Downsize**:
  - Enforced `session.withTransaction` during room sharing updates and occupant bed remapping (`rebuildBedsForSharingType`) in `apps/api/src/routes/rooms.ts`, guaranteeing atomicity under concurrency.
- **RM-P2-1: Dynamic Monthly Rent Auto-Prefill**:
  - Wired `AppConfig.roomPricing` in `apps/web/src/app/(admin)/rooms/new/page.tsx` to automatically populate and adjust default monthly rent when switching sharing types.
- **RM-P2-2: Standardized Floor Selection**:
  - Migrated `apps/web/src/app/(admin)/rooms/[id]/edit/page.tsx` from raw manual floor fetch to standardized `<ResourceSelect endpoint="floors" labelKey={floorLabel} />`.
- **RM-P2-3: Form & Table Accessibility**:
  - Added explicit `aria-label` attributes to the room search input, sharing type filter, status filter, and all numeric inputs across list, new, and edit pages.
- **RM-P2-4: Direct Tenant Assignment Onboarding CTA**:
  - Added an "Assign Tenant" link on available bed cards in `apps/web/src/app/(admin)/rooms/[id]/page.tsx` directing straight to `/tenants/new?roomId=${room._id}&bedId=${bed.bedId}`.
- **Bed Matrix Feature Addition**:
  - Integrated `BedOccupancyGrid` into `apps/web/src/app/(admin)/rooms/page.tsx`, offering administrators an interactive visual floor-by-floor occupancy overview alongside the classic table view.

---

## 6. Acceptance Checklist (Audit Pass 1 Verified)

- [x] Admin Next.js web vs resident Flutter mobile boundaries verified against active source code.
- [x] Mongoose model schema, subdocuments, indexes, and lifecycle hooks verified.
- [x] All 6 HTTP endpoints in `rooms.ts` audited and hardened with transactions and audit logs.
- [x] Sharing reconfiguration algorithm verified with occupant downsize guards.
- [x] Admin Web pages (`/rooms`, `/new`, `/[id]`, `/[id]/edit`) standardized with design system components.
- [x] Direct onboarding navigation verified from available room bed cards.
- [x] Full accessibility `aria-label`s implemented on inputs and filters.
- [x] Verified clean via `bun run typecheck`, `bun run lint` (`oxlint`), and `flutter analyze`.
