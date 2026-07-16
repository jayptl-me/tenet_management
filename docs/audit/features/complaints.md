# Complaints -- Feature Audit

**Last verified:** 2026-07-16  
**Grade:** **A-**  
**Priority of remaining work:** P1 polish / authz (no open P0 CRUD breakage)

Code is truth. Prior audit claimed missing full PUT and invalid `critical` priority; both are fixed in source.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/complaint.ts` |
| Routes | `apps/api/src/routes/complaints.ts` (mounted `/api/v1/complaints` in `apps/api/src/index.ts`) |
| Types | `packages/types/src/complaint.ts` |
| Admin list | `apps/web/src/app/(admin)/complaints/page.tsx` (table + kanban) |
| Admin detail | `apps/web/src/app/(admin)/complaints/[id]/page.tsx` |
| Admin new | `apps/web/src/app/(admin)/complaints/new/page.tsx` |
| Admin edit | `apps/web/src/app/(admin)/complaints/[id]/edit/page.tsx` |
| Flutter tenant | `mobile/lib/features/tenant/presentation/complaints_screen.dart` |
| Flutter data | `mobile/lib/features/tenant/data/tenant_repository.dart` (`myComplaints`, `createComplaint`) |
| Seed samples | `apps/api/src/scripts/seed.ts` (sample complaints) |
| HTTP smoke | `apps/api/src/__tests__/module-http-e2e.test.ts` (create/list/detail/edit/delete) |

Related (not complaint routes): `complaint_status_change` audit action enum; SSE types `new_complaint` / `complaint_updated`; notification type `complaint_update` -- **not written/emitted from complaint handlers today**.

---

## Model truth

| Field | Constraints | Notes |
|-------|-------------|-------|
| `tenantId` | required ObjectId -> Tenant | Virtual `tenant` |
| `roomId` | required ObjectId -> Room | Virtual `room` |
| `category` | enum: wifi, water, electricity, food_quality, cleaning_room, cleaning_washroom, washing_machine, fridge, lights, noise, other | |
| `title` | required, trim, min 5, max 200 | |
| `description` | required, trim, **max 2000 only** (no schema minlength) | Zod create/update enforces min 10 |
| `photos` | string[] | **Live** -- create/update Zod URL array (max 5); `POST /:id/photos` append |
| `priority` | `low \| medium \| high \| urgent`, default medium | Not `critical` |
| `status` | `open \| in_progress \| resolved \| dismissed`, default open | |
| `adminNotes` | optional string, default `''` | |
| `resolvedAt` | Date \| null, default null | Set on resolve; **cleared when status leaves resolved** (both `/status` and full PUT via `complaintStatusPatch`) |
| timestamps | createdAt, updatedAt | |

Indexes: tenantId, roomId, status, category, priority, compound status+priority.

---

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/stats` | admin | Aggregates byStatus + byCategory |
| GET | `/my` | tenant | Own tenant profile complaints |
| POST | `/` | any JWT | Admin **must** pass `tenantId`; tenant uses self; optional `photos[]` URLs; 30 min category cooldown |
| GET | `/` | admin | Filters: status, category, priority, roomId, fromDate, toDate; pagination; `mapComplaint` populate |
| GET | `/:id` | JWT | Populated + mapComplaint; **tenant ownership enforced** (non-owner 404; CMP-authz closed) |
| POST | `/:id/photos` | tenant owner or admin | Append URL list (max 5 total) |
| PUT | `/:id/status` | admin | `{ status, adminNotes? }`; sets `resolvedAt` if resolved |
| PUT | `/:id` | admin | Partial incl. `photos`; sets/clears `resolvedAt` on status change |
| DELETE | `/:id` | admin | Hard delete |

### Zod notes

- Create: title min 5, description min 10; priority enum; optional `photos` URL array max 5; **category is free string max 50** (not enum) -- invalid values fail only at Mongoose.
- Update: optional `photos` replaces list; category still free string.

### `mapComplaint`

Normalizes lean populate so FE can use `tenant.user.{name,email,phone}` and `tenant.room.roomNumber` consistently.

---

## FE page matrix (admin)

| Page | Verdict | Calls | UX stack |
|------|---------|-------|----------|
| List | **PASS** | GET `complaints?page&limit&status`; DELETE | PageHeader, DataTable, StatusBadge, TableActions, mobileCard, EmptyState, ConfirmModal |
| List kanban | **PASS** | GET limit=200; PUT `/:id/status` on drop; optimistic + rollback | dnd-kit columns open / in_progress / resolved / dismissed |
| Detail | **PASS** (status workflow) | GET `/:id`; PUT `/:id` with `{ status, adminNotes }` | FormPage, DetailCard, Radix Select, Textarea |
| New | **PASS** | POST with optional photo URL lines | FormPage; photoUrls textarea |
| Edit | **PASS** | PUT full whitelist incl. photos | FormPage / FormSection; photo URLs; maps critical->urgent |

List column header says **Severity** but field is **priority** (label-only inconsistency).

---

## Flutter matrix (tenant)

| Surface | Verdict | Notes |
|---------|---------|-------|
| List my | **PASS** | GET `complaints/my` |
| Create | **PASS** functional | POST with roomId from profile; title 5+ / desc 10+ client check; priority low/medium/high/urgent |
| Categories | **PARTIAL** | UI offers wifi, water, electricity, food_quality, cleaning_room, noise, other -- **missing** cleaning_washroom, washing_machine, fridge, lights |
| Photos | **Display** | Detail shows photo URLs; create attach optional via API/admin |
| Design | **PARTIAL** | Portal widgets; no SaaS parity requirement for admin tokens |

---

## Field coverage

| Field | Model | Create API | Admin new | Admin edit | Admin detail | Flutter create |
|-------|:-----:|:----------:|:---------:|:----------:|:------------:|:--------------:|
| tenantId | Y | admin required | Y | read-only card | Y (populated) | implicit |
| roomId | Y | Y | Y (auto from tenant) | -- | via tenant.room | from profile |
| category | Y | Y (string) | Y enum | Y enum | Y | partial enum |
| title | Y | Y min5 | Y | Y | Y | Y |
| description | Y | Y min10 | Y | Y | Y | Y |
| priority | Y | Y | Y | Y | as Severity | Y |
| status | Y | default open | -- | Y | Y (form) | list chip only |
| adminNotes | Y | -- | -- | Y | Y | -- |
| resolvedAt | Y | auto on resolve | -- | -- | **Y DetailRow** | -- |
| photos | Y | Y URL[] | Y URL field | Y URL field | Y gallery | display on detail |
| resolution | **N** | -- | -- | -- | **removed** (use adminNotes) | -- |

---

## Lifecycle

```
POST create -> status=open
  -> PUT /:id/status or PUT /:id: in_progress
  -> PUT status=resolved  (+ resolvedAt = now via complaintStatusPatch)
  -> PUT status=dismissed|open|in_progress  (resolvedAt = null)
  -> any status jump allowed (no FSM)
  -> reopen via kanban PUT /:id/status clears resolvedAt (same helper as full PUT)
DELETE hard remove
```

Kanban drag: optimistic local status update then `PUT /:id/status` (uses shared `complaintStatusPatch`).

Admin can file on behalf of tenant; cooldown applies per tenant+category still.

---

## Design

| Rule | Status |
|------|--------|
| FormPage / FormCard / FormSection / FormActions | New + edit yes |
| StatusBadge + statusToVariant | List + detail yes |
| Select (themed) | New, edit, detail, list filter |
| Tokens (no gray/slate hardcodes) | Yes on admin pages |
| mobileCardRenderer | List yes |
| Kanban SaaS styling | Border/token based; functional |

---

## Open gaps (ordered)

### P0

_None._ Full CRUD, kanban status path, priority enum, title/description mins all work against live code.

### P1

_None open._ Photos contract is live.

### P2

4. Align create Zod `category` to model enum (reject bad categories with 400).
5. Model description minlength 10 to match Zod/FE.
6. Flutter category list complete parity with model.
7. `writeAuditLog({ action: 'complaint_status_change' })` on status transitions (enum already reserved).
8. Optional: emit SSE / in-app notification on create and status change (types exist unused).
9. Kanban hard-caps at 200 rows; paginate or filter if volume grows.
10. Surface `/stats` on admin list (counts by status/category) or remove unused route if intentional dead weight.
11. List "Severity" label -> "Priority" for field name consistency.
12. Multipart Cloudinary upload helper (URL attach path ships; native file picker is polish).

### P3

13. Detail form could call `PUT /:id/status` (already works via full PUT).

---

## Closed (verified 2026-07-16 -- do not re-file)

| Prior claim | Live status |
|-------------|-------------|
| No full `PUT /:id` | **FIXED** -- `updateComplaintSchema` + admin PUT |
| Edit posts `priority: critical` | **FIXED** -- FE options low/medium/high/urgent; edit maps critical->urgent |
| Status-only path missing for kanban | **FIXED** -- drag uses `PUT /:id/status` |
| Title/description min validation | **FIXED** -- Zod + FE + Flutter client checks |
| Kanban / list dual view | **PRESENT** |
| photos[] dead contract | **FIXED 2026-07-16** -- create/update accept `photos` URL array; `POST /:id/photos` append; admin new/edit URL fields; detail + Flutter display |
| resolvedAt sticky on reopen | **FIXED 2026-07-16** -- shared `complaintStatusPatch` on **both** `PUT /:id/status` (kanban) and `PUT /:id`; test resolve then reopen clears resolvedAt |
| Admin create without tenantId | **FIXED** -- admin requires tenantId (`TENANT_REQUIRED`) |
| GET `/:id` any JWT IDOR (CMP-authz) | **FIXED** -- tenant ownership check returns 404 for non-owner |

---

## Acceptance checklist

- [x] Admin list table loads paginated complaints with StatusBadge
- [x] Admin kanban drag updates status via API with rollback on failure
- [x] Admin new: title min 5, description min 10, priority enum, tenant+room
- [x] Admin edit: full field PUT 200
- [x] Admin detail: status + adminNotes save 200
- [x] Admin delete hard-deletes
- [x] Tenant Flutter list + create (when room linked)
- [x] Tenant cannot GET another tenant's complaint by id (CMP-authz)
- [x] Photos attachable via URL create/update/append + admin/Flutter display
- [x] resolvedAt cleared on reopen via kanban `PUT /:id/status` and full `PUT /:id` (shared helper)
- [ ] Flutter exposes all model categories (P2)
- [ ] Audit log row on status change (if product wants audit parity) (P2)

---

## Remediation log

- **2026-07-16 goal pass (status path):** Extracted `apps/api/src/lib/complaint-status.ts` `complaintStatusPatch`; both status PUT and full PUT use it. Contract test: resolve then reopen via `PUT /:id/status` asserts `resolvedAt === null` (kanban client path).
- **2026-07-16 goal pass:** Photos live (create/update/append URLs + admin/Flutter display). CMP-authz closed. Residual P2: Flutter category completeness, audit/SSE hooks, Severity label.
- **Earlier:** Batch A added full PUT, priority enum alignment, kanban status endpoint usage (confirmed present).
