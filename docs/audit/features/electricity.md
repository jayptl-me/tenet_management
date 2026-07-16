# Electricity -- Feature Audit

**Last verified:** 2026-07-16  
**Admin grade:** A-  
**Priority of remaining work:** P2  
**Surface:** Admin `apps/web` only (no Flutter electricity admin; charges appear on tenant invoices)

Code is truth. Re-verified against model, routes, invoice service share math, and admin FE pages.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/electricityBill.ts` |
| Routes | `apps/api/src/routes/electricity.ts` |
| Invoice share (generate) | `apps/api/src/services/invoice.service.ts` (`calculateElectricityShare`) |
| Shared types | `packages/types/src/electricity.ts` |
| Admin list | `apps/web/src/app/(admin)/electricity/page.tsx` |
| Admin detail | `apps/web/src/app/(admin)/electricity/[id]/page.tsx` |
| Admin new | `apps/web/src/app/(admin)/electricity/new/page.tsx` |
| Admin edit | `apps/web/src/app/(admin)/electricity/[id]/edit/page.tsx` |

---

## Model truth

| Field | Type / enum | Notes |
|-------|-------------|-------|
| month | YYYY-MM **unique** | One bill document per month |
| totalBillAmount | number required min 0 | Utility company total; **not** auto-tied to room sum |
| billImageUrl | string \| null | URL only; no upload pipeline |
| roomEntries[] | roomId, previous, current, unitsConsumed, ratePerUnit, amount | At least one entry |
| status | draft \| finalized \| distributed | Default draft |
| notes | max 500 | Optional |
| Pre-save | unitsConsumed = max(0, current-previous); amount = units * rate | PUT must use `save()` (does) |

No separate index beyond unique month (schema unique on month field).

---

## API surface

| Method | Path | Auth | Admin FE | Notes |
|--------|------|------|:--------:|-------|
| GET | `/electricity` | admin | **Wired** | Filters month, status; populate room entries |
| GET | `/electricity/:id` | admin | **Wired** | Room + floor populate |
| POST | `/electricity` | admin | **Wired** | Draft create; 409 DUPLICATE_BILL |
| PUT | `/electricity/:id` | admin | **Wired** | Locked if finalized/distributed; document.save for pre-save |
| POST | `/electricity/:id/finalize` | admin | **Wired** | draft -> finalized only |
| POST | `/electricity/:id/distribute` | admin | **Wired** | Requires finalized; updates/creates invoices; sets distributed |
| DELETE | `/electricity/:id` | admin | **Wired** | Blocks distributed |

### Distribute lifecycle (code-verified)

For each room entry:

1. Load **active** tenants in room (`isActive: true` only).
2. `sharePerTenant = entry.amount / tenants.length`.
3. If invoice exists for tenant+month:
   - Set `electricityAmount = share`
   - Replace electricity line items (filter descriptions starting with `electricity`)
   - Re-sync open pending payment to residual balance
   - Adjust invoice status paid/partial/sent from paid totals
4. Else: `generateSingleInvoice({ tenantId, month })` which **recalculates** share via `calculateElectricityShare` (date-aware tenant count).

Bill then status -> `distributed`.

### API vs FE Zod drift

| Contract | API | Admin FE | Drift |
|----------|-----|----------|-------|
| Create | month, totalBillAmount min 0, billImageUrl url?, roomEntries min 1 { roomId, previous, current, rate }, notes? | month, totalBillAmount min **0.01**, billImageUrl http(s) refine, roomEntries + unique room + current>=previous refine | **Minor** -- FE stricter min total; API allows 0 |
| Update | create.partial() | Same form shape as create | **Aligned** |
| Finalize / distribute | no body | empty json / none | **Aligned** |

---

## FE page matrix

| Page | Stack | API calls | Verdict |
|------|-------|-----------|---------|
| List | PageHeader, DataTable, StatusBadge, TableActions, mobileCardRenderer | GET; DELETE | **PASS** |
| Detail | FormPage, StatCard, Finalize / Distribute CTAs, room table, bill image link | GET; POST finalize; POST distribute | **PASS** actions wired |
| New | FormPage field array rooms, ResourceSelect, billImageUrl, computed units/amount | POST | **PASS** |
| Edit | Same as new; lock banner when finalized/distributed | GET; PUT | **PASS** lock UX |

### Special FE behaviors (verified)

| Behavior | Status |
|----------|--------|
| billImageUrl field | **Wired** new + edit + detail link |
| Finalize CTA | **Wired** when status draft |
| Distribute CTA | **Wired** when status finalized |
| Edit lock | **Wired** FE + API for finalized/distributed |
| Image upload | **None** -- URL paste only |
| Month filter on list | **Missing** (API supports) |

---

## Field coverage (model vs forms)

| Field | New | Edit | Detail | Notes |
|-------|:---:|:----:|:------:|-------|
| month | Y | Y | Y | Unique server-side |
| totalBillAmount | Y | Y | Y | Independent of room sum |
| billImageUrl | Y | Y | Y link | No Cloudinary upload |
| roomEntries.roomId | Y | Y | Y | ResourceSelect rooms |
| previous/current | Y | Y | Y | FE + API current >= previous |
| ratePerUnit | Y | Y | Y | Default 8 on new row |
| unitsConsumed | derived | derived | Y | pre-save |
| amount | derived | derived | Y | pre-save |
| status | draft default | lock after | Y badge | CTAs transition |
| notes | Y | Y | Y | |

---

## Lifecycle: draft -> finalize -> distribute

```
POST create draft
  -> pre-save units/amount per room

PUT while draft
  -> re-derive units/amount

POST finalize
  -> status finalized (only from draft)

POST distribute
  -> per active tenant share -> existing invoice update OR generateSingleInvoice
  -> re-sync pending payments
  -> status distributed

DELETE
  -> allowed draft/finalized; blocked distributed
```

### Integrity issue: share math divergence (**P1**)

| Path | Tenant denominator |
|------|-------------------|
| `POST .../distribute` | `Tenant.find({ roomId, isActive: true }).length` |
| `calculateElectricityShare` (invoice generate) | Active tenants with moveIn <= monthEnd and (moveOut null or >= monthStart) |

When tenants checked out mid-month still `isActive` false, or move dates differ, **distribute share != generate share**. Existing invoices use distribute formula; newly generated invoices use date-aware formula. Can produce inconsistent electricity lines in one run.

### totalBillAmount vs room sum

Admin may enter utility bill total that does not equal sum(room amounts). No server validation or pro-rata. Operational risk only (not a crash).

---

## Design

| Check | Result |
|-------|--------|
| Token colors under electricity/* | **PASS** |
| StatusBadge | **PASS** |
| FormPage / field array UX | **PASS** |
| mobileCardRenderer | **PASS** |
| List delete for distributed | **Weak** -- always shown; API rejects |

---

## Open gaps

### P0

None (CRUD + finalize + distribute are implemented and reachable).

### P1

None open. ELEC-P1-1 closed 2026-07-16 (date-windowed occupants on distribute).

### P2

| ID | Gap | Paths |
|----|-----|-------|
| ELEC-P2-1 | billImageUrl is paste-URL only; no upload -- wire Cloudinary or drop field emphasis | `electricity/new`, `electricity/[id]/edit`, model |
| ELEC-P2-2 | List Delete shown for distributed (API `BILL_ALREADY_DISTRIBUTED`) | `electricity/page.tsx` |
| ELEC-P2-4 | Edit always offered on list for locked bills (detail correctly hides Edit when not draft) | `electricity/page.tsx` vs `[id]/page.tsx` |
| ELEC-P2-5 | FE totalBillAmount min 0.01 vs API min 0 | form schemas vs `createBillSchema` |
| ELEC-P2-6 | After distribute, no link-out to affected invoices | `electricity/[id]/page.tsx` |

---

## Closed (do not re-file)

| Claim | Live status |
|-------|-------------|
| Finalize/distribute only on API, no FE buttons | **Closed** -- detail CTAs |
| PUT bypasses pre-save (findByIdAndUpdate) | **Closed** -- document.save + markModified |
| Duplicate month | **Closed** -- unique + 409 |
| Cannot edit finalized/distributed | **Closed** -- API BILL_LOCKED + FE lock UI |
| Room readings missing on forms | **Closed** -- field arrays |
| mobileCardRenderer missing | **Closed** |
| ELEC-P1-2 FE total vs rooms | **Closed** -- new/edit warn abs(diff)>0.5; hard-block large drift |
| ELEC-P2-3 month filter | **Closed** -- list month input |
| ELEC-P1-1 distribute isActive-only vs date-windowed share | **FIXED 2026-07-16** -- `routes/electricity.ts` distribute uses same `moveInDate`/`moveOutDate` window as `calculateElectricityShare` (`invoice.service.ts`); share rounded to cents; covered by `p1-lifecycle-integrity.test.ts` ELEC distribute vs generateSingleInvoice |

---
| ELEC-P2-3 | ~~List missing month filter~~ | **FIXED** -- `type=month` bound to API `month` |


## Acceptance checklist

- [ ] Create draft with 2 rooms -> units/amount derived correctly
- [ ] Duplicate month create -> 409
- [ ] Edit draft readings -> amounts recompute
- [ ] Finalize draft -> status finalized; further edit blocked
- [ ] Finalize non-draft -> 400
- [ ] Distribute finalized -> invoices get electricity line; open pending re-synced; bill distributed
- [ ] Distribute with mixed existing + missing invoices -> shares **consistent** (currently may fail ELEC-P1-1)
- [ ] Second distribute blocked (not finalized)
- [ ] Delete distributed blocked; delete draft OK
- [ ] billImageUrl displays on detail when set

---

## Remediation log

| Date | Change | Result |
|------|--------|--------|
| 2026-07-16 | Full code re-audit; rewrite this MD | Grade **B** then FE reconcile |
| 2026-07-16 | FE reconcile + month filter | Grade **A-**; open ELEC-P1-1 share math only |
| Prior | Detail finalize/distribute CTAs; edit lock; pre-save PUT | Closed prior "actions missing" gaps |
