# Menus (DailyMenu) -- Gap Analysis (code-verified 2026-07-12)

**Priority:** P2 polish (week planner, labels); CRUD **PASS**  
**Admin grade:** A-  
**Theme:** SaaS FormPage; add WeekMenuPlanner + shared meal item editor

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/dailyMenu.ts` |
| Routes | `apps/api/src/routes/menus.ts` |
| Types | `packages/types/src/menu.ts` |
| Admin FE | `apps/web/src/app/(admin)/menus/**` |
| Flutter | via `tenant_repository.todayMenu()` -> GET menus/today |

## Model truth

```
date: YYYY-MM-DD unique
meals.breakfast|lunch|dinner: [{ name, description?, category? }]
timestamps
```

**No stored `isActive`.** Routes derive `isActive: date >= today`.

## API surface

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/menus/today` | JWT | 404 if none |
| GET | `/menus` | JWT | fromDate/toDate/isActive(derived)/search |
| POST | `/menus` | admin | **EXISTS**; past date 422 PAST_DATE |
| GET | `/menus/:id` | JWT | ObjectId **or** YYYY-MM-DD |
| PUT | `/menus/:id` | admin | full menuDaySchema; date-string upsert |
| DELETE | `/menus/:id` | admin | ObjectId or date |

**Not feature-gated** (unlike meals / messFeedbackEnabled). Nav always shows Menus.

Older audit claim "POST menus missing" is **obsolete**.

## Admin FE matrix

| Page | Verdict | Notes |
|------|---------|-------|
| List | PASS | Active/Draft badge from derived isActive -- **Draft label for past is misleading** (prefer Past) |
| Detail | PASS | B/L/D cards, WhatsApp share, Edit CTA |
| New | PASS | nested meals payload correct; no category field |
| Edit | PASS | same; past date only generic error |

## Flutter

- Only **today** menu consumed.
- No week browse (`GET menus`).
- Feedback lives on meals screen.

## Gaps

### P1

- [ ] Product decision: gate menus with messFeedbackEnabled or keep always-on (document)
- [ ] Align IDailyMenu with isActive + timestamps if clients need it

### P2

- [ ] Relabel Active / Past (not Draft)
- [ ] WeekMenuPlanner page or list mode
- [ ] MenuMealItemsEditor shared (Input + fieldControlBase)
- [ ] Optional category on items
- [ ] Client min date = today to avoid PAST_DATE
- [ ] Flutter optional week menu list

## Custom SaaS components

| Component | Purpose |
|-----------|---------|
| **WeekMenuPlanner** | 7-day grid; open day editor; copy previous day |
| **MenuMealItemsEditor** | Shared new/edit breakfast/lunch/dinner rows |
| Status label helper | map isActive+date -> Active / Today / Past |

## Acceptance

- [ ] Create future/today menu 201
- [ ] Past create 422 with clear message
- [ ] Edit by id and by date upsert
- [ ] Today endpoint matches calendar day for portal
- [ ] List badges not called Draft for historical menus

## Remediation log

- 2026-07-12: Re-audit. Obsolete: POST missing; phantom isActive stored field (derived only).
