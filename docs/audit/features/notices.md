# Notices -- Gap Analysis

**Priority:** P0 -- triple contract failure (missing GET, enum mismatch, phantom fields).

## Source

- Model: `apps/api/src/models/noticePost.ts`
  - fields: title, content, pinned, authorId, targetType enum **`all|floor|room`**, targetIds[]
  - **No** priority, **No** isPublished
- Routes: `apps/api/src/routes/notices.ts`
  - GET `/` role feed (not admin pagination)
  - GET `/admin` paginated
  - POST `/` Zod targetType **`all|floor|individual`** -- **diverges from model `room`**
  - PUT `/:id` partial same schema
  - DELETE `/:id`
  - **No GET `/:id`**
- FE list calls `notices?page&limit` expecting meta -- wrong endpoint
- FE edit GET `notices/${id}` -- 404
- FE forms send isPublished, targetType individual

## Failures

1. Admin list wrong endpoint/shape
2. Edit/detail load 404
3. Create/update with `individual` may fail Mongoose enum validation (or pass Zod then fail save)
4. isPublished/priority UI is fiction
5. noticeBoardEnabled not enforced

## Fixes (end-to-end decide one enum)

**Recommended:** Model + Zod + FE all use `all | floor | room` (or all use individual if product wants tenants -- then change model).

- [ ] Add GET `/:id` admin
- [ ] Align targetType everywhere
- [ ] Remove isPublished/priority from FE OR add to model with defaults
- [ ] List -> `notices/admin`
- [ ] PUT body whitelist: title, content, pinned, targetType, targetIds

## Acceptance

- [ ] Admin list paginates
- [ ] Edit loads and saves
- [ ] Create with floor target stores valid enum
