# Session deep remediate -- 2026-07-16

Independent multi-agent re-audit (code truth) found gaps that LIVE_GAP understated.
This file records what was verified and fixed in this session.

## Method

1. Loaded docs/audit/* + AGENT_CONTEXT.
2. Parallel code-explorer agents: meals/menus, tenants/rooms/beds, finance, Flutter portal, ops/flags.
3. Implemented P0/P1 integrity and date bugs directly in source.

## Fixed this session (proof paths)

### Money integrity (API)

| ID | Fix | Paths |
|----|-----|-------|
| PAY-UTR-OWN | `submit-utr` is `tenantOnly`; ownership on invoice.tenantId; reject paid/cancelled; never mutate paid rows; amount = remaining balance | `apps/api/src/routes/payments.ts` |
| PAY-QR-BAL | QR amount uses balance; tenant ownership; reject non-payable | same |
| PAY-PUT-LOCK | Paid payments locked on PUT; stamp paidAt when forcing paid | same |
| PAY-STATUS | Sticky paid when totalPaid=0 fixed; partial not clobbered by overdue job | `payment-status.service.ts`, `jobs/scheduler.ts` |
| INV-PAYMENTS | Invoice detail returns non-cancelled payments; paidAmount only from paid | `routes/invoices.ts` |
| ELEC-DIST | Skip cancelled; skip paid already with electricity; only mark distributed when errors=0 | `routes/electricity.ts` |

### Occupancy / rooms / floors

| ID | Fix | Paths |
|----|-----|-------|
| T-INACTIVE-XFER | PUT rejects room/bed change when tenant inactive | `routes/tenants.ts` |
| T-REINSTATE-SELF | Reinstate allows bed occupied by same tenant | same |
| RM-FLOOR-COUNT | recomputeFloorTotalRooms on floorId/isActive/sharingType/soft-delete | `routes/rooms.ts` |
| FL-DEL-SOFT | Floor delete counts only active rooms | `routes/floors.ts` |

### Menus / meals / dates

| ID | Fix | Paths |
|----|-----|-------|
| MENU-TZ | menus today/past guards use `todayInTZ()` | `routes/menus.ts`, `lib/dates.ts` |
| MENU-PUT-11000 | ObjectId PUT catches DUPLICATE_MENU | `routes/menus.ts` |
| MENU-WEEK-LOCAL | WeekMenuPlanner local YMD (no toISOString) | `WeekMenuPlanner.tsx` |
| MENU-WEEK-NAV | View goes to detail; Create uses `?date=`; new page reads query | menus list/new/planner |
| MENU-DETAIL | Past/Active/Scheduled badges; hide Edit on past | menus/[id]/page.tsx |
| ATT-TZ | Attendance today uses todayInTZ | `routes/attendance.ts` |
| TYPES-MEAL | status, summary row shape, admin create type | `packages/types/src/meal.ts` |
| TYPES-ROOM | roomAmenities on IRoom/IRoomCreate | `packages/types/src/room.ts` |
| TYPES-MENU | isActive/timestamps + create type | `packages/types/src/menu.ts` |
| STATUS-MAP | meal + past/scheduled variants | `packages/types/src/tokens.ts` |

### Flutter / admin flags

| ID | Fix | Paths |
|----|-----|-------|
| FL-403 | isFeatureDisabled only FEATURE_DISABLED code | `mobile/.../api_exception.dart` |
| FL-CANCEL | visitor cancel API + Cancel visit CTA | visitor_repository + status screen |
| EMERGENCY-UI | EmergencyAlertButton hidden when flag off | EmergencyAlertButton.tsx |

## Still open (next stages)

### P1 residual

1. Flutter change/forgot password (API exists; no UI) -- P1-AUTH-PW
2. Flutter proactive app-config feature hide (nav still shows gated modules)
3. ~~Complaint photos dead contract~~ **FIXED later** -- URL create/update + POST :id/photos (see SESSION lifecycle + leave-cancel-complaint-photos tests)
4. Attendance method `qr` enum without QR flow
5. Admin types lag residuals (ITenantCreate flat docs)

### P2 residual

1. Room photo upload UI
2. OccupancyBedPicker reuse on tenant edit
3. Laundry free-form time / items
4. Guardian depth (product may not want finance APIs)
5. Seed attendanceEnabled default false
6. Scheduler push TODOs (ntfy) still log-only

## Verification

- `bun run typecheck` -- pass (types, api, web)
- `bun run lint` -- pass (api warnings cleared for attendance imports)
- `cd mobile && flutter analyze` -- no issues

## Do not re-open closed historical P0s

Transfer atomicity, isActive free toggle, temp password, visitor filter enums remain closed; this session added **new** integrity holes discovered by re-read of payments UTR and inactive transfer.
