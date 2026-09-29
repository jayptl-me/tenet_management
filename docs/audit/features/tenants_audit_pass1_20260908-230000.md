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
