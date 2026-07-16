# Visitors -- Feature Audit

**Last verified:** 2026-07-16  
**Auditor:** code-verified source pass  
**Grade:** A-

> Admin list filters, lifecycle actions, ownership, and arrive/depart state machine are solid. Admin PUT no longer free-sets status (arrive/depart/approve/cancel only). Flutter register still needs `User.tenantId` (self-heal present). No open P0.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/visitor.ts` |
| Routes | `apps/api/src/routes/visitors.ts` |
| Types | `packages/types/src/visitor.ts` |
| Admin list | `apps/web/src/app/(admin)/visitors/page.tsx` |
| Admin new | `apps/web/src/app/(admin)/visitors/new/page.tsx` |
| Admin detail | `apps/web/src/app/(admin)/visitors/[id]/page.tsx` |
| Admin edit | `apps/web/src/app/(admin)/visitors/[id]/edit/page.tsx` |
| Shared UI | `VisitorLifecycleActions`, `StatusFilterSelect` |
| Flutter desk | `mobile/lib/features/visitor/**` |
| Tenant tab | `mobile/lib/features/tenant/presentation/visitors_tab_screen.dart` |
| Feature flag | `visitorManagementEnabled` on entire router |

---

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/visitors` | admin or tenant | Tenant forces own tenantId; status always `expected` |
| GET | `/visitors` | admin | `status` filter, pagination, `mapVisitor` |
| GET | `/visitors/my` | tenant | Static path **before** `/:id` |
| GET | `/visitors/:id` | admin or owning tenant | Ownership enforced |
| POST | `/visitors/:id/approve` | admin | Only from `cancelled` -> `expected` + `approvedBy` |
| POST | `/visitors/:id/arrive` | admin or owner | Only from `expected` -> `arrived` + `actualArrival` |
| POST | `/visitors/:id/depart` | admin or owner | Only from `arrived` -> `departed` + `actualDeparture` |
| PUT | `/visitors/:id` | admin | name/phone/purpose/expectedArrival only -- **status omitted** (use arrive/depart/approve/cancel) |
| DELETE | `/visitors/:id` | admin | Hard delete |

`mapVisitor` exposes both `visitorName`/`visitorPhone` and aliases `name`/`phone` for lean + toJSON compatibility.

Model status enum: **`expected | arrived | departed | cancelled` only** (no `pending`).

---

## FE page matrix

| Page | Stack | Verdict |
|------|-------|---------|
| List | PageHeader, DataTable, TableActions, mobileCardRenderer, StatusBadge, **StatusFilterSelect** with expected/arrived/departed/cancelled | **PASS** |
| Detail | FormPage, DetailCard, **VisitorLifecycleActions** (arrive/depart/cancel/re-approve) | **PASS** lifecycle; **no Edit CTA** |
| New | FormPage, ResourceSelect tenant, normalizeInPhone, datetime-local expectedArrival | **PASS** |
| Edit | FormPage, visitorName/phone, **expectedArrival**; status **display-only** (not in PUT) | **PASS** fields; lifecycle on detail |
| Cancel | POST `/:id/cancel` expected->cancelled | **PASS** FE uses POST not PUT |

---

## Field coverage

| Model field | List | Detail | New | Edit | Notes |
|-------------|:----:|:------:|:---:|:----:|-------|
| tenantId / tenant | Y name | Y name + room | ResourceSelect | not editable | Ownership fixed at create |
| visitorName (alias name) | Y | Y | Y | Y | mapVisitor dual |
| visitorPhone (alias phone) | Y | Y | normalize | normalize | +91 |
| purpose | Y | Y | Y | Y | |
| expectedArrival | -- | Y | datetime-local | datetime-local | **Present on edit** |
| actualArrival | Y check-in | Y | n/a | n/a | Set by arrive action |
| actualDeparture | Y check-out | Y | n/a | n/a | Set by depart action |
| status | Y badge | Y + actions | always expected | read-only display | FE omits status; API PUT omits free status (P1-V1 closed) |
| approvedBy | -- | -- | n/a | n/a | Set by approve; not displayed |
| createdAt / updatedAt | -- | -- | n/a | n/a | timestamps |

---

## Lifecycle

```
Admin/Tenant POST create -> status=expected
  -> POST arrive      -> arrived + actualArrival   (expected only)
  -> POST depart      -> departed + actualDeparture (arrived only)
  -> Cancel via lifecycle (not free PUT status jump)
  -> POST approve     -> expected + approvedBy (cancelled only)
```

There is **no** register -> pending -> approve gate. Approve re-opens cancelled visitors only.

| Step | Status |
|------|--------|
| Create admin / tenant | **PASS** |
| List filter enums | **PASS** |
| Arrive / depart guards | **PASS** on action endpoints |
| Ownership on GET/arrive/depart | **PASS** |
| PUT free status | **PASS** -- status intentionally omitted from PUT; use arrive/depart/approve/cancel |
| Detail lifecycle bar | **PASS** (`VisitorLifecycleActions`) |
| Edit expectedArrival | **PASS** |
| Feature flag | **PASS** API + admin nav |

---

## Design / stack

- StatusBadge via `STATUS_COLOR_MAP` keys `expected`, `arrived`, `departed`, `cancelled`.
- ResourceSelect for tenant on create (no free-text Mongo ID).
- Tokens / FormPage SaaS stack.
- Detail cancel uses PUT `{ status: 'cancelled' }` rather than a dedicated cancel endpoint.

---

## Flutter matrix

| Surface | Verdict | Notes |
|---------|---------|-------|
| Routes /visitor/* | PASS | Tenant-auth desk |
| My list | PASS | GET visitors/my |
| Register | PASS with caveat | Requires `user.tenantId`; self-heal via `refreshUser` then fail message |
| Arrive / depart | PASS | Repository posts |
| Feature flag UX | PASS | FeatureDisabledWidget on visitor home |
| Design | PARTIAL | Uses theme + some AppTheme.muted |

API create Zod still requires `tenantId` in body even for tenants (server overwrites for tenant role). Flutter must supply a real id for validation.

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
| P2-V1 | Detail page has no Edit CTA (edit only via list actions). | `visitors/[id]/page.tsx` |
| P2-V2 | `approvedBy` never shown on admin detail. | detail page fields |
| P2-V3 | No audit log on arrive/depart/approve/cancel. | routes vs tenants transfer audit |
| P2-V4 | `@pg/types` `IVisitorRegister` omits admin `tenantId`; dual name fields lag mapVisitor. | `packages/types/src/visitor.ts` |
| P2-V5 | New form uses bare FormGrid without FormSection (consistency). | `visitors/new/page.tsx` |
| P2-V6 | Create Zod always requires `tenantId` even for tenant JWT (FE must invent id). | `createVisitorSchema` |

---

## Closed / do-not-refile

| P1-V2 Flutter FEATURE_DISABLED UX | **FIXED** -- FeatureDisabledWidget on visitor home |

| Old claim | Live status |
|-----------|-------------|
| List filter includes `pending`, omits expected/cancelled (P0-V1) | **FIXED** -- StatusFilterSelect enums match model |
| GET/arrive/depart no ownership (P1) | **FIXED** -- admin or owning tenant |
| No transition guards on arrive/depart | **FIXED** -- 409 INVALID_TRANSITION |
| Edit missing expectedArrival | **FIXED** |
| VisitorLifecycleActions missing | **FIXED** -- shared component on detail |
| Admin create 403 / /my shadowed | **FIXED** (prior) |
| Flutter tenantId hard fail without heal | **FIXED** -- refreshUser + seed/me backfill path |
| Admin PUT free-sets status (P1-V1) | **FIXED** -- `status intentionally omitted` in PUT handler |

---

## Acceptance checklist

- [x] Admin registers visitor for any tenant
- [x] Tenant registers for self (when User.tenantId present or healed)
- [x] List filter expected/arrived/departed/cancelled works
- [x] Edit loads names from mapVisitor dual fields
- [x] Arrive then depart happy path (action endpoints)
- [x] Illegal action transitions 409; non-owner tenant 403
- [x] visitorManagementEnabled false -> 403 + admin nav hidden
- [x] PUT status cannot bypass lifecycle timestamps (status omitted from PUT)
- [x] Flutter feature-disabled UX dedicated (FeatureDisabledWidget)
- [ ] Detail Edit CTA + optional approvedBy display

---

## Remediation log

- 2026-07-12: Re-audit closed admin create 403, /my shadow, filter pending, ownership holes (then open).
- **2026-07-16:** Source re-verify. Filter, ownership, arrive/depart machine, expectedArrival edit, VisitorLifecycleActions all **confirmed present**. **P1-V1 CLOSED** -- PUT omits free status. Grade **A-** residual P2 polish only.


## Cancel FSM (2026-07-16)
- API: `POST /visitors/:id/cancel` (expected only)
- FE detail: all lifecycle actions POST including cancel
