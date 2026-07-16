# Interconnection: Feature Flags

**Last verified:** 2026-07-16

## Flow diagram or steps (ASCII ok)

```
AppConfig.features (Mongo single config doc)
  defaults in model schema + middleware loadFlags fallbacks
       |
       +-- PUT/PATCH appConfig (admin settings)
       |     -> invalidateFeatureFlagCache()
       |
       +-- requireFeature(flag) middleware on gated API routers
       |     -> 403 FEATURE_DISABLED when off (30s in-memory cache)
       |
       +-- Admin Sidebar / QuickCreate read flags from config
       |     -> hide nav items with matching featureFlag
       |
       +-- CommandPalette: filters commands with same featureFlag map as Sidebar
       |
       +-- Flutter: NO client flag read
             -> API 403 surfaces as generic Dio/error UX
```

## Code paths (source files)

| Concern | Path |
|---------|------|
| Schema defaults | `apps/api/src/models/appConfig.ts` (`features` subdoc) |
| Middleware + cache | `apps/api/src/middleware/featureFlags.ts` |
| Config PUT + invalidate | `apps/api/src/routes/appConfig.ts` |
| Shared types | `packages/types/src/appConfig.ts` `IFeatureFlags` |
| Seed defaults | `apps/api/src/scripts/seed.ts` |
| Tests | `apps/api/src/__tests__/feature-flags.test.ts` |
| Admin settings toggles | `apps/web/src/app/(admin)/settings/page.tsx` |
| Sidebar nav gating | `apps/web/src/components/admin/Sidebar.tsx` |
| Quick create gating | `apps/web/src/components/admin/QuickCreate.tsx` |
| Command palette (flag-gated) | `apps/web/src/components/admin/CommandPalette.tsx` |
| Flutter | `mobile/lib/**` — no AppConfig features consumer |

### Flag defaults (model / middleware / Sidebar FEATURE_DEFAULTS)

| Flag | Default | Domain |
|------|---------|--------|
| `attendanceEnabled` | **false** | Attendance + Leaves **nav and API** |
| `laundryEnabled` | true | Laundry API + nav |
| `messFeedbackEnabled` | true | Meals (feedback) API + Meals nav |
| `visitorManagementEnabled` | true | Visitors API + nav |
| `guardianPortalEnabled` | true | Guardians API + nav |
| `noticeBoardEnabled` | true | Notices API + nav |
| `emergencyAlertsEnabled` | true | Stored + settings UI only; **no requireFeature consumer, no Sidebar gate** |

### API `requireFeature` wiring (source)

| Flag | Mounted on |
|------|------------|
| `laundryEnabled` | `routes/laundry.ts` `use('*', ...)` |
| `messFeedbackEnabled` | `routes/meals.ts` |
| `visitorManagementEnabled` | `routes/visitors.ts` |
| `guardianPortalEnabled` | `routes/guardians.ts` |
| `noticeBoardEnabled` | `routes/notices.ts` |
| `attendanceEnabled` | `routes/attendance.ts`, `routes/leaves.ts` |
| (none) | `routes/menus.ts` — **always on** |
| (none) | Core tenants/rooms/invoices/payments/etc. |

### Admin nav vs always-on

| Module | Sidebar | API gate |
|--------|---------|----------|
| Laundry | `laundryEnabled` | yes |
| Meals | `messFeedbackEnabled` | yes |
| **Menus** | **always visible** | **no gate** |
| Notices | `noticeBoardEnabled` | yes |
| Visitors | `visitorManagementEnabled` | yes |
| Guardians | `guardianPortalEnabled` | yes |
| Attendance | `attendanceEnabled` | yes |
| Leaves | `attendanceEnabled` | yes (same flag) |
| Services, Assets, Complaints, Enquiries, Notifications, Finance, Tenants, Rooms, Floors | always | n/a (core) |

### Flutter

- Tenant shell always offers laundry/meals/notices/visitors/attendance/leaves routes in UI structure.
- When flag off, API returns 403 `FEATURE_DISABLED`; no dedicated empty-state mapping verified in mobile client.
- Guardian portal routes still hit guardians API (flag-gated server-side).

## What works

- Six operational flags enforced on their primary Hono routers via `requireFeature` (attendance also covers leaves).
- Defaults match between model schema, middleware fallbacks, seed, settings page, Sidebar.
- Settings Features tab can flip flags; `invalidateFeatureFlagCache` clears 30s cache on config write.
- Sidebar hides flagged items when config says false (with local FEATURE_DEFAULTS fallback).
- QuickCreate filters notice/guardian actions by flags.
- Feature-flag unit tests cover 403 when off and allow when on / default true.

## Gaps / half-baked

| Severity | Gap | Proof |
|----------|-----|-------|
| P2 | **Menus always-on** while Meals require `messFeedbackEnabled` — intentional split or product inconsistency | menus.ts ungated; meals gated |
| P2 | `emergencyAlertsEnabled` has no route/nav/Flutter enforcement — toggle is dead config | grep: only model/settings/middleware type |
| P2 | Flutter has no feature flag bootstrap; disabled modules show as errors not empty states | mobile has no AppConfig features parse |
| P2 | Direct URL to `/laundry` etc. still loads admin page when nav hidden; only API blocks mutations/list | Next admin pages not middleware-gated by flag |

**Obsolete:** claim that only laundry is gated. Full set of six routers are gated (leaves/menus/emergency excepted as above).

## Acceptance for fix agents

- [x] Toggle `laundryEnabled` false -> laundry API 403 FEATURE_DISABLED; Sidebar hides Laundry
- [x] Same API+nav pattern for visitors, guardians, notices, meals, attendance
- [x] Admin settings flips flags without redeploy; cache invalidates on write
- [x] Leaves API shares `attendanceEnabled` gate (FLAG-leaves FIXED)
- [x] CommandPalette filters commands with same flag map as Sidebar
- [ ] Product decision recorded: Menus always-on vs pair with `messFeedbackEnabled`
- [ ] `emergencyAlertsEnabled` either wired to a real surface or removed from settings
- [ ] Flutter maps FEATURE_DISABLED to friendly empty/disabled module state

## Remediation log

| Date | Change | Status |
|------|--------|--------|
| historical | Broader requireFeature rollout across laundry/meals/visitors/guardians/notices/attendance | Live |
| historical | Sidebar featureFlag keys aligned with AppConfig | Live |
| 2026-07-16 | Re-verified middleware, all gated routes, leaves/menus ungated, Flutter absence, emergencyAlerts dead | Docs synced |
| 2026-07-16 | Reconcile | CommandPalette **flag-gated** (same FEATURE_DEFAULTS as Sidebar) -- FLAG-palette closed |
| 2026-07-16 | Queue E | **FLAG-leaves FIXED** -- `leaves.use('*', requireFeature('attendanceEnabled'))` |
