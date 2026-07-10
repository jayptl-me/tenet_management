# SPEC AGENT PROMPT -- Adaptive Codebase Audit & Self-Healing Orchestration

> **Purpose**: This prompt is designed to be fed to an AI agent at any point in this codebase's lifecycle. It dynamically discovers the current state, audits structural integrity, identifies gaps, and orchestrates sub-agents to apply fixes. It never trusts outdated documentation -- it reads source files directly.

> **Stack**: Bun monorepo -- Next.js 16 (React 19, Tailwind v4, motion, Recharts) + Express (Hono, Mongoose 8, Zod)
> **Repository root**: `/home/odoo/Development/tenet_management`
> **Spec reference**: `docs/specs/` (read for domain knowledge, not as source of truth)

---

## PHASE 0: State Detection (MANDATORY -- run first every time)

Before any audit or fix, discover the current codebase state. Do not assume anything.

### 0.1 Package & Dependency Scan

```
read: package.json
read: apps/api/package.json
read: apps/web/package.json
```

Verify: installed packages, versions, workspace setup.

### 0.2 Structure Discovery

```
list: apps/api/src/models       (all model files)
list: apps/api/src/routes       (all route files)
list: apps/web/src/app/(admin)  (all admin pages + subdirectories)
list: apps/web/src/components/ui (all UI components)
list: apps/web/src/components/admin (all admin shell components)
list: packages/types/src        (all shared type files)
```

### 0.3 Feature Flag Detection

Read `apps/api/src/models/appConfig.ts` and extract all boolean flags under `features: { ... }`. These control sidebar visibility and route gating.

### 0.4 Build State

```
execute: cd /home/odoo/Development/tenet_management && bun run --cwd apps/api typecheck 2>&1 | tail -5
execute: cd /home/odoo/Development/tenet_management && bun run --cwd apps/web typecheck 2>&1 | tail -5
execute: cd /home/odoo/Development/tenet_management && bun run --cwd apps/web lint 2>&1 | tail -10
```

### 0.5 Live Entity Map

From the model files discovered in 0.2, build an in-memory entity map:

- For each model: list all fields, types, FK references, unique indexes, validators, virtuals
- For each route: list all endpoints (method + path), which model they operate on, which populates they use
- For each frontend page: list which API endpoints it calls, which components it renders

**Output of Phase 0**: A complete, code-verified inventory of every entity, endpoint, page, and component.

---

## PHASE 1: Relational Integrity Audit

For every FK relationship discovered in Phase 0.5, trace the full mutation lifecycle.

### 1.1 Cascade Audit

For every model that has child entities (e.g., Tenant has Payments, Invoices, Complaints):

- Check the DELETE handler: does it cascade to children?
- Check the PUT handler: does it maintain FK consistency when the parent changes?
- Flag every missing cascade as P0.

### 1.2 Compound Index Enforcement

For every unique compound index (e.g., `{ tenantId, month }` on Invoice):

- Check the CREATE handler: does it handle duplicate key errors (code 11000)?
- Check the UPDATE handler: does it prevent index violations?
- Flag every missing handler as P1.

### 1.3 Cross-Field Validation

For every model with auto-derived fields (e.g., Invoice.totalAmount, ElectricityBill.unitsConsumed):

- Verify the pre-save hook or middleware exists
- Verify the PUT handler triggers re-derivation on field changes
- Flag every missing derivation as P0.

### 1.4 Occupancy/Bed Consistency (CRITICAL PATH)

This is the most fragile relationship in the system:

- Room.beds[].isOccupied must always match reality
- Tenant.bedId + Tenant.roomId must always match a bed in that room
- Room.occupancyCount = beds.filter(isOccupied).length
- On sharingType change: beds array must be rebuilt (see `rebuildBedsForSharingType` in `apps/api/src/routes/rooms.ts`)

Trace every code path that modifies beds: tenant create, tenant checkout, tenant delete, tenant room transfer, tenant bed swap, room sharingType edit. Verify each path updates all three consistency points.

### 1.5 Audit Output Format

```
| # | Severity | File | Issue | Current Behavior | Required Behavior |
|---|----------|------|-------|-----------------|-------------------|
| 1 | P0 | tenants.ts:DELETE | Tenant delete doesn't cascade to Payments | Payments orphaned | Cascade-delete or mark inactive |
```

---

## PHASE 2: Integration Completeness Matrix

For every module (Tenants, Rooms, Floors, Payments, Invoices, Electricity, Complaints, Services, Assets, Notices, Notifications, Enquiries, Visitors, Guardians, Attendance, Leaves, Laundry, Meals, Menus, Settings, Audit Logs):

### 2.1 Page Completeness

Check existence and quality of:

- List page (`apps/web/src/app/(admin)/<module>/page.tsx`)
- Detail page (`apps/web/src/app/(admin)/<module>/[id]/page.tsx`)
- Edit page (`apps/web/src/app/(admin)/<module>/[id]/edit/page.tsx`)
- New page (`apps/web/src/app/(admin)/<module>/new/page.tsx`)

For each existing page, verify:

- Uses `PageHeader` component (not raw `<h2>`)
- Uses `TableActions` component (not raw `<button>` with Eye/Pencil/Trash2 icons)
- Has `mobileCardRenderer` callback if using `DataTable`
- Has proper loading skeleton, empty state, error state
- Has `FormPage` / `FormCard` / `FormSection` structure on edit/new pages
- Calls the correct API endpoint with proper error handling

### 2.2 API Completeness

For each backend route file:

- GET list: paginated with filters
- GET by ID: populated with virtuals
- POST: validated with Zod, handles duplicates
- PUT: partial update, maintains relational integrity
- DELETE: checks for active dependents before deleting

### 2.3 Output Format

```
| Module | List | Detail | Edit | New | Backend CRUD | Actions | Header | Mobile | Issues |
|--------|------|--------|------|-----|-------------|---------|--------|--------|--------|
| Tenants | PASS | PASS | PASS | PASS | PASS | TableActions | PageHeader | PASS | - |
| Complaints | PASS | PASS | PASS | PASS | PASS | TableActions | RAW H2 | PASS | Replace header |
```

---

## PHASE 3: Component Quality Audit

### 3.1 Design Token Compliance

Verify all pages use CSS variable references, not hardcoded colors:

- `text-[color:var(--color-text-primary)]` not `text-gray-900`
- `bg-[color:var(--color-card-bg)]` not `bg-white`
- `border-[color:var(--border-color)]` not `border-gray-200`

Flag any hardcoded Tailwind color classes (e.g., `bg-white`, `text-gray-500`, `border-gray-200`) that should use theme tokens instead.

### 3.2 Shared Field Styles

Verify form pages use the shared field style classes from `apps/web/src/lib/field-styles.ts`:

- `fieldControlBase`, `fieldControlBorderOk`, `fieldLabelClass`, `surfaceCardClass`, `surfaceNestedClass`, `formActionsBarClass`, `pageStackClass`

Flag any inline Tailwind on form elements that duplicates these shared classes.

### 3.3 Status Badge Consistency

Verify all status displays use `<StatusBadge>` with `statusToVariant()` -- never inline conditional color logic.

---

## PHASE 4: Functional Flow Testing

For each critical lifecycle, trace the complete frontend-to-backend-to-database path.

### 4.1 Tenant Lifecycle

1. Create: `/tenants/new` -> POST /tenants -> creates User + Tenant + marks bed occupied
2. View: `/tenants/:id` -> GET /tenants/:id -> shows populated data
3. Edit: `/tenants/:id/edit` -> PUT /tenants/:id -> handles room transfer correctly
4. Checkout: `/tenants/:id` checkout modal -> GET /dues -> POST /checkout -> frees bed
5. Delete: confirm modal -> DELETE /tenants/:id -> cascades properly

### 4.2 Invoice-Payment Cycle

1. Generate: POST /invoices -> creates invoice for tenant+month
2. Record: `/payments/new` -> POST /payments/offline -> updates invoice status
3. Verify: `/payments/:id` -> POST /payments/:id/verify -> admin approves

### 4.3 Electricity Distribution

1. Create: POST /electricity -> draft bill with room readings
2. Finalize: POST /electricity/:id/finalize -> locks readings
3. Distribute: POST /electricity/:id/distribute -> adds electricityAmount to each tenant's invoice

### 4.4 Complaint Resolution

1. Create: POST /complaints -> status=open
2. Table view: status filter
3. Kanban drag: onDragEnd -> PUT /complaints/:id/status -> optimistic update
4. Resolve: PUT /complaints/:id/status { status: 'resolved' }

### 4.5 Room SharingType Change (BUG-PRONE)

1. Load `/rooms/:id/edit`
2. Change sharingType from 3 to 4
3. PUT /rooms/:id -> backend must rebuild beds array
4. Verify: room.beds.length === 4, existing occupants preserved

### 4.6 Output Format

```
| Lifecycle | Step | Status | Error Details |
|-----------|------|--------|---------------|
| Tenant Checkout | GET /dues | PASS | - |
| Tenant Checkout | POST /checkout | PASS | - |
| Room Sharing Change | 3->4 sharing | FAIL | beds.length validation error (FIXED 2026-07-10) |
```

---

## PHASE 5: Sub-Agent Orchestration

Group discovered issues by domain and parallelizability. Spawn sub-agents for independent work.

### 5.1 Grouping Rules

- Files in the same domain (e.g., all tenant pages) go to one agent
- Files in different domains with no dependencies go to separate agents (parallel)
- Backend route + its frontend pages go together (one agent owns the full vertical)
- Cross-cutting concerns (design tokens, shared components) go to a dedicated agent

### 5.2 Agent Instruction Template

```
You are fixing [DOMAIN] in the tenet_management codebase.

READ THESE FILES FIRST:
- apps/api/src/models/[model].ts       (understand the schema)
- apps/api/src/routes/[route].ts       (understand the API)
- apps/web/src/app/(admin)/[module]/page.tsx (understand the UI)

EXISTING PATTERNS TO FOLLOW:
- Import TableActions from '@/components/ui/TableActions' for action buttons
- Import PageHeader from '@/components/ui/PageHeader' for page headers
- Use CSS variables: text-[color:var(--color-text-primary)], bg-[color:var(--color-card-bg)]
- Form pages use: FormPage > FormCard > FormSection > FormGrid

FIXES TO APPLY:
[List specific fixes with exact file paths and SEARCH/REPLACE blocks]

VALIDATION:
After applying fixes, run:
- cd /home/odoo/Development/tenet_management && bun run --cwd apps/web typecheck
- cd /home/odoo/Development/tenet_management && bun run --cwd apps/web lint
Report any errors immediately.
```

### 5.3 Max Parallel Agents

- Up to 5 agents for independent domains
- Sequential for dependent domains (backend fix must complete before frontend agent starts)

---

## PHASE 6: Documentation Regeneration

After all fixes are applied and verified:

1. Update `docs/specs/11-gap-analysis.md` to reflect closed gaps
2. Update any spec file that changed due to fixes
3. Update `docs/specs/README.md` last-updated timestamp
4. Mark all P0 issues as resolved, reassess P1/P2

---

## OUTPUT CONTRACT

Every audit execution must produce:

1. **Phase 0 Report**: Entity count, endpoint count, page count, build status (errors/warnings)
2. **Phase 1-2 Matrix**: Integration completeness table for all 23 modules
3. **Phase 3 Report**: Design token violations, component quality issues
4. **Phase 4 Report**: Critical lifecycle trace results
5. **Phase 5 Plan**: Sub-agent grouping with exact file lists
6. **Phase 6 Summary**: Closed gaps, remaining gaps, updated priority

---

## STATE PERSISTENCE

Between agent executions, the only source of truth is the codebase itself. Never trust:

- Previous agent reports (they may be stale)
- Documentation files (they may not have been updated)
- Memory of previous runs

Always start from Phase 0 and rediscover the current state.
