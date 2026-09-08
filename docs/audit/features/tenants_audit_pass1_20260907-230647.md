# Tenants Module - Audit Pass 1

Module: tenants
Scope: admin web + API + DB + shared types + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-07 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

tenants (resident lifecycle: list, create, detail, edit, checkout, reinstate, KYC docs, activity, dues)

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                     | Status            |
| ------ | ------------------------------------------------------------------------- | ----------------- |
| List   | apps/web/src/app/(admin)/tenants/page.tsx -> /tenants                     | WORKING           |
| Create | apps/web/src/app/(admin)/tenants/new/page.tsx -> /tenants/new             | WORKING WITH GAPS |
| Detail | apps/web/src/app/(admin)/tenants/[id]/page.tsx -> /tenants/[id]           | WORKING WITH GAPS |
| Edit   | apps/web/src/app/(admin)/tenants/[id]/edit/page.tsx -> /tenants/[id]/edit | WORKING           |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen             | Route                                 | API Used                                    | Status            |
| ------------------ | ------------------------------------- | ------------------------------------------- | ----------------- |
| Home badge         | /tenant (home_screen.dart)            | GET tenants/:id, invoices/my, complaints/my | WORKING           |
| Profile personal   | /tenant/profile (profile_screen.dart) | GET tenants/:id                             | WORKING           |
| Profile room rent  | /tenant/profile room section          | GET tenants/:id + rooms/:id via myFloorId   | WORKING           |
| Profile emergency  | /tenant/profile emergency section     | GET tenants/:id                             | WORKING           |
| Profile KYC status | /tenant/profile KYC section           | GET tenants/:id documents                   | WORKING READ-ONLY |
| Change password    | /tenant/profile password form         | POST auth/change-password                   | WORKING           |

### 2.3 End-User Guardian (mobile, role guardian only)

| Screen    | Route                        | Status                                             |
| --------- | ---------------------------- | -------------------------------------------------- |
| Ward view | /guardian (ward_screen.dart) | WORKING (reads linked tenant, not tenant-owned UI) |

### 2.4 Not Accessible

| Actor            | Blocked Surface                                                            | Enforcement                                                                |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| tenant, guardian | all /tenants Next routes                                                   | AdminLayout role guard, redirects to /login                                |
| admin            | all /tenant Flutter routes                                                 | app_router.dart redirects admin to /login                                  |
| tenant           | POST/PUT/DELETE /tenants, dues, checkout, reinstate, documents, verify-kyc | adminOnly middleware, 403                                                  |
| guardian         | GET /tenants/:id directly                                                  | assertAdminOrTenantOwner allows admin or owning tenant only, 403 otherwise |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List - tenants/page.tsx

| Feature                                             | Element                                                | Status                                                     |
| --------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| Table columns Name/Room/Contact/Rent/Status/Actions | DataTable                                              | WORKING                                                    |
| Search by name                                      | Input                                                  | WORKING (API matches User.name regex only)                 |
| Status filter All/Active/Checked Out                | Select -> isActive query                               | WORKING                                                    |
| Floor filter                                        | none                                                   | MISSING (API supports floorId, UI does not expose)         |
| Room filter                                         | none                                                   | MISSING (API supports roomId, UI does not expose)          |
| Pagination page/perPage/total                       | DataTable pagination                                   | WORKING                                                    |
| Row click -> detail                                 | onRowClick                                             | WORKING                                                    |
| View/Edit/Delete actions                            | TableActions                                           | WORKING                                                    |
| Add Tenant button                                   | Button + Plus icon -> /tenants/new                     | WORKING                                                    |
| Export CSV                                          | Button + Download icon, RFC4180 escape + formula guard | WORKING                                                    |
| Empty state                                         | EmptyState + Users lucide icon                         | WORKING                                                    |
| Mobile cards                                        | mobileCardRenderer                                     | WORKING                                                    |
| Delete confirm                                      | ConfirmModal + DELETE tenants/:id                      | WORKING                                                    |
| Custom SVG                                          | none, lucide only                                      | NO CUSTOM SVG (acceptable, no gap)                         |
| Scripted layout                                     | none (no print/statement layout)                       | MISSING (per-tenant statement print not in scope for list) |

### 3.2 Create - tenants/new/page.tsx

| Feature                                    | Element                                                       | Status                                                                  |
| ------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Personal info name/email/phone             | Input + zod + normalizeInPhone                                | WORKING                                                                 |
| Room select                                | ResourceSelect endpoint rooms?isActive=true                   | WORKING WITH GAP (first page only, no pagination; see 5.3)              |
| Bed select                                 | OccupancyBedPicker roomId=selectedRoom._id                    | WORKING WITH GAP (ignores roomId query param)                           |
| Bed Matrix Assign deep-link roomId+bedId   | /tenants/new?roomId=X&bedId=Y from rooms matrix + room detail | BROKEN (page reads name/phone/email/enquiryId only, drops roomId/bedId) |
| Room summary banner                        | brand-50 box                                                  | WORKING (only after manual room pick)                                   |
| Monthly rent auto-fill from room           | onRoomChange setValue monthlyRent                             | WORKING                                                                 |
| Move-in date                               | Input type=date -> ISO                                        | WORKING                                                                 |
| Deposit/rent numeric                       | Input type=number + zod coerce                                | WORKING                                                                 |
| Emergency contact name/phone/relation      | Input/Select, requires all-or-none                            | WORKING                                                                 |
| Enquiry prefill name/phone/email/enquiryId | useSearchParams                                               | WORKING                                                                 |
| Enquiry convert mark                       | PUT enquiries/:id/status converted                            | WORKING (best-effort toast on fail)                                     |
| Submit -> POST tenants                     | api.post tenants                                              | WORKING                                                                 |
| Temp credentials dialog                    | TempCredentialsDialog                                         | WORKING                                                                 |
| Buttons Save Tenant/UserPlus, Cancel       | FormActions                                                   | WORKING                                                                 |
| Custom SVG                                 | none                                                          | NO CUSTOM SVG                                                           |
| Calendar picker                            | native Input type=date                                        | WORKING (no custom calendar needed here)                                |

### 3.3 Detail - tenants/[id]/page.tsx

| Feature                                            | Element                                                                   | Status                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Header title/bed/room + status badge + Edit button | FormPage + StatusBadge + Button/Pencil                                    | WORKING                                                                           |
| StatCards rent/deposit/move-in/move-out            | StatCard + Banknote/CreditCard/Calendar icons                             | WORKING                                                                           |
| Contact card email/phone                           | DetailCard/User + Mail/Phone icons                                        | WORKING                                                                           |
| Room card number/floor/bedId                       | DetailCard/Home                                                           | WORKING                                                                           |
| Emergency contact card                             | DetailCard/Shield variant warning                                         | WORKING (hidden when empty)                                                       |
| Documents KYC aadhaar/photo                        | DetailCard/FileText + 2x DocumentUpload                                   | WORKING                                                                           |
| KYC Verified pill vs Verify KYC button             | conditional + POST verify-kyc + toast                                     | WORKING                                                                           |
| Actions WhatsApp/Copy Info/Check Out/Reinstate     | Button MessageCircle/Copy/LogOut/RotateCcw                                | WORKING                                                                           |
| Checkout dues modal                                | dues GET + total/electricity/deposit/pending + unpaid list + blocked gate | WORKING WITH GAP (unpaid rows not linked to invoice detail)                       |
| Reinstate inline + placement picker                | ResourceSelect rooms + OccupancyBedPicker + POST reinstate                | WORKING                                                                           |
| Reinstate BED_OCCUPIED -> placement UI             | showReinstatePlacement flow                                               | WORKING                                                                           |
| Guardians card list + Add guardian                 | DetailCard/Users + router /guardians/new?tenantId=X                       | WORKING                                                                           |
| Guardians View all guardians                       | Button -> /guardians?search= (empty)                                      | BROKEN (drops tenant context; API supports ?tenantId=X, UI does not use it)       |
| Recent payments list + Record payment              | DetailCard/CreditCard + /payments/:id + /payments/new?tenantId=X          | WORKING WITH GAP (Record button only when list non-empty; empty state has no CTA) |
| Recent invoices list                               | DetailCard/Receipt + /invoices/:id                                        | WORKING WITH GAP (no Generate/Record CTA at all)                                  |
| Recent complaints list                             | DetailCard/AlertTriangle + /complaints/:id                                | WORKING WITH GAP (no View-all filtered link)                                      |
| Activity timeline                                  | TenantActivityTimeline GET activity                                       | WORKING                                                                           |
| Tenancy calendar month view                        | none                                                                      | MISSING (required custom calendar component, see 6)                               |
| Buttons completeness                               | WhatsApp, Copy, Checkout, Reinstate, Verify, Add guardian                 | PARTIAL (missing invoice/payment/complaint CTAs in empty states)                  |
| Custom SVG                                         | none                                                                      | NO CUSTOM SVG                                                                     |
| Scripted layout                                    | none (no print-friendly tenancy summary)                                  | MISSING (deferred: not blocking flow)                                             |

### 3.4 Edit - tenants/[id]/edit/page.tsx

| Feature                                             | Element                  | Status        |
| --------------------------------------------------- | ------------------------ | ------------- |
| Load GET tenants/:id + reset form                   | useForm zodResolver      | WORKING       |
| Personal name/phone/email                           | Input + normalizeInPhone | WORKING       |
| Room assignment ResourceSelect + OccupancyBedPicker | currentBedId passthrough | WORKING       |
| Inactive lock banner + link to detail reinstate     | AlertTriangle + Link     | WORKING       |
| Financial monthlyRent/depositPaid/moveInDate        | Input number/date        | WORKING       |
| Emergency contact                                   | Input/Select             | WORKING       |
| Documents section 2x DocumentUpload                 | FormSection              | WORKING       |
| Save Changes/Cancel                                 | FormActions              | WORKING       |
| Custom SVG                                          | none                     | NO CUSTOM SVG |

## 4. Shared Components Used by Tenants

| Component                                                                                                                          | Path                                              | Status                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| OccupancyBedPicker                                                                                                                 | apps/web/src/components/ui/OccupancyBedPicker.tsx | WORKING WITH GAP (slices A-D by sharingType instead of using room.beds array; mismatches after sharingType race) |
| ResourceSelect/SearchableSelect                                                                                                    | ResourceSelect.tsx / SearchableSelect.tsx         | WORKING WITH GAP (endpoint fetch takes first page only, no limit param; rooms list paginated at 25)              |
| DocumentUpload                                                                                                                     | DocumentUpload.tsx                                | WORKING                                                                                                          |
| TenantActivityTimeline                                                                                                             | TenantActivityTimeline.tsx                        | WORKING                                                                                                          |
| TempCredentialsDialog                                                                                                              | TempCredentialsDialog.tsx                         | WORKING                                                                                                          |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/StatCard/DetailCard | ui/*                                              | WORKING                                                                                                          |
| DateRangePicker                                                                                                                    | DateRangePicker.tsx (2x native date inputs)       | WORKING (not used in tenants; no gap)                                                                            |
| HeatmapCalendar                                                                                                                    | HeatmapCalendar.tsx (SVG month contribution grid) | WORKING (used by dashboard complaints; not tenant-aware; does not satisfy tenancy calendar need)                 |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/tenants.ts)

| Endpoint                                                    | Auth           | Status                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST /tenants                                               | adminOnly      | WORKING (txn User+Tenant+bed occupy+User.tenantId+enquiry convert)                                                                                                                                                                                                                                        |
| GET /tenants?page/limit/search/isActive/roomId/floorId/sort | adminOnly      | WORKING (floorId resolves via Room lookup; search matches User.name only)                                                                                                                                                                                                                                 |
| GET /tenants/:id                                            | admin or owner | WORKING (populates user + room.floor label)                                                                                                                                                                                                                                                               |
| PUT /tenants/:id                                            | adminOnly      | WORKING (atomic room/bed transfer, validates target before freeing old, audit tenant_transfer)                                                                                                                                                                                                            |
| POST /tenants/:id/checkout                                  | adminOnly      | WORKING (blocks on invoice remaining balance via getInvoiceBalance + pending_verification/overdue payments; frees bed; deactivates User + guardian Users)                                                                                                                                                 |
| POST /tenants/:id/reinstate {roomId,bedId?}                 | adminOnly      | WORKING (validates target free or self-owned; frees old if relocating; reactivates User + guardians)                                                                                                                                                                                                      |
| POST /tenants/:id/documents multipart                       | adminOnly      | WORKING (Cloudinary guard via isServiceAvailable, 5MB + jpeg/png/webp/pdf, deletes prior publicId)                                                                                                                                                                                                        |
| POST /tenants/:id/verify-kyc                                | adminOnly      | WORKING (sets documents.isVerified/verifiedAt + audit)                                                                                                                                                                                                                                                    |
| GET /tenants/:id/payments                                   | admin or owner | WORKING                                                                                                                                                                                                                                                                                                   |
| GET /tenants/:id/complaints                                 | admin or owner | WORKING                                                                                                                                                                                                                                                                                                   |
| GET /tenants/:id/invoices                                   | admin or owner | WORKING                                                                                                                                                                                                                                                                                                   |
| GET /tenants/:id/dues                                       | adminOnly      | WORKING (remaining per invoice, electricity pro-rate, pendingPayments count)                                                                                                                                                                                                                              |
| GET /tenants/:id/activity                                   | admin or owner | WORKING (move_in/checkout + payments + complaints + leaves + notifications, sorted desc)                                                                                                                                                                                                                  |
| DELETE /tenants/:id                                         | adminOnly      | WORKING WITH GAP (cascade deletes payments/complaints/invoices/visitors/guardians/laundry/mealFeedback/attendance/leaves, frees bed, scrubs User email/phone with non-email non-phone placeholders; placeholders violate User email/phone regex shape though validators are skipped on findByIdAndUpdate) |

### 5.2 Database Models

| Model                                                                                                             | File               | Relation to Tenant                                                                             | Status                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| User                                                                                                              | models/user.ts     | Tenant.userId -> User._id unique; User.tenantId string backref                                 | WORKING (email lowercase unique + regex, phone +91 unique + regex, role tenant/guardian/admin)                     |
| Room                                                                                                              | models/room.ts     | Tenant.roomId -> Room._id; Room.beds[].tenantId -> Tenant._id; occupancyCount derived pre-save | WORKING WITH GAP (list API omits tenantName enrichment; detail enriches; matrix therefore shows Occupied fallback) |
| Floor                                                                                                             | models/floor.ts    | Room.floorId -> Floor._id; Floor.totalRooms synced post-save + recompute helper                | WORKING                                                                                                            |
| Guardian                                                                                                          | models/guardian.ts | Guardian.tenantId -> Tenant._id; Guardian.userId -> User._id unique                            | WORKING                                                                                                            |
| Payment/Invoice/Complaint/Visitor/LaundrySlot/MealFeedback/AttendanceRecord/LeaveApplication/Notification/Enquiry | models/*           | tenantId foreign keys cascade-deleted in DELETE txn                                            | WORKING                                                                                                            |

### 5.3 Shared Entity Relationships (tenant-room-bed-tenant)

| Association                                   | Direction                                                                                           | Enforcement                                                                                   | Status                                                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant.roomId+bedId -> Room.beds[bedId]       | create/transfer/reinstate occupy                                                                    | txn + pre-check isOccupied + unique_active_room_bed partial index + 11000 -> 409 BED_OCCUPIED | WORKING                                                                                                                                                           |
| Room.beds[].tenantId -> Tenant._id            | occupy/free on create/transfer/checkout/reinstate/delete                                            | manual sync in each txn + occupancyCount recount                                              | WORKING                                                                                                                                                           |
| Room.sharingType -> beds.length               | rebuildBedsForSharingType packs occupied A..N + Tenant.bedId remap                                  | txn + BEDS_OCCUPIED_ON_DOWNSIZE guard + CONCURRENT_MODIFICATION guard                         | WORKING                                                                                                                                                           |
| Room list -> bed tenantName                   | GET /rooms enriches only /:id, not / list                                                           | none for list                                                                                 | BROKEN (BedOccupancyGrid in rooms/page.tsx expects tenantName but list never sends it; shows Occupied fallback; strictly required fix for tenant assignment flow) |
| Tenant detail room.floor                      | GET /tenants/:id populates room.floor; GET /tenants list populates room only                        | populate difference                                                                           | WORKING WITH GAP (list cannot show floor without extra fetch; floor filter exists in API but no UI)                                                               |
| User.tenantId backref                         | set on create, never cleared on checkout/delete (only isActive flip + email/phone scrub)            | none                                                                                          | WORKING WITH GAP (stale tenantId remains on deactivated User; re-add creates new User so no collision, but stale pointer persists)                                |
| Guardian linkage on checkout/reinstate/delete | checkout deactivates guardian Users; reinstate reactivates; delete scrubs guardian User email/phone | session txn                                                                                   | WORKING                                                                                                                                                           |

## 6. Missing Custom Components

| Component            | Need                                                                                                                                                                                                                                                                                                                   | Status                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| TenantStayCalendar   | Month grid calendar for tenancy: move-in/move-out range highlight, today marker, prev/next month + Today controls, legend, per-day dots for payments/invoices/complaints/leaves/notices from GET activity + dues/invoices/payments payloads, click day -> event list; theme tokens only, no emoji, keyboard accessible | MISSING (HeatmapCalendar is complaints heatmap, not tenancy-aware; DateRangePicker is two native inputs; neither satisfies stay timeline need) |
| TenantStatementPrint | Print-friendly tenancy summary layout                                                                                                                                                                                                                                                                                  | MISSING (deferred, not blocking)                                                                                                               |

## 7. Buttons Inventory (tenants scope)

| Location            | Buttons                                                                                                                                 | Status                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| List filter bar     | Add Tenant, Export CSV                                                                                                                  | WORKING                                                                                                                   |
| List rows           | View, Edit, Delete                                                                                                                      | WORKING                                                                                                                   |
| List empty          | Add Tenant                                                                                                                              | WORKING                                                                                                                   |
| Create footer       | Save Tenant, Cancel                                                                                                                     | WORKING                                                                                                                   |
| Detail header       | Edit                                                                                                                                    | WORKING                                                                                                                   |
| Detail Actions      | WhatsApp, Copy Info, Check Out, Reinstate, Verify KYC, Add guardian, Record payment (non-empty only), Reinstate to selected bed, Cancel | PARTIAL (Record payment missing on empty; Generate invoice missing; View-all guardians/complaints missing tenant context) |
| Edit footer         | Save Changes, Cancel                                                                                                                    | WORKING                                                                                                                   |
| Checkout modal      | Cancel, Confirm Checkout                                                                                                                | WORKING                                                                                                                   |
| Reinstate placement | Reinstate to selected bed, Cancel                                                                                                       | WORKING                                                                                                                   |

## 8. SVG Inventory (tenants scope)

| Location         | SVG                                                                                                                                                                                                                                          | Status                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| All tenant pages | lucide-react icons only (Users, Plus, Download, Pencil, Mail, Phone, Calendar, Home, Banknote, Shield, FileText, MessageCircle, Copy, LogOut, RotateCcw, CreditCard, Receipt, AlertTriangle, Activity, ExternalLink, UserPlus, CalendarDays) | WORKING (no custom SVG required) |
| Photo fallback   | inline SVG string in rooms/[id] onError (not tenants)                                                                                                                                                                                        | OUT OF SCOPE                     |

## 9. Scripted Layouts Inventory (tenants scope)

| Layout                                     | Location                | Status             |
| ------------------------------------------ | ----------------------- | ------------------ |
| Responsive list table + mobile cards       | tenants/page.tsx        | WORKING            |
| FormCard/FormSection/FormGrid create/edit  | tenants/new + [id]/edit | WORKING            |
| Detail StatCards + DetailCards grid        | tenants/[id]            | WORKING            |
| Checkout modal + reinstate placement panel | tenants/[id]            | WORKING            |
| Print/statement layout                     | none                    | MISSING (deferred) |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. Fix create deep-link: read roomId+bedId search params, prefill form, auto-fetch selectedRoom + monthlyRent, pass prefilled roomId to OccupancyBedPicker; keep enquiry prefill intact.
2. Add floor filter to list: ResourceSelect or Select loading GET floors, query floorId, reset page on change; keep search + status + CSV intact.
3. Fix rooms list tenantName: enrich GET /rooms list with tenantName map like GET /rooms/:id (batch Tenant lookup + User name), strictly for bed matrix tenant display.
4. Fix OccupancyBedPicker: render from room.beds array when present, fallback to sharingType slice; keep currentBedId disabled logic.
5. Fix detail links/CTAs: View all guardians -> /guardians?tenantId=X; add Record payment CTA on empty payments; add Generate invoice CTA (/invoices/new?tenantId=X) in invoices card; add View-all tenant-filtered links where API supports it; link unpaid invoice rows to /invoices/:id.
6. Build TenantStayCalendar component + integrate into detail as Tenancy Calendar DetailCard fed by tenant moveIn/moveOut + activity + dues unpaidInvoices + recentInvoices/payments; month nav, legend, day detail, theme tokens, accessible buttons.
7. Keep portal boundaries: no Next tenant/guardian routes; no API source imports in web; Flutter read-only for this pass.
8. Run bun run lint with zero warnings/errors; no test execution.

## 11. Out of Scope for This Pass

1. rooms/floors/guardians/payments/invoices/complaints full module passes (only tenant-flow fixes above).
2. Flutter tenant portal edits (audit mapping only).
3. Per-tenant print statement layout (deferred).
4. User.tenantId stale pointer cleanup + DELETE placeholder email/phone shape (documented in 5.1/5.3; risky auth-adjacent change, separate pass).

## 12. Pass 1 Fixes Applied

| Fix                                                                  | Files                                          | Status  |
| -------------------------------------------------------------------- | ---------------------------------------------- | ------- |
| Create deep-link roomId+bedId prefill                                | tenants/new/page.tsx                           | WORKING |
| List floor filter                                                    | tenants/page.tsx                               | WORKING |
| Rooms list tenantName enrichment                                     | apps/api/src/routes/rooms.ts                   | WORKING |
| Bed picker uses room.beds array                                      | OccupancyBedPicker.tsx                         | WORKING |
| Detail guardians/invoice/payment/complaint CTAs + invoice deep-links | tenants/[id]/page.tsx                          | WORKING |
| TenantStayCalendar component + detail integration                    | TenantStayCalendar.tsx + tenants/[id]/page.tsx | WORKING |
| Invoice tenantId prefill                                             | invoices/new/page.tsx                          | WORKING |
| Guardians tenantId filter                                            | guardians/page.tsx                             | WORKING |

Verification: bun run lint clean (oxlint 0 warnings/errors); bun run typecheck clean across types/web/api; no tests executed; no emojis; portal boundaries respected.
