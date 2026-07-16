# Guardians -- Feature Audit

**Last verified:** 2026-07-16  
**Auditor:** code-verified source pass  
**Grade:** A-

> Admin CRUD + portal ward endpoints are wired and aligned with the model. Feature flag gates the entire router. P1-G1 (cascade Users) and P1-G2 (Flutter FeatureDisabledWidget) are **closed**. Residual: P2 phantom detail fields and TempCredentialsDialog reuse.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/guardian.ts` |
| Routes | `apps/api/src/routes/guardians.ts` |
| Types | `packages/types/src/guardian.ts` |
| Admin list | `apps/web/src/app/(admin)/guardians/page.tsx` |
| Admin new | `apps/web/src/app/(admin)/guardians/new/page.tsx` |
| Admin detail | `apps/web/src/app/(admin)/guardians/[id]/page.tsx` |
| Admin edit | `apps/web/src/app/(admin)/guardians/[id]/edit/page.tsx` |
| Flutter | `mobile/lib/features/guardian/**` |
| Feature flag | `guardianPortalEnabled` via `requireFeature` on router |

---

## API surface

| Method | Path | Role | Notes |
|--------|------|------|-------|
| POST | `/guardians` | admin | Transaction User(role=guardian) + Guardian; returns `temporaryPassword`; 409 on duplicate phone/email |
| GET | `/guardians` | admin | Paginated; `search`, `tenantId`; `mapGuardian` populate |
| GET | `/guardians/me/ward` | guardian JWT | **Registered before `/:id`** |
| GET | `/guardians/me/ward/attendance` | guardian JWT | Paginated attendance for ward |
| GET | `/guardians/:id` | admin | Single + mapGuardian |
| PUT | `/guardians/:id` | admin | Whitelist fields; syncs User name/phone/email/isActive |
| DELETE | `/guardians/:id` | admin | Soft deactivate guardian + User |

All routes: `requireFeature('guardianPortalEnabled')` (defaults true if config missing).

### Schemas (truth)

**createGuardianSchema:** `tenantId`, `name`, `phone` (+91), **`email` required**, `relation` enum `father|mother|guardian|other`.  
**updateGuardianSchema (strictObject):** `name?`, `phone?`, `email?`, `relation?`, `isActive?`.  
Does **not** allow: `tenantId`, `isEmergencyContact`, extra keys.

### mapGuardian

- Flattens `tenantId` string for ResourceSelect.
- Nested `tenant.user` / `tenant.room`.
- Computes **`isEmergencyContact`** = relation is father or mother (not a stored field).

---

## FE page matrix

| Page | Stack | Verdict |
|------|-------|---------|
| List | PageHeader, DataTable, TableActions, mobileCardRenderer, StatusBadge, ConfirmModal, search | **PASS** |
| Detail | FormPage, DetailCard, Edit + View Tenant CTAs, emergency badge | **PASS** (phantom types only) |
| New | FormPage, ResourceSelect tenant, relation enum correct, phone normalize, temp password banner | **PASS** |
| Edit | FormPage, tenant ResourceSelect **disabled**, whitelist PUT payload, relation enum, isActive checkbox, emergency display-only | **PASS** |

Sidebar / QuickCreate respect `guardianPortalEnabled`.

---

## Field coverage

| Model field | List | Detail | New | Edit | Notes |
|-------------|:----:|:------:|:---:|:----:|-------|
| userId | -- | -- | created server-side | -- | Unique User link |
| tenantId | via tenant name | linked tenant | ResourceSelect | display-only (disabled) | Not reassignable on PUT |
| name | Y | Y | Y | Y | |
| phone | Y | Y | normalize +91 | normalize +91 | |
| email | -- | Y if present | **required** | optional | Create requires email for login |
| relation | Y | Y | enum 4 | enum 4 | Matches model |
| isActive | Y badge | Y badge | default true | Checkbox | Syncs User on PUT |
| isEmergencyContact | Y (computed) | Y (computed) | n/a | display-only disabled | **Not in model** |
| address | -- | typed only | -- | -- | **Phantom** -- never from API |
| notes | -- | conditional render | -- | -- | **Phantom** -- never from API |
| temporaryPassword | n/a | n/a | inline banner | n/a | One-time create response |
| createdAt / updatedAt | -- | Y | n/a | n/a | |

---

## Lifecycle

```
Admin POST create -> User(role=guardian) + Guardian(isActive) + temp password
  -> PUT name/phone/email/relation/isActive (User sync)
  -> DELETE soft-deactivates Guardian + User
Guardian JWT -> GET /me/ward + /me/ward/attendance
Tenant DELETE cascade -> deactivates guardian Users then deletes Guardian docs (P1-G1 closed)
```

| Step | Status |
|------|--------|
| Create + credentials | **PASS** |
| Edit save (whitelist) | **PASS** |
| Soft delete | **PASS** API + UI -- ConfirmModal "Deactivate Guardian" / reinstate later |
| /me/ward portal | **PASS** route order + Flutter repo |
| Feature flag off | **PASS** API 403; FE nav hidden |

---

## Design / stack

- CSS variable tokens; FormPage / DataTable SaaS stack.
- ResourceSelect for tenant (no free-text Mongo IDs on create/edit).
- Emergency contact is derived UI, not a form field on create.
- New page uses **inline** temp-password banner (not shared `TempCredentialsDialog`) -- functional.

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
| P2-G1 | Detail TypeScript interface includes `address` / `notes` never returned by API (dead branches). | `guardians/[id]/page.tsx` |
| P2-G3 | New guardian temp password not using shared `TempCredentialsDialog`. | `guardians/new/page.tsx` |
| P2-G4 | No admin path to reassign `tenantId` (product choice; create new link instead). | update schema |

---

## Closed / do-not-refile

| Old claim | Live status |
|-----------|-------------|
| `/me/ward` shadowed by `/:id` | **FIXED** -- static routes registered first |
| Edit PUT sends tenantId + isEmergencyContact + bad relation enum | **FIXED** -- whitelist + enum aligned |
| Phone min(10) without +91 | **FIXED** -- `normalizeInPhone` + `isValidInPhone` |
| `guardianPortalEnabled` never checked | **FIXED** -- `requireFeature` on router |
| Relation options brother/sister/spouse on edit | **FIXED** -- father/mother/guardian/other only |
| PUT does not sync User | **FIXED** -- name/phone/email/isActive sync |
| ConfirmModal hard-delete copy (P2-G2) | **FIXED** -- "Deactivate Guardian" + reinstate later message |
| P1-G1 orphaned guardian Users on tenant DELETE | **FIXED** -- deactivate Users before Guardian.deleteMany (`tenants.ts`) |
| P1-G2 Flutter 403 swallow as empty ward | **FIXED** -- FeatureDisabledWidget on ward screens |

---

## Acceptance checklist

- [x] Create guardian with +91 phone succeeds; User role guardian
- [x] Create returns temporaryPassword once
- [x] Edit name/phone/relation/isActive succeeds (no strictObject 400)
- [x] GET `/guardians/me/ward` returns 200 for guardian JWT (when flag on)
- [x] DELETE deactivates guardian + user
- [x] Feature flag gates API + admin nav
- [x] Tenant cascade deactivates guardian Users
- [x] Flutter surfaces FEATURE_DISABLED distinctly from empty ward
- [x] Soft-delete UX copy accurate (Deactivate Guardian)

---

## Remediation log

- Prior audit claimed edit save dead, portal routes shadowed, flag missing -- all obsolete against 2026-07-16 source.
- **2026-07-16:** Full re-verify. Grade **A**. Open P1 empty. Closed P1-G1/P1-G2. Residual P2 phantoms/TempCredentialsDialog.
