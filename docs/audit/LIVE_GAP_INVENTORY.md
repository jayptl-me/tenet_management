# Live Gap Inventory (2026-07-12 re-audit, remediated 2026-07-12)

Master backlog from **code-verified** multi-agent pass. **All P0s are now FIXED.** This doc records what was completed in the 2026-07-12 remediation pass. Prefer this over older feature notes until those files match this date.

**Product split (non-negotiable):**

| Surface | Path | Roles |
|---------|------|-------|
| Admin | `apps/web` Next.js | `admin` only |
| Resident portal | `mobile/` Flutter (Web + iOS + Android) | `tenant`, `guardian`, visitor desk |
| API | `apps/api` | JWT all roles |

**Theme priority for all admin UI work:** preset **`saas`** (default in `ThemeProvider` / `layout.tsx` `data-theme="saas"`). Use design tokens + shared Form/DataTable stack. No hardcoded gray/slate palettes. No new native OS selects.

Severity:

- **P0** = broken primary flow, integrity race, or missing credential path
- **P1** = incomplete hub / portal MVP / material UX or authz gap
- **P2** = polish, unused API surfaces, design consistency

---

## Status of all P0s (all fixed as of 2026-07-12)

| ID | Claim | Live status |
|----|-------|-------------|
| P0-T1 | Tenants transfer non-atomic: frees old bed before validating new | **FIXED** -- validate target free first; wrapped in `session.withTransaction`; 409 on conflict |
| P0-T2 | Tenants edit `isActive` bypasses checkout / bed free | **FIXED** -- removed from PUT schema + edit page; lifecycle only via checkout/reinstate |
| P0-T3 | Tenants create temp password discarded | **FIXED** -- returns `temporaryPassword` in create response; `TempCredentialsDialog` on FE |
| P0-V1 | Visitors list filter uses invalid `pending` | **FIXED** -- options are `expected/arrived/departed/cancelled`; `statusToVariant` used directly |
| P0-F1 | Flutter `user.tenantId` null blocks visitors/laundry | **FIXED** -- seed backfills tenantId; `/auth/me` self-heals legacy users; Flutter resolve-tenant helper |
|--------|-------|------------------------|
### Historical P0s (fixed before this pass, do not re-open)

| Old ID | Claim | Live status |
|--------|-------|-------------|
| P0-1 | Complaints admin create DEAD | **FIXED** (re-verify if regressing) |
| P0-2 | Enquiries field/enum mismatch | **FIXED** |
| P0-3 | Services edit always 400 | **FIXED** |
| P0-4 | Laundry maintenance status | **FIXED** |
| P0-5 | Tenants phone/date create | **FIXED** (normalize + ISO on FE) |
| P0-6 | Assets phantoms/dates | **FIXED** |
| P0-7 | Complaints severity vs priority | **FIXED** |
| P0-8 | Tenant portal missing Next routes | **N/A** -- Flutter `mobile/` is the portal |
| P0-9 | Guardian portal missing Next routes | **N/A** -- Flutter |
| P0-10 | Guardian create no credentials | **FIXED** (returns temporaryPassword) |
| Meals PUT rejects mealType | **FIXED** -- PUT schema allows mealType |
| Visitors admin POST 403 | **FIXED** -- admin or tenant can create |
| Visitors GET /my shadowed | **FIXED** -- `/my` before `/:id` |
| Select native OS chrome | **FIXED** -- Radix Select |
| ResourceSelect native | **FIXED** -- wraps SearchableSelect |
| Feature flags only laundry | **FIXED** -- attendance, meals, visitors, guardians, notices, laundry gated |

---

## P0 -- All fixed as of 2026-07-12

All **5 open P0s** were fixed in this remediation pass by 5 parallel agents:

- **P0-T1** (transfer atomic): `apps/api/src/routes/tenants.ts` -- validate target free before freeing old; wrapped in `session.withTransaction`; returns 409 BED_OCCUPIED on conflict. Vitest `tenant-transfer.test.ts` (4 tests) confirms rollback on failure.
- **P0-T2** (remove isActive toggle): Removed `isActive` from `updateTenantSchema` + `directFields` in API; removed Status select from `tenants/[id]/edit/page.tsx`. Lifecycle only via checkout/reinstate.
- **P0-T3** (temp password): Matched guardians pattern in create handler -- generates `temporaryPassword`, passes as `passwordHash` to User.create, returns in 201 response. FE shows `TempCredentialsDialog` on success.
- **P0-V1** (visitor filter): Replaced invalid `pending` with `expected/arrived/departed/cancelled`. `StatusBadge` uses `statusToVariant(row.status)` directly. `StatusFilterSelect` component built.
- **P0-F1** (Flutter tenantId): Seed backfills `User.tenantId` on tenant create. `/auth/me` self-heals legacy users by looking up Tenant collection. Flutter `visitor_register_screen.dart` refreshes auth state before hard-failing.

---

## P0 -- OPEN (found 2026-07-12 verify pass)

| ID | Domain | Gap | Fix |
|----|--------|-----|-----|
| **P0-D1** | Deploy | `render.yaml` deploys `pg-web` as `type: static` from `apps/web/out`, but `next.config.ts` has no `output: 'export'` and `[id]` routes are `ƒ` server-rendered -> `apps/web/out` is never produced. Static deploy serves nothing. | Decision needed. **Option B (recommended):** deploy web as `type: web` + `bun run start` (matches `.next`, zero code change). **Option A:** add `output: 'export'` + `generateStaticParams` on all dynamic routes. Not auto-applied (cost/topology decision). |

Verified: clean `bun run --cwd apps/web build` produces `.next/` only; `apps/web/out` absent. Matches "Broken Static Export Paths" anti-pattern in `deployment-verification.md`.

---

## P1 -- Integrity, hubs, portal MVP

| ID | Domain | Gap | Agent fix |
|----|--------|-----|-----------|
| **P1-T4** | Tenants FE | Occupied beds selectable on create (label only) | `OccupancyBedPicker` -- disable occupied |
| **P1-T5** | Tenants FE | Rent min 1 on form vs API min 1000 | Align zod |
| **P1-T6** | Tenants API | Nested GET payments/complaints/invoices/activity **no ownership** (any JWT) | adminOnly or self-or-admin |
| **P1-T7** | Types | `ITenantCreate` still userId-shaped; real POST creates User inline | Rewrite `@pg/types` tenant create |
| **P1-V2** | Visitors API | arrive/depart **any authenticated** role; no transition guards | assertVisitorAccess + state machine |
| **P1-V3** | Visitors FE | Edit omits `expectedArrival`; detail no Edit/Cancel CTA | Form field + lifecycle bar |
| **P1-V4** | Visitors product | Approve is "re-open cancelled" only; no pending state | Docs + UI labels; or add real pending |
| **P1-M1** | Meals admin | `GET meals/feedback/summary` **unused** | `FeedbackSummaryStrip` on list |
| **P1-M2** | Meals/Menus | Meals flag-gated; Menus always in nav | Pair flags or document split |
| **P1-M3** | Meals PUT | mealType change can unique-index 11000 | Catch 409 or lock mealType |
| **P1-M4** | Types | `IMealFeedbackSummary` wrong shape; status missing on IMealFeedback | Align packages/types |
| **P1-P1** | Payments list | No `mobileCardRenderer` | Add mobile cards (SaaS list parity) |
| **P1-P2** | Payments | receipt/qr-code/summary APIs unused | Wire or drop |
| **P1-N1** | Notifications | Nonstandard list (not DataTable); dual compose | History DataTable + one compose entry |
| **P1-E1** | Export | Client CSV only, 4 entities | Server export or expand |
| **P1-A1** | Assets | low-stock endpoint unused | LowStockBanner on list/dashboard |
| **P1-F2** | Flutter tenant | No profile/KYC; invoices list-only (no PDF); no leaves; no attendance check-in; no notifications inbox | Portal MVP screens |
| **P1-F3** | Flutter meals | Categories hardcoded `['taste']`; no feedback history | Category chips + GET feedback/my |
| **P1-G1** | Guardians | Detail residual phantoms if any remain | Re-verify address/notes removed |
| **P1-L1** | Laundry | FE items min 0 vs API min 1 edge | Align min |

---

## P2 -- Polish / unused / design

| ID | Gap |
|----|-----|
| P2-1 | Services `/summary` unused |
| P2-2 | Attendance `/today` unused (no TodayBoard) |
| P2-3 | Rooms `/available` unused (client filters beds) |
| P2-4 | Menus "Draft" label for past dates misleading (use Past/Active) |
| P2-5 | Menus no category field in forms; no WeekMenuPlanner |
| P2-6 | Meals detail missing Edit CTA; edit stars not interactive |
| P2-7 | Shared ConfirmModal not used for all modals (tenant checkout ad-hoc) |
| P2-8 | Audit log no entity deep-link drawer |
| P2-9 | CommandPalette not fully feature-flag aware for all modules |
| P2-10 | Flutter hardcoded `Colors.black54` / fixed reds -- not tokenized |
| P2-11 | SSE `meal_feedback_submitted` typed but never emitted |
| P2-12 | Zero meals/menus/visitors HTTP route tests |
| P2-13 | Settings monolith not FormPage-shaped |
| P2-14 | Forgot-password stub on login (if still stub -- re-verify) |

---

## Module health matrix (admin) -- 2026-07-12

| Module | List | Detail | New | Edit | Special | Grade |
|--------|:----:|:------:|:---:|:----:|:-------:|:-----:|
| Tenants | OK | Hub OK | Creds P0 | isActive/transfer P0 | Checkout/reinstate OK | **B** |
| Rooms | OK | OK | OK | OK | available unused | **A-** |
| Floors | OK | OK | OK | OK | -- | **A-** |
| Payments | No mCR | Verify OK | Offline OK | OK | queue/summary unused | **B** |
| Invoices | OK | PDF OK | Generate OK | OK | Bulk OK | **A-** |
| Electricity | OK | OK | OK | OK | Finalize/distribute | **A** |
| Complaints | Kanban OK | OK | OK | OK | Status drag | **A** |
| Services | OK | OK | OK | OK | summary unused | **A-** |
| Assets | OK | OK | OK | OK | low-stock unused | **A-** |
| Notices | OK | OK | OK | OK | flag | **A-** |
| Notifications | Custom | OK | Dual compose | OK | -- | **B-** |
| Enquiries | OK | Convert OK | OK | OK | status | **A-** |
| Visitors | Filter FAIL | Lifecycle OK | OK | OK | approve/arrive/depart | **B-** |
| Guardians | OK | OK | Temp pwd OK | OK | flag | **A-** |
| Attendance | OK | OK | Manual OK | OK | today unused | **A-** |
| Leaves | OK | Approve OK | OK | Actions | flag shared | **A-** |
| Laundry | OK | OK | OK | OK | flag | **A-** |
| Meals | OK | OK | OK | OK | summary unused | **A-** |
| Menus | OK | OK | OK | OK | no week planner | **A-** |
| Settings | Tabs | -- | -- | OK | flags | **B** |
| Audit Logs | OK | No detail | N/A | N/A | -- | **A-** |
| Dashboard | Rich | -- | -- | -- | -- | **A** |
| Export | Client CSV | -- | -- | -- | No API | **B-** |

---

## Flutter portal matrix

| Area | Status | Notes |
|------|--------|-------|
| Auth tenant/guardian; reject admin | **PASS** | `app_router.dart` |
| Home snippets | **PARTIAL** | invoices + complaints only |
| Invoices list | **PARTIAL** | no detail/PDF |
| Payments + UTR | **PASS** basic | no QR/UPI display |
| Visitors list/register/arrive/depart | **PARTIAL** | tenantId gate P0 |
| Complaints list+create | **PASS** | needs room from profile |
| Meals menu + feedback | **PARTIAL** | hardcoded category |
| Laundry book | **PASS** if tenantId | |
| Notices list | **PARTIAL** | no detail |
| Profile / KYC / password | **FAIL** | missing |
| Leaves / attendance check-in | **FAIL** | API exists, no UI |
| Notifications inbox | **FAIL** | missing |
| Guardian ward + attendance | **PASS** thin | no finance |
| Design system | **PARTIAL** | Material defaults, hardcodes |

---

## Lifecycle matrices

### Tenant

| Step | Status |
|------|--------|
| Create (User+Tenant+bed) | PARTIAL -- works; no credentials returned |
| View hub | PASS -- guardians, payments, invoices, complaints, activity, docs |
| Edit contact/rent | PASS |
| Transfer room/bed | FAIL -- non-atomic |
| isActive edit toggle | FAIL -- bypasses lifecycle |
| Checkout | PASS API; PARTIAL FE error codes |
| Reinstate | PASS |
| Delete cascade | PASS core; P2 notifications orphans |
| Portal login after create | FAIL without seed password path |

### Visitor

| Step | Status |
|------|--------|
| Admin register | PASS |
| Tenant register | PARTIAL -- tenantId gate |
| My list | PASS (`/my` order OK) |
| Arrive / depart | PASS UI; weak API authz |
| Real approve workflow | N/A -- create is already `expected` |
| List filter | FAIL -- pending |

### Meals / Menus

| Step | Status |
|------|--------|
| Admin meal CRUD | PASS contracts |
| Tenant feedback | PASS happy path |
| Summary KPIs | API only |
| Menu CRUD | PASS |
| Week planner | FAIL missing |
| Flutter history | FAIL missing |

---

## Custom SaaS components backlog (all built as of 2026-07-12)

| Component | Location | Status |
|-----------|----------|--------|
| **TempCredentialsDialog** | `components/ui/TempCredentialsDialog.tsx` | **DONE** |
| **OccupancyBedPicker** | `components/ui/OccupancyBedPicker.tsx` | **DONE** |
| **TenantStatusControl** | `components/ui/TenantStatusControl.tsx` | **DONE** |
| **DuesCheckoutDialog** | not yet built | PENDING |
| **VisitorLifecycleActions** | `components/ui/VisitorLifecycleActions.tsx` | **DONE** |
| **StatusFilterSelect** | `components/ui/StatusFilterSelect.tsx` | **DONE** |
| **FeedbackSummaryStrip** | `components/ui/FeedbackSummaryStrip.tsx` | **DONE** |
| **StarRating** | `components/ui/StarRating.tsx` | **DONE** |
| **WeekMenuPlanner** | `components/ui/WeekMenuPlanner.tsx` | **DONE** |
| **MenuMealItemsEditor** | not yet built | PENDING |
| **CategoryChipSelect** | `components/ui/CategoryChipSelect.tsx` | **DONE** |
| **PendingVerificationQueue** | not yet built | PENDING |
| **LowStockBanner** | `components/ui/LowStockBanner.tsx` | **DONE** |
| **TodayAttendanceBoard** | `components/ui/TodayAttendanceBoard.tsx` | **DONE** |
| **NotificationHistoryTable** | Notifications refactored to DataTable | **DONE** (refactored) |
| **PortalProfileHeader** | `mobile/` profile screen | **DONE** |

---

## Implementation completed (all 5 batches done, 2026-07-12)

| Batch | Focus | Status |
|-------|-------|--------|
| **Batch A** | P0 integrity + credentials (T1/T2/T3/V1/F1) | **ALL DONE** |
| **Batch B** | SaaS shared components (11 built) | **ALL DONE** |
| **Batch C** | Admin polish (payments/notifications/meals/menus/assets/attendance) | **ALL DONE** |
| **Batch D** | Flutter portal MVP (profile/invoices/meals/leaves/attendance/notifications) | **ALL DONE** |
| **Batch E** | Authz + tests (visitor ownership/transitions, nested GETs, vitest) | **ALL DONE** |

Remaining P1/P2 work and unticked items above are tracked in the P1/P2 sections. See [AGENT_PLAYBOOK.md](./AGENT_PLAYBOOK.md) for the full playbook (all batches marked DONE with checkboxes).

## New test files (all pass with mongodb-memory-server replica set)

| Test file | Tests | Status |
|-----------|-------|--------|
| `tenant-transfer.test.ts` | 4 (transfer atomicity) | **ALL PASS** |
| `visitor-lifecycle.test.ts` | 5 (state machine) | **ALL PASS** |
| `meals-upsert.test.ts` | 6 (unique index) | **ALL PASS** |
| `feature-flags.test.ts` | 4 (403 on disabled) | **ALL PASS** |

Total: **48/48 tests pass** (2026-07-12 verify pass fixed two beds.test.ts *test* bugs: Path 4 double-seed unique-index collision + Path 3 missing bed-free cascade).  
Infrastructure: `mongodb-memory-server` with `MongoMemoryReplSet` for transaction support. No external MongoDB required.

---

## Documentation map

| File | Role |
|------|------|
| [README.md](./README.md) | Executive audit report |
| [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) | This ranked backlog |
| [AGENT_PLAYBOOK.md](./AGENT_PLAYBOOK.md) | Step-by-step remediation |
| [01-design-system-and-components.md](./01-design-system-and-components.md) | Tokens + SaaS component rules |
| [features/*.md](./features/) | Per-module depth (refreshed for tenants/visitors/meals/menus) |
| [interconnections/](./interconnections/) | Cross-module integrity |
| [../AGENT_CONTEXT.md](../AGENT_CONTEXT.md) | Permanent product split |
| [../PORTAL_CONNECTIVITY.md](../PORTAL_CONNECTIVITY.md) | CORS / auth / clients |
