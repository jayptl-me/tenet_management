# Notifications -- Gap Analysis

**Priority:** P0

## API reality (`routes/notifications.ts`)

- GET `/` list for current user
- GET `/unread-count`
- POST `/` admin create
- PATCH `/:id/read`
- PATCH `/read-all`
- DELETE `/:id` admin
- **No GET by id, No PUT**

## FE reality

- List: custom inbox UX + raw native select filter
- Detail/Edit pages call GET/PUT by id -- **dead**
- New create may work if payload matches createSchema

## Product decision required

**A)** Notifications are inbox-only: delete admin edit/detail routes and TableActions edit.  
**B)** Admin broadcast CRUD: implement GET/PUT with Zod and fields matching model.

## Also

- [ ] Replace native select filter with themed Select
- [ ] StatusBadge usage on read/unread OK if present

## Acceptance

- [ ] No 404 from admin UI actions that remain visible
- [ ] Mark read / read-all work
