# Tenants -- Feature Audit

**Last verified:** 2026-07-16  
**Auditor:** code-verified source pass  
**Grade:** A-

> Admin lifecycle is solid (create + temp password, atomic transfer, checkout/reinstate, nested ownership). Residual gaps are P1 race uniqueness, cascade orphan users, and FE error-surface polish -- not P0.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/tenant.ts` |
| Routes | `apps/api/src/routes/tenants.ts` |
| Types | `packages/types/src/tenant.ts` |
| Admin list | `apps/web/src/app/(admin)/tenants/page.tsx` |
| Admin new | `apps/web/src/app/(admin)/tenants/new/page.tsx` |
| Admin detail | `apps/web/src/app/(admin)/tenants/[id]/page.tsx` |
| Admin edit | `apps/web/src/app/(admin)/tenants/[id]/edit/page.tsx` |
| Shared UI | `OccupancyBedPicker`, `TempCredentialsDialog`, `TenantActivityTimeline`, `DocumentUpload` |
| Flutter | `mobile/lib/features/tenant/**` (self-service shell) |

---

## API surface

| Method | Path | Role | Verified behavior |
|--------|------|------|-------------------|
| POST | `/tenants` | admin | Transaction: User + Tenant + bed occupy; returns `temporaryPassword` |
| GET | `/tenants` | admin | Filters: `isActive`, `roomId`, `floorId`, `search`; paginated |
| GET | `/tenants/:id` | admin or owner | `assertAdminOrTenantOwner`; populate user + room.floor |
| PUT | `/tenants/:id` | admin | Atomic room/bed transfer in session; **no `isActive`** in `updateTenantSchema` |
| POST | `/tenants/:id/checkout` | admin | Blocks unpaid invoices + unresolved payments; frees bed; deactivates User |
| POST | `/tenants/:id/reinstate` | admin | Requires free original bed; reactivates tenant + User |
| POST | `/tenants/:id/documents` | admin | Multipart aadhaar/photo -> Cloudinary; graceful if unavailable |
| GET | `/tenants/:id/payments` | admin or owner | Ownership gated |
| GET | `/tenants/:id/complaints` | admin or owner | Ownership gated |
| GET | `/tenants/:id/invoices` | admin or owner | Ownership gated |
| GET | `/tenants/:id/activity` | admin or owner | Timeline aggregate |
| GET | `/tenants/:id/dues` | admin | Checkout dues panel |
| DELETE | `/tenants/:id` | admin | Cascade children + free bed + scrub User email/phone |

Portal money/ops also use other routers (`invoices/my`, `payments/my`, `complaints/my`, etc.).

### Create / update Zod truth

- Create: `monthlyRent` min **1000** max 50000; phone `+91[6-9]\d{9}`; `moveInDate` ISO datetime.
- Update: scalar rent/deposit, roomId/bedId, moveInDate, emergencyContact, nested `user.{name,email,phone}` only. **No free `isActive`.**

---

## FE page matrix

| Page | Stack | Verdict |
|------|-------|---------|
| List | PageHeader, DataTable, TableActions, mobileCardRenderer, StatusBadge, ConfirmModal | **PASS** |
| Detail | FormPage, StatCard, DetailCard, DocumentUpload, hubs (guardians/payments/invoices/complaints), checkout modal, reinstate, TenantActivityTimeline | **PASS** hub |
| New | FormPage/Card/Section/Actions, ResourceSelect room, **OccupancyBedPicker**, normalizeInPhone, rent min 1000, **TempCredentialsDialog** | **PASS** |
| Edit | Form stack, ResourceSelect room, bed Select with occupied-by-other filter, DocumentUpload, no isActive control | **PASS** (bed picker not shared OccupancyBedPicker -- behavior OK) |

### Hub panels (detail) -- wired

- Guardians via `GET guardians?tenantId=`
- Nested payments / invoices / complaints
- Reinstate when inactive; Checkout when active
- Floor from nested populate
- Activity timeline
- Documents upload

---

## Field coverage

| Model / domain field | List | Detail | New | Edit | Notes |
|----------------------|:----:|:------:|:---:|:----:|-------|
| userId / user.name | Y | Y | Y (name) | Y (user.name) | Via User |
| user.email | Y | Y | Y | Y | |
| user.phone | Y | Y | Y + normalize | Y + normalize | +91 |
| roomId / room | Y | Y | Y ResourceSelect | Y ResourceSelect | |
| bedId | Y | Y | OccupancyBedPicker | filtered Select | API enum A-D |
| moveInDate | -- | Y | Y ISO | Y ISO | |
| moveOutDate | -- | Y | n/a | n/a | Set by checkout |
| monthlyRent | Y | Y | min 1000 | min 1000 | Matches API |
| depositPaid | -- | Y | Y | Y | |
| isActive | Y badge | Y badge | n/a | **not editable** | Lifecycle only |
| documents.aadhaarUrl | -- | upload | -- | upload | API optional URL on create unused by FE |
| documents.photoUrl | -- | upload | -- | upload | |
| emergencyContact.name | -- | Y | optional | optional | |
| emergencyContact.phone | -- | Y | normalize | normalize | |
| emergencyContact.relation | -- | Y | free options | free options | Model is free string |
| temporaryPassword | n/a | n/a | **dialog** | n/a | Returned once on create |
| createdAt / updatedAt | -- | -- | n/a | n/a | Model timestamps |

---

## Lifecycle

```
Create (admin) -> active + bed occupied + temp password shown
  -> Edit transfer (atomic free old / occupy new)
  -> Checkout (dues guards) -> inactive + bed free + User inactive
  -> Reinstate (if bed free) -> active again
  -> Delete cascade (children + bed free + User scrubbed)
```

| Step | Status |
|------|--------|
| Create occupies bed | **PASS** |
| Temp password UX | **PASS** (`TempCredentialsDialog`) |
| View hub | **PASS** |
| Edit fields + transfer | **PASS** (transaction + 409 BED_OCCUPIED) |
| isActive free toggle | **CLOSED** -- not in PUT schema or FE |
| Checkout | **PASS** API; FE uses `parseApiError` for checkout/reinstate errors |
| Reinstate | **PASS** |
| Delete cascade | **PASS** core; guardian **User** accounts not deactivated |

---

## Design / stack

- Admin pages use CSS variables / FormPage SaaS stack. Default theme: **saas**.
- Checkout modal is ad-hoc `fixed inset-0 ... bg-black/40` (works; not shared ConfirmModal / dedicated DuesCheckoutDialog).
- StatusBadge via `statusToVariant(active|checked_out)`.
- ResourceSelect for rooms (not free-text Mongo IDs).

---

## Open gaps

### P0

_None verified open._

### P1

| ID | Gap | Proof |
|----|-----|-------|

### P2

| ID | Gap | Proof |
|----|-----|-------|
| P2-T1 | Edit uses hand-rolled bed Select instead of shared `OccupancyBedPicker` (duplication). | `tenants/[id]/edit/page.tsx` |
| P2-T2 | Checkout overlay hardcodes `bg-black/40` instead of shared modal primitive. | detail page ~line 533 |
| P2-T3 | Create form does not accept document URLs (post-create upload only). | new page |
| P2-T4 | `@pg/types` `ITenantCreate` / response types lag create response (`temporaryPassword`). | `packages/types/src/tenant.ts` |

---

## Closed / do-not-refile

| Old claim | Live status |
|-----------|-------------|
| Transfer non-atomic / free-before-validate (P0-T1) | **FIXED** -- validate then `withTransaction` |
| isActive free-set on PUT (P0-T2) | **FIXED** -- removed from schema + edit FE |
| temporaryPassword discarded (P0-T3) | **FIXED** -- returned + TempCredentialsDialog |
| Nested GET IDOR (P1-T6) | **FIXED** -- `assertAdminOrTenantOwner` |
| Occupied beds selectable on create | **FIXED** -- OccupancyBedPicker |
| FE rent min 1 vs API 1000 | **FIXED** -- FE min 1000 |
| Flutter profile missing | **FIXED** -- `profile_screen.dart` + leaves/attendance/notifs present |
| Detail missing reinstate / guardians hub | **FIXED** |
| FE lifecycle errors generic (P1-T3) | **FIXED** -- `parseApiError` on checkout/reinstate (detail page) |

---

## Acceptance checklist

- [x] Create occupies bed; room shows tenant
- [x] Transfer frees old, occupies new; 409 if target occupied
- [x] isActive cannot flip without checkout/reinstate
- [x] Admin sees temp password once
- [x] Nested GETs require admin or owner
- [x] Checkout blocked with unpaid invoices / unresolved payments
- [x] FE surfaces API error messages on checkout/reinstate (`parseApiError`)
- [ ] Unique DB constraint (or partial unique index) on active room+bed
- [ ] Cascade delete deactivates guardian users
- [ ] typecheck + lint green (repo-wide gate)

---

## Remediation log

- 2026-07-12: Prior full re-audit; major P0s closed in source.
- **2026-07-16:** Independent re-verify against live source. Confirmed P0s remain closed. Grade **A-**. Open set: P1-T1, P1-T2 + P2 polish. **P1-T3 closed** (parseApiError).
