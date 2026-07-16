# Interconnection: Tenant Lifecycle

**Last verified:** 2026-07-16

## Flow diagram or steps (ASCII ok)

```
Admin New Tenant (apps/web tenants/new)
  -> POST /api/v1/tenants
       withTransaction:
         validate room active + bed free
         User (role tenant, temp password hashed via pre-save)
         Tenant (isActive true, roomId/bedId)
         occupy Room.beds[] + occupancyCount
         User.tenantId = Tenant._id
  -> 201 data includes temporaryPassword
  -> TempCredentialsDialog (one-time share)

Detail hub GET /tenants/:id
  -> Documents POST /tenants/:id/documents (Cloudinary optional)
  -> Guardian POST /guardians (own temporaryPassword; flag-gated)
  -> Nested: payments / invoices / complaints / activity / dues
  -> Flutter login with temp password (tenant role)

Edit PUT /tenants/:id
  -> Scalar: monthlyRent, depositPaid, moveInDate, emergencyContact, user.*
  -> Optional room/bed transfer (atomic; no free isActive toggle)

Checkout POST /tenants/:id/checkout
  -> Guard unpaid invoices (sent|partial|overdue) -> 409 UNPAID_INVOICES
  -> Guard payments (pending_verification|overdue) -> 409 UNRESOLVED_PAYMENTS
  -> withTransaction: moveOutDate, isActive false, free bed, User.isActive false
  -> Guardians NOT auto-deactivated (product gap)

Reinstate POST /tenants/:id/reinstate
  -> Requires inactive tenant, active original room, free original bed
  -> withTransaction: re-occupy bed, isActive true, clear moveOutDate, User active

Hard DELETE /tenants/:id
  -> withTransaction cascade children, free bed, scrub tenant User email/phone,
     deactivate tenant User; delete Tenant doc
```

## Code paths (source files)

| Concern | Path |
|---------|------|
| API routes | `apps/api/src/routes/tenants.ts` |
| Tenant model / indexes | `apps/api/src/models/tenant.ts` |
| Room beds | `apps/api/src/models/room.ts` |
| Guardian create | `apps/api/src/routes/guardians.ts` |
| Admin new | `apps/web/src/app/(admin)/tenants/new/page.tsx` |
| Admin detail hub | `apps/web/src/app/(admin)/tenants/[id]/page.tsx` |
| Admin edit / transfer | `apps/web/src/app/(admin)/tenants/[id]/edit/page.tsx` |
| Admin list | `apps/web/src/app/(admin)/tenants/page.tsx` |
| Temp password UI | `apps/web/src/components/ui/TempCredentialsDialog.tsx` |
| Bed picker (create) | OccupancyBedPicker (new page) |
| Flutter portal | `mobile/lib/features/tenant/**`, auth rejects admin |
| Related feature audit | `docs/audit/features/tenants.md` |
| Occupancy interconnection | `docs/audit/interconnections/occupancy-bed-consistency.md` |

### API surface (verified)

| Method | Path | Role | Behavior |
|--------|------|------|----------|
| POST | `/tenants` | admin | Txn create + bed occupy; returns `temporaryPassword` |
| GET | `/tenants` | admin | Filters `isActive`, `roomId`, `floorId`, `search` |
| GET | `/tenants/:id` | admin or owner | `assertAdminOrTenantOwner` |
| PUT | `/tenants/:id` | admin | Transfer/swap in session; 409 `BED_OCCUPIED`; **no `isActive` in Zod** |
| POST | `/tenants/:id/checkout` | admin | Dues guards + free bed + deactivate User |
| POST | `/tenants/:id/reinstate` | admin | Reclaim bed if free; reactivate User |
| POST | `/tenants/:id/documents` | admin | KYC upload |
| GET | `/tenants/:id/{payments,complaints,invoices,activity}` | admin or owner | Ownership gated |
| GET | `/tenants/:id/dues` | admin | Checkout dues summary |
| DELETE | `/tenants/:id` | admin | Cascade + free bed + scrub tenant User |

### Create / update Zod (truth)

- **Create:** name, email, phone `+91[6-9]\d{9}`, roomId, bedId, moveInDate ISO datetime, monthlyRent 1000-50000, optional deposit/emergency/docs URLs.
- **Update:** monthlyRent, depositPaid, bedId enum A-D, roomId, moveInDate, emergencyContact, nested `user.{name,email,phone}` only. **`isActive` not accepted.**

### Transfer algorithm (PUT)

1. Pre-validate target room active and target bed free (or owned by same tenant).
2. `session.withTransaction`: reload tenant; free old bed; occupy new; update `roomId`/`bedId`; optional user fields; save.
3. Best-effort audit log outside transaction for room/bed changes.
4. Concurrent target occupancy -> 409 `BED_OCCUPIED` (in-txn recheck).

### Checkout guards (source)

Blocks if:

- Invoices status in `sent | partial | overdue` -> `UNPAID_INVOICES` 409
- Payments status in `pending_verification | overdue` -> `UNRESOLVED_PAYMENTS` 409

Then (transaction): `moveOutDate`, `isActive false`, free bed (`isOccupied false`, `tenantId null`, recompute `occupancyCount`), `User.isActive false`.

### Delete cascade children

In one transaction: Payments, Complaints, Invoices, Visitors, Guardians (docs only), LaundrySlots, MealFeedbacks, AttendanceRecords, LeaveApplications; free bed; tenant User scrubbed (`isActive false`, email/phone `deleted:…`); Tenant deleted.

**Not cascaded:** Notifications to user, AuditLogs, room-level ElectricityBills, **guardian User accounts** (orphan logins possible after Guardian doc delete).

### FE CTAs (detail hub)

| CTA | When | Call |
|-----|------|------|
| Edit | always | navigate `/tenants/:id/edit` (transfer via room/bed fields) |
| Check Out | `isActive` | dues fetch -> confirm -> `POST .../checkout` |
| Reinstate | `!isActive` | `POST .../reinstate` |
| Add guardian | empty guardians list | `/guardians/new?tenantId=` |
| Documents | always | upload widgets |
| WhatsApp / Copy Info | contact present | client-side only |

## What works

- Create occupies bed inside transaction; returns `temporaryPassword`; admin dialog works.
- Transfer / same-room bed swap: validate-first + Mongo session; 409 on occupied target.
- `isActive` lifecycle only via checkout/reinstate (removed from PUT schema and edit FE).
- Nested GETs use `assertAdminOrTenantOwner` (admin or owning tenant).
- Checkout dues endpoint + FE modal; reinstate CTA when inactive.
- OccupancyBedPicker on create; edit filters occupied beds (hand-rolled Select).
- E2E coverage in `module-http-e2e.test.ts` / transfer tests for bed paths.
- Cross-ref feature audit grades lifecycle core as PASS (A- residual P1).

## Gaps / half-baked

| Severity | Gap | Proof |
|----------|-----|-------|
| P1 | No partial unique index on active `(roomId, bedId)`; concurrent create/transfer can race past app checks | `tenant.ts` index `{ roomId, bedId, isActive }` non-unique |
| P1 | DELETE deletes Guardian docs but does not deactivate/scrub guardian `User` accounts | `tenants.ts` DELETE; guardians created with separate Users |
| P1 | Checkout/reinstate/transfer FE catch blocks show generic strings; API codes not parsed | detail + edit pages |
| P2 | Checkout does not deactivate linked guardians (login still possible for ward data until flag/route checks) | checkout handler only touches tenant User |
| P2 | Edit bed UI not shared OccupancyBedPicker | edit page |
| P2 | Checkout overlay ad-hoc `bg-black/40` vs shared modal | detail page |
| P2 | `@pg/types` may lag create response `temporaryPassword` | packages/types tenant |

**Obsolete claims (do not refile):** non-atomic transfer, free `isActive` on PUT, temporaryPassword discarded, nested GET IDOR.

## Acceptance for fix agents

- [x] Create occupies bed; room shows tenant; admin sees temp password once
- [x] Transfer frees old / occupies new; 409 if target occupied; no partial free-without-claim on failure
- [x] `isActive` cannot flip without checkout/reinstate
- [x] Nested GETs require admin or tenant owner
- [x] Checkout blocked with unpaid invoices / unresolved payments
- [ ] Partial unique index (or atomic claim helper) prevents double-book under concurrent load
- [ ] Cascade delete deactivates scrubbed guardian Users (or product documents orphan policy)
- [ ] FE surfaces `UNPAID_INVOICES`, `BED_OCCUPIED`, `UNRESOLVED_PAYMENTS` codes
- [ ] Product decision: deactivate guardians on checkout or leave active

## Remediation log

| Date | Change | Status |
|------|--------|--------|
| pre-2026-07-12 | Transfer free-before-validate; isActive free toggle; temp password dropped | Open historically |
| ~2026-07-12+ | Transfer session + validate-first; temp password + dialog; isActive removed from PUT; nested ownership | **Fixed in source** |
| 2026-07-16 | Interconnection audit re-verified against `tenants.ts` + admin pages; P0s closed; residual P1 race + guardian User cascade | Docs synced |
