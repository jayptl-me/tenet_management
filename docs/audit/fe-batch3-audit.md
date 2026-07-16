# FE Batch 3 Audit -- Admin UI vs API Zod

> **SUPERSEDED 2026-07-16.** Authoritative backlog: [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) and per-module [features/](./features/). Historical batch notes only.

**Date:** 2026-07-16  
**Scope:** Visitors, Leaves, Laundry, Meals, Menus, Notices, Notifications, Enquiries, Settings, Export, Dashboard, Audit Logs  
**Method:** Source-only adversarial check of `apps/web` list/detail/new/edit forms against `apps/api` Zod schemas and route behavior. Prior LIVE_GAP claims ignored.  
**Surfaces:** Admin Next.js only (`apps/web`). No product code changed.

---

## Open severity counts

| Severity | Open | Notes |
|----------|-----:|-------|
| **P0** | **0** | No create/save-breaking contract breaks found in this batch |
| **P1** | **5** | Invalid list filters; notification targeting; settings YouTube dead field; notice targetIds optional when required in practice |
| **P2** | **7** | Dead search params, copy/limit mismatches, HTML min, polish |

---

## Module matrix

| Module | List | Detail | New | Edit | Critical checks | Verdict |
|--------|:----:|:------:|:---:|:----:|-----------------|---------|
| Visitors | PASS | PASS | PASS | PASS | expectedArrival; status filter; arrive/depart | **PASS** |
| Leaves | PARTIAL | PASS | PASS | PASS* | reject JSON body; approve | **PASS** (P2 filter noise) |
| Laundry | PASS | PASS | PASS | PASS | items min 1 | **PASS** (P2 min HTML) |
| Meals | PASS | PASS | PASS | PASS | categories on edit; admin create omits (API allows) | **PASS** |
| Menus | PASS | PASS | PASS | PASS | category on items; nav (no flag) | **PASS** |
| Notices | PASS | PASS | PARTIAL | PARTIAL | title/body mins; targetIds | **PARTIAL** |
| Notifications | PARTIAL | PASS | PARTIAL (compose) | PARTIAL | compose targets | **PARTIAL** |
| Enquiries | FAIL filter | PASS | PASS | PASS | preferredSharing | **PARTIAL** |
| Settings | -- | -- | -- | PASS save path | sanitize; GST/PAN; youtube; amenityDefinitions | **PARTIAL** |
| Export | -- | -- | multipage PASS | -- | multipage not single-page lie | **PASS** (P2 copy) |
| Dashboard | PASS | -- | -- | -- | real metrics endpoints | **PASS** |
| Audit Logs | PASS | n/a | n/a | n/a | filters vs closed enum | **PASS** (P2 completeness) |

\* Leaves "edit" is approve/reject workflow (no field PUT on API) -- correct for current contract.

---

## Critical checks (detailed)

### Visitors -- PASS

| Check | Result | Evidence |
|-------|--------|----------|
| `expectedArrival` on new | PASS | `visitors/new/page.tsx` schema + `datetime-local` + ISO on submit |
| `expectedArrival` on edit | PASS | `visitors/[id]/edit/page.tsx` loads/local-formats/sends field |
| Status filters (no invalid `pending`) | PASS | List uses `StatusFilterSelect` with `expected \| arrived \| departed \| cancelled` only |
| Arrive / depart actions | PASS | Detail uses `VisitorLifecycleActions`; `arrive`/`depart` POST; cancel via PUT status; re-approve via POST approve |

API Zod (`visitors.ts`): create requires `expectedArrival`; status enum matches FE.

### Leaves -- PASS (minor P2)

| Check | Result | Evidence |
|-------|--------|----------|
| Reject sends JSON body | PASS | Detail: `json: { adminNotes: '' }`; edit: `json: { adminNotes: ... }` matches `z.strictObject({ adminNotes?: string })` |
| Approve path | PASS | Detail PUT `leaves/:id/approve` with `{}`; edit PUT without body (no Zod on approve) |
| Create fields | PASS | New posts `tenantId`, `fromDate`, `toDate`, `reason` matching create schema |
| List status `cancelled` | P2 | Model enum is only `pending \| approved \| rejected`; filter option `cancelled` always empty |
| List `search` | P2 | FE sends `search`; API list ignores it |

### Laundry -- PASS

| Check | Result | Evidence |
|-------|--------|----------|
| items min 1 (not 0) | PASS | New/edit FE: `z.coerce.number().int().min(1)`; preprocess defaults empty/0 to 1 on edit |
| API alignment | PASS | `createSlotSchema` / `updateSlotSchema` both `items.min(1)` |
| HTML `min={0}` on edit | P2 | Input allows spinning to 0; zod preprocess coerces 0->1 before submit |

Feature flag: Sidebar `laundryEnabled` + API `requireFeature('laundryEnabled')`.

### Meals / Menus -- PASS

| Check | Result | Evidence |
|-------|--------|----------|
| Meals categories | PASS | Admin create schema has no `categories` (API `adminCreateFeedbackSchema`); edit has CategoryChipSelect + PUT categories enum |
| Meal type / rating | PASS | breakfast/lunch/dinner; rating 1-5 |
| Menus category fields | PASS | New/edit item rows include optional `category`; payload strips empty category |
| Feature flags in nav | PASS | Meals: `messFeedbackEnabled`; Menus: always visible (API has no menu feature flag) |

### Notices -- PARTIAL (P1 targetIds)

| Check | Result | Evidence |
|-------|--------|----------|
| title min 5 / content min 10 | PASS | New + edit client Zod matches API |
| targetType enum | PASS | all/floor/room/individual |
| targetIds for room/floor/individual | P1 | Free-text comma IDs; **not required** when targetType != all; can post empty `targetIds: []` -- API accepts but notice is effectively invisible to intended audience |
| List filters | PASS | targetType + search match API admin branch |

### Notifications -- PARTIAL (P1 compose targets)

| Check | Result | Evidence |
|-------|--------|----------|
| Type enum | PASS | Matches API create/update enums including `meal_feedback` |
| Compose targets | P1 | Free-text "Floor/Room/User IDs"; no ResourceSelect; non-`all` with empty `targetIds` still POSTs -- service resolves **zero users** and stores a no-op broadcast |
| Title/body mins | PASS | Client blocks empty; API min(1) max 200/2000 |
| History id routing | PASS | Model `toJSON` maps `_id` -> `id`; list uses `row.id` |
| Edit metadata | PASS | PUT title/body/type/targetType/targetIds aligned |

### Enquiries -- PARTIAL (P1 list filter)

| Check | Result | Evidence |
|-------|--------|----------|
| preferredSharing on new/edit | PASS | enum `2 \| 3 \| 4 \| single` on both forms + payload |
| Detail preferredSharing display | PASS | Shown when present |
| List status filter | **P1** | Options include **`follow_up`** and **`closed`** -- not in API (`new \| contacted \| converted \| lost`). Selecting them yields empty results; real statuses `lost` missing from list filter |
| Detail status update | PASS | PUT `enquiries/:id/status` with valid enum |
| Phone normalize | PASS | `normalizeInPhone` on create/edit |

### Settings -- PARTIAL (P1 YouTube UX)

| Check | Result | Evidence |
|-------|--------|----------|
| handleSave + sanitize | PASS | `handleSave` -> `sanitizeSettingsPayload(config)` -> PUT `app-config` |
| Empty phone/email | PASS | `emptyToUndef`; tests in `sanitize-settings-payload.test.ts` |
| Blank testimonials | PASS | Filtered unless name+quote non-empty |
| amenityDefinitions | PASS | Included in payload; API Zod object array |
| GST / PAN | PASS | Sanitizer sends; API schema accepts max 20; public GET strips tax IDs, admin JWT keeps them |
| YouTube social | **P1** | UI still shows YouTube input; sanitizer **never sends** `youtube` (not in API socialLinks schema). User can type a URL, save succeeds, value never persists -- silent data loss |
| Social allowed keys | PASS | facebook/instagram/whatsapp only in payload |

### Export -- PASS multipage (P2 copy)

| Check | Result | Evidence |
|-------|--------|----------|
| Multipage fetch | PASS | Loops `page` while `page <= totalPages`, `limit=100`, safety cap 200 pages |
| Not single-page lie | PASS | Code walks all pages of list API |
| Copy vs code | P2 | Banner says "Up to 5,000 records"; code allows up to 20k (200*100). Mentions date-range filters export does not implement |

### Dashboard -- PASS

| Check | Result | Evidence |
|-------|--------|----------|
| Real metrics | PASS | Single load of `GET dashboard/stats` -- occupancy, revenue, complaints, services, enquiries, charts, heatmap, service history all from that payload |
| No fake static metrics | PASS | Loading/error/skeleton; data from API only |

### Audit Logs -- PASS

| Check | Result | Evidence |
|-------|--------|----------|
| List + pagination | PASS | `GET audit-logs` with page/limit/action/resource |
| Action filter values | PASS | Subset of model enum; no invented actions that break API |
| Missing filter option | P2 | `tenant_transfer` / `visitor_approve` in model + ACTION_LABELS but not both in filter Select |

---

## Open findings

### P1

| ID | Module | Issue | Fix direction |
|----|--------|-------|---------------|
| P1-E1 | Enquiries list | Status filter offers `follow_up`, `closed`; omits `lost` | Align options to `new \| contacted \| converted \| lost` |
| P1-N1 | Notifications compose | Non-`all` targets use free-text IDs; empty targetIds still sends -- zero recipients | ResourceSelect (floors/rooms/tenants); block submit if targetIds empty when targetType != all |
| P1-NO1 | Notices new/edit | targetIds optional for floor/room/individual; empty array accepted | Client require >=1 ID when targetType != all; prefer ResourceSelect multi |
| P1-S1 | Settings | YouTube field in UI never persisted (stripped by sanitize + not in API) | Remove YouTube input **or** add `youtube` to API Zod + model + sanitizer |
| P1-NF1 | Notifications compose | Silent failure on send error (empty catch) | Surface API error toast/banner |

### P2

| ID | Module | Issue |
|----|--------|-------|
| P2-L1 | Leaves list | Status option `cancelled` not in model enum |
| P2-L2 | Leaves list | `search` query param ignored by API |
| P2-LA1 | Laundry edit | HTML `min={0}` while schema min is 1 |
| P2-X1 | Export | UI "5,000" / date-range claims vs multipage 20k cap and no date filters |
| P2-A1 | Audit | Filter dropdown incomplete vs full action enum |
| P2-NO2 | Notices/Notifications | Free-text Mongo IDs are error-prone (UX) even when required |
| P2-M1 | Meals list | Status column may show empty if older docs lack status default |

---

## PASS rows (no open P0/P1 for check)

| Area | Status |
|------|--------|
| Visitors full CRUD + lifecycle + expectedArrival + valid status filter | PASS |
| Leaves create + approve + reject-with-JSON | PASS |
| Laundry items min 1 (new + edit Zod) | PASS |
| Meals admin create/edit vs API (incl. categories on edit) | PASS |
| Menus category field + meals payload shape | PASS |
| Notices title/content min lengths | PASS |
| Notification type enum + history list | PASS |
| Enquiries preferredSharing new/edit/detail | PASS |
| Settings sanitize empty phone/email/testimonials; GST/PAN; amenityDefinitions; handleSave | PASS |
| Export multipage client CSV | PASS |
| Dashboard `dashboard/stats` real metrics | PASS |
| Audit logs paginated list + action/resource filters | PASS |
| Sidebar feature flags: laundry, meals, notices, visitors | PASS |

---

## File map (audited)

| Module | FE | API |
|--------|----|-----|
| Visitors | `apps/web/src/app/(admin)/visitors/**`, `VisitorLifecycleActions.tsx` | `apps/api/src/routes/visitors.ts` |
| Leaves | `apps/web/src/app/(admin)/leaves/**` | `apps/api/src/routes/leaves.ts` |
| Laundry | `apps/web/src/app/(admin)/laundry/**` | `apps/api/src/routes/laundry.ts` |
| Meals | `apps/web/src/app/(admin)/meals/**` | `apps/api/src/routes/meals.ts` |
| Menus | `apps/web/src/app/(admin)/menus/**` | `apps/api/src/routes/menus.ts` |
| Notices | `apps/web/src/app/(admin)/notices/**` | `apps/api/src/routes/notices.ts` |
| Notifications | `apps/web/src/app/(admin)/notifications/**` | `apps/api/src/routes/notifications.ts`, `services/notification.service.ts` |
| Enquiries | `apps/web/src/app/(admin)/enquiries/**` | `apps/api/src/routes/enquiries.ts` |
| Settings | `settings/page.tsx`, `lib/sanitize-settings-payload.ts` (+ test) | `apps/api/src/routes/appConfig.ts` |
| Export | `export/page.tsx` | list endpoints only (client CSV) |
| Dashboard | `dashboard/page.tsx` | `apps/api/src/routes/dashboard.ts` |
| Audit | `audit-logs/page.tsx` | `apps/api/src/routes/audit.ts` |
| Nav flags | `components/admin/Sidebar.tsx` | feature middleware on gated routes |

---

## Summary

Batch 3 is in good shape for **Visitors, Leaves approve/reject, Laundry min items, Meals/Menus, Export multipage, Dashboard stats, Audit list, and Settings sanitize path**. No P0 contract breaks.

Highest-value residual work is **invalid Enquiries status filter options**, **notification/notice targeting without real ID pickers or non-empty validation**, and **Settings YouTube field that never saves**.

**Open: P0=0, P1=5, P2=7.**
