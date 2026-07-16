# Laundry -- Feature Audit

**Last verified:** 2026-07-16 (goal pass reconcile)  
**Admin grade:** A-  
**Priority:** P2 residuals only  
**Theme:** SaaS list + Form stack

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/laundrySlot.ts` |
| Routes | `apps/api/src/routes/laundry.ts` |
| Types | `packages/types/src/laundry.ts` (tenant booking slots -- aligned) |
| Admin FE | `apps/web/src/app/(admin)/laundry/**` |
| Flutter | `mobile/lib/features/tenant/presentation/laundry_screen.dart` |

## Open gaps

### P0

None.

### P1

_None open._ Material items closed below.

### P2

- [ ] Capacity / shared machine scheduling if product needs global slot exclusivity
- [ ] Tenant cancel own booking endpoint (status PUT admin-only today)
- [ ] Free-form time (no slot catalogue) product polish
- [ ] Route tests for unique index + flag beyond create 409 smoke

## Closed

- [x] laundryEnabled enforced API + Sidebar + Flutter FeatureDisabledWidget
- [x] FE items min 1 preprocess on new + edit
- [x] 11000 -> DUPLICATE_SLOT 409 on create
- [x] **Types package rewritten** to tenant booking slots (not machine/floor fiction)
- [x] Flutter `ensureTenantId` on book path
- [x] Flutter 403 FEATURE_DISABLED UX
- [x] mapLaundrySlot on PUT response
- [x] Admin new surfaces DUPLICATE_SLOT via `parseApiError` (2026-07-16)

## Acceptance checklist

- [x] Admin books slot for tenant 201
- [x] Duplicate same tenant/date/time -> friendly 409
- [x] Flag off -> 403 + nav hidden (admin + Flutter)
- [x] Flutter tenant books with ensureTenantId heal
