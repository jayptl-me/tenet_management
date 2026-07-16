# FE Batch 2 Audit -- Payments, Invoices, Electricity, Complaints, Services, Assets

> **SUPERSEDED 2026-07-16.** Authoritative backlog: [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) and per-module [features/](./features/). Historical batch notes only.

> Adversarial frontend audit. Code is truth. Compared `apps/web` admin pages against `apps/api/src/routes/*.ts` Zod and handlers.
> Date: 2026-07-16. Scope: list / detail / new / edit + stated lifecycles only.

## Summary counts (Open)

| Severity | Count |
|----------|------:|
| P0       | 0 |
| P1       | 7 |
| P2       | 12 |
| PASS     | 28 |

---

## Findings table

| Severity | Module | Page | Field/Flow | Problem | Evidence | Fix |
|----------|--------|------|------------|---------|----------|-----|
| P1 | Payments | Detail `payments/[id]` | UTR display / verify | Admin approve/reject UI never shows `utrNumber` (or screenshot context beyond optional URL). Operator cannot confirm the UTR they are verifying. | `PaymentDetail` interface has no `utrNumber` (`apps/web/.../payments/[id]/page.tsx` L26-43). No DetailRow for UTR. API returns full payment lean doc with `utrNumber` on GET `/payments/:id`. | Add `utrNumber` to type and render a prominent row when present; keep screenshot block. |
| P1 | Payments | Detail | Receipt lifecycle | API exposes `GET /payments/:id/receipt` but admin UI never calls it. No receipt view/print/download after offline create or verify. | `apps/api/src/routes/payments.ts` L614-641. Grep of `apps/web` for `receipt` under payments: zero usages. | Add "View receipt" action that hits `payments/${id}/receipt` with auth and renders printable summary (or PDF if added later). |
| P1 | Payments | Detail | Invoice linkage | Invoice is shown as raw mono id string only; not navigable to `/invoices/:id`. Weakens tenant/invoice linkage UX after offline payment. | `payments/[id]/page.tsx` L253-266. | Link `invoiceId` / invoice number to `/invoices/${invoiceId}`. |
| P1 | Electricity | Edit `electricity/[id]/edit` | Locked status UI | Finalized bills are treated as load-time errors but form controls remain enabled (only `distributed` disables inputs / hides submit). User can edit and hit Save; API returns `BILL_LOCKED`. | Edit page: early return sets error for `finalized`/`distributed` (L122-129) but `disabled={billStatus === 'distributed'}` only (L237+). API PUT blocks both (electricity.ts L146-148). | Disable all fields + hide submit for both `finalized` and `distributed`; prefer redirect to detail. |
| P1 | Complaints | Edit `complaints/[id]/edit` | Tenant "Reported by" card | FE reads `complaintData.tenantId` with `userId`/`roomId`; API `mapComplaint` returns `tenant` with `user`/`room`. Card never populates. | FE L53-58, L127. API `complaints.ts` mapComplaint L31-69; GET `/:id` returns mapped shape. | Use `tenant` shape (or dual-read `tenant ?? tenantId` + `user ?? userId`). Prefer shared `tenantDisplayName`. |
| P1 | Complaints | Edit | Category free text | Edit uses free-text `Input` for category. Mongoose enum rejects values outside the closed list even though update Zod is open string max 50. | FE edit L197-202 (`register('category')` as Input). Model enum `complaint.ts` L33-45. | Use same category select as new page (or load from config) constrained to model enum. |
| P1 | Services | List `services/page` | Status filter | FE sends `?status=` but API GET `/services` only filters `floorId`. Status filter is a silent no-op; counts/pagination wrong when filter selected. | FE L122. API `services.ts` L99-108 (no status branch). | Either implement `status` query on API or filter client-side after fetch (and document). |
| P2 | Payments | New offline | Notes max length | FE `notes` optional with no max; API `offlinePaymentSchema.notes` max 500. Long notes 400. | FE schema L25; API payments.ts L88. | `z.string().max(500).optional()`. |
| P2 | Payments | Edit | Notes max length | Same gap on PUT body. | FE edit schema L22; API `updatePaymentSchema` L112. | Add `.max(500)`. |
| P2 | Payments | List | Delete paid | Delete always offered; API rejects paid with 422 `PAYMENT_VERIFIED`. Generic error only. | List TableActions always `onDelete` (L169). API L761-772. | Hide delete when `status === 'paid'`; surface API error message. |
| P2 | Invoices | New / bulk | Month format | FE regex `^\d{4}-\d{2}$` accepts month 13-99; API requires `0[1-9]|1[0-2]`. Bulk generate has no client validation. | New L19-22; list bulk input L178-184. API `generateBulkSchema` / `generateSingleSchema` L28-35. | Align regex with API; validate bulk month before POST. |
| P2 | Invoices | Edit | Paid lock UX | Paid invoices block submit and show banner, but amount/date inputs stay enabled; confusing. | Edit L118-120, L198-214 (no `disabled` on inputs for paid). API L220-221. | Disable inputs when `status === 'paid'`. |
| P2 | Invoices | Detail | Payment history completeness | Detail renders `invoice.payments` from GET invoice, which only loads `status: 'paid'`. Pending/pending_verification not listed. | API invoices.ts L157-159. FE detail L329-378. | Either document as paid-only, or extend API/FE to show all non-cancelled payments. |
| P2 | Electricity | New/Edit | Month regex | Same weaker YYYY-MM regex as invoices. | new L33; edit L33. API L31. | Match API month regex. |
| P2 | Electricity | New/Edit | Notes max | FE notes unconstrained; API `notes` max 500. | createBillSchema L35. | `.max(500)`. |
| P2 | Electricity | List | Edit affordance | Table always shows Edit for finalized/distributed bills that API locks. | list L129-133. | Conditionally omit Edit when status !== `draft`. |
| P2 | Assets | List delete | Soft retire vs delete | Modal says "delete" / "cannot be undone"; API sets `status: 'retired'` (soft). | FE ConfirmModal L217-223; API assets.ts L160-168. | Relabel to "Retire asset" and refresh status messaging. |
| P2 | Assets | Edit | Clear service dates | Clearing a date sends `undefined` (omitted field); partial update leaves previous date. Cannot clear service dates once set. | edit onSubmit L120-126. API update applies only defined keys. | Send `null` or empty string when cleared if API accepts; or add explicit clear. API already maps empty optionalDateString to null on create. |
| P2 | Assets | New | Defaults | No default `category`/`status` in form defaults; empty selects until user picks (zod fails late). | new defaultValues L59. | Default `category: 'other'`, `status: 'available'`. |
| P2 | Services | Detail | Labels | Hardcoded `serviceLabels` map incomplete vs dynamic amenity keys; falls back to raw key (OK) but inconsistent with list which uses app-config. | detail L25-33 vs list getLabel from definitions. | Prefer app-config labels on detail too. |
| P2 | Services | New | Fallback types | On app-config failure, hardcoded fallbacks may not match live amenity keys. | new L56-61. | Show hard error "Failed to load amenity definitions" instead of inventing keys. |
| P2 | Complaints | Detail | Edit entry | Detail allows status/adminNotes update only; no link to full edit page for title/desc/priority. | detail page has no Edit action. | Add Edit button to `/complaints/[id]/edit`. |

---

## PASS checklist (verified against API)

| Module | Flow | Result | Notes |
|--------|------|--------|-------|
| Payments | Offline create schema | PASS | `tenantId`, `invoiceId`, `amount` min 0.01, method enum `cash|bank_transfer|other`, `paidAt` ISO via `toIsoFromLocal`, notes optional. Matches `offlinePaymentSchema`. |
| Payments | Offline tenant/invoice linkage | PASS | Invoice options filtered by tenant + payable statuses `draft|sent|partial|overdue`. Balance prefill from GET invoice. |
| Payments | Verify approve/reject | PASS | POST `payments/:id/verify` with `{ approved: boolean }` matches `verifyPaymentSchema`. |
| Payments | Edit PUT payload | PASS | amount/method/type/status enums align with `updatePaymentSchema`. |
| Payments | List filters | PASS | method/type/status query params match API. |
| Invoices | Generate single | PASS | POST `invoices/generate-single` `{ tenantId, month }`. |
| Invoices | Bulk generate | PASS | POST `invoices/generate-bulk` `{ month }` from list. |
| Invoices | Partial status not clobbered | PASS | Edit deliberately omits `status` when current status is `partial` (comment + guard L131-134). Status select hidden for paid/partial. |
| Invoices | Paid lock | PASS | Client blocks submit when paid; API also `INVOICE_LOCKED`. |
| Invoices | PDF download auth blob | PASS | Uses `api.get(.../pdf).blob()` + object URL download; comment documents JWT requirement (detail L428-437). |
| Invoices | dueDate payload | PASS | Date input converted to ISO datetime for API `z.string().datetime()`. |
| Invoices | Amount fields | PASS | rent/electricity/otherCharges min 0; API same. |
| Electricity | Create reading payload | PASS | month, totalBillAmount, roomEntries `{ roomId, previousReading, currentReading, ratePerUnit }`, optional billImageUrl/notes. Matches `createBillSchema`. |
| Electricity | billImageUrl | PASS | Optional URL; empty stripped; FE http(s) refine; detail shows link when set. |
| Electricity | Finalize draft-only | PASS | Detail shows Finalize only when `status === 'draft'`; API rejects non-draft. |
| Electricity | Distribute | PASS | Detail shows Distribute only when `finalized`; POST distribute. |
| Electricity | Edit locked distributed | PASS | Distributed path sets error + hideSubmit + disabled fields. |
| Electricity | current >= previous | PASS | FE refine + API handler check. |
| Complaints | New title/desc min-max | PASS | title 5-200, description 10-2000 match API create Zod. |
| Complaints | New priority/status enums | PASS | priority enum matches; status set by API default open. |
| Complaints | Admin tenantId required | PASS | FE requires tenantId; payload includes tenantId (API TENANT_REQUIRED for admin). |
| Complaints | Status transitions | PASS | Detail PUT full with status enum; kanban uses PUT `/:id/status` with `{ status }` matching `updateStatusSchema`. |
| Complaints | Edit update whitelist | PASS | title/description/category/priority/status/adminNotes only. |
| Services | serviceType from amenityDefinitions | PASS | New/edit load `app-config` amenityDefinitions keys (prefer `isPerFloor`); not wrong hardcoded-only primary path. |
| Services | Create payload | PASS | floorId, serviceType, status enum, note max 500. |
| Services | Full update path | PASS | Edit uses PUT `services/:id/full` with serviceType/status/note (status-only PUT would reject serviceType). Floor disabled (API full does not move floor). |
| Assets | CRUD field coverage | PASS | name, category enum, location, quantity, lowStockThreshold, status enum, purchasedDate, lastServicedDate, nextServiceDate, notes — match create/update schemas. |
| Assets | Low stock | PASS | List mounts `LowStockBanner` calling `assets/low-stock`. |
| Assets | Service dates on detail | PASS | Purchase / last / next service rendered. |

---

## Lifecycle notes (by module)

### Payments
1. **Offline create**: New page -> POST `/payments/offline` with ISO paidAt. Correct method whitelist (no UPI offline).
2. **Verify**: Detail approve/reject -> POST `/:id/verify`. Works, but missing UTR visibility (P1).
3. **Tenant/invoice linkage**: Tenant ResourceSelect + invoice list by tenant; balance from invoice detail. Solid.
4. **Receipt**: API ready; FE missing (P1).

### Invoices
1. **Generate**: Single + bulk wired to correct endpoints.
2. **Edit status**: Partial cannot be forced to `sent` on save (critical regression already fixed).
3. **Paid lock**: Enforced client + server.
4. **PDF**: Auth blob path correct (not window.open).

### Electricity
1. **Create reading**: Multi-room field array; units/amount computed client-side for display; server pre-save derives.
2. **billImageUrl**: Optional on create/edit/detail.
3. **Finalize**: Draft-only controls on detail.
4. **Distribute**: Finalized-only; surfaces distributed/error counts.
5. **Edit lock**: Distributed OK; finalized incomplete (P1).

### Complaints
1. **Title/desc**: Aligned with API Zod min/max.
2. **Status**: List kanban + detail form cover open/in_progress/resolved/dismissed.
3. **Edit tenant card / category select**: Failures (P1).

### Services
1. **serviceType**: Driven by amenityDefinitions (primary path PASS).
2. **Status filter**: Broken against API (P1).
3. **CRUD**: Create, full edit, delete, open-complaint enrichment display OK.

### Assets
1. **Service dates + low stock + CRUD**: Present and schema-aligned.
2. **Delete semantics**: Soft retire (P2 messaging).

---

## Method

- Read API: `payments.ts`, `invoices.ts`, `electricity.ts`, `complaints.ts`, `services.ts`, `assets.ts`.
- Read FE: all list/detail/new/edit pages under `apps/web/src/app/(admin)/{payments,invoices,electricity,complaints,services,assets}/`.
- Cross-checked FE Zod/submit payloads vs API `z.strictObject` schemas and status guards.
- Did not trust `docs/audit/LIVE_GAP_INVENTORY.md`.

---

## Suggested fix priority

1. P1: Payment UTR + receipt; complaint tenant shape + category select; electricity finalized lock UI; services status filter.
2. P2: Validation max lengths / month regex; asset retire messaging; invoice paid disable; list edit gates.

No product code was modified in this audit pass.
