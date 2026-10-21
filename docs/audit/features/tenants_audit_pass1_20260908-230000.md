# Tenants Module - Audit Pass 1 (User-Facing Info Surfaces)

pass1_20260908-230000
Scope: tenant/guardian self-service info surfaces in `mobile/` plus the API contracts they depend on.
Admin web tenants pages (list/detail/create/edit) were rebuilt previously and remain per `docs/audit/features/tenants.md`.
Source verified against live code: apps/api/src/routes/tenants.ts, apps/api/src/routes/guardians.ts, apps/api/src/models/tenant.ts, apps/api/src/models/user.ts, mobile/lib/features/tenant/**, mobile/lib/features/guardian/**.

## Module scope

Self-service "my information" surfaces:

- Tenant: profile (identity, room/rent, emergency contact, KYC status), change password
- Guardian: ward overview (identity, room, dues summary), ward attendance, change password

## Pages / routes

| Surface                | Route (Flutter)             | File                                                                     |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------ |
| Tenant profile         | `/tenant/profile` via shell | `mobile/lib/features/tenant/presentation/profile_screen.dart`            |
| Guardian ward overview | `/guardian`                 | `mobile/lib/features/guardian/presentation/ward_screen.dart`             |
| Guardian attendance    | `/guardian/attendance`      | `mobile/lib/features/guardian/presentation/ward_attendance_screen.dart`  |
| Guardian profile       | `/guardian/profile`         | `mobile/lib/features/guardian/presentation/guardian_profile_screen.dart` |

## API dependencies

| Endpoint                 | Method           | Auth                                               | Status                                                                                                                                                                                                                                                                                          |
| ------------------------ | ---------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/tenants/:id`           | GET              | admin or tenant-owner (`assertAdminOrTenantOwner`) | WORKING                                                                                                                                                                                                                                                                                         |
| `/tenants/me/profile`    | PATCH            | tenant only                                        | NEW - self-service phone + emergencyContact update, duplicate-phone 409 check, transaction, audit log                                                                                                                                                                                           |
| `/tenants/me/documents`  | POST (multipart) | tenant only                                        | NEW - self-service Aadhaar/photo upload via shared `handleKycUpload` pipeline; fresh upload resets `documents.isVerified` to false for admin re-review; notifies all active admins via `createNotification` (`kyc_uploaded`, individual-target, push + SSE); registered before `/:id/documents` |
| `/tenants/:id/activity`  | GET              | admin or tenant-owner                              | WORKING                                                                                                                                                                                                                                                                                         |
| `/guardians/me/ward`     | GET              | guardian only                                      | WORKING - duesSummary now computed from remaining balances via `getInvoiceBalance` (was gross invoice totals)                                                                                                                                                                                   |
| `/tenants/:id/documents` | POST (multipart) | admin only                                         | WORKING - refactored onto shared `handleKycUpload` (behavior unchanged, `selfService` false)                                                                                                                                                                                                    |
| `/auth/password`         | PUT              | any                                                | WORKING - change password, revokes sessions                                                                                                                                                                                                                                                     |

## Database / entity dependencies

- `Tenant` (userId unique, roomId+bedId, emergencyContact {name, phone, relation}, documents, depositPaid, monthlyRent, moveInDate/moveOutDate, isActive)
- `User` (name, email, phone unique, profilePhoto, isActive)
- `Room` populated with `floor` (label/floorNumber)
- `Guardian` (userId unique, tenantId, relation, isActive)

## Features and status

| Feature                                                   | Status   | Notes                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant views own profile incl. floor label, move-out date | COMPLETE | `GET /tenants/:id` returns populated room.floor                                                                                                                                                                                                                                         |
| Tenant edits own mobile number                            | COMPLETE | PATCH `/tenants/me/profile`; +91 validation client and server; duplicate 409 surfaced                                                                                                                                                                                                   |
| Tenant adds/edits own emergency contact                   | COMPLETE | PATCH `/tenants/me/profile`; all-or-none enforced client-side; server schema requires all three fields                                                                                                                                                                                  |
| Tenant sees real KYC document status                      | COMPLETE | Previous build fabricated a "Tenancy Agreement" row; removed. Now Aadhaar + photo from `documents`, with admin-verified chip                                                                                                                                                            |
| Tenant profile photo in header                            | COMPLETE | Uses `documents.photoUrl` (User.profilePhoto only set at creation)                                                                                                                                                                                                                      |
| Tenant uploads/replaces own KYC documents from portal     | COMPLETE | `POST /tenants/me/documents`; Aadhaar accepts gallery, camera, or PDF via file_picker; photo accepts gallery/camera via image_picker; client-side 5 MB pre-check, per-document progress, verification reset to Pending on replace; iOS Info.plist photo/camera usage descriptions added |
| Admins notified of tenant KYC uploads                     | COMPLETE | New `kyc_uploaded` notification type (packages/types + Notification model + route schema); all active admins targeted as individuals; ntfy push + SSE + badge refresh via existing pipeline; admin-side uploads do not notify; failure is non-fatal                                     |
| KYC notifications deep-link to tenant detail              | COMPLETE | `apps/web/src/lib/notificationLinks.ts` maps `kyc_uploaded` + `data.tenantId` to `/tenants/:id`; used by the admin NotificationBell row click and a primary "Review Document" action on the notification detail page (which also renders the payload with a document URL link)          |
| Tenants list shows inline KYC review badges               | COMPLETE | `kycStatus` helper derives Verified / Pending / No Docs from `documents`; dedicated KYC column (desktop), inline badge on mobile cards, and a KYC column in CSV export; list API already returns `documents` (no projection strips it)                                                  |
| Tenant change password                                    | COMPLETE | Pre-existing                                                                                                                                                                                                                                                                            |
| Guardian sees ward identity incl. floor, move-in          | COMPLETE | ward populate includes floor via roomId path                                                                                                                                                                                                                                            |
| Guardian calls ward                                       | COMPLETE | tel: via url_launcher (already a dependency)                                                                                                                                                                                                                                            |
| Guardian dues accurate to remaining balance               | COMPLETE | API fix: per-invoice `getInvoiceBalance`, isClear at <= 0.001                                                                                                                                                                                                                           |
| Guardian attendance + notices                             | COMPLETE | Pre-existing, unchanged                                                                                                                                                                                                                                                                 |
| Guardian change password                                  | COMPLETE | Pre-existing                                                                                                                                                                                                                                                                            |

## Missing / intentionally out of scope

- Name/email self-edit: admin-controlled by design (identity + invoicing anchor). UI states this explicitly.
- Guardian profile screen shows ward identity from `/guardians/me/ward`; acceptable as-is.
- PDF Aadhaar upload from Flutter: image_picker picks images only; the API accepts application/pdf but the portal offers gallery/camera. Recorded as P4 refinement.

## Priority register (source-derived)

- P0: none remaining in scope.
- P1 (fixed this pass): no tenant self-service profile update; guardian dues used gross totals.
- P2 (fixed this pass): tenant KYC section showed a non-existent document; no floor/move-out info; guardian ward lacked floor/move-in/call.
- P3 (fixed this pass): tenant-side document upload (API endpoint + image_picker integration).
- P4 (fixed this pass): PDF (non-image) Aadhaar upload from the portal via file_picker.

## Validation

- `bun run typecheck` green (api, web, types).
- `flutter analyze` clean for mobile.
- Flow: profile edit -> PATCH `/tenants/me/profile` -> transaction updates User.phone and Tenant.emergencyContact -> audit log -> refreshed populated tenant returned -> UI state updated.

## Open gaps

No open gap findings recorded in this file.

## Closed

| Claim                                                          | Live status                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| No tenant self-service profile update (P1)                     | CLOSED - PATCH /tenants/me/profile implemented with audit log (fixed this pass) |
| Guardian dues used gross totals (P1)                           | CLOSED - guardian dues use net totals (fixed this pass)                         |
| Tenant KYC section showed a non-existent document (P2)         | CLOSED - fixed this pass                                                        |
| Tenant profile lacked floor and move-out info (P2)             | CLOSED - fixed this pass                                                        |
| Guardian ward lacked floor, move-in date, and call action (P2) | CLOSED - fixed this pass                                                        |
| No tenant-side document upload (P3)                            | CLOSED - API endpoint plus image_picker integration (fixed this pass)           |
| No PDF Aadhaar upload from the portal (P4)                     | CLOSED - file_picker integration (fixed this pass)                              |

## Depth pass (2026-10-21): the four admin screens rebuilt to the depth standard

Pass: depth (wave 6 of the depth program).
Method: the three gates and the per-module contract of
`docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` (gate A truth, gate B flow, gate C layout),
applied to the admin screens of this module. Every claim below was read out of source on
2026-10-21 and is cited as `file:line`.
Precedent: `docs/audit/features/payments_depth_pass1_20260930.md`,
`docs/audit/features/invoices_audit_pass1_20260908-003801.md`.
Nothing above this section was changed: the findings of pass 1 stand as they were written.

### 1. Inventory

| Artifact          | Path                                                | Lines | Notes                                                                        |
| ----------------- | --------------------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| Roster (list)     | apps/web/src/app/(admin)/tenants/page.tsx           | 934   | URL filters, status tabs, band metrics, per resident dues, CSV export        |
| Resident (detail) | apps/web/src/app/(admin)/tenants/[id]/page.tsx      | 1573  | Protagonist, onboarding trail, dues, KYC, office actions, calendar, timeline |
| Check in (create) | apps/web/src/app/(admin)/tenants/new/page.tsx       | 655   | Intake form, lease passport rail, consequence panel                          |
| Check in (edit)   | apps/web/src/app/(admin)/tenants/[id]/edit/page.tsx | 765   | Read through the query stack, transfer, consequence panel                    |
| API route         | apps/api/src/routes/tenants.ts                      | 2180  | 20 endpoints, 6 of them resident readable                                    |
| Model             | apps/api/src/models/tenant.ts                       | 214   | No status field, two booleans and the document flags                         |
| Shared types      | packages/types/src/tenant.ts                        | 98    | No importer anywhere in the repository                                       |
| Contract          | packages/types/src/contracts/tenants.ts             | -     | State machine, truth contract, layout, next best action                      |

### 2. What the operator is doing here

The operator puts a resident in a bed, proves who the resident is, collects what the resident
owes and closes the stay when the resident leaves. The money belongs to the invoice module and
the payments module; what this module owns is the resident, the bed, the identity state and the
stay. Done looks like: every bed is either taken by a named resident or marked free, every
checked-in resident has a verified identity and a reachable phone number, and a checked-out
resident has no open dues and no portal access.

### 3. The findings of this pass

| ID        | Severity | Finding                                                                                                                                                                                                                                                 | How it ended                                                                                                                                    |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| TEN-D2-1  | P2       | The roster had no money column. The audit already flagged it (FLOW_AND_LAYOUT_AUDIT_20261021.md, F3: "The admin tenants list has no balance column"), and the office had to open a resident to learn that the resident owed anything.                   | Closed by the rebuild: the column reads the server's dues summary for that resident.                                                            |
| TEN-D2-2  | P2       | The identity column said "Verified", "Pending" or "No Docs" and never said what the state meant, so an upload waiting for a verdict and a record with no upload at all looked like the same queue entry.                                                | Closed by the rebuild: the state and what it means are both on the row.                                                                         |
| TEN-D2-3  | P2       | The list did not say what its columns meant. The search matches the resident name only (apps/api/src/routes/tenants.ts:437-460), and the rent and the deposit were bare numbers.                                                                        | Closed by the rebuild: a legend under the table names the scope of the search, of the dues, of the stay and of the money columns.               |
| TEN-D2-4  | P2       | The CSV export wrote the page in view and said nothing about the rest of the set (the old list page walked one request).                                                                                                                                | Closed by the rebuild: the export walks the pages of the filtered set and reports the rows the server holds against the rows the file carries.  |
| TEN-D2-5  | P2       | The resident page never showed what the resident owes. The dues were read only when the office opened the checkout modal, so the money was one click and one modal away from the record.                                                                | Closed by the rebuild: the dues summary is read on the page and rendered as the money number of the record and as the resident's own view.      |
| TEN-D2-6  | P2       | The onboarding of a resident was scattered over four cards and no progression was drawn anywhere. The tenant model has no status field, so the progression was the six states the record actually proves.                                               | Closed by the rebuild: the onboarding trail renders them in order.                                                                              |
| TEN-D2-7  | P2       | The office could only delete a resident from the roster, and the resident page did not carry every action the office takes on a resident.                                                                                                               | Closed by the rebuild: one card carries every action and each write renders the server's answer.                                                |
| TEN-D2-8  | P2       | The check out and the reinstate reloaded the whole page with `window.location.reload()`, which threw the view away and left the operator with no record of what the server committed.                                                                   | Closed by the rebuild: both writes invalidate the queries and the page reports the state the server committed.                                  |
| TEN-D2-9  | P2       | The edit page did not say that an edit moves what the resident owes. The rent on the record is what the next invoice is raised from (apps/api/src/services/invoice.service.ts:97), and the resident is not told about either the old or the new number. | Closed by the rebuild: the panel on the edit page names the four consequences and the silence of the server.                                    |
| TEN-D2-10 | P2       | The create page did not say what creating the tenant does, and nothing on the form stopped a resident the office could not reach.                                                                                                                       | Closed by the rebuild: the rail panel names what the server commits and what is still open, and the phone field carries the reachability rule.  |
| TEN-D2-11 | P3       | The edit page was the only screen of the module outside the shared query stack: a hand written fetch, no cache and no invalidation after the write.                                                                                                     | Closed by the rebuild: the record is read with `useApiQuery` and the write invalidates the tenant queries.                                      |
| TEN-D2-12 | P3       | The resident page opened with four statistic tiles (monthly rent, deposit, move-in, move-out) and no protagonist, so it read like every other record page of the app.                                                                                   | Closed by the rebuild: the tiles are gone and the page opens with the resident, the bed, the stay and the money number.                         |
| TEN-D2-13 | P3       | The status filter was a select and the size of the set was never on the screen, so the office could not tell an empty filter from an empty roster.                                                                                                      | Closed by the rebuild: the status is a tab strip with the server counts of the same filtered set, and the band names the scope of every number. |
| TEN-D3-1  | P2       | The tenant model holds no lease end date (apps/api/src/models/tenant.ts:8-9, :84-91), so a stay that is about to end cannot be computed from the server's numbers.                                                                                      | Still open: it needs a field on the model, the routes and the portal. The roster shows the length of the stay instead and says why.             |
| TEN-D3-2  | P2       | GET /tenants has no money filter and no dues aggregate (apps/api/src/routes/tenants.ts:391-483), so the roster reads the dues of one resident at a time.                                                                                                | Still open: it needs an aggregate or a filter on the list route. The band says that the owing number covers the page.                           |
| TEN-D3-3  | P2       | The tenant model has no status field, so the domain carries no lifecycle vocabulary and the shared stepper cannot render it (packages/types/src/lifecycle.json).                                                                                        | Still open: the vocabulary and the generated Dart need a domain and a status union that the model does not have.                                |
| TEN-D3-4  | P2       | A check out deactivates the portal login of the resident and of the guardians (apps/api/src/routes/tenants.ts:820-843) and sends no notification, so the resident is never told.                                                                        | Still open: it is an API change. The office page says so before the write.                                                                      |
| TEN-D3-5  | P3       | PUT /tenants/:id writes an audit entry only when the room or the bed moved (apps/api/src/routes/tenants.ts:681-702), so a change of the rent leaves no trail.                                                                                           | Still open: it is an API change. The edit page says that no audit entry is written.                                                             |
| TEN-D3-6  | P3       | The resident record carries no link back to the enquiry it came from: the server stores convertedTenantId on the enquiry (apps/api/src/routes/tenants.ts:313-323).                                                                                      | Still open: it needs a reverse read on the enquiries route. The resident page points at the converted enquiries list.                           |
| TEN-D3-7  | P3       | The shared tenant DTOs of packages/types/src/tenant.ts have no importer in the repository.                                                                                                                                                              | Still open: the four screens declare their own interfaces, as in the invoices and the payments module.                                          |
| TEN-D3-8  | P3       | The KYC queue has no list of its own: the only queue is the notification bell (apps/api/src/routes/tenants.ts:1097-1131) and GET /tenants cannot filter on the identity state.                                                                          | Still open: it needs a filter on the list route. The roster names the state of every row instead.                                               |

The rows that are still open are carried in `docs/audit/features/tenants.md` with their severity and
their paths; the rows that the rebuild closed are carried in the Closed section of the same file.

### 4. The contract

`packages/types/src/contracts/tenants.ts` now holds the grid of the domain (the tenant model has
no status field, so the grid is `isActive` times `documents.isVerified`), one truth entry per
action the admin can take (check in, check out, reinstate, edit, verify the documents, read the
dues, delete), the layout archetype with the grammar tokens and the module's own number, and the
next best action per grid cell and per empty state.

### 5. What was NOT done

- No API route, model or shared type was changed. Every gap that needs one is listed above as
  still open.
- The mobile portal was not touched. The resident half of this module (the profile, the ward view)
  was not re-audited in this pass; pass 1 above still stands.
- No screenshot and no browser run: every layout claim is read out of the component geometry and
  the width rule, not measured.
