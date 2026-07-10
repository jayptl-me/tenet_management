---
name: electricity-bill-finalized-edit-gap
description: PUT /electricity/:id only blocks editing distributed bills but allows editing finalized bills, which should be locked
metadata:
  type: project
---

In apps/api/src/routes/electricity.ts:146, the PUT handler checks `if (bill.status === 'distributed')` to block edits, but does NOT check for `finalized` status. Once a bill is finalized (readings locked, ready for distribution), it can still be edited, which could lead to data inconsistency if distribution has already used the readings for invoice calculations.

**Why:** Data integrity risk -- finalized readings should be immutable until distribution, after which they become truly locked.

**How to apply:** Add `|| bill.status === 'finalized'` to the guard condition in electricity.ts PUT handler.
