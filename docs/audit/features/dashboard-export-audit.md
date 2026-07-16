# Dashboard, Export, Audit Logs -- Gap Analysis

**Last verified:** 2026-07-16  
**Priority:** P1 for badge correctness; P2 for audit write coverage and export polish  
**Dashboard grade:** A- (stats rich; badges wrong field + dead live event)  
**Export grade:** B (honest client multipage CSV; no server API)  
**Audit logs grade:** B- (list UX solid; writers sparse)

Code is truth. Three admin system surfaces bundled here because they are operational tooling, not domain CRUD.

---

## Source map

### Dashboard

| Layer | Path |
|-------|------|
| Routes | `apps/api/src/routes/dashboard.ts` |
| Types | `packages/types/src/dashboard.ts` |
| FE page | `apps/web/src/app/(admin)/dashboard/page.tsx` |
| Badges hook | `apps/web/src/hooks/useSidebarBadges.ts` |
| SSE (admin) | `apps/api/src/routes/sse.ts`, `apps/web/src/hooks/useSSE.ts` |
| Chart tokens | `apps/web/src/lib/chart-theme.ts` |
| Mount | `apps/api/src/index.ts` -> `/dashboard` |

### Export

| Layer | Path |
|-------|------|
| FE page | `apps/web/src/app/(admin)/export/page.tsx` |
| Types (unused contract) | `packages/types/src/export.ts` |
| Server export route | **None** |
| Data source | Standard list APIs: `tenants`, `payments`, `invoices`, `complaints` |

### Audit logs

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/auditLog.ts` |
| Writer helper | `apps/api/src/lib/write-audit-log.ts` |
| Routes | `apps/api/src/routes/audit.ts` |
| Types | `packages/types/src/audit.ts` |
| FE page | `apps/web/src/app/(admin)/audit-logs/page.tsx` |
| Mount | `apps/api/src/index.ts` -> `/audit-logs` |

---

## API surface

### Dashboard

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/dashboard/stats` | admin | Full operational payload (occupancy, revenue, complaints, services, enquiries, charts, heatmap, funnel, amenity health, recent lists) |
| GET | `/dashboard/badges` | admin | `{ unreadNotifications, openComplaints, pendingEnquiries }` |
| GET | `/dashboard/occupancy-history` | admin | Last 6 months occupied vs total beds -- **FE unused** (stats already embeds `occupancyHistory`) |

**Stats consumers (FE):** only `dashboard/stats` on page load. No client polling; no SSE refresh of dashboard widgets.

**Badges bug (code):**

```ts
// apps/api/src/routes/dashboard.ts
Notification.countDocuments({ 'unreadBy.0': { $exists: true } })
```

Notification model field is **`unreadBy`**. Badges query uses `'unreadBy.0': { $exists: true }` (**D1 closed** 2026-07-16).

**Occupancy history heuristic:** active tenants counted by `moveInDate <= month` against current total beds -- approximate, not historical snapshots.

### Export

| Method | Path | Status |
|--------|------|--------|
| Server export API | -- | **Does not exist** (by design) |
| Client multipage | FE | Walks `GET /{resource}?limit=100&page=N` until complete; max 200 pages (20k rows); builds CSV in browser |

Supported FE resources: `tenants` | `payments` | `invoices` | `complaints`.  
`packages/types` also lists `enquiries` -- **not** in FE UI.

Audit action enum includes `export` but client export **never** calls `writeAuditLog`.

### Audit logs

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/audit-logs` | admin | Paginated; filters `action`, `resource`, `userId`, `fromDate`, `toDate`; populate user; sort timestamp desc |
| GET | `/audit-logs/actions` | admin | `distinct('action')` for filter dropdown -- **FE does not call this** |
| POST/PUT/DELETE | -- | -- | No mutation API (append-only via helper) |
| Detail / new / edit | -- | -- | **None by design** |

### Model truth (`AuditLog`)

| Field | Notes |
|-------|--------|
| userId | ObjectId User required |
| action | Closed enum: create, update, delete, login, logout, payment_verify, complaint_status_change, tenant_checkout, tenant_transfer, settings_change, notification_send, visitor_approve, export |
| resource / resourceId | free strings |
| details | Mixed default {} |
| ip / userAgent | optional |
| timestamp | default now |
| TTL | index expireAfterSeconds 90 days on `timestamp` |

### Who actually writes audit logs (verified)

| Location | Action used |
|----------|-------------|
| `routes/payments.ts` | `payment_verify` (offline verify path) |
| `routes/invoices.ts` | `update` |
| `routes/tenants.ts` | `update` (room/bed transfer details) |

**Not wired** (despite enum values existing): login/logout, generic create/delete across modules, complaint status, tenant checkout, settings change, notification send, visitor approve, export.  
Audit list UI will look empty or sparse until writers expand.

---

## FE page matrix

### Dashboard `/dashboard`

| Area | Implementation | Verdict |
|------|----------------|---------|
| Load | GET `dashboard/stats` | **PASS** |
| Loading / error | DashboardSkeleton, ErrorState | **PASS** |
| Stat cards | occupancy, revenue, complaints, services, enquiries | **PASS** |
| Charts | Sparkline, Donut, Funnel, StackedBar, Line, Gauge, Heatmap, Timeline | **PASS** -- uses `chartTokens` + CSS vars |
| Recent complaints / enquiries | lists with StatusBadge, deep links | **PASS** |
| SSE widget refresh | none on page | N/A by design |
| Live sidebar badges | `useSidebarBadges` | **FAIL** count + **FAIL** live event (below) |

**SSE badges path:**

1. Initial: GET `dashboard/badges`
2. EventSource `sse/admin?token=...` listens for event name `badges-update`
3. API never `broadcast`s `badges-update` (notification service emits `notification_created` only)
4. Live badge updates never fire; complaints/enquiries badges also static until reload

### Export `/export`

| Area | Verdict |
|------|---------|
| PageHeader + ErrorBanner | **PASS** |
| Four resource cards + loading/success | **PASS** |
| Multipage fetch + CSV blob download | **PASS** functional |
| Date/range filters | **Missing** (copy mentions filters on resource pages, not implemented on export) |
| Server-side export | **Absent** (documented on page) |
| Limit copy | **Mismatch** -- UI says "Up to 5,000 records"; code caps at 200 * 100 = 20,000 |
| Enquiries option | types yes / FE no |
| Audit of export | **Missing** |

### Audit logs `/audit-logs`

| Area | Verdict |
|------|---------|
| List only (no detail/new/edit) | **PASS** by design |
| PageHeader, ErrorBanner, DataTable, mobileCardRenderer | **PASS** |
| StatusBadge on actions | **PASS** |
| Action filter Select | **PARTIAL** -- hardcoded; missing `tenant_transfer`, `visitor_approve` vs model enum |
| Resource filter Select | Hardcoded resource strings; may not match writer `resource` values |
| Date / user filters | API supports; FE **does not** expose |
| Use GET `/actions` | **Not used** |

---

## Field coverage

### Dashboard stats payload vs FE

| Payload key | FE usage |
|-------------|----------|
| occupancy | Stat cards + sparkline |
| revenue + revenueHistory | Cards + charts + MoM delta |
| complaints + complaintsByCategory + complaintHeatmap | Cards + donut + heatmap |
| services + amenityHealth + serviceHistory | Cards + timeline |
| enquiries.pending | Card |
| recent.complaints / enquiries | Lists |
| paymentFunnel | FunnelChart |
| mealFeedbackTrend | Line/meal averages |
| occupancyHistory | Sparkline (optional chain) |

### Export columns

Derived dynamically from flattened list JSON (nested objects one level; arrays JSON.stringified; drops `__v` and `passwordHash`). Not a fixed schema -- column set depends on API populate shape.

### Audit log row FE

| Field | Shown |
|-------|-------|
| action | StatusBadge |
| resource + resourceId | Y (id truncated) |
| user name/email/role | Y |
| timestamp | Y |
| ip | Y |
| details | **Not shown** (no expand/detail) |
| userAgent | **Not shown** |

---

## Lifecycle

| Surface | Happy path | Status |
|---------|------------|--------|
| Admin opens dashboard | stats 200, charts render | **PASS** |
| Sidebar badges on load | open complaints / pending enquiries | **PASS** if those queries correct |
| Sidebar unread notifications | count from badges | **PASS** uses `unreadBy` |
| Sidebar live SSE badge refresh | badges-update event | **PASS** (D2 FIXED -- broadcastBadgesUpdate) |
| Export tenants CSV | multipage + download | **PASS** |
| Export empty collection | error message | **PASS** |
| Audit list after payment verify | row appears | **PASS** if verify path used |
| Audit list after notice create | row appears | **PASS** (A1 notices create/update/delete) |
| Audit list after login | row appears | **FAIL** no writer (out of Queue E scope) |
| Audit detail page | N/A | intentional absence |

---

## Design

| Surface | Notes |
|---------|-------|
| Dashboard | Strong SaaS layout: Surface panels, tokens, chartTokens, StatusBadge, motion stagger -- grade A design |
| Export | Token cards, brand accents, honest client-side disclaimer -- clean |
| Audit | Standard list module stack; themed Select; no FormPage needed |

Hardcoded Tailwind gray/slate: not observed on these three pages (uses CSS variables).

---

## Open gaps

### Dashboard

| ID | Sev | Gap | Fix |
|----|-----|-----|-----|
| D3 | **P2** | `occupancy-history` route dead code relative to FE | Keep for external clients or remove; stats already embeds series |
| D4 | **P2** | Occupancy history is heuristic not true time series | Accept as approximation or snapshot job |
| D5 | **P3** | Dashboard does not auto-refresh on SSE `notification_created` / complaint events | Optional invalidate stats |

### Export

| ID | Sev | Gap | Fix |
|----|-----|-----|-----|
| E1 | **P2** | UI "5,000" vs code 20,000 cap | Align copy and safety limit |
| E2 | **P2** | No date/status filters on export page | Query params passthrough or server export |
| E3 | **P2** | Types include `enquiries`; FE omits | Add card or trim type |
| E4 | **P2** | No audit `export` action | Optional best-effort log after successful client export (needs API) or accept un-audited client export |
| E5 | **P3** | Nested/populate CSV quality | Explicit column maps per resource |

### Audit logs

| ID | Sev | Gap | Fix |
|----|-----|-----|-----|
| A4 | **P2** | details blob never visible | Expand row or lightweight detail drawer |
| A5 | **P3** | resource filter values may not match writers | Document canonical resource strings |

---

## Closed (do not re-file)

| Old claim | Live status 2026-07-16 |
|-----------|------------------------|
| Export may have server API -- re-read | **Confirmed client-only multipage CSV** -- no server export route |
| Audit needs new/edit pages | **Rejected** -- list-only is correct product shape |
| Dashboard charts hardcode non-theme colors | **Mostly closed** -- chartTokens + CSS variables dominate |
| Audit StatusBadge missing | **Present** on action column |

---
| D1 | **CLOSED** | Was: badges used `readBy`. Now: `'unreadBy.0': { $exists: true }` | Do not re-file |
| D2 | **FIXED** | Was: FE listens for SSE `badges-update` but API never emits. Now: `broadcastBadgesUpdate` on notif create/read/delete | `apps/api/src/lib/broadcast-badges.ts` + notification.service |
| A1 | **FIXED (Queue E)** | Was: sparse writers. Expanded: notices CRUD, services status, visitor approve/arrive/depart, notification_send (plus prior payment/tenant/invoice) | writeAuditLog call sites |
| A2 | **FIXED** | FE action filter includes tenant_transfer, visitor_approve | audit-logs page |
| A3 | **FIXED** (dates) | FE fromDate/toDate wired; userId still optional P2 | audit-logs page |


## Acceptance

### Dashboard

- [ ] `/dashboard` loads without console errors; all primary widgets render with empty-safe zeros
- [x] `/dashboard/badges` unreadNotifications matches real Notification `unreadBy` semantics
- [x] Sidebar badge for notifications updates after send (SSE `badges-update` + GET shape shared)
- [x] Server emits `badges-update` with same shape as GET badges (`broadcast-badges.ts`)

### Export

- [ ] Each of tenants/payments/invoices/complaints produces a downloadable CSV when data exists
- [ ] Empty data shows clear error (not a corrupt file)
- [ ] Limit copy matches implementation cap
- [ ] Page documents client-side nature (already does)

### Audit logs

- [ ] List paginates; action filter reduces results for actions that exist in DB
- [x] Payment verify, notices, notification_send, visitor transitions, service status produce rows (A1 Queue E)
- [ ] No create/edit/delete UI for audit rows (append-only)

---

## Remediation log

| Date | Change |
|------|--------|
| Prior | Dashboard stats/charts, export client CSV, audit list page -- historical |
| 2026-07-16 | Full re-audit from source; rewritten this file. Open: D2 dead SSE event, A1 sparse audit writers, E1 limit copy |
| 2026-07-16 | Reconcile vs worktree | **D1 CLOSED** -- badges use `unreadBy` |
| 2026-07-16 | Queue E | **D2 FIXED** broadcastBadgesUpdate; **A1 FIXED** notices/services/visitors/notification_send writers |
|
