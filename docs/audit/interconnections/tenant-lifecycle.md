# Interconnection: Tenant Lifecycle

**Updated:** 2026-07-12 (code-verified)

## Happy path

```
Admin New Tenant
  -> POST /tenants (User + Tenant + bed occupy)  [should return temporaryPassword -- OPEN P0]
  -> Show TempCredentialsDialog
  -> Detail GET /tenants/:id
  -> Optional documents POST /tenants/:id/documents
  -> Optional Guardian POST /guardians (returns temporaryPassword)
  -> Tenant logs into Flutter with temp password
  -> Monthly jobs generate invoices
  -> Payments offline / UTR against invoices
  -> Checkout POST /tenants/:id/checkout (guards)
  -> Optional Reinstate POST /tenants/:id/reinstate
  -> OR hard DELETE /tenants/:id (cascade)
```

## Checkout guards (source)

Blocks if:

- Invoices status in `sent|partial|overdue`
- Payments status in `pending_verification|overdue`

Then (transaction): moveOutDate, isActive false, free bed, User.isActive false.

## Reinstate

Requires original room active, original bed free. Reactivates tenant + user. Does not auto re-enable guardians (P2).

## Delete cascade children

Payments, Complaints, Invoices, Visitors, Guardians, LaundrySlots, MealFeedbacks, AttendanceRecords, LeaveApplications; free bed; scrub user email/phone; delete tenant.

**Not cascaded:** Notifications to user, Audit logs, room-level electricity.

## Occupancy / bed consistency

| Path | Transaction? | Notes |
|------|--------------|-------|
| Create | YES | Occupies bed |
| Checkout | YES | Frees bed |
| Reinstate | YES | Re-claims bed |
| Delete | YES | Frees bed |
| PUT transfer | **NO -- P0** | Free old then validate new -- can desync |
| PUT isActive false | **NO -- P0** | Does not free bed or deactivate user properly |

See also [occupancy-bed-consistency.md](./occupancy-bed-consistency.md).

## Cross-feature breaks

| Dependency | Issue |
|------------|-------|
| Guardians | May remain active after checkout -- verify product intent |
| Flutter portal | Needs User.tenantId + credentials from create |
| Nested GETs | payments/complaints/invoices/activity lack ownership (P1) |
| Invoices unpaid | Block checkout; FE dues panel exists |
| Rooms | Occupancy must track all lifecycle paths |

## Open gaps

- [ ] P0 transfer atomic + validate-first
- [ ] P0 remove isActive free toggle on edit
- [ ] P0 temporary password return + SaaS dialog
- [ ] P1 nested route ownership
- [ ] P2 checkout optionally deactivate guardians
- [ ] P2 OccupancyBedPicker on create/edit

## Acceptance

- [ ] Full create -> Flutter login -> checkout with zero dues
- [ ] Checkout blocked with dues; dues endpoint matches
- [ ] Failed transfer never leaves empty bed with tenant still "on" old bed id incorrectly
- [ ] isActive only via checkout/reinstate
- [ ] Delete removes guardians docs and frees bed
- [ ] Reinstate only when bed free
