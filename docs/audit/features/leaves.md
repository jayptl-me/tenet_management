# Leaves -- Gap Analysis

**Last verified:** 2026-07-16  
**Admin grade:** B+  
**Priority:** P1 (no API feature gate; date field dual-name care)  
**Theme:** SaaS FormPage approve/reject workflow (no generic PUT)

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/leaveApplication.ts` |
| Routes | `apps/api/src/routes/leaves.ts` |
| Types | `packages/types/src/attendance.ts` (`ILeaveApplication*`) |
| Admin FE | `apps/web/src/app/(admin)/leaves/**` |
| Flutter | `mobile/lib/features/tenant/presentation/leaves_screen.dart` |
| Repo | `tenant_repository.dart` (`myLeaves`, create leave) |
| Cascade | Tenant delete removes leave applications (`tenants.ts`) |

## Model truth

| Field | Constraints |
|-------|-------------|
| tenantId | ObjectId Tenant, required |
| fromDate / toDate | YYYY-MM-DD strings |
| reason | required, max 500 |
| status | `pending \| approved \| rejected` (default pending) |
| approvedBy | ObjectId User \| null |
| approvedAt | Date \| null |
| adminNotes | max 500, default `''` |
| Indexes | `{ tenantId, fromDate }`, `{ status, createdAt }` |

**No dedicated leaves feature flag.** Admin nav for Leaves uses **`attendanceEnabled`**. API leaves routes are **always on** (no `requireFeature`).

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/leaves` | JWT | tenant self-only; admin any tenant; overlap 409 OVERLAPPING_LEAVE; inactive tenant rejected |
| GET | `/leaves` | admin | status, tenantId, **search** (tenant name via User regex) |
| GET | `/leaves/my` | JWT | tenant own list |
| GET | `/leaves/:id` | JWT | mapLeave; **no ownership** |
| DELETE | `/leaves/:id` | admin | **pending only** else LEAVE_NOT_PENDING |
| PUT | `/leaves/:id/approve` | admin | **no body schema**; sets approved + approvedBy/At |
| PUT | `/leaves/:id/reject` | admin | **JSON body required** by zValidator: `{ adminNotes?: string max 500 }` |

`mapLeave` aliases `startDate`/`endDate` from fromDate/toDate and nests `tenant.user` / `tenant.room` + `approvedByName`.

**No generic PUT `/:id`** -- intentional workflow design.

## FE page matrix

| Page | Verdict | Notes |
|------|---------|-------|
| List | **PASS** | DataTable; status filter OK; server `search` by tenant name; delete only when pending |
| Detail | **PASS** | Uses `startDate`/`endDate` aliases; approve/reject with JSON `{}` or `{ adminNotes: '' }`; Edit CTA |
| New | **PASS** | POST leaves with fromDate/toDate/reason/tenantId -- matches createLeaveSchema |
| Edit | **PASS (workflow)** | Not a field editor; approve/reject + adminNotes textarea; reject sends `{ adminNotes }` |

### FE zod vs API

| Surface | FE | API | Match |
|---------|----|-----|-------|
| Create | tenantId, fromDate, toDate, reason min 1 | same + date regex + reason max 500 | **YES** (FE lacks max 500) |
| Approve | PUT `.../approve` (edit: no body; detail: `{}`) | no zValidator body | **YES** |
| Reject | PUT `.../reject` + `{ adminNotes? }` | strictObject adminNotes optional | **YES** |

### Date field dual names

| Consumer | Fields used |
|----------|-------------|
| List / Detail | `startDate`, `endDate` (aliases) |
| Edit page load | `fromDate`, `toDate` (raw; still present via spread in mapLeave) |
| API create | `fromDate`, `toDate` |

Both shapes work on mapped GET because mapLeave spreads doc then adds aliases. Prefer one convention in FE.

## Field coverage

| Field | List | Detail | New | Edit | API |
|-------|------|--------|-----|------|-----|
| tenant | Y | Y | ResourceSelect | read-only | populate |
| from/to dates | period | Y | Y | read-only | Y |
| reason | truncated | Y | Y | read-only | Y |
| status | badge | badge | pending | approve/reject | enum |
| adminNotes | -- | if set | -- | reject input | reject only |
| approvedBy/At | -- | partial | -- | display if set | Y |

## Lifecycle

```
POST create -> status=pending
  -> PUT approve -> approved + approvedBy + approvedAt
  -> PUT reject  -> rejected + approvedBy + approvedAt + optional adminNotes
  -> DELETE (pending only)
```

Overlap: any pending/approved leave intersecting date range blocks create (409).

## Feature flags

| Surface | Behavior |
|---------|----------|
| API leaves | **Gated** -- `leaves.use('*', requireFeature('attendanceEnabled'))` (FLAG-leaves FIXED) |
| Admin Sidebar Leaves | `featureFlag: 'attendanceEnabled'` (shared with attendance) |
| Flutter | 403 FEATURE_DISABLED when attendance flag off |

Product coupling: Leaves share attendance flag (nav + API).

## Design

| Check | Verdict |
|-------|---------|
| PageHeader / DataTable / FormPage | PASS |
| StatusBadge on list/detail | PASS |
| Edit status chips use token colors (not StatusBadge) | PARTIAL |
| FormSection / FormActions | PASS on edit |

## Open gaps

### P0

None for approve/reject happy path when admin is logged in.

### P1

_None open._ Material cancel/flag/search items closed.

### P2

- [x] List delete gated to status===pending (API LEAVE_NOT_PENDING)
- [ ] Align FE to single date naming (`startDate` vs `fromDate`)
- [ ] FE reason max 500 to match API
- [ ] GET `/:id` tenant ownership
- [ ] Detail reject should allow adminNotes input (currently empty string only on detail; notes live on edit)
- [ ] StatusBadge on edit page instead of ad-hoc chips

## Closed

- [x] Edit page does **not** call missing generic PUT -- uses approve/reject
- [x] Reject always sends JSON body (detail + edit)
- [x] Overlap detection on create
- [x] Pending-only delete
- [x] **LV-search FIXED 2026-07-16** -- GET `/leaves?search=` + FE
- [x] **FLAG-leaves FIXED 2026-07-16** -- `requireFeature('attendanceEnabled')`
- [x] **LV-CANCEL FIXED 2026-07-16** -- `POST /leaves/:id/cancel` (tenant owner or admin) sets status `cancelled`; Flutter Cancel on pending; tests in `leave-cancel-complaint-photos.test.ts`

## Acceptance checklist

- [ ] Admin creates leave for tenant 201
- [ ] Tenant creates self leave; cannot create for others 403
- [ ] Overlap returns 409 with message
- [ ] Approve sets approved; reject stores adminNotes
- [ ] Delete only when pending
- [x] List status filter works; server-side tenant name search works
- [x] Flag story: Leaves share `attendanceEnabled` on nav + API

## Remediation log

- 2026-07-16: Full re-audit. Workflow approve/reject verified; search dead on list; API not feature-gated. Grade B+.
- 2026-07-16: **LV-search FIXED** -- server-side tenant name search on list (API + FE).
- 2026-07-16: **FLAG-leaves FIXED** -- `requireFeature('attendanceEnabled')` on leaves router.
