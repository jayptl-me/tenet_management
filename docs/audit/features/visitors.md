# Visitors -- Gap Analysis (code-verified 2026-07-12)

**Priority:** P0 list filter + Flutter tenantId; otherwise B- admin  
**Theme:** SaaS StatusBadge + FormPage; need shared lifecycle action bar

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/visitor.ts` |
| Routes | `apps/api/src/routes/visitors.ts` |
| Types | `packages/types/src/visitor.ts` (may lag dual name fields) |
| Admin FE | `apps/web/src/app/(admin)/visitors/**` |
| Flutter desk | `mobile/lib/features/visitor/**` |
| Tenant tab | `mobile/lib/features/tenant/presentation/visitors_tab_screen.dart` |

## Model truth

| Field | Notes |
|-------|--------|
| tenantId | required |
| visitorName / visitorPhone | phone +91; toJSON aliases to name/phone |
| purpose / expectedArrival | required |
| actualArrival / actualDeparture | set by arrive/depart |
| status | **`expected \| arrived \| departed \| cancelled`** only -- **no `pending`** |
| approvedBy | optional User |

Feature flag: `visitorManagementEnabled` on **all** visitor routes.

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/` | admin **or** tenant | Tenant forces own tenantId; status always `expected` |
| GET | `/` | admin | status filter, pagination, mapVisitor |
| GET | `/my` | tenant | **before** `/:id` -- OK |
| GET | `/:id` | any JWT | **no ownership** |
| POST | `/:id/approve` | admin | sets expected + approvedBy (re-open cancelled) |
| POST | `/:id/arrive` | any JWT | **weak authz** |
| POST | `/:id/depart` | any JWT | **weak authz** |
| PUT | `/:id` | admin | name/phone/purpose/expectedArrival/status |
| DELETE | `/:id` | admin | hard delete |

`mapVisitor` keeps both visitorName and name for lean docs.

## Admin FE matrix

| Page | Verdict | Notes |
|------|---------|-------|
| List | **PARTIAL / FAIL filter** | Full DataTable stack; filter includes **pending**, omits expected/cancelled |
| Detail | **PASS** lifecycle | Arrive / Depart / Re-approve wired; no Edit CTA |
| New | **PASS** | FormPage, ResourceSelect tenant, normalizeInPhone |
| Edit | **PASS** field map | visitorName ?? name; **missing expectedArrival** field |

### Status filter fix (P0-V1)

Replace filter options with:

```ts
[
  { value: 'expected', label: 'Expected' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'departed', label: 'Departed' },
  { value: 'cancelled', label: 'Cancelled' },
]
```

Use `statusToVariant(row.status)` -- do not remap to pending/active/completed unless STATUS_COLOR_MAP needs aliases.

## Flutter matrix

| Surface | Verdict | Notes |
|---------|---------|-------|
| Routes /visitor/* | PASS | tenant-only guard |
| My list | PASS | GET visitors/my |
| Register | PARTIAL **P0-F1** | Requires `user.tenantId` even though API resolves tenant from JWT |
| Status arrive/depart | PASS | |
| Feature flag UX | FAIL | 403 generic |
| Design | PARTIAL | Colors.black54 hardcodes |

### Critical: tenantId

- Seed/legacy users may lack `User.tenantId`.
- Fix: seed backfill + `/auth/me` enrich + Flutter `resolveTenantId()` that allows empty body for tenant role if API overrides.

## Lifecycle reality

```
Admin/Tenant POST create  -> status=expected
  -> POST arrive         -> arrived + actualArrival
  -> POST depart         -> departed + actualDeparture
POST approve             -> re-open cancelled to expected (not a pre-arrival gate)
```

There is **no** register -> pending -> approve chain unless product adds `pending`.

## Gaps

### P0

- [ ] List filter enum alignment (pending -> expected/cancelled)
- [ ] Flutter tenantId resolution for register

### P1

- [ ] assertVisitorAccess on GET/arrive/depart
- [ ] Transition guards (expected->arrived->departed; cancelled->expected via approve only)
- [ ] Edit expectedArrival field
- [ ] Detail Edit + Cancel one-click
- [ ] HTTP route tests

### P2

- [ ] VisitorLifecycleActions shared component
- [ ] Audit log on lifecycle actions
- [ ] Align @pg/types dual names
- [ ] FormSection on new form consistency

## Custom SaaS components

| Component | Purpose |
|-----------|---------|
| **VisitorLifecycleActions** | Detail (+ optional list) buttons from status |
| **StatusFilterSelect** | Enum-driven filters (prevents pending drift) |
| CancelConfirmButton | PUT cancelled without full edit |

## Acceptance

- [ ] Admin registers visitor for any tenant
- [ ] Tenant registers for self (with or without User.tenantId after fix)
- [ ] List filter expected/arrived/departed/cancelled works
- [ ] Edit loads names from lean mapVisitor
- [ ] Arrive then depart happy path admin + Flutter
- [ ] Illegal transitions 400; non-owner tenant 403
- [ ] visitorManagementEnabled false -> 403 FEATURE_DISABLED + nav hidden

## Remediation log

- 2026-07-12: Re-audit. Obsolete: admin create 403, /my shadow, lean name load empty, phone not normalized.
