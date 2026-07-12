# Complaints -- Gap Analysis

**Priority:** P0

## API

- Full GET list/detail, POST create, DELETE
- Status update only: `PUT /:id/status` with `{ status, adminNotes? }`
- **No** full `PUT /:id`
- Model priority enum: `low|medium|high|urgent`
- Status enum: `open|in_progress|resolved|dismissed`

## FE edit

```ts
await api.put(`complaints/${id}`, { json: data });
// data includes title, description, category, priority: critical, status, adminNotes
```

1. Path 404 (no full PUT)
2. priority `critical` invalid vs `urgent`
3. Even if path fixed, full body not accepted by status schema

## Fixes

**Option A (workflow):** Edit form only status + adminNotes; call `put complaints/${id}/status`.

**Option B (full edit):** Implement PUT `/:id` with zod for title/description/category/priority/status/adminNotes; FE priority options use urgent.

Kanban/optimistic UI on list if present must use same status endpoint.

## Acceptance

- [ ] Admin can resolve complaint
- [ ] Priority values persist only from model enum
- [ ] No 404 on save
