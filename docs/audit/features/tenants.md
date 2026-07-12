# Tenants -- Gap Analysis (code-verified 2026-07-12)

**Priority:** P0 (integrity + credentials)  
**Admin grade:** B  
**Flutter:** Self-service shell present; not full profile MVP  
**Theme:** SaaS-first FormPage / DataTable stack

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/tenant.ts` |
| Routes | `apps/api/src/routes/tenants.ts` |
| Types | `packages/types/src/tenant.ts` |
| Admin FE | `apps/web/src/app/(admin)/tenants/**` |
| Flutter | `mobile/lib/features/tenant/**` (self-service only) |

## Model truth

| Field | Notes |
|-------|--------|
| userId | ObjectId User, required, unique |
| roomId / bedId | bed enum A-D |
| moveInDate / moveOutDate | checkout sets moveOut |
| monthlyRent / depositPaid | rent min 1000 |
| isActive | lifecycle via checkout/reinstate -- not free toggle |
| documents.aadhaarUrl / photoUrl | nested |
| emergencyContact | phone `+91[6-9]…` |
| Indexes | roomId, bedId, isActive, compound room+bed+isActive (**not unique bed claim**) |

## API surface

| Method | Path | Role | Notes |
|--------|------|------|-------|
| POST | `/tenants` | admin | Transaction User+Tenant+bed; **temp password not returned** |
| GET | `/tenants` | admin | filters isActive, roomId, floorId, search |
| GET | `/tenants/:id` | JWT | tenant self-check; populate user + room.floor |
| PUT | `/tenants/:id` | admin | transfer **non-atomic**; isActive free-set **P0** |
| POST | `/:id/checkout` | admin | unpaid invoice + unresolved payment guards; frees bed |
| POST | `/:id/reinstate` | admin | bed free required; reactivates user |
| POST | `/:id/documents` | admin | multipart aadhaar/photo Cloudinary |
| GET | `/:id/payments\|complaints\|invoices\|activity` | JWT | **P1 no ownership** |
| GET | `/:id/dues` | admin | checkout panel |
| DELETE | `/:id` | admin | cascade children + free bed + scrub user |

Portal money/ops use **other routers**: `invoices/my`, `payments/my`, `complaints/my`, etc.

## Admin FE matrix

| Page | Stack | Verdict |
|------|-------|---------|
| List | PageHeader, DataTable, TableActions, mobileCardRenderer, StatusBadge | **PASS** |
| Detail | FormPage, hubs, checkout, reinstate, DocumentUpload, TenantActivityTimeline | **PASS** hub |
| New | FormPage/Card/Section/Actions, ResourceSelect, normalizeInPhone, ISO moveIn | **PARTIAL** -- no credentials UX; rent min weak; occupied beds selectable |
| Edit | Same form stack + docs; phone normalize | **PARTIAL** -- isActive Status select is P0 |

### Hub panels (detail) -- wired

- Guardians `GET guardians?tenantId=`
- Payments / invoices / complaints nested
- Reinstate when inactive
- Floor from nested populate
- Activity timeline
- Documents upload

## Field coverage

| Field | New | Edit | Notes |
|-------|:---:|:----:|-------|
| user name/email/phone | Y | nested user | phone normalized |
| roomId / bedId | Y | Y | create does not disable occupied |
| monthlyRent / deposit | Y | Y | FE rent min 1 vs API 1000 |
| moveInDate | Y | Y | ISO on submit |
| emergencyContact | Y | Y | |
| documents | after create | upload | create can take URLs API-side |
| isActive | n/a | **Y bad** | must remove |
| temporaryPassword | missing UX | n/a | API discards |

## Flutter tenant portal

| Screen | Mode | API | Gap |
|--------|------|-----|-----|
| Home | snippets | invoices/my, complaints/my | no profile/dues card |
| Invoices | list | invoices/my | no detail/PDF |
| Payments | list + UTR | payments/my, submit-utr | no QR |
| Complaints | list + create | complaints/my, POST | needs roomId from profile |
| Meals | menu + feedback | menus/today, meals/feedback | basic |
| Laundry | list + book | laundry-slots | needs tenantId |
| Notices | list | notices | no detail |
| Visitors tab | embeds visitor feature | visitors/my | tenantId gate |
| Profile | **missing** | tenants/:id exists | P1 |
| Leaves / attendance / notifs | **missing** | APIs exist | P1 |

## E2E lifecycle

| Step | Status |
|------|--------|
| Create | PARTIAL (no credentials) |
| View hub | PASS |
| Edit fields | PASS |
| Transfer | **FAIL** non-atomic |
| isActive toggle | **FAIL** |
| Checkout | PASS API / PARTIAL errors |
| Reinstate | PASS |
| Delete | PASS core |
| Portal after create | **FAIL** without password path |

## Integrity issues (open)

1. **P0-T1 Transfer race / free-before-validate** -- fix with transaction + validate first.
2. **P0-T2 isActive on PUT** -- remove from schema + FE; force checkout/reinstate.
3. **P0-T3 Credentials** -- return temporaryPassword like guardians; TempCredentialsDialog.
4. **P1-T6 Nested IDOR** -- adminOnly or ownership on nested GETs.
5. **P1 bed create UX** -- OccupancyBedPicker.

## Custom SaaS components required

| Component | Purpose |
|-----------|---------|
| TempCredentialsDialog | Show one-time password after create |
| OccupancyBedPicker | Free beds only |
| TenantStatusControl | Checkout / Reinstate only |
| DuesCheckoutDialog | Shared modal; parse API error codes |
| RelatedRecordsTabs (optional polish) | If hub grows beyond current cards |

## Design notes

- Admin tenants pages use CSS variables; FormPage stack is SaaS-correct.
- Prefer ConfirmModal / DuesCheckoutDialog over ad-hoc `bg-black/40` overlays.
- Default theme preset: **saas**.

## Required fixes (checklist)

- [ ] Atomic bed claim helper for create/transfer/reinstate
- [ ] Remove isActive from PUT + edit form
- [ ] Return + display temporaryPassword on create
- [ ] Disable occupied beds on new
- [ ] Align rent min 1000 on FE
- [ ] Nested route ownership
- [ ] Surface API error codes on checkout/transfer
- [ ] Flutter profile screen + reliable tenantId on /me
- [ ] Fix `ITenantCreate` in packages/types

## Acceptance

- [ ] Create occupies bed; room shows tenant
- [ ] Transfer frees old, occupies new; concurrent double-book impossible
- [ ] Occupied bed rejected 409
- [ ] Checkout blocked with unpaid invoices; bed freed when OK
- [ ] isActive cannot flip without checkout/reinstate
- [ ] Admin sees temp password once; tenant can login Flutter
- [ ] Delete cascade leaves no orphan payments/guardians docs
- [ ] typecheck + lint green

## Remediation log

- 2026-07-12: Full re-audit (code). Prior claims about missing reinstate hub, missing guardians panel, missing phone normalize on new are **obsolete**.
