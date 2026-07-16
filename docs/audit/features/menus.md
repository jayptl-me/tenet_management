# Menus (DailyMenu) -- Feature Audit

**Last verified:** 2026-07-16 (goal pass reconcile)  
**Admin grade:** A  
**Priority:** P2 polish

## Open gaps

### P0

None.

### P1

_None open._

### Deferred (product)

- **FLAG-menus:** Menus remain **always-on** (no feature flag); only meal feedback uses `messFeedbackEnabled`. Documented product split -- not a bug.

### P2

- [ ] Shared MenuMealItemsEditor extract (new/edit still duplicated field arrays)
- [ ] Client min-date=today to avoid PAST_DATE before submit
- [ ] Flutter optional week browse (`GET menus?fromDate&toDate`)
- [ ] Align `IDailyMenu` with derived `isActive` + timestamps if clients need it
- [ ] Route tests for PAST_DATE + date upsert residual

## Closed

- [x] POST menus exists; past-date guards via `todayInTZ()`
- [x] isActive list filter uses `todayInTZ()` (not UTC ISO)
- [x] WeekMenuPlanner + Past/Active/Scheduled badges
- [x] category on menu items
- [x] Past menus hide Edit on list
- [x] Menus usable when messFeedbackEnabled is false (by design)

## Acceptance checklist

- [x] Create today/future menu 201
- [x] Past create/edit 422 PAST_DATE
- [x] List badges Past / Active / Scheduled
- [x] Week view loads Mon-Sun grid
- [x] GET menus/today matches portal day (PG TZ)
- [x] Menus remain usable when messFeedbackEnabled is false
