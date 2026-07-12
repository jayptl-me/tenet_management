# Assets -- Gap Analysis

**Priority:** P0  
**Root cause:** No `GET /assets/:id` while detail/edit pages call it.

## Source

- Model: `apps/api/src/models/asset.ts`
- Routes: `apps/api/src/routes/assets.ts` -- GET `/`, GET `/low-stock`, POST `/`, PUT `/:id`, DELETE `/:id`
- FE: `apps/web/src/app/(admin)/assets/**`

## Failures

1. Edit load: `api.get(assets/${id})` -> 404. Form never hydrates.
2. Detail page same GET -- broken unless it incorrectly uses list filter.
3. PUT exists -- save would work if load worked and payload matches update schema.

## Fixes

- [ ] Add `GET /:id` adminOnly after `/low-stock` (static path must stay first)
- [ ] Align create/update Zod with form fields (name, category, location, quantity, lowStockThreshold, status, dates, notes)
- [ ] StatusBadge already used on list -- keep
- [ ] Native Select on category/status -- design batch

## Acceptance

- [ ] Detail and edit load 200
- [ ] Edit save 200
- [ ] Low-stock endpoint still works
