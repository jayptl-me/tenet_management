# Notifications -- Gap Analysis

**Last verified:** 2026-07-16  
**Priority:** P1 (compose solid; history semantics + portal read UX + badge coupling issues)  
**Admin grade:** B  
**Flutter grade:** C+  
**Feature flag:** none on notification routes (`emergencyAlertsEnabled` exists in AppConfig but is **not** wired to this router)

Code is truth. Prior audit claims (no GET by id, no PUT, dead detail/edit) are **closed**. Dual compose was consolidated into list tabs; `/notifications/new` redirects.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/notification.ts` |
| Service | `apps/api/src/services/notification.service.ts` |
| Routes | `apps/api/src/routes/notifications.ts` |
| Push | `apps/api/src/lib/ntfy.ts` |
| SSE bus | `apps/api/src/lib/eventBus.ts` + broadcast on create |
| Types | `packages/types/src/notification.ts`, `packages/types/src/sse.ts` |
| Admin FE list/compose | `apps/web/src/app/(admin)/notifications/page.tsx` |
| Admin FE detail | `apps/web/src/app/(admin)/notifications/[id]/page.tsx` |
| Admin FE edit | `apps/web/src/app/(admin)/notifications/[id]/edit/page.tsx` |
| Admin FE new | `apps/web/src/app/(admin)/notifications/new/page.tsx` (redirect only) |
| Flutter | `mobile/lib/features/tenant/presentation/notifications_screen.dart` |
| Flutter API | `tenant_repository.dart` (`myNotifications`, `markNotificationRead`, `markAllNotificationsRead`) |
| Related badges | `apps/api/src/routes/dashboard.ts` GET `/badges`; `apps/web/src/hooks/useSidebarBadges.ts` |
| Mount | `apps/api/src/index.ts` -> `/notifications` |

---

## API surface

All routes use `authGuard` at module level.

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/notifications` | JWT | Paginated. **Admin:** all notifications (optional `type`, `unreadOnly`). **Non-admin (F1 FIXED):** history via `recipientUserIds` (legacy fallback `unreadBy`); inbox via `unreadOnly=true` or `status=unread`. List rows include `isRead`. |
| GET | `/notifications/unread-count` | JWT | Count where user in `unreadBy` |
| POST | `/notifications` | admin | Create + resolve recipients + optional ntfy + SSE `notification_created` |
| PATCH | `/notifications/read-all` | JWT | Pull user from all `unreadBy` |
| GET | `/notifications/:id` | JWT | No ownership check |
| PUT | `/notifications/:id` | admin | Metadata edit only -- **does not re-broadcast or re-resolve recipients** |
| PATCH | `/notifications/:id/read` | JWT | Pull self from `unreadBy` |
| DELETE | `/notifications/:id` | admin | Hard delete |

### Create Zod

```
targetType: all | individual | room | floor
targetIds?: string[] default []
title: min 1, max 200
body: min 1, max 2000
type: payment_reminder | payment_verified | complaint_update | announcement
      | service_update | electricity_bill | welcome | emergency | meal_feedback
data?: Record<string,string>
sendPush?: boolean default true
```

### Model truth

| Field | Schema |
|-------|--------|
| targetType | required enum all/individual/room/floor |
| targetIds | string[], default [] -- free-text entity/user IDs |
| title / body | required; body max 2000 |
| type | closed enum (9 values) |
| data | Map string->string |
| unreadBy | ObjectId[] User -- **unread set**, not `readBy` |
| sentAt | Date default now |
| timestamps | createdAt only (no updatedAt) |
| indexes | createdAt, type, targetType, unreadBy |

### Recipient resolution (`notification.service.ts`)

| targetType | Resolution |
|------------|------------|
| `all` | **Active Users with role `tenant` only (F3 FIXED)** -- not admins/guardians |
| `individual` | Active users by `_id` in targetIds |
| `floor` | Rooms on those floors -> active tenants -> users |
| `room` | Active tenants in those rooms -> users |

Each recipient is stored in permanent `recipientUserIds` and initial `unreadBy`. Optional ntfy push per user with `ntfyTopic`. SSE broadcasts `notification_created` and `badges-update` to admin SSE subscribers.

**Audit:** POST writes `writeAuditLog(..., action: 'notification_send')` (F6 FIXED with A1).

---

## FE page matrix (admin)

| Page | Mode | Verdict |
|------|------|---------|
| List `/notifications` | Tabs: **Compose** + **History** | **PASS** as primary surface |
| Compose tab | ResourceSelect for floor/room/tenant; type chips; title/body; sendPush; WhatsApp preview for emergency | **PASS** -- stronger targeting UX than notices |
| History tab | DataTable, type Select filter, StatusBadge unread counts, TableActions view/edit | **PASS** for admin broadcast log |
| Detail `/notifications/[id]` | FormPage + DetailCard | **PASS** load; phantom `status`/`scheduledFor` display branches unused |
| Edit `/notifications/[id]/edit` | FormPage stack; ResourceSelect targets | **PASS** pickers; residual: "will be sent" copy implies re-send though PUT is metadata-only |
| New `/notifications/new` | `router.replace('/notifications')` | **PASS** consolidation (no dual compose form) |

History uses `row.id` (mongoose docs serialize with transform). Detail uses lean `_id` in description -- acceptable.

Compose individual targets use `valueKey="userId"` on tenants ResourceSelect (correct for User-based individual resolution).

---

## Field coverage

| Field | Compose | Edit | Detail | History | Notes |
|-------|:-------:|:----:|:------:|:-------:|-------|
| title | Y | Y | Y | Y | |
| body | Y | Y | Y | mobile | |
| type | chip grid | Select | Y | icon+label | |
| targetType | chip grid | Select | Y | label | |
| targetIds | ResourceSelect multi | ResourceSelect multi | no | count only | both compose + edit use pickers |
| sendPush | checkbox | -- | -- | -- | create only |
| data map | -- | -- | -- | -- | unused in admin UI |
| unreadBy | server | -- | not shown | StatusBadge count | |
| sentAt | server | -- | via created fallback | Y | |
| status / scheduledFor | -- | -- | phantom optional | -- | not on model |

---

## Lifecycle

| Step | Status | Notes |
|------|--------|-------|
| Admin compose + send (all) | **PASS** | Creates doc, push, SSE |
| Compose floor/room/individual | **PASS** | ResourceSelect + server resolve |
| History list + type filter | **PASS** | Admin sees full history |
| View detail | **PASS** | GET by id |
| Edit metadata | **PASS** API | No re-push; UI copy misleading |
| Delete | **API only** | No FE delete action on history |
| Mark read / read-all | **PASS** API | Used by Flutter; admin rarely |
| Tenant inbox list | **PASS** | F1: history via recipientUserIds; mark-read keeps row with isRead |
| Flutter mark read | **PASS** | F2: isRead from API + unreadBy; uses id/_id |
| Audit `notification_send` | **PASS** | Written on admin POST |
| System-generated notifs (payments etc.) | **Sparse** | Jobs still TODO for push; few callers of `createNotification` outside POST |

### History semantics (product)

Admin history tab correctly shows all notifications because `listNotifications` skips the unread filter when `role === 'admin'`.

Tenant/guardian GET list (F1 FIXED):

```ts
// default history
filter.$or = [{ recipientUserIds: objectId }, { unreadBy: objectId }];
// inbox: unreadOnly=true or status=unread -> filter.unreadBy = objectId
```

Permanent `recipientUserIds` is set on create alongside `unreadBy`. Mark-read only pulls from `unreadBy`.

---

## Design

| Check | Status |
|-------|--------|
| Tokens / CSS variables | **PASS** |
| StatusBadge unread / all-read | **PASS** |
| Themed Select for type filter | **PASS** |
| ResourceSelect on compose | **PASS** |
| Native checkbox for sendPush | **OK** minor (could use Checkbox component) |
| Dual compose entry | **Closed** -- `/new` redirects |
| Edit ResourceSelect targets | **PASS** -- residual F5 is misleading re-send copy only |
| Emergency WhatsApp preview | **PASS** compose only |

---

## Open gaps

| ID | Sev | Gap | Fix direction |
|----|-----|-----|---------------|
| F5 | **P2** | Edit still says "This notification will be sent to..." though PUT is metadata-only (no re-broadcast) | Change label to "Metadata only -- does not re-send" (ResourceSelect already wired) |
| F7 | **P2** | No FE delete on history | Optional TableActions delete + ConfirmModal |
| F8 | **P2** | Detail phantom status/scheduledFor | Remove; show unreadBy length + targetIds |
| F9 | **P2** | `emergencyAlertsEnabled` unused | Wire to emergency type or drop dead flag |
| F10 | **P3** | System events (payment verified, complaint update) rarely auto-create notifications | Call `createNotification` from those routes |
| F11 | **P3** | GET by id open to any JWT | Optional ownership for non-admin |

---

## Closed (do not re-file)

| Old claim | Live status 2026-07-16 |
|-----------|------------------------|
| No GET by id / No PUT | **Fixed** -- both exist; edit is metadata-only |
| Detail/edit pages dead 404 | **Fixed** -- load via GET `/:id` |
| Dual compose entry points | **Fixed** -- `/new` redirects to list compose tab |
| Native OS select for type filter | **Fixed** -- themed `Select` |
| Missing type enum values on FE | **Aligned** with model/types |
| Sidebar badges use `readBy` (F4 / D1) | **FIXED** -- dashboard badges query `unreadBy` |

---
| F1 | **FIXED** | Was: non-admin unread-only. Now: recipientUserIds history + isRead | `notification.service.ts` listNotifications |
| F2 | **FIXED** | Was: phantom isRead. Now: API DTO + Flutter unreadBy derive | notifications_screen + serializeNotification |
| F3 | **FIXED** | Was: all = every User. Now: role tenant only | resolveTargetUsers case all |
| F4 | **CLOSED** | Was: badges used `readBy`. Dashboard D1 fixed: `'unreadBy.0': { $exists: true }` | Do not re-file; see dashboard-export-audit.md |
| F6 | **FIXED** | writeAuditLog notification_send on POST | routes/notifications.ts POST |


## Acceptance

- [x] Admin compose sends; history shows row with type/target/unread counts
- [x] Floor/room/individual compose requires at least one ResourceSelect id (already FE-enforced)
- [ ] Edit updates title/body without re-pushing ntfy (document in UI) -- residual F5 copy
- [x] Tenant Flutter: history retained after mark-read (F1); optimistic isRead (F2)
- [x] `isRead` derived correctly in Flutter (or API)
- [x] `targetType: all` only hits tenant role (F3)
- [x] Audit log entry on admin send (`notification_send`)
- [x] Sidebar unread badge reflects real `unreadBy` (D1/F4 closed)

---

## Remediation log

| Date | Change |
|------|--------|
| 2026-07-12 (prior) | GET/PUT by id, compose ResourceSelect, dual-compose redirect -- historical |
| 2026-07-16 | Full re-audit from source; rewritten this file. Open: unread-only portal semantics, all-users blast, audit |
| 2026-07-16 | Reconcile | **F4 CLOSED** with D1 (`unreadBy` badges) |
| 2026-07-16 | Queue E | **F1/F2/F3/F6 FIXED** -- recipientUserIds, isRead DTO+Flutter, all=tenants, notification_send audit; D2 badges-update emit |
|
