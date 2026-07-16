# Assets -- Feature Audit

**Last verified:** 2026-07-16  
**Grade:** **A-**  
**Priority of remaining work:** P2 polish; soft-retire copy and date clear **closed**

Code is truth. Prior audit claimed missing `GET /assets/:id` and unused low-stock API; both are fixed and wired in source.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/asset.ts` |
| Routes | `apps/api/src/routes/assets.ts` (mounted `/api/v1/assets`) |
| Types | `packages/types/src/asset.ts` |
| Admin list | `apps/web/src/app/(admin)/assets/page.tsx` |
| Admin detail | `apps/web/src/app/(admin)/assets/[id]/page.tsx` |
| Admin new | `apps/web/src/app/(admin)/assets/new/page.tsx` |
| Admin edit | `apps/web/src/app/(admin)/assets/[id]/edit/page.tsx` |
| Low-stock UI | `apps/web/src/components/ui/LowStockBanner.tsx` |
| Flutter | **None** (admin inventory only -- correct product split) |
| HTTP smoke | `apps/api/src/__tests__/module-http-e2e.test.ts` (create/edit/list/detail/delete) |

---

## Model truth

| Field | Constraints | Notes |
|-------|-------------|-------|
| `name` | required, trim, max 120 | |
| `category` | `furniture \| appliance \| electronics \| cleaning \| other` | |
| `location` | required, trim, max 160 | free text (not room FK) |
| `quantity` | number, min 0, default 1 | |
| `lowStockThreshold` | number, min 0, default 0 | 0 disables low-stock match (`threshold > 0` and qty <= threshold) |
| `status` | `available \| in_use \| under_maintenance \| damaged \| retired`, default available | |
| `purchasedDate` | Date \| null | |
| `lastServicedDate` | Date \| null | |
| `nextServiceDate` | Date \| null | indexed |
| `notes` | max 500, default `''` | |
| timestamps | createdAt, updatedAt | |

Indexes: `{ category, status }`, `{ nextServiceDate }`.

**No phantom model fields.** FE forms map 1:1 to schema (no serialNumber / vendor / cost leftovers).

---

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/` | admin | Filters: category, status, search (name regex); pagination; sort category+name |
| GET | `/low-stock` | admin | `lowStockThreshold > 0` AND `$expr qty <= threshold`; **static path before `/:id`** |
| GET | `/:id` | admin | Detail load |
| POST | `/` | admin | Full create; optional ISO/YYYY-MM-DD dates via `optionalDateString` |
| PUT | `/:id` | admin | Partial update; empty date string -> null when key present |
| DELETE | `/:id` | admin | **Soft retire**: sets `status: 'retired'`; response message "Asset retired" -- **not hard delete** |

Route order: list, low-stock, :id -- correct (low-stock not captured as id).

---

## FE page matrix (admin)

| Page | Verdict | Calls | UX stack |
|------|---------|-------|----------|
| List | **PASS** | GET `assets?page&limit&search&status`; DELETE | PageHeader, DataTable, StatusBadge, TableActions, mobileCard, **LowStockBanner**, ConfirmModal |
| Detail | **PASS** | GET `assets/:id` | FormPage, DetailCard: identity, inventory, dates/service, notes |
| New | **PASS** | POST `assets` | FormPage / FormCard / FormGrid; all model fields including service dates |
| Edit | **PASS** load/save | GET + PUT `assets/:id` | FormSection blocks; hydrates date inputs from ISO slice(0,10) |

### Low-stock

- API: implemented and correct.
- FE: `LowStockBanner` fetches `assets/low-stock` and renders warning count + names.
- **Gap:** list does not pass `onFilterLowStock`; banner is informational only (no click-to-filter).
- Prior claim "low-stock unused" is **false** as of this verify.

---

## Field coverage

| Field | Model | Create API | New FE | Edit FE | Detail FE | List FE |
|-------|:-----:|:----------:|:------:|:-------:|:---------:|:-------:|
| name | Y | Y | Y | Y | Y | Y |
| category | Y | Y | Y | Y | Y | Y |
| location | Y | Y | Y | Y | Y | Y |
| quantity | Y | Y | Y | Y | Y | Y |
| lowStockThreshold | Y | Y | Y | Y | Y | **N** (banner only) |
| status | Y | Y | Y | Y | Y | Y + filter |
| purchasedDate | Y | Y | Y | Y | Y | **N** |
| lastServicedDate | Y | Y | Y | Y | Y | **N** |
| nextServiceDate | Y | Y | Y | Y | Y | **N** |
| notes | Y | Y | Y | Y | Y | **N** |

No FE fields sent that the API rejects (no phantoms).

---

## Lifecycle

```
POST create -> status default available (or chosen)
  -> PUT update fields / status including under_maintenance, damaged
  -> DELETE -> status=retired (row remains; list still shows unless filtered)
```

There is no hard delete, no reactivate endpoint (reactivate = edit status away from retired), no service-due job.

### Date clear (CLOSED)

Edit always sends date keys as strings; empty string clears (`toDateOrUndefined` -> null):

```ts
purchasedDate: data.purchasedDate ? new Date(...).toISOString() : '',
lastServicedDate: ...,
nextServiceDate: ...,
```

---

## Design

| Rule | Status |
|------|--------|
| FormPage / FormCard / FormSection / FormActions | New + edit yes |
| StatusBadge | List + detail |
| Themed Select | Category + status |
| Tokens | Yes |
| mobileCardRenderer | Yes |
| LowStockBanner | Present; warning tokens |

ConfirmModal: **"Retire asset"** / "marked as retired (not permanently deleted)" -- matches soft-retire API.

---

## Open gaps (ordered)

### P0

_None._ Detail/edit GET `:id` works; create/update field set aligned; low-stock endpoint lives and is consumed.

### P1

_None open._ AST-delete and AST-dates closed 2026-07-16 (Retire copy; empty-string date clear).

### P2

1. Wire `LowStockBanner` `onFilterLowStock` to client-side filter or dedicated list mode (API has no `lowStock=1` query -- could filter by ids from banner response or add query).
2. Category filter on list (API already supports `category` query).
3. **Service due** surface: index exists on `nextServiceDate` but no list badge, banner, or `/assets/service-due` endpoint.
4. List columns optional: low-stock indicator when qty <= threshold.
5. Dedicated unit tests for low-stock `$expr` and retire semantics beyond e2e smoke.
6. Optionally default list filter to hide `retired` rows.

### P3

8. Link assets to rooms/floors (product enhancement; free-text location only today).
9. Quantity adjust shortcuts (+/-) without full edit form.

---

## Closed (verified 2026-07-16 -- do not re-file)

| Prior claim | Live status |
|-------------|-------------|
| Missing `GET /assets/:id` -> detail/edit 404 | **FIXED** -- route present after `/low-stock` |
| Zod/form field mismatch / phantom fields | **FIXED** -- name, category, location, qty, threshold, status, three dates, notes only |
| Low-stock API unused | **FIXED** -- `LowStockBanner` on list calls `assets/low-stock` |
| Service dates missing on forms | **FIXED** -- new + edit + detail |
| ConfirmModal hard-delete copy (AST-delete) | **FIXED** -- "Retire asset" / not permanently deleted |
| Blanking dates does not clear (AST-dates) | **FIXED** -- edit sends `''` for empty date keys |

---

## Acceptance checklist

- [x] List loads with search + status filter
- [x] Low-stock banner appears when threshold assets exist
- [x] Retire confirm copy accurate
- [x] Blanking dates on edit clears via empty string payload
- [x] Detail GET 200 hydrates identity, inventory, service dates
- [x] New create 201 with optional dates as ISO
- [x] Edit load + save 200
- [x] DELETE retires (status retired) without 404
- [ ] List copy / filter honest about retire vs destroy
- [ ] Blanking a date on edit clears stored date
- [ ] Optional: click banner filters low-stock rows
- [ ] Optional: overdue nextServiceDate visible

---

## Remediation log

- **2026-07-16:** Full source re-audit. Grade **A-**. Prior P0 GET-by-id and low-stock-unused claims closed.
- **2026-07-16 reconcile:** AST-delete (Retire copy) + AST-dates (empty-string clear) **CLOSED**. Residual P2: banner filter, service-due surface, category filter.
- **Earlier:** Batch A added GET `/:id` and form field alignment (confirmed present).
