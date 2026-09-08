# Beds & Bed Allocation -- Feature Audit

**Audit Pass:** 1  
**Audit Timestamp:** 2026-09-08T03:36:00+05:30 (Asia/Kolkata)  
**Module:** Beds & Bed Allocation Management (A-Z Phase 1: Module 5)  
**Audit Status:** Complete & Remediated (Pass 1)  
**Grade:** A+  
**Priority:** All P1 & P2 Remediations Closed

---

## 1. Executive Summary & Product Split

The Beds & Bed Allocation module governs individual tenant capacity, bed slot tracking ('A', 'B', 'C', 'D'), vacancy discovery, atomic room/bed onboarding, intra-room bed swaps, cross-room tenant transfers, checkout vacancy release, and post-checkout reinstatement across the Tenet PG Management platform.

Beds are modeled as embedded subdocument arrays within `Room` documents, while active tenants hold an explicit foreign reference (`roomId` and `bedId`). Occupancy counts are dynamically derived and synchronized with floors and operational dashboards.

### Product Split & Access Boundary Matrix

| Surface                          | Allowed Roles                     | Platform                | Route / URL                                                                                                      | Role Enforcement Mechanism                                                                                                                                                          |
| -------------------------------- | --------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin Web                        | `admin` only                      | Next.js (`apps/web`)    | `/rooms`, `/rooms/[id]`, `/rooms/new`, `/rooms/[id]/edit`, `/tenants/new`, `/tenants/[id]/edit`, `/tenants/[id]` | Admin layout auth guard rejects non-admin; redirects to login.                                                                                                                      |
| Resident Mobile (Tenant)         | `tenant` only                     | Flutter (`mobile/`)     | `/tenant/home`, `/tenant/profile`                                                                                | Role route guard in `app_router.dart`, token auth. Read-only placement badge on Home and full details on Profile.                                                                   |
| Resident Mobile (Guardian)       | `guardian` only                   | Flutter (`mobile/`)     | `/guardian` (Ward Screen)                                                                                        | Role route guard in `app_router.dart`, token auth. Read-only view of ward's assigned room and bed.                                                                                  |
| Visitor Desk                     | None                              | Flutter (`mobile/`)     | N/A                                                                                                              | Excluded by product design. Bed details are strictly confidential to PG management and assigned residents.                                                                          |
| Core API (Rooms & Beds)          | `admin` (write), all roles (read) | Bun + Hono (`apps/api`) | `/api/v1/rooms/*`                                                                                                | `authGuard` on read routes (`/`, `/available`, `/:id`); `adminOnly` on mutations (`POST /`, `PUT /:id`, `DELETE /:id`).                                                             |
| Core API (Tenant Bed Allocation) | `admin` only                      | Bun + Hono (`apps/api`) | `/api/v1/tenants/*`                                                                                              | `authGuard` + `adminOnly` on onboarding (`POST /`), transfer (`PUT /:id`), checkout (`POST /:id/checkout`), reinstatement (`POST /:id/reinstate`), and hard delete (`DELETE /:id`). |
| Core API (Self Bed Visibility)   | `tenant`, `guardian`              | Bun + Hono (`apps/api`) | `/api/v1/tenants/me`, `/api/v1/guardians/me/ward`                                                                | `authGuard`, restricted to the authenticated user's own record or ward record.                                                                                                      |

- **Strict Product Boundary Verification**:
  - Non-admin users cannot access any admin Next.js web routes under `/rooms/*` or `/tenants/*`.
  - Tenants cannot modify their bed assignment; they inspect their assigned bed letter via `/tenant/home` and `/tenant/profile`.
  - Guardians cannot mutate beds or reassign wards; they inspect the ward's bed on `/guardian`.
  - Visitors have zero access to room or bed data.
- **Feature Flags**:
  - Beds and rooms constitute fundamental physical inventory and capacity infrastructure. They are NOT gated by operational feature flags and remain permanently active.

---

## 2. Source Code Map

| Layer                      | File Path                                                     | Responsibilities & Coverage                                                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room Model                 | `apps/api/src/models/room.ts`                                 | Schema definition, `IBedSubdoc` (`bedId`, `isOccupied`, `tenantId`), `BED_IDS` enum `['A', 'B', 'C', 'D']`, `generateBeds` static method, pre-save occupancy calculation hook, post-save floor sync.                                                                                                     |
| Tenant Model               | `apps/api/src/models/tenant.ts`                               | Schema definition, `bedId` enum `['A', 'B', 'C', 'D']`, compound partial unique index `unique_active_room_bed` on `{ roomId: 1, bedId: 1 }` where `isActive: true`.                                                                                                                                      |
| Floor Model                | `apps/api/src/models/floor.ts`                                | Schema definition, `totalRooms` aggregation counter maintained by room lifecycle hooks.                                                                                                                                                                                                                  |
| Core Room Routes           | `apps/api/src/routes/rooms.ts`                                | Hono router mounted at `/api/v1/rooms`: paginated room list, available rooms with vacant beds (`/available`), room details with occupant tenant names (`/:id`), room creation (`POST /`), atomic sharing type downsize/rebuild (`PUT /:id`), soft deletion with occupant block (`DELETE /:id`).          |
| Core Tenant Routes         | `apps/api/src/routes/tenants.ts`                              | Hono router mounted at `/api/v1/tenants`: onboarding vacancy check and bed reservation (`POST /`), atomic room transfer and intra-room bed swap (`PUT /:id`), checkout bed release (`POST /:id/checkout`), reinstatement bed re-occupation (`POST /:id/reinstate`), hard delete cleanup (`DELETE /:id`). |
| Dashboard Routes           | `apps/api/src/routes/dashboard.ts`                            | Aggregates room and bed occupancy statistics for the admin dashboard including `totalBeds` and `occupiedBeds`.                                                                                                                                                                                           |
| Shared Room Types          | `packages/types/src/room.ts`                                  | TypeScript definitions: `SharingType` (`2                                                                                                                                                                                                                                                                | 3   | 4`), `IBed` (`bedId`, `isOccupied`, `tenantId`), `IRoom`, `IRoomCreate`, `IRoomWithOccupants`. |
| Shared Tenant Types        | `packages/types/src/tenant.ts`                                | TypeScript definitions: `ITenant`, `ITenantCreate`, `ITenantTransfer`.                                                                                                                                                                                                                                   |
| Shared Dashboard Types     | `packages/types/src/dashboard.ts`                             | TypeScript definitions: `IDashboardOccupancyStats` (`totalRooms`, `totalBeds`, `occupiedBeds`, `vacancyRate`).                                                                                                                                                                                           |
| Admin Room List Page       | `apps/web/src/app/(admin)/rooms/page.tsx`                     | ViewMode toggle (`List` vs `Bed Matrix`), filters (search, sharing, status), data table, and integration with `BedOccupancyGrid`.                                                                                                                                                                        |
| Admin Bed Matrix View      | `apps/web/src/components/ui/BedOccupancyGrid.tsx`             | Floor-grouped interactive bed allocation heatmap with capacity metrics and direct assignment shortcuts.                                                                                                                                                                                                  |
| Admin Room Detail Page     | `apps/web/src/app/(admin)/rooms/[id]/page.tsx`                | Occupancy DonutChart, Current Tenants table with direct links, and Bed Allocations visual grid card list.                                                                                                                                                                                                |
| Admin Room Create Page     | `apps/web/src/app/(admin)/rooms/new/page.tsx`                 | Room creation form with Sharing Type selector (2, 3, 4) auto-generating initial vacant beds.                                                                                                                                                                                                             |
| Admin Room Edit Page       | `apps/web/src/app/(admin)/rooms/[id]/edit/page.tsx`           | Room update form with sharing type selector, live occupancy indicator, and pre-submit downsize guard.                                                                                                                                                                                                    |
| Admin Bed Picker Component | `apps/web/src/components/ui/OccupancyBedPicker.tsx`           | Reactive dropdown component fetching room bed status, disabling occupied beds, and rendering "(Occupied)" labels.                                                                                                                                                                                        |
| Admin Tenant Create Page   | `apps/web/src/app/(admin)/tenants/new/page.tsx`               | Tenant onboarding form featuring `ResourceSelect` for room and `OccupancyBedPicker` for bed slot.                                                                                                                                                                                                        |
| Admin Tenant Edit Page     | `apps/web/src/app/(admin)/tenants/[id]/edit/page.tsx`         | Tenant transfer interface with room and bed selection, preventing transfers for inactive tenants.                                                                                                                                                                                                        |
| Admin Tenant Detail Page   | `apps/web/src/app/(admin)/tenants/[id]/page.tsx`              | Displays tenant room and bed assignment, checkout action, and reinstatement dialog with fallback room/bed picker.                                                                                                                                                                                        |
| Admin Dashboard Page       | `apps/web/src/app/(admin)/dashboard/page.tsx`                 | Occupancy stat card showing occupied/totalBeds, occupancy sparkline, and last 6 months occupancy trend chart.                                                                                                                                                                                            |
| Flutter Tenant Home Screen | `mobile/lib/features/tenant/presentation/home_screen.dart`    | Displays tenant room and bed placement badge beside greeting, linking directly to profile.                                                                                                                                                                                                               |
| Flutter Tenant Profile     | `mobile/lib/features/tenant/presentation/profile_screen.dart` | Read-only presentation of room number and bed letter under 'Room & Rent' card.                                                                                                                                                                                                                           |
| Flutter Guardian Ward      | `mobile/lib/features/guardian/presentation/ward_screen.dart`  | Read-only presentation of ward's room number and bed letter under 'Tenant' card.                                                                                                                                                                                                                         |
| Test Suite (Beds)          | `apps/api/src/__tests__/beds.test.ts`                         | Integration tests verifying all 7 critical consistency paths across room beds and tenant models.                                                                                                                                                                                                         |
| Test Suite (Transfers)     | `apps/api/src/__tests__/tenant-transfer.test.ts`              | Integration tests verifying transaction rollback when transferring to an occupied bed.                                                                                                                                                                                                                   |

---

## 3. Data Model Audit

### 3.1 Subdocument: `IBedSubdoc` (`apps/api/src/models/room.ts`)

Beds are maintained as an embedded subdocument array within each `Room`:

```typescript
const BED_IDS = ['A', 'B', 'C', 'D'] as const;

export interface IBedSubdoc {
  bedId: 'A' | 'B' | 'C' | 'D';
  isOccupied: boolean;
  tenantId: Schema.Types.ObjectId | null;
}
```

| Field        | Type     | Constraints & Defaults                 | Working Status                                                           |
| ------------ | -------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `bedId`      | String   | Required, Enum: `['A', 'B', 'C', 'D']` | Working. Enforced across schema and UI.                                  |
| `isOccupied` | Boolean  | Default: `false`                       | Working. Maintained on create, transfer, checkout, and reinstate.        |
| `tenantId`   | ObjectId | Ref: `'Tenant'`, Default: `null`       | Working. Null when vacant; populated with tenant ObjectId when occupied. |

### 3.2 Schema: `Room` (`apps/api/src/models/room.ts`)

| Field            | Type          | Constraints & Defaults                    | Working Status                                   |
| ---------------- | ------------- | ----------------------------------------- | ------------------------------------------------ |
| `roomNumber`     | String        | Required, unique, uppercase, max 20 chars | Working. Indexed unique.                         |
| `floorId`        | ObjectId      | Ref: `'Floor'`, Required                  | Working. Populated across API and UI.            |
| `sharingType`    | Number        | Required, Enum: `[2, 3, 4]`               | Working. Controls bed capacity.                  |
| `monthlyRent`    | Number        | Required, Min: 1000, Max: 50000           | Working.                                         |
| `beds`           | `[bedSchema]` | Array of `IBedSubdoc`                     | Working. Enforces `beds.length === sharingType`. |
| `occupancyCount` | Number        | Default: 0                                | Working. Recomputed in `pre('save')` hook.       |
| `isActive`       | Boolean       | Default: `true`                           | Working. Soft delete flag.                       |

- **Indexes Verified**:
  - `{ floorId: 1 }` -- operational.
  - `{ sharingType: 1 }` -- operational.
  - `{ isActive: 1 }` -- operational.
  - `{ 'beds.isOccupied': 1 }` -- operational.

### 3.3 Schema: `Tenant` (`apps/api/src/models/tenant.ts`)

| Field         | Type     | Constraints & Defaults                 | Working Status                                            |
| ------------- | -------- | -------------------------------------- | --------------------------------------------------------- |
| `roomId`      | ObjectId | Ref: `'Room'`, Required, Indexed       | Working.                                                  |
| `bedId`       | String   | Required, Enum: `['A', 'B', 'C', 'D']` | Working.                                                  |
| `isActive`    | Boolean  | Default: `true`, Indexed               | Working.                                                  |
| `moveInDate`  | Date     | Required                               | Working.                                                  |
| `moveOutDate` | Date     | Default: `null`                        | Working. Stamped upon checkout; cleared on reinstatement. |

- **Database-Level Partial Unique Index**:
  - `unique_active_room_bed`: `{ roomId: 1, bedId: 1 }` with `{ unique: true, partialFilterExpression: { isActive: true } }`. Working and tested.

---

## 4. Feature Listing & Lifecycle Status

| Feature ID | Feature Description                     | Surface                             | Status  | Verification Details                                                      |
| ---------- | --------------------------------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------- |
| BED-F01    | Bed generation on room creation         | Backend API                         | Working | `Room.generateBeds` generates vacant bed slots matching sharing type.     |
| BED-F02    | Onboarding bed reservation              | Backend API & Admin Web             | Working | Validates vacancy, reserves bed, links tenantId, updates occupancyCount.  |
| BED-F03    | Cross-room atomic transfer              | Backend API & Admin Web             | Working | Checks target bed vacancy before releasing source bed in transaction.     |
| BED-F04    | Intra-room bed swap                     | Backend API & Admin Web             | Working | Validates slot vacancy within room, frees old slot, reserves new slot.    |
| BED-F05    | Vacancy release on checkout             | Backend API & Admin Web             | Working | Frees bed slot, clears tenantId, decrements occupancy count.              |
| BED-F06    | Reinstatement with bed fallback         | Backend API & Admin Web             | Working | Re-occupies original bed or accepts alternate room/bed if occupied.       |
| BED-F07    | Bed picker with disabled occupied slots | Admin Web                           | Working | `OccupancyBedPicker` dynamically labels and disables occupied beds.       |
| BED-F08    | Room deletion active occupant check     | Backend API                         | Working | Rejects room deletion with 409 if any beds are occupied.                  |
| BED-F09    | Sharing type downsize guard (API)       | Backend API                         | Working | Rejects sharing reduction with 409 if occupied beds exceed new capacity.  |
| BED-F10    | Pre-submit downsize warning (UI)        | Admin Web (`/rooms/[id]/edit`)      | Working | Real-time warning and disabled submit when occupants exceed sharing type. |
| BED-F11    | PG-wide bed heatmap matrix              | Admin Web (`/rooms`)                | Working | `BedOccupancyGrid` floor-grouped matrix with interactive bed chips.       |
| BED-F12    | List vs Bed Matrix view toggle          | Admin Web (`/rooms`)                | Working | Seamless toggle matching complaints page design pattern.                  |
| BED-F13    | Dashboard total beds alignment          | API & Admin Web (`/dashboard`)      | Working | Correctly calculates and renders `occupiedBeds / totalBeds`.              |
| BED-F14    | Tenant mobile room & bed home badge     | Resident Mobile (`/tenant/home`)    | Working | Compact badge linking to profile showing room and bed assignment.         |
| BED-F15    | Tenant mobile profile room & rent card  | Resident Mobile (`/tenant/profile`) | Working | Displays room number, bed letter, rent, deposit, move-in date.            |
| BED-F16    | Guardian mobile ward bed visibility     | Resident Mobile (`/guardian`)       | Working | Displays ward room number and bed letter.                                 |

---

## 5. Acceptance Checklist (Audit Pass 1)

- [x] Bed data model verified against source (`bedId: 'A' | 'B' | 'C' | 'D'`, `isOccupied`, `tenantId`)
- [x] Database partial unique index `unique_active_room_bed` verified on `{ roomId: 1, bedId: 1 }`
- [x] Dynamic sharing type downsize protection verified (`rebuildBedsForSharingType`)
- [x] Room deletion blocked when active occupants exist (`ACTIVE_TENANTS` 409 conflict)
- [x] Atomic cross-room transfer and intra-room bed swap verified in database transaction
- [x] Checkout frees bed slot and decrements occupancy count
- [x] Reinstatement workflow verified with fallback bed picker if original is occupied
- [x] OccupancyBedPicker UI component verified in tenant onboarding and edit forms
- [x] Read-only room and bed presentation verified on Flutter Tenant and Guardian surfaces
- [x] Visitor desk role exclusion verified
- [x] [BED-GAP-1] Dashboard totalBeds calculation and display corrected across API, types, and admin web
- [x] [BED-GAP-2] PG-wide bed occupancy matrix/heatmap component implemented on `/rooms` (`BedOccupancyGrid.tsx`)
- [x] [BED-GAP-3] Pre-submit occupancy indicator and downsize guard added to `/rooms/[id]/edit` form
- [x] [BED-GAP-4] Room and bed badge added to Flutter tenant home screen (`home_screen.dart`)
