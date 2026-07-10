---
name: visitor-fixes-applied
description: Full visitor module fixed -- backend route/model field mismatch, frontend detail/edit pages
metadata:
  type: project
---

Visitor module was fully broken: route Zod schema used `name`/`phone`/`expectedVisitDate` but Mongoose model had `visitorName`/`visitorPhone`/`expectedArrival`. No `GET /:id` handler existed. Frontend detail page referenced non-existent fields (`notes`, `checkIn`, `checkOut`, `approverName`). Frontend edit page sent `name`/`phone` in PUT body but route Zod expected `visitorName`/`visitorPhone`.

**Fixes applied across 3 sessions:**

1. Route rewritten: Zod schemas match model fields (`visitorName`, `visitorPhone`, `expectedArrival`)
2. `GET /:id` handler added with full population (tenant -> user, room)
3. Model toJSON aliases `visitorName`->`name`, `visitorPhone`->`phone` for frontend compatibility
4. Detail page (`visitors/[id]/page.tsx`): removed `checkIn`/`checkOut`/`departure`/`approverName`/`approverRelation`/`notes` references; uses `actualArrival`/`actualDeparture` directly
5. Edit page (`visitors/[id]/edit/page.tsx`): form schema uses `visitorName`/`visitorPhone`; `reset()` maps GET response `name`/`phone` to form's `visitorName`/`visitorPhone`
6. Tests created: 8 visitor model tests covering CRUD, validation, toJSON alias, and lifecycle

**Pattern:** Mongoose stores `visitorName`/`visitorPhone`; toJSON exposes `name`/`phone`; frontend forms use `visitorName`/`visitorPhone` in API calls (matching route Zod). GET responses return `name`/`phone` via toJSON alias.
