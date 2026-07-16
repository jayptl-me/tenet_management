# Meals (MealFeedback) -- Gap Analysis

**Last verified:** 2026-07-16 (goal pass reconcile)  
**Admin grade:** A  
**Priority:** P2 polish  
**Theme:** SaaS list + FeedbackSummaryStrip + StarRating + CategoryChipSelect

Feature flag: **`messFeedbackEnabled`** (default true) -- not `mealsEnabled`.

## Open gaps

### P0

None.

### P1

_None open._

### Deferred (product)

- Menus nav always-on vs messFeedbackEnabled pairing -- documented; menus independent of feedback flag.

### P2

- [ ] Admin create categories optional field for parity with tenant
- [ ] SSE `meal_feedback_submitted` emit if dashboard expects real-time
- [ ] Route tests for upsert + flag residual

## Closed

- [x] FeedbackSummaryStrip wired to GET summary
- [x] Date column + filters; categories on admin edit
- [x] Flutter category multi-select + feedback/my history
- [x] PUT mealType 11000 -> 409 `DUPLICATE_FEEDBACK`
- [x] Tenant re-submit resets `status: submitted`
- [x] `packages/types` status + IMealFeedbackSummaryRow aligned
- [x] Detail page Edit action
- [x] Past/menus list edit hardening related (menus module)

## Acceptance checklist

- [x] Admin records feedback 201 (upsert)
- [x] Edit status/rating/comment/categories saves 200
- [x] mealType change either succeeds or clear 409 on conflict
- [x] Summary strip shows averages
- [x] Flutter submit with categories; history lists past feedback
- [x] Flag off -> 403 + Meals nav hidden
