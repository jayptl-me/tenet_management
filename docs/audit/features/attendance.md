# Attendance -- Feature Audit

**Last verified:** 2026-07-16 (goal pass reconcile)  
**Admin grade:** A-  
**Priority:** P2 residual (QR product flow, ownership polish)

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/attendanceRecord.ts` |
| Routes | `apps/api/src/routes/attendance.ts` |
| Types | `packages/types/src/attendance.ts` |
| Admin | `apps/web/src/app/(admin)/attendance/**` |
| Flutter | `mobile/lib/features/tenant/presentation/attendance_screen.dart` |

Feature flag: **`attendanceEnabled`** (default **false** in seed -- intentional ops default).

## Open gaps

### P0

None.

### P1

_None open._

### Deferred (product / non-goal)

- **ATT-SEED:** Default `attendanceEnabled: false` -- enable in Settings; Flutter nav hides via app-config when off.
- **ATT-QR-FLOW:** Full QR check-in scanner -- admin method options no longer offer `qr` until product ships scanner (enum residual only).

### P2

- [ ] GET `/:id` ownership for tenant role
- [ ] Align `@pg/types` IAttendanceRecord checkIn vs FE checkInTime alias if still dual-read
- [ ] Extra HTTP route tests for window + unique beyond existing suites

## Closed

- [x] `today()` / check-in window use `todayInTZ` + `currentHourInTZ` (not UTC server local)
- [x] Check-in 11000 -> ALREADY_RECORDED
- [x] Manual POST 11000 -> ALREADY_RECORDED (2026-07-16)
- [x] ATT-search server-side name search
- [x] Flutter check-in/out + FeatureDisabledWidget + ensureTenantId
- [x] Admin new drops fictional `qr` method option

## Acceptance checklist

- [x] Settings enable attendance -> nav + API work
- [x] Flag off -> 403 FEATURE_DISABLED + Flutter/admin nav hide
- [x] Manual mark creates present/absent/on_leave/not_returned
- [x] Flutter check-in/out when flag on
- [x] Duplicate same tenant+date returns friendly error
