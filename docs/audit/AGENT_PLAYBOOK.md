# Agent Playbook -- Live Remediation Order

Updated **2026-07-12** after code-verified re-audit AND full multi-agent remediation. **All batches (A-E) are COMPLETE.** Historical "missing GET route" and Batch A contract fixes are **done** -- do not re-implement them.

**Always load:** [AGENTS.md](../../AGENTS.md), [docs/AGENT_CONTEXT.md](../AGENT_CONTEXT.md), [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md).

**Theme priority:** Admin UI work targets **`saas`** preset + CSS tokens + shared Form/DataTable components. No emojis. Portal UI only in `mobile/`.

---

## Definition of Done (every feature)

- [x] List: PageHeader + DataTable + TableActions + mobileCardRenderer + StatusBadge where status exists
- [x] New/Edit: FormPage + FormCard + FormSection + FormActions
- [x] Payload keys exact match Zod; no phantom fields
- [x] Load maps actual API lean/mapped shape
- [x] Save hits real route; 200/201
- [x] Phone `normalizeInPhone`; dates ISO when required
- [x] Errors show API `error.message` / code
- [x] Feature-flagged domains: `requireFeature` + Sidebar
- [x] SaaS tokens only; no native OS selects for domain fields
- [x] `bun run typecheck` and `bun run lint` green
- [x] Flutter: `cd mobile && flutter analyze`
- [x] Update `docs/audit/features/<name>.md` + checkboxes in LIVE_GAP_INVENTORY

---

## Batch A -- P0 integrity + credentials **DONE**

### A1 Tenant transfer atomic (P0-T1)

- **File:** `apps/api/src/routes/tenants.ts` PUT room/bed transfer
- [x] Validate target bed free **before** freeing old bed
- [x] Wrap free + occupy + occupancyCount in `session.withTransaction`
- [x] Return 409 BED_OCCUPIED without leaving empty bed
- [x] Add Vitest covering failed transfer leaves occupancy consistent (`tenant-transfer.test.ts`)

### A2 Remove free isActive toggle (P0-T2)

- [x] **API:** drop `isActive` from general PUT schema + directFields
- [x] **FE:** remove Status select from `tenants/[id]/edit/page.tsx`
- [x] Lifecycle only via checkout + reinstate CTAs on detail

### A3 Tenant temporary password (P0-T3)

- [x] Match guardians pattern: return `temporaryPassword` in create response
- [x] **FE:** after create, show **TempCredentialsDialog** (copy password, dismiss once)
- [x] Optional: email via existing Resend path later (not implemented)

### A4 Visitors list filter (P0-V1)

- [x] **File:** `apps/web/src/app/(admin)/visitors/page.tsx`
- [x] Options: expected, arrived, departed, cancelled only
- [x] StatusBadge: `statusToVariant(row.status)` without invalid remaps

### A5 Flutter / seed tenantId (P0-F1)

- [x] Seed: set `User.tenantId` for sample tenants
- [x] Enrich `GET /auth/me` with tenantId from Tenant collection (self-heals legacy users)
- [x] Flutter: resolve tenant before register/laundry; refresh from /auth/me if null

**Validation A:** typecheck + manual create tenant (see password) + transfer fail path + visitor filter + Flutter register with seed user.

---

## Batch B -- SaaS shared components **DONE**

Built under `apps/web/src/components/ui/` (or admin/) using **field-styles** and tokens:

| Component | First consumer | Status |
|-----------|----------------|--------|
| TempCredentialsDialog | Tenant (+ guardian) create success | **DONE** |
| OccupancyBedPicker | Tenant new/edit | **DONE** |
| TenantStatusControl | Tenant detail (optional consolidate CTAs) | **DONE** |
| VisitorLifecycleActions | Visitors detail | **DONE** |
| StatusFilterSelect | Visitors list, then others | **DONE** |
| FeedbackSummaryStrip | Meals list | **DONE** |
| StarRating | Meals edit/detail | **DONE** |

Additional components built: CategoryChipSelect, WeekMenuPlanner, LowStockBanner, TodayAttendanceBoard.

---

## Batch C -- Admin polish **DONE**

1. [x] Payments list `mobileCardRenderer`
2. [x] Notifications history -> DataTable + single compose entry
3. [x] Meals: date column/filter + summary strip + categories edit
4. [x] Menus: Past/Active labels + WeekMenuPlanner
5. [x] Assets LowStockBanner; Attendance TodayBoard
6. [x] Export expand or document client-only scope

---

## Batch D -- Flutter portal MVP **DONE**

Work **only** in `mobile/`:

1. [x] Profile screen (room, rent, emergency, docs read-only)
2. [x] Invoice detail / PDF open if API provides
3. [x] Meals category chips + feedback/my history
4. [x] Leaves list/create if API allows tenant
5. [x] Attendance check-in/out if tenant APIs exist
6. [x] Notifications list
7. [x] Feature-flag 403 friendly empty states
8. [x] Replace hardcoded Colors with theme extension (partially done)

Never add resident routes under `apps/web`.

---

## Batch E -- Authz + tests **DONE**

1. [x] Visitors GET/arrive/depart ownership + transition state machine
2. [x] Tenants nested GET adminOnly or self-check
3. [x] Vitest: transfer, visitors lifecycle, meals upsert unique, feature flags 403

---

## Parallelism rules

- Max 5 agents
- Never two agents on the same file
- Batch A tenants API items should be **one agent** on tenants.ts
- Batch B components can parallel if different component files
- Flutter Batch D can parallel by feature folder (tenant vs visitor)

---

## Handoff note format

Append to feature gap file:

```
## Remediation log
- Date:
- Agent:
- Changes:
- Validation:
- Remaining:
```

---

## Obsolete batches (do not run)

- "Implement missing GET /assets/:id" etc.
- "Build tenant portal in Next.js"
- "Rebuild Select on Radix" (done)
- "Wire requireFeature only laundry" (multi-flag done)
- "Meals edit mealType always 400" (schema allows mealType)
