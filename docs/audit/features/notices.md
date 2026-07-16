# Notices -- Gap Analysis

**Last verified:** 2026-07-16  
**Priority:** P2 polish (portal floor/room targeting **CLOSED** via resolveNoticeAudience)  
**Admin grade:** A-  
**Flutter grade:** C+ (list-only feed)  
**Feature flag:** `noticeBoardEnabled` (default true)

Code is truth. Prior audit claims (missing GET by id, enum mismatch, phantom isPublished/priority, wrong list endpoint) are **closed** against current source.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/noticePost.ts` |
| Routes | `apps/api/src/routes/notices.ts` |
| Feature flag | `apps/api/src/middleware/featureFlags.ts` (`requireFeature('noticeBoardEnabled')`) |
| Types | `packages/types/src/notice.ts` |
| Admin FE | `apps/web/src/app/(admin)/notices/**` |
| Nav / flag | `apps/web/src/components/admin/Sidebar.tsx`, settings features |
| Flutter | `mobile/lib/features/tenant/presentation/notices_screen.dart` |
| Flutter API | `mobile/lib/features/tenant/data/tenant_repository.dart` (`notices()`) |
| Seed | `apps/api/src/scripts/seed.ts` (sample notice posts) |
| Mount | `apps/api/src/index.ts` -> `/notices` |

---

## API surface

Route module is gated by `requireFeature('noticeBoardEnabled')` on `*` (403 `FEATURE_DISABLED` when off).

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/notices` | JWT | **Admin:** paginated list (`page`/`limit`/`search`/`targetType`), sort pinned then createdAt, populate author. **Tenant/guardian:** feed of up to 20 matching notices (see targeting). |
| GET | `/notices/admin` | admin | Paginated list without search; sort by createdAt only. **Redundant** -- admin UI uses GET `/`. |
| GET | `/notices/:id` | JWT | Detail; no ownership filter (any auth user can load any notice by id). |
| POST | `/notices` | admin | Create; `authorId` from JWT `sub`. |
| PUT | `/notices/:id` | admin | Partial update (strict Zod). |
| DELETE | `/notices/:id` | admin | Hard delete. |

### Create / update Zod

```
title: min 5, max 200
content: min 10, max 5000
pinned?: boolean (create default false)
targetType: all | floor | room | individual
targetIds?: string[] (default [])
```

### Model truth

| Field | Schema |
|-------|--------|
| title | required, trim, **minlength 3**, max 200 |
| content | required, trim, max 5000 (no minlength in model) |
| pinned | boolean, default false |
| authorId | ObjectId User, required; virtual `author` |
| targetType | enum `all \| floor \| room \| individual`, default `all` |
| targetIds | string[], default `[]` -- **free-text IDs, no FK validation** |
| timestamps | createdAt, updatedAt |
| indexes | `{ pinned: -1, createdAt: -1 }`, `{ targetType: 1 }` |

**Title min mismatch:** model allows 3 chars; route Zod enforces 5. API gate wins for writes. Document as intentional stricter API.

**Types lag:** `packages/types/src/notice.ts` `NoticeTargetType` is only `'all' \| 'floor' \| 'room'` -- missing `individual` that model, Zod, and FE all use.

---

## FE page matrix (admin)

| Page | Path | Stack | Verdict |
|------|------|-------|---------|
| List | `/notices` | PageHeader, DataTable, Select filter, StatusBadge, TableActions, ConfirmModal, mobileCardRenderer, ErrorBanner | **PASS** -- calls `notices?page&limit&search&targetType` |
| Detail | `/notices/[id]` | FormPage, DetailCard, StatusBadge, WhatsApp share | **PASS** |
| New | `/notices/new` | FormPage / FormCard / FormGrid / FormActions, Input, Textarea, Select, Checkbox, ResourceSelect | **PASS** -- ResourceSelect for floor/room/individual |
| Edit | `/notices/[id]/edit` | Same form stack; GET hydrate + PUT; ResourceSelect | **PASS** -- ResourceSelect for targets |

List delete uses `row._id` (lean responses keep `_id` -- correct).

Sidebar + QuickCreate hide Notices when `noticeBoardEnabled` is false (client). API still enforces the flag.

---

## Field coverage

| Field | New | Edit | Detail | List | Notes |
|-------|:---:|:----:|:------:|:----:|-------|
| title | Y | Y | Y | Y | FE/Zod min 5 |
| content | Y | Y | Y | truncate | |
| pinned | Checkbox | Checkbox | badge | badge | |
| targetType | Select | Select | badge/row | badge | all/floor/room/individual |
| targetIds | ResourceSelect multi | ResourceSelect multi | code chips | -- | FE refine requires ids when targetType !== all; stored as string[] |
| authorId / author | server | -- | not shown | -- | populated on API; detail ignores author |
| createdAt | -- | -- | Y | mobile card | |

**No** `isPublished`, `priority`, or schedule fields in model or FE (old phantom claims closed).

---

## Lifecycle

| Step | Status | Evidence |
|------|--------|----------|
| Create (all) | **PASS** | POST stores + list/detail |
| Create (floor/room/individual) | **PASS** FE | ResourceSelect pickers; API still stores IDs without FK join validation |
| Edit | **PASS** | GET + PUT |
| Pin / unpin | **PASS** | pinned boolean |
| Delete | **PASS** | ConfirmModal + DELETE |
| Admin list/search/filter | **PASS** | |
| Feature flag off | **PASS** API | 403; FE nav hides |
| Tenant feed (all) | **PASS** | `$or` includes `targetType: 'all'` |
| Tenant feed (individual) | **PASS** | `targetIds: user.sub` |
| Tenant feed (floor) | **PASS** | Resolves floorId via tenant.roomId -> Room.floorId |
| Tenant feed (room) | **PASS** | targetType room + tenant roomId |
| Flutter list | **PASS** basic | title + content; no pin/target badges, no detail route |
| Audit log on notice CRUD | **FAIL** | No `writeAuditLog` in notices routes |

### Tenant feed logic (code)

```ts
// apps/api/src/routes/notices.ts -- non-admin branch (after resolveNoticeAudience)
orConditions = [
  { targetType: 'all' },
  // floor if ctx.floorId from tenant room
  // room if ctx.roomId
  { targetType: 'individual', targetIds: user.sub },
]
```

JWT still only has `{ sub, role }`. Feed uses `resolveNoticeAudience` to load tenant/guardian ward room+floor from DB (N1/N2 closed).

---

## Design

| Check | Status |
|-------|--------|
| CSS variables / tokens | **PASS** on all four pages |
| StatusBadge for audience + pin | **PASS** |
| FormPage stack on new/edit/detail | **PASS** |
| Radix/themed Select (not native OS) | **PASS** |
| mobileCardRenderer | **PASS** |
| ResourceSelect for targets | **PASS** -- floors/rooms/tenants ResourceSelect on new+edit |
| WhatsApp share on detail | **PASS** (uses `NEXT_PUBLIC_PG_PHONE`) |

Default theme: **saas**.

---

## Open gaps

| ID | Sev | Gap | Fix direction |
|----|-----|-----|---------------|
| N4 | **P2** | API Zod may still allow empty targetIds for non-all; FE refine present | Align API create/update refine with FE |
| N5 | **P2** | `@pg/types` `NoticeTargetType` missing `individual` | Align with model enum |
| N6 | **P2** | Title min 3 (model) vs 5 (Zod) undocumented | Align model minlength to 5 or document API as source of truth |
| N7 | **P2** | GET `/notices/admin` redundant | Deprecate or point docs only; single list path |
| N8 | **P2** | GET `/:id` no audience check for non-admin | Optional: enforce same `$or` as feed for tenants |
| N9 | **P2** | No audit trail on notice create/update/delete | `writeAuditLog` with action create/update/delete, resource `notice` |
| N10 | **P3** | Flutter no detail / pin badge / empty targeting copy | Optional portal polish |
| N11 | **P3** | Detail omits author name | Show populated author |

---

## Closed (do not re-file)

| Old claim | Live status 2026-07-16 |
|-----------|------------------------|
| No GET `/:id` | **Fixed** -- exists; FE detail/edit load it |
| Admin list wrong endpoint / no meta | **Fixed** -- admin branch on GET `/` returns meta |
| targetType enum mismatch model vs Zod | **Fixed** -- both `all\|floor\|room\|individual` |
| Phantom isPublished / priority on FE | **Removed** -- only real fields |
| noticeBoardEnabled not enforced | **Fixed** -- route middleware + FE nav/QuickCreate |
| FE forms send invalid individual | **Fixed** -- individual is valid |

---
| N1 | **CLOSED** | Portal feed resolves floor from tenant room | Do not re-file |
| N2 | **CLOSED** | Portal feed includes room targetIds from tenant | Do not re-file |
| N3 | **CLOSED** | Was free-text targetIds; now ResourceSelect on new/edit | Do not re-file |


## Acceptance

- [ ] Create notice targetType `all` appears in admin list and Flutter notices list
- [ ] Create floor-targeted notice: tenants on that floor see it on GET `/notices` (currently fails)
- [ ] Create room-targeted notice: tenants in that room see it (currently fails)
- [ ] Create individual notice: only that user id sees it; admin list still shows it
- [ ] Edit title/content/pin/target; detail reflects changes
- [ ] Delete removes from list
- [ ] With `noticeBoardEnabled: false`, API returns 403 and admin nav hides Notices
- [ ] targetIds cannot be empty when audience is not All (after N4)
- [ ] `packages/types` NoticeTargetType includes `individual`

---

## Remediation log

| Date | Change |
|------|--------|
| 2026-07-12 (prior) | CRUD, GET by id, flag, enum align -- historical |
| 2026-07-16 | Full re-audit from source; rewritten this file. Open: portal floor/room targeting (N1/N2) |
| 2026-07-16 | Reconcile | **N3 CLOSED** -- ResourceSelect on notices new/edit |
|
