# Interconnection: Feature Flags

**Updated:** 2026-07-12 (code-verified)

## Definition

`AppConfig.features` booleans (`apps/api/src/models/appConfig.ts`):

| Flag | Default (model / middleware) | Domain |
|------|------------------------------|--------|
| attendanceEnabled | false / false | Attendance + Leaves routes + nav |
| laundryEnabled | true | Laundry slots |
| messFeedbackEnabled | true | Meals feedback routes + Meals nav |
| visitorManagementEnabled | true | Visitors |
| guardianPortalEnabled | true | Guardians routes + nav |
| noticeBoardEnabled | true | Notices |
| emergencyAlertsEnabled | true | Emergency alert UX (verify enforcement) |

Middleware: `apps/api/src/middleware/featureFlags.ts` -> `requireFeature(flag)`.

## Enforcement reality (source 2026-07-12)

| Flag | API `requireFeature` | Admin nav (Sidebar) |
|------|----------------------|---------------------|
| laundryEnabled | YES `routes/laundry.ts` | YES |
| messFeedbackEnabled | YES `routes/meals.ts` | YES Meals |
| visitorManagementEnabled | YES `routes/visitors.ts` | YES |
| guardianPortalEnabled | YES `routes/guardians.ts` | YES |
| noticeBoardEnabled | YES `routes/notices.ts` | YES |
| attendanceEnabled | YES `routes/attendance.ts` | YES Attendance + Leaves |
| emergencyAlertsEnabled | Partial / verify | Emergency button |
| Menus | **No API gate** | **Always visible** |
| Leaves API | Shares attendance flag on nav; verify route middleware | nav with attendance |

Older claim "only laundry gated" is **obsolete**.

## Product inconsistencies

1. **Menus vs Meals:** meals require messFeedbackEnabled; menus always on. Decide: pair flags or document intentional split.
2. **CommandPalette:** may still list disabled modules -- verify and gate.
3. **Flutter:** no client-side flag read; API 403 FEATURE_DISABLED surfaces as generic error.

## Required work

- [ ] Pair menus with messFeedbackEnabled OR document always-on menus
- [ ] CommandPalette respects same flags as Sidebar
- [ ] emergencyAlertsEnabled end-to-end if used
- [ ] Flutter: map FEATURE_DISABLED to friendly empty state
- [ ] Settings Features tab flips flags; FE nav updates without redeploy (verify)

## Acceptance

- [ ] Toggle laundryEnabled false -> laundry POST 403 FEATURE_DISABLED + nav hidden
- [ ] Same pattern for attendance, visitors, guardians, notices, meals
- [ ] Menus behavior matches product decision
- [ ] Admin settings can flip flags live
