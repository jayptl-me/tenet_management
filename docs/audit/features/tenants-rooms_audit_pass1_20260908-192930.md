# Tenants and Rooms - Audit Pass 1

Module: tenants-rooms (Floors + Rooms + Beds + Tenants as one product surface: physical inventory and resident lifecycle)
Scope: apps/web admin pages + apps/api routes/models + shared types + shared UI components
Source verified: 2026-09-08 (live code, no markdown relied on for status)
Marker: pass1_20260908-192930

## 1. Module Scope and Access

| Surface | Route | Status |
| ------- | ----- | ------ |
| Floors list/detail/create/edit | /floors, /floors/[id], /floors/new, /floors/[id]/edit | WORKING (rebuilt earlier pass; two data-correctness gaps found) |
| Rooms list + Bed Matrix | /rooms (table and matrix toggle) | WORKING WITH GAPS |
| Room detail | /rooms/[id] | WORKING |
| Room create/edit | /rooms/new, /rooms/[id]/edit | WORKING WITH GAPS |
| Tenants list | /tenants | WORKING WITH GAPS |
| Tenant detail | /tenants/[id] | WORKING WITH GAPS |
| Tenant create/edit | /tenants/new, /tenants/[id]/edit | WORKING WITH GAPS |

Access: all pages behind AdminLayout admin-only guard. API: floors/rooms/tenants mutations adminOnly; rooms list/detail authGuard (tenant portal reads own room); tenants list adminOnly; tenant self-read via assertAdminOrTenantOwner. Portal boundaries respected; no Next tenant routes exist.

## 2. API and DB Dependencies (verified)

| Dependency | Location | Contract | Status |
| ---------- | -------- | -------- | ------ |
| Floor CRUD | apps/api/src/routes/floors.ts | GET list (all), GET/:id, POST, PUT/:id (strips totalRooms), DELETE/:id with FLOOR_HAS_ROOMS + FLOOR_HAS_MACHINES 409s, POST /reseed-services | WORKING |
| Room CRUD | apps/api/src/routes/rooms.ts | GET list (paginated, tenantName-enriched beds), GET /available (unused), GET /reconcile-occupancy dry-run + POST, GET/:id, POST, PUT/:id (sharingType rebuild txn, BEDS_OCCUPIED_ON_DOWNSIZE, CONCURRENT_MODIFICATION), DELETE soft with ACTIVE_TENANTS 409 | WORKING |
| Tenant CRUD + lifecycle | apps/api/src/routes/tenants.ts | POST (txn User+Tenant+bed occupy+enquiry convert, temp password), GET list (search/isActive/roomId/floorId), GET/:id, PUT/:id (atomic transfer/bed swap), POST /:id/checkout (dues + pending-payment gates, frees bed, deactivates user+guardians), POST /:id/reinstate (free-or-self bed), POST /:id/documents (Cloudinary), POST /:id/verify-kyc, GET /:id/payments /complaints /invoices /dues /activity, DELETE /:id (full cascade + Cloudinary cleanup) | WORKING |
| Models | models/room.ts, floor.ts, tenant.ts, user.ts | beds[] subdocs A-D, beds.length==sharingType validator, occupancyCount pre-save, Floor.totalRooms post-save sync, unique_active_room_bed partial index, User.email/phone unique + regex | WORKING |
| Reconcile service | services/occupancy-reconcile.service.ts | Rebuilds beds[] from active tenants; conflicts keep earliest move-in; orphans + invalid rooms reported | WORKING |

## 3. Ruthless Page-by-Page Findings

### 3.1 Floors list (/floors/page.tsx)

| Finding | Severity | Status |
| ------- | -------- | ------ |
| Rooms fetched with limit=500 and client-side per-floor aggregation; page beyond 500 silently drops rooms from stats | P1 | GAP |
| OccupancyRing/occupancy bars computed from client-side beds arrays; correct only within first 500 rooms | P1 | GAP (same root cause) |
| Stat strip, FloorCard grid, table view, search, sort, view toggle, delete guards | - | WORKING |

### 3.2 Rooms list (/rooms/page.tsx)

| Finding | Severity | Status |
| ------- | -------- | ------ |
| No server-driven stats; no building-wide KPI strip (rooms/beds/occupied/vacant/rate) on table view | P2 | GAP |
| floorId deep-link from floors detail (/rooms?floorId=X) ignored: floor filter state initializes empty, so the filter is not applied | P1 | GAP |
| Bed Matrix ignores perPage (fetches perPage rows, matrix shows fewer than table) | P2 | GAP |
| Filters, CSV export, availability filter, reconcile flow, mobile cards, empty states | - | WORKING |

### 3.3 Room detail (/rooms/[id]/page.tsx)

| Finding | Severity | Status |
| ------- | -------- | ------ |
| Amenity health shown as an abstract stacked bar (counts only); FloorServiceGrid exists but is unused here | P2 | GAP |
| Occupancy donut, current tenants table, bed allocation cards with Assign links, floor link, notes, photos | - | WORKING |

### 3.4 Room create/edit

| Finding | Severity | Status |
| ------- | -------- | ------ |
| Edit page backHref=/rooms and cancelHref=/rooms; loses detail context (tenants edit returns to detail) | P3 | GAP |
| Rent auto-default from app-config roomPricing, downsize guard banner + submit block, photo URL line validation, amenity status selects | - | WORKING |

### 3.5 Tenants list (/tenants/page.tsx)

| Finding | Severity | Status |
| ------- | -------- | ------ |
| Room column shows only room number; floor context missing although API populates room (room.floor not requested/populated in list) | P3 | GAP |
| Search, status filter, floor filter, CSV export, pagination, delete confirm | - | WORKING |

### 3.6 Tenant detail (/tenants/[id]/page.tsx)

| Finding | Severity | Status |
| ------- | -------- | ------ |
| Checkout modal is a hand-rolled fixed-overlay div: no role=dialog/aria-modal/labelledby, no focus trap, no Escape handling | P2 | GAP |
| Delete from list shows generic "cannot be undone" copy; cascade deletes payments/invoices/guardians etc. without surfacing counts | P2 | GAP |
| No printable tenancy summary (statement) action | P3 | GAP |
| Dues modal with per-invoice links, reinstate + placement picker, KYC upload/verify, activity timeline, stay calendar, related cards | - | WORKING |

### 3.7 Tenant create/edit

| Finding | Severity | Status |
| ------- | -------- | ------ |
| Create: roomId+bedId deep-link prefill works; temp credentials dialog works; emergency contact all-or-none validation works | - | WORKING |
| Edit: inactive lock banner works; room/bed transfer works | - | WORKING |

### 3.8 Shared components

| Finding | Severity | Status |
| ------- | -------- | ------ |
| OccupancyBedPicker ignores room.beds when beds array is empty for a sharingType mismatch; falls back to A-D slice; acceptable | P4 | OK |
| SearchableSelect fetches endpoint without limit param; floors endpoint returns full list so floor/room pickers are fine | P4 | OK |
| DataTable, StatCard, DetailCard, FormCard/Section/Grid/Actions, PageHeader, ErrorBanner, EmptyState, ConfirmModal, TempCredentialsDialog, BedMiniGrid, OccupancyRing, FloorCard, TenantStayCalendar, TenantActivityTimeline | - | WORKING |

## 4. Missing Components

| Component | Need | Status |
| --------- | ---- | ------ |
| RoomOccupancyStatsStrip | Server-aggregated building-wide bed KPIs for rooms list | MISSING (P2) |
| FloorRoomsResponse | API: GET /floors/:id/rooms returning rooms + per-floor + global occupancy aggregates (single source of truth for floors list and rooms matrix) | MISSING (P1) |
| RoomAmenityHealthGrid slot | Reuse FloorServiceGrid on room detail (floor-scoped services) instead of abstract stacked bar | MISSING wiring (P2) |
| CheckoutDialog (accessible) | role=dialog + focus trap + Escape for tenant checkout modal | MISSING (P2) |
| TenantDeleteDialog (cascade-aware) | Shows cascade counts (payments/invoices/guardians) before hard delete | MISSING (P2) |
| TenantStatementPrint | Print-friendly tenancy summary | MISSING (P3) |

## 5. Broken End-to-End Flows

| Flow | Break | Fix |
| ---- | ----- | ---- |
| Floors detail -> View all rooms for this floor | /rooms?floorId=X drops the filter on load | Initialize floorFilter from searchParams |
| Floors list stats beyond 500 rooms | Client-side aggregation truncates | Add GET /floors/:id/rooms with server-side aggregation; floors list consumes it per floor (bounded by floor count) |
| Rooms matrix completeness | Matrix limited by perPage | Matrix mode fetches limit=500 server-side (or consumes floors rooms endpoint) |
| Tenant hard delete confidence | Admin not told what will be cascade-deleted | Cascade-aware confirm dialog |

## 6. Prioritized Implementation Work

P0: none (no broken core CRUD; all lifecycle endpoints verified working end to end).

P1:
1. GET /floors/:id/rooms endpoint returning { floor, rooms, stats: { activeRooms, totalBeds, occupiedBeds, occupancyPct, potentialRent } }.
2. Rooms page: honor ?floorId= deep-link on mount.
3. Rooms matrix mode: fetch full active room set (limit=500) instead of perPage.

P2:
4. Rooms list: RoomOccupancyStatsStrip fed by the same server aggregation (global stats when no floor filter, floor stats when filtered).
5. Tenant checkout modal: accessible dialog (role/aria/focus trap/Escape) using existing Modal shell.
6. Tenant delete: cascade-aware ConfirmModal copy (enumerate what gets deleted).
7. Room detail: replace abstract amenity stacked bar with FloorServiceGrid (floor services with report-issue link).

P3:
8. Rooms edit: return to detail (/rooms/:id) for backHref/cancelHref/success push.
9. Tenants list: show floor label alongside room (populate room.floor in tenants list API).
10. Tenant detail: print statement action (window.print with print-scoped section).

P4: none blocking; shared components already token-driven and theme-safe.

## 7. Out of Scope

- guardians/payments/invoices/complaints module passes (only tenant-flow touchpoints above).
- Flutter portal edits (read-only mapping).
- GET /rooms/available wiring (unconsumed; documented).
- User.tenantId stale pointer cleanup on checkout/delete (auth-adjacent; separate pass).
