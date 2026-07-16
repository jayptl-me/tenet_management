# FE Batch 1 Audit -- Tenants, Rooms, Floors, Guardians, Attendance

> **SUPERSEDED 2026-07-16.** Authoritative backlog: [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) and per-module [features/](./features/). Keep this file as historical adversarial notes only; do not treat open rows here as current without re-check against source.

> Adversarial frontend audit against live API Zod schemas and route handlers.
> Code is truth. Generated 2026-07-16. Read-only; product code not modified.

## Scope

| Module | Admin pages | API route |
|--------|-------------|-----------|
| Tenants | `apps/web/src/app/(admin)/tenants/**` | `apps/api/src/routes/tenants.ts` |
| Rooms | `apps/web/src/app/(admin)/rooms/**` | `apps/api/src/routes/rooms.ts` |
| Floors | `apps/web/src/app/(admin)/floors/**` | `apps/api/src/routes/floors.ts` |
| Guardians | `apps/web/src/app/(admin)/guardians/**` | `apps/api/src/routes/guardians.ts` |
| Attendance | `apps/web/src/app/(admin)/attendance/**` | `apps/api/src/routes/attendance.ts` |

---

## Findings

| Severity | Module | Page | Field/Flow | Problem | Evidence (file:line) | Suggested fix |
|----------|--------|------|------------|---------|----------------------|---------------|
| P1 | Attendance | List | Search filter | FE sends `search` query param; API list handler only accepts `status`, `date`, `tenantId`. Search by tenant name is a no-op. | FE: `attendance/page.tsx:50`; API: `attendance.ts:212-221` (no `search`) | Add server-side name search (join/populate tenant user) or remove the search input; alternatively resolve tenant IDs client-side then filter by `tenantId`. |
| P1 | Attendance | List | Status filter enum | Filter offers `late` which is not in API status enum (`present`, `absent`, `on_leave`, `not_returned`). Selecting Late always yields empty results. Missing `not_returned` option. | FE: `attendance/page.tsx:171-177`; API: `attendance.ts:29` | Replace `late` with `not_returned`; align options with API enum. |
| P1 | Guardians | New | Prefill `tenantId` from query | Tenant detail deep-links to `/guardians/new?tenantId=...` but New Guardian form never reads `useSearchParams` / `tenantId`. Admin must re-select tenant. | Tenant detail: `tenants/[id]/page.tsx:413`; New: `guardians/new/page.tsx` (no searchParams) | Read `tenantId` from query, set as defaultValue on ResourceSelect; wrap in Suspense if needed. |
| P1 | Floors | List | Pagination | DataTable expects server-sliced pages; floors fetch loads entire list and never slices by `page`/`perPage`. Page controls change page number but still render all rows. | FE: `floors/page.tsx:42-50,143-158`; DataTable does not slice (`DataTable.tsx` renders full `data`) | Either slice client-side (`filtered.slice((page-1)*perPage, page*perPage)`) or add server pagination to GET `/floors`. |
| P1 | Rooms | Edit | sharingType downsize error | Changing sharingType when occupied beds exceed new size returns API `BEDS_OCCUPIED_ON_DOWNSIZE` (409). FE catch shows generic "Failed to update room" with no guidance. | FE: `rooms/[id]/edit/page.tsx:156-158`; API: `rooms.ts:311-318` | Parse API error body; surface conflict message; optionally disable lower sharing types when occupancy exceeds them. |
| P1 | Floors | Edit | `totalRooms` field | Edit form still collects and PUTs `totalRooms`, but API deliberately strips it (`// Strip totalRooms -- auto-synced by Room.post('save') hook`). Admins think they set capacity; value is ignored. | FE: `floors/[id]/edit/page.tsx:105-110,151-156`; API: `floors.ts:76-77` | Make `totalRooms` read-only on edit (display actual count); do not send it in PUT payload. |
| P2 | Tenants | List | Search UX | Search param hits API on every keystroke (no debounce); also only matches user name server-side. | `tenants/page.tsx:43-65` | Debounce 300ms; optional email/phone search if needed. |
| P2 | Tenants | Detail | Checkout with dues | Confirm Checkout stays enabled when unpaid invoices / totalDue > 0; API correctly 409s on unpaid invoices / unresolved payments. Admin gets generic failure after click. | FE: `tenants/[id]/page.tsx:615-622`; API: `tenants.ts:549-587` | Disable confirm when `unpaidInvoices.length > 0` or unresolved payments; show API error message from body. |
| P2 | Tenants | New / Edit | Emergency phone labels | Labels say "Phone (10 digits)" while validation/normalization expects full Indian mobile (+91). Confusing but works via `normalizeInPhone`. | `tenants/new/page.tsx:157`; `tenants/[id]/edit/page.tsx:177` | Label as "Indian mobile (+91...)" consistent with main phone field. |
| P2 | Tenants | Edit | Clear emergency contact | Omitting emergency fields sends `emergencyContact: undefined` (not sent). Existing EC cannot be cleared via UI; API merge also cannot null out. | FE: `tenants/[id]/edit/page.tsx:128-139`; API: `tenants.ts:423-427` | Add "Clear emergency contact" + API support if product needs it. |
| P2 | Tenants | Detail | Reinstate UX | Reinstate posts `/reinstate`; on bed occupied, generic error. No in-flow transfer before reinstate. | `tenants/[id]/page.tsx:193-207` | Link to edit for reassignment when BED_OCCUPIED; show API message. |
| P2 | Rooms | List / Delete | Soft delete messaging | DELETE soft-deactivates (`isActive: false`). Confirm modal says hard delete / "cannot be undone". Active tenants block with conflict; FE shows generic failure. | FE: `rooms/page.tsx:253-260,82-84`; API: `rooms.ts:338-376` | Rename action to "Deactivate"; surface ACTIVE_TENANTS message. |
| P2 | Rooms | New / Edit | Photos | API accepts `photos: string[]` URLs; no admin UI to add/remove photos (detail only displays if present). | API: `rooms.ts:31,41`; FE forms have no photos field | Optional: photo URL list or upload flow if product requires. |
| P2 | Rooms | Detail | Tenant links | Occupied beds show `tenantName` but no link to `/tenants/:id` (tenantId available on bed). | `rooms/[id]/page.tsx:243-256` | Link name to tenant detail when `tenantId` present. |
| P2 | Floors | Detail | Description block | UI supports `floor.description` but Floor model/schema has no `description` field; block never appears for real data. | FE: `floors/[id]/page.tsx:302-308`; model: `apps/api/src/models/floor.ts` (no description) | Remove dead UI or add field to schema + create/edit forms. |
| P2 | Floors | List / Delete | Delete error | FLOOR_HAS_ROOMS conflict returns generic "Failed to delete floor". | FE: `floors/page.tsx:69-71`; API: `floors.ts:100-107` | Surface conflict message. |
| P2 | Floors | New / Edit | Amenity max mismatch | API amenity count hard-max 10; FE uses `maxPerFloor` from app-config (default 10). If config sets max > 10, FE accepts values API rejects. | FE: `floors/new/page.tsx:20-24`; API: `floors.ts:18` | Cap FE max at min(maxPerFloor, 10) or raise API max to match config. |
| P2 | Guardians | List / Delete | Soft deactivate messaging | DELETE deactivates guardian + User (`isActive: false`); modal says permanent delete. | FE: `guardians/page.tsx:208-214`; API: `guardians.ts:400-423` | Label as "Deactivate guardian". |
| P2 | Guardians | New | Temp credentials UX | Inline password banner works; does not use shared `TempCredentialsDialog` (tenant flow does). Copy/close polish only. | `guardians/new/page.tsx:87-103` vs `tenants/new/page.tsx:162` | Reuse TempCredentialsDialog for consistency. |
| P2 | Attendance | New | checkIn/Out payload | Sends `HH:mm` time strings; API builds `new Date(\`${date}T${time}:00\`)` without timezone -- local/UTC skew possible for stored instants. | FE: `attendance/new/page.tsx:64-71`; API: `attendance.ts:197-198` | Prefer ISO with explicit offset or store as date+time fields consistently. |
| P2 | Attendance | List | Mobile delete | Desktop TableActions include delete; mobile card sets `showDelete={false}` -- inconsistent delete affordance. | `attendance/page.tsx:136-140` vs `249` | Align mobile/desktop actions. |
| P2 | Attendance | List | Date filter | API supports `date` query; list UI has no date picker filter (only status + dead search). | API: `attendance.ts:215`; FE list filters only search+status | Add date filter input bound to `date` query. |

### PASS rows (correctly wired)

| Severity | Module | Page | Field/Flow | Problem | Evidence (file:line) | Suggested fix |
|----------|--------|------|------------|---------|----------------------|---------------|
| PASS | Tenants | List | DataTable + filters + actions | List uses pagination (`page`/`limit`), `search`, `isActive`, view/edit/delete, empty/loading/error, `mobileCardRenderer`. Matches GET `/tenants`. | `tenants/page.tsx:43-220`; API `tenants.ts:249-341` | -- |
| PASS | Tenants | New | Create schema alignment | Fields: name, email, phone (+91 normalize), roomId, bedId, moveInDate (ISO), monthlyRent 1000-50000, depositPaid >=0, optional emergencyContact. Temp password dialog on `temporaryPassword`. | FE: `tenants/new/page.tsx:30-115`; API: `tenants.ts:54-69,226-233` | -- |
| PASS | Tenants | Edit | Update + transfer | Prefill from GET; PUT payload nested `user`, room/bed transfer, rent/deposit, emergency. Bed options filter occupied. Matches `updateTenantSchema`. | FE: `tenants/[id]/edit/page.tsx:125-141`; API: `tenants.ts:71-89,361-541` | -- |
| PASS | Tenants | Detail | Lifecycle actions | Checkout (dues GET + POST checkout), reinstate, documents upload, related guardians/payments/invoices/complaints, WhatsApp/copy. Routes exist. | FE: `tenants/[id]/page.tsx:158-207,326-399`; API: checkout/dues/reinstate/documents | -- |
| PASS | Tenants | Detail / Edit | Document upload | Multipart POST `tenants/:id/documents` with docType aadhaar/photo; FE DocumentUpload matches. | `DocumentUpload.tsx:47-49`; API `tenants.ts:686-797` | -- |
| PASS | Rooms | List | DataTable | Filters roomNumber, sharingType, isActive; CRUD actions; mobile cards; empty/error. | `rooms/page.tsx` | -- |
| PASS | Rooms | New | Create schema | roomNumber, floorId, sharingType 2/3/4, monthlyRent 1000-50000, description max 500, roomAmenities status enum. Matches createRoomSchema. | FE: `rooms/new/page.tsx:64-118`; API: `rooms.ts:25-33` | -- |
| PASS | Rooms | Edit | Update schema | All create fields + isActive; amenities prefilled from GET; PUT rooms/:id. | FE: `rooms/[id]/edit/page.tsx:62-153`; API: `rooms.ts:35-44` | -- |
| PASS | Rooms | Detail | Display | Beds, occupancy charts, amenities bar, floor link, photos if any. GET rooms/:id with tenant names. | `rooms/[id]/page.tsx`; API `rooms.ts:150-198` | -- |
| PASS | Rooms | API | sharingType rebuild | Backend rebuilds beds + remaps Tenant.bedId on sharing change; FE can change type (error UX is separate P1). | API: `rooms.ts:59-98,251-320` | -- |
| PASS | Floors | List | Core CRUD shell | PageHeader, search (client), TableActions, ConfirmModal, mobileCardRenderer, empty/error. | `floors/page.tsx` | -- |
| PASS | Floors | New | Create schema | label max 50, floorNumber >=0, totalRooms 1-50, amenityCounts from app-config. Matches createFloorSchema core. | FE: `floors/new/page.tsx:17-104`; API: `floors.ts:21-32` | -- |
| PASS | Floors | Detail | Rooms listing | Loads floor + rooms?floorId; links to room detail; add room with floorId prefill. | `floors/[id]/page.tsx:87-107,209-298`; rooms/new reads floorId | -- |
| PASS | Guardians | List | DataTable | Paginated GET with search; view/edit/delete; mobile cards; empty/error. | `guardians/page.tsx`; API `guardians.ts:211-253` | -- |
| PASS | Guardians | New | Create + credentials | tenantId, name, phone +91, email required, relation enum father/mother/guardian/other. Shows temporaryPassword. Matches createGuardianSchema. | FE: `guardians/new/page.tsx:19-77`; API: `guardians.ts:33-43,173-180` | -- |
| PASS | Guardians | Edit | Update schema | Whitelists name/phone/email/relation/isActive; tenant locked; emergency derived read-only. Matches updateGuardianSchema strictObject. | FE: `guardians/[id]/edit/page.tsx:94-103`; API: `guardians.ts:45-55` | -- |
| PASS | Guardians | Detail | Display + nav | Fields, emergency badge, link to tenant, edit. GET mapped shape. | `guardians/[id]/page.tsx` | -- |
| PASS | Attendance | List | Board + table | TodayAttendanceBoard hits `/attendance/today`; table uses status filter (partial), pagination, view/edit/delete. | `attendance/page.tsx`; `TodayAttendanceBoard.tsx` | -- |
| PASS | Attendance | New | Manual mark | POST `attendance/manual` with tenantId, date YYYY-MM-DD, status enum, method, optional checkIn/Out/notes. Aligns with manualSchema. | FE: `attendance/new/page.tsx:18-77`; API: `attendance.ts:26-34,178-208` | -- |
| PASS | Attendance | Edit | Update | Prefill; PUT with date/status/checkInTime/checkOutTime/notes. API accepts checkInTime aliases. | FE: `attendance/[id]/edit/page.tsx:124-131`; API: `attendance.ts:332-405` | -- |
| PASS | Attendance | Detail | Display | Status, times, method, recordedBy, notes. GET by id. | `attendance/[id]/page.tsx` | -- |
| PASS | Cross-cutting | Phone | normalizeInPhone | Shared helper produces `+91[6-9]\\d{9}` matching API regex on tenants/guardians. | `apps/web/src/lib/phone.ts`; API phone regex | -- |
| PASS | Cross-cutting | Feature flags | Guardians / Attendance | API routes gated by `guardianPortalEnabled` / `attendanceEnabled`; FE will 403 if disabled (expected). | `guardians.ts:97`; `attendance.ts:73` | -- |

---

## Module summary

### Tenants

| Area | Verdict |
|------|---------|
| List | Solid: filters, pagination, mobile cards, delete confirm |
| Detail | Strong lifecycle: checkout+dues, reinstate, docs, related entities |
| New | Schema-aligned; temp credentials; OccupancyBedPicker |
| Edit | Room/bed transfer + user nested update correctly shaped |
| Gaps | Checkout confirm UX; emergency clear; minor labels |

### Rooms

| Area | Verdict |
|------|---------|
| List | Complete |
| Detail | Rich occupancy UI |
| New / Edit | Schema-aligned including amenities |
| Gaps | Soft-delete copy; sharingType 409 message; no photos editor |

### Floors

| Area | Verdict |
|------|---------|
| List | UI complete but pagination broken for >perPage |
| Detail | Service grid + rooms table good |
| New | Schema-aligned for core + amenityCounts |
| Edit | totalRooms is a fake control (API strips it) |

### Guardians

| Area | Verdict |
|------|---------|
| List / Detail / Edit | Correctly wired to mapGuardian shape |
| New | Credentials flow works; missing query prefill from tenant |
| Gaps | Soft-delete wording; deep-link tenantId |

### Attendance

| Area | Verdict |
|------|---------|
| Today board | Correct `/attendance/today` |
| New / Edit / Detail | Manual + update schemas match |
| List filters | Search dead; `late` invalid; no date filter |

---

## Counts

| Severity | Open count |
|----------|------------|
| **P0** | **0** |
| **P1** | **6** |
| **P2** | **16** |
| PASS | 23 |

No P0 (happy path always fails / wrong endpoint / data integrity break on primary create flows). Create/edit happy paths for all five modules hit real routes with mostly correct Zod shapes.

---

## Priority fix list

1. **Attendance list filters** -- Fix status enum (`not_returned` not `late`); implement or remove search; add date filter (P1 + P2).
2. **Guardian new `?tenantId=` prefill** -- Honor deep link from tenant detail (P1).
3. **Floors list pagination** -- Client-slice or server-page so DataTable page controls work (P1).
4. **Room sharingType conflict UX** -- Surface `BEDS_OCCUPIED_ON_DOWNSIZE` (P1).
5. **Floor edit totalRooms** -- Read-only display; stop sending stripped field (P1).
6. **Soft-delete / deactivate copy** -- Rooms delete, Guardians delete (P2 batch).
7. **Tenant checkout confirm** -- Disable or hard-warn when unpaid invoices block checkout (P2).
8. **API error message passthrough** -- Prefer `error.message` from JSON over generic strings across modules (P2 systemic).

---

## API schema quick reference (batch 1)

### Tenants POST (`createTenantSchema`)
`name` min2 max100, `email`, `phone` +91, `roomId`, `bedId`, `moveInDate` ISO datetime, `monthlyRent` 1000-50000, `depositPaid` >=0 optional, `emergencyContact` optional {name,phone,relation}, optional aadhaarUrl/photoUrl URLs.

### Tenants PUT (`updateTenantSchema`)
Optional: monthlyRent, depositPaid, bedId enum A-D, roomId, moveInDate, emergencyContact, user{name,email,phone}.

### Rooms POST/PUT
sharingType 2|3|4, monthlyRent 1000-50000, roomNumber max20, floorId, description max500, photos URL[], roomAmenities[{amenityKey,status enum}], PUT + isActive.

### Floors POST
floorNumber >=0, label max50, totalRooms 1-50, amenityCounts optional. PUT = partial; totalRooms stripped server-side.

### Guardians POST
tenantId, name, phone +91, email required, relation enum father|mother|guardian|other. Returns temporaryPassword.

### Attendance manual POST
tenantId, date YYYY-MM-DD, status present|absent|on_leave|not_returned, checkIn/Out optional, method manual|qr|app, notes max500.

### Attendance PUT
date, status, checkInTime|checkIn, checkOutTime|checkOut, notes max500.

---

## Essential files for this audit

- `apps/web/src/app/(admin)/tenants/page.tsx`
- `apps/web/src/app/(admin)/tenants/new/page.tsx`
- `apps/web/src/app/(admin)/tenants/[id]/page.tsx`
- `apps/web/src/app/(admin)/tenants/[id]/edit/page.tsx`
- `apps/api/src/routes/tenants.ts`
- `apps/web/src/app/(admin)/rooms/page.tsx`
- `apps/web/src/app/(admin)/rooms/new/page.tsx`
- `apps/web/src/app/(admin)/rooms/[id]/page.tsx`
- `apps/web/src/app/(admin)/rooms/[id]/edit/page.tsx`
- `apps/api/src/routes/rooms.ts`
- `apps/web/src/app/(admin)/floors/page.tsx`
- `apps/web/src/app/(admin)/floors/new/page.tsx`
- `apps/web/src/app/(admin)/floors/[id]/page.tsx`
- `apps/web/src/app/(admin)/floors/[id]/edit/page.tsx`
- `apps/api/src/routes/floors.ts`
- `apps/web/src/app/(admin)/guardians/page.tsx`
- `apps/web/src/app/(admin)/guardians/new/page.tsx`
- `apps/web/src/app/(admin)/guardians/[id]/page.tsx`
- `apps/web/src/app/(admin)/guardians/[id]/edit/page.tsx`
- `apps/api/src/routes/guardians.ts`
- `apps/web/src/app/(admin)/attendance/page.tsx`
- `apps/web/src/app/(admin)/attendance/new/page.tsx`
- `apps/web/src/app/(admin)/attendance/[id]/page.tsx`
- `apps/web/src/app/(admin)/attendance/[id]/edit/page.tsx`
- `apps/api/src/routes/attendance.ts`
- `apps/web/src/lib/phone.ts`
- `apps/web/src/components/ui/DataTable.tsx`
- `apps/web/src/components/ui/OccupancyBedPicker.tsx`
- `apps/web/src/components/ui/DocumentUpload.tsx`
- `apps/web/src/components/ui/TodayAttendanceBoard.tsx`
