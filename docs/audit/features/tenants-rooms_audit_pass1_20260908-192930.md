# Tenants and Rooms - Audit Pass 1

Module: tenants-rooms (Floors + Rooms + Beds + Tenants as one product surface: physical inventory and resident lifecycle)
Scope: apps/web admin pages + apps/api routes/models + shared types + shared UI components
Source verified: 2026-09-08 (live code, no markdown relied on for status)
Marker: pass1_20260908-192930
Status: IMPLEMENTED - all P1/P2/P3 gaps closed, typecheck + lint green

## 1. Module Scope and Access

| Surface                        | Route                                                 | Status        |
| ------------------------------ | ----------------------------------------------------- | ------------- |
| Floors list/detail/create/edit | /floors, /floors/[id], /floors/new, /floors/[id]/edit | WORKING       |
| Floors overview aggregate      | API GET /floors/overview                              | WORKING (new) |
| Floors rooms aggregate         | API GET /floors/:id/rooms                             | WORKING (new) |
| Rooms list + Bed Matrix        | /rooms (table and matrix toggle)                      | WORKING       |
| Room detail                    | /rooms/[id]                                           | WORKING       |
| Room create/edit               | /rooms/new, /rooms/[id]/edit                          | WORKING       |
| Tenants list                   | /tenants                                              | WORKING       |
| Tenant detail                  | /tenants/[id]                                         | WORKING       |
| Tenant create/edit             | /tenants/new, /tenants/[id]/edit                      | WORKING       |
| Tenant statement PDF           | API GET /tenants/:id/statement.pdf                    | WORKING (new) |

Access: all pages behind AdminLayout admin-only guard. API: floors/rooms/tenants mutations adminOnly; rooms list/detail authGuard (tenant portal reads own room); tenants list adminOnly; tenant self-read via assertAdminOrTenantOwner (statement PDF also admin-or-self). Portal boundaries respected; no Next tenant routes exist.

## 2. API and DB Dependencies (verified)

| Dependency              | Location                                                | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status  |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Floor CRUD              | apps/api/src/routes/floors.ts                           | GET list, GET /overview (per-floor stats + beds + service health + open complaints, one shot), GET /:id, GET /:id/rooms ({ floor, rooms tenantName-enriched, stats }), POST (auto-seeds per-floor ServiceStatus), PUT/:id (strips totalRooms), DELETE/:id with FLOOR_HAS_ROOMS + FLOOR_HAS_MACHINES 409s, POST /reseed-services                                                                                                                                                                                                                                                                                                                    | WORKING |
| Room CRUD               | apps/api/src/routes/rooms.ts                            | GET list (paginated, tenantName-enriched beds, meta.stats aggregated over the FULL filtered set: totalRooms/activeRooms/totalBeds/occupiedBeds/vacantBeds/occupancyPct/potentialRent), GET /available (unconsumed), GET/POST /reconcile-occupancy, GET/:id, POST, PUT/:id (sharingType rebuild txn, BEDS_OCCUPIED_ON_DOWNSIZE, CONCURRENT_MODIFICATION), DELETE soft with ACTIVE_TENANTS 409                                                                                                                                                                                                                                                       | WORKING |
| Tenant CRUD + lifecycle | apps/api/src/routes/tenants.ts                          | POST (txn User+Tenant+bed occupy+enquiry convert, temp password), GET list (search/isActive/roomId/floorId; room populated WITH floor label), GET/:id, PUT/:id (atomic transfer/bed swap), POST /:id/checkout (dues + pending-payment gates, frees bed, deactivates user+guardians), POST /:id/reinstate (free-or-self bed), POST /:id/documents (Cloudinary), POST /:id/verify-kyc, GET /:id/payments /complaints /invoices /dues /activity, GET /:id/statement.pdf (admin-or-self; invoices with per-invoice remaining balances via getInvoiceBalance, payments, totals, StatementPdf template), DELETE /:id (full cascade + Cloudinary cleanup) | WORKING |
| Models                  | models/room.ts, floor.ts, tenant.ts, user.ts            | beds[] subdocs A-D, beds.length==sharingType validator, occupancyCount pre-save, Floor.totalRooms post-save sync, unique_active_room_bed partial index, User.email/phone unique + regex                                                                                                                                                                                                                                                                                                                                                                                                                                                            | WORKING |
| Reconcile service       | services/occupancy-reconcile.service.ts                 | Rebuilds beds[] from active tenants; conflicts keep earliest move-in; orphans + invalid rooms reported                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | WORKING |
| PDF templates           | apps/api/src/templates/InvoicePdf.tsx, StatementPdf.tsx | @react-pdf/renderer documents; statement includes stay period, invoices (month/number/total/balance/status), payments (date/method/amount/status), totals block (invoiced/paid/deposit held/outstanding)                                                                                                                                                                                                                                                                                                                                                                                                                                           | WORKING |

## 3. Page-by-Page Implementation State

### 3.1 Floors list (/floors/page.tsx)

- Single server-aggregated fetch: GET /floors/overview (stats + beds + services per floor). No client-side room join, no limit truncation.
- OccupancyRing + stat strip (floors/active rooms/potential rent/service issues), FloorCard grid with BedMiniGrid, table view with OccupancyBar, search, sort (floor/label/occupancy/rooms), view toggle, delete guards via ConfirmModal.
- FloorCard consumes floor.beds from the overview payload; occupancy math server-computed.

### 3.2 Rooms list (/rooms/page.tsx)

- Filter-aware KPI strip: OccupancyRing + StatCards (active rooms, vacant beds, tenants housed, potential rent) from meta.stats aggregated server-side over the full filtered set (not just the current page).
- floorId deep-link: /rooms?floorId=X (from floor detail "View all") seeds the floor filter on mount via useSearchParams.
- Bed Matrix fetches limit=500 when in matrix mode so the matrix shows the full matching set, not just the current page.
- Table view paginated (perPage); filters (search/sharing/status/floor/availability), CSV export, reconcile dry-run + apply with conflict/orphan/invalid-room drill-down links, mobile cards, empty states.

### 3.3 Room detail (/rooms/[id]/page.tsx)

- Occupancy donut, current tenants, bed allocation cards with Assign Tenant CTAs (deep-links /tenants/new?roomId&bedId), notes, photos.
- Floor Service Health card wired to FloorServiceGrid (floorId from populated room.floor) with report-issue deep-link to /complaints/new?category&roomId. Replaces the abstract amenity stacked bar; per-room amenity statuses remain editable in the room edit form.

### 3.4 Room create/edit

- Create: floor picker (ResourceSelect), rent auto-default from app-config roomPricing, downsize guard banner + submit block (edit), photo URL validation, amenity status selects.
- Edit: backHref/cancelHref/success push all return to /rooms/:id detail.

### 3.5 Tenants list (/tenants/page.tsx)

- Room column shows floor label + room number (API populates room.floor) + bed.
- Search, status filter, floor filter, CSV export, pagination, delete confirm with explicit cascade enumeration (payments, invoices, complaints, visitors, guardians + their portal logins, laundry slots, meal feedback, attendance, leaves; bed freed; login disabled; prefer Check Out).

### 3.6 Tenant detail (/tenants/[id]/page.tsx)

- Checkout modal rebuilt on the shared Modal shell: role=dialog, aria-modal, aria-labelledby, Escape-to-close, overlay click, scrollable, footer slot. Dues summary, per-invoice remaining balances with links, blocked/safe states unchanged.
- Statement of Account action: authenticated blob download of GET /tenants/:id/statement.pdf (window.open would omit JWT); loading state + toast error.
- Reinstate + alternate-bed placement picker (OccupancyBedPicker), KYC upload/verify, WhatsApp + copy info, guardians, recent payments/invoices/complaints, tenancy calendar, activity timeline.

### 3.7 Tenant create/edit

- Create: roomId+bedId deep-link prefill, temp credentials dialog, emergency contact all-or-none validation.
- Edit: inactive lock banner, room/bed transfer with BED_OCCUPIED handling.

## 4. Shared Components

OccupancyBedPicker, SearchableSelect (floors endpoint returns full list, fine), DataTable, StatCard, DetailCard, FormCard/Section/Grid/Actions, PageHeader, ErrorBanner, EmptyState, ErrorState, ConfirmModal, Modal (shared accessible dialog shell), TempCredentialsDialog, BedMiniGrid, OccupancyRing, FloorCard, FloorServiceGrid, TenantStayCalendar, TenantActivityTimeline - all token-driven and theme-safe.

## 5. End-to-End Flows (verified in source)

| Flow                                     | Path                                                                                                                                     | Status  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Floor -> rooms -> bed -> assign tenant   | FloorCard -> /floors/:id -> room card -> /rooms/:id -> Assign Tenant -> /tenants/new?roomId&bedId -> POST /tenants (txn) -> bed occupied | WORKING |
| Floor stats integrity                    | GET /floors/overview aggregates all rooms server-side                                                                                    | WORKING |
| Floor detail deep-link to filtered rooms | /floors/:id "View all" -> /rooms?floorId=X -> filter applied                                                                             | WORKING |
| Room KPI truthfulness                    | meta.stats over full filtered set regardless of page                                                                                     | WORKING |
| Checkout with dues gate                  | Modal -> GET /:id/dues -> blocked/safe -> POST /:id/checkout -> bed freed, user+guardians deactivated                                    | WORKING |
| Statement of account                     | Button -> authenticated blob -> GET /tenants/:id/statement.pdf -> StatementPdf render                                                    | WORKING |
| Hard delete cascade warning              | ConfirmModal enumerates cascade -> DELETE /:id cascade in txn                                                                            | WORKING |
| Occupancy drift repair                   | Reconcile button -> dry-run/apply -> conflicts/orphans listed with drill-down links                                                      | WORKING |

## 6. Remaining Notes (non-blocking)

- GET /rooms/available remains unconsumed by admin UI (available to portals/integrations).
- User.tenantId stale pointer cleanup on checkout/delete is auth-adjacent; separate pass.
- Bed Matrix limit=500 is a pragmatic bound; /floors/overview exists if the matrix ever needs a server-driven path.

## 7. Out of Scope

- guardians/payments/invoices/complaints module passes (only tenant-flow touchpoints above).
- Flutter portal edits (read-only mapping).
