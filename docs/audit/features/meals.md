# Meals (MealFeedback) -- Gap Analysis (code-verified 2026-07-12)

**Priority:** P1 (summary unused, Flutter depth); contracts **PASS**  
**Admin grade:** A-  
**Theme:** SaaS list + FormPage; add FeedbackSummaryStrip + StarRating

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/mealFeedback.ts` |
| Routes | `apps/api/src/routes/meals.ts` |
| Types | `packages/types/src/meal.ts` (summary shape lag) |
| Admin FE | `apps/web/src/app/(admin)/meals/**` |
| Flutter | `mobile/lib/features/tenant/presentation/meals_screen.dart` |

## Model truth

| Field | Constraints |
|-------|-------------|
| tenantId | ObjectId Tenant |
| date | YYYY-MM-DD |
| mealType | breakfast \| lunch \| dinner |
| rating | 1-5 |
| status | submitted \| acknowledged \| actioned (default submitted) |
| comment | max 500 |
| categories | string[] (tenant path enum-validated) |
| Unique | tenantId + date + mealType |

Feature flag: **`messFeedbackEnabled`** on entire meals router.

## API surface

| Method | Path | Role | Notes |
|--------|------|------|-------|
| POST | `/meals` | admin | upsert; no categories |
| POST | `/meals/feedback` | tenant | categories **required** min 1 enum |
| GET | `/meals/feedback/summary` | admin | array `{ date, mealType, avgRating, count }` -- **unused by FE** |
| GET | `/meals/feedback/my` | tenant | last 30 -- **unused by Flutter** |
| GET | `/meals/feedback` | admin | list + filters; virtual `tenant` populate |
| GET | `/meals/:id` | admin | populate tenantId.userId/roomId (**different shape than list**) |
| PUT | `/meals/:id` | admin | **allows** mealType, rating, comment, status, categories |
| DELETE | `/meals/:id` | admin | |

### PUT schema (verified fixed)

```ts
z.strictObject({
  mealType: z.enum(['breakfast', 'lunch', 'dinner']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(500).optional(),
  status: z.enum(['submitted', 'acknowledged', 'actioned']).optional(),
  categories: z.array(z.enum([...])).optional(),
})
```

Older audit claim "PUT rejects mealType" is **obsolete**.

## Admin FE matrix

| Page | Verdict | Notes |
|------|---------|-------|
| List | PASS | GET feedback; filters mealType/rating/search; **no date filter/column**; **no summary strip** |
| Detail | PASS | stars display, categories chips; **no Edit CTA** |
| New | PASS | POST admin schema match |
| Edit | PASS contract | sends mealType+rating+comment+status; categories not editable; stars display-only + number input |

List uses virtual `tenant.user`; detail uses `tenantId.userId` -- both correct for their endpoints.

## Flutter matrix

| Capability | Status |
|------------|--------|
| Today menu GET menus/today | PARTIAL -- errors -> empty |
| Submit feedback | PASS happy path |
| Categories | hardcoded `['taste']` |
| Rating | Slider (not stars) |
| History feedback/my | **missing** |
| Feature flag | no client gate |

## Types lag

| Type | Issue |
|------|-------|
| IMealFeedback | missing status |
| IMealFeedbackSummary | wrong rollup shape vs API array |
| IMealFeedbackCreate | categories optional in type; required for tenant |

## Gaps

### P0

None for admin create/edit contracts when flag on.

### P1

- [ ] Wire FeedbackSummaryStrip to GET summary
- [ ] Date column + date filter on list
- [ ] Categories on admin edit (chip multi-select)
- [ ] Flutter category chips + history
- [ ] Align packages/types
- [ ] mealType change unique 11000 -> 409
- [ ] Flag-pair menus nav with messFeedbackEnabled (product decision)

### P2

- [ ] Interactive StarRating component
- [ ] Detail Edit button
- [ ] fieldControlBase on rating number input
- [ ] SSE meal_feedback_submitted emit or drop
- [ ] Route tests

## Custom SaaS components

| Component | Wire to |
|-----------|---------|
| **FeedbackSummaryStrip** | GET `/meals/feedback/summary?dateFrom=&dateTo=` above list |
| **StarRating** | edit (interactive), detail (readonly), Flutter |
| **CategoryChipSelect** | Flutter submit + admin edit |

## Acceptance

- [ ] Edit status/rating/comment saves 200
- [ ] mealType change either works with 409 on conflict or is read-only
- [ ] List shows tenant name + date
- [ ] Summary strip shows avg ratings
- [ ] Flutter can pick categories; history lists past feedback
- [ ] Flag off -> 403 + nav hidden
- [ ] typecheck + lint green

## Remediation log

- 2026-07-12: Re-audit. Obsolete: PUT mealType reject; "portal API only".
