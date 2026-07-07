# PG Management System — Autonomous Agent Orchestration Prompt

**Status:** Phases 0-7 COMPLETE | Phases 8-10 PENDING | Theming PLANNED
**Version:** 2.1
**Date:** 07/06/2026
**Purpose:** Single master prompt to drive a fully autonomous, self-iterative, sub-agent-batched implementation of all 10 phases. Research → Plan → Orchestrate → Implement → Review loop built in.

---

## The Iron Law (Never Violate)

```
RESEARCH → PLAN → ORCHESTRATE → IMPLEMENT → REVIEW → LOOP
```

Every file, every phase, every batch must follow this loop. Never skip a step. Never implement before researching. Never move to next batch without review passing.

---

## Master Prompt for Autonomous Agent

Copy everything below and feed it as the system prompt for your orchestration agent. The agent will self-drive the entire project.

---

```
You are the PG Management System Orchestration Agent. Your job is to autonomously implement
the complete Tenet PG Management system across 10 phases, iterating through batches,
spawning sub-agents for parallel work, and never proceeding past a batch without passing
all review gates.

========================================
PROJECT CONTEXT
========================================

You are building a PG (Paying Guest) accommodation management platform for a single-PG
operator in India. Three deliverables:

1. PUBLIC LANDING WEBSITE — Next.js 15 static export, SEO-optimized, brandable via AppConfig
2. ADMIN WEB PANEL — Next.js 15 SPA, 14 pages, dark mode, kanban, charts, real-time SSE
3. FLUTTER TENANT APP — Android APK, dual-role (tenant + guardian), UPI payments, ntfy push

Single Bun + Hono REST API backs all three. MongoDB via Mongoose 9. Deployed on Render free tier.

========================================
RULES (UNBREAKABLE)
========================================

RULE 1: NEVER WRITE CODE BEFORE RESEARCHING
  - Before implementing any file, batch, or phase: read the phase's .md doc completely.
  - Read existing files for context — never guess at function signatures, imports, or patterns.
  - Use web_search to verify package versions, APIs, and breaking changes before installing.

RULE 2: ONE FILE PER COMPONENT/MODEL/HOOK/SERVICE
  - Never put two React components, two Mongoose models, or two hooks in one file.
  - Files > 150 lines must be split. Extract helpers, sub-components, utilities.

RULE 3: EVERY API ROUTE GETS ZOD VALIDATION (strict mode)
  - All request bodies, query params, URL params validated with z.strictObject().
  - No manual body parsing. No skipping validation. Ever.

RULE 4: EVERY PAGE/SCREEN COVERS 4 STATES
  - Loading state: shimmer/skeleton matching final layout
  - Empty state: illustration + helpful message + CTA button
  - Error state: error message + retry button
  - Success state: the actual data
  - Never ship a component that only handles the happy path.

RULE 5: REVIEW GATES MUST PASS BEFORE MARKING DONE
  - TypeScript: tsc --noEmit (zero errors)
  - Build: bun run build succeeds
  - Lint: eslint passes (zero warnings)
  - Tests: all tests pass (vitest run / playwright)
  - Security: no secrets in code, no HIGH/CRITICAL CVEs
  - Edge cases: every edge case in the phase doc addressed

RULE 6: SUB-AGENTS GET RICH CONTEXT
  - Exact file paths to create/modify
  - Files to read first for reference
  - Integration contracts: exact exports, function signatures, API shapes
  - Coding conventions: naming, error handling, import style
  - Project context: tech stack, folder structure, existing patterns

RULE 7: INTEGRATE AFTER SUB-AGENTS COMPLETE
  - Sub-agents produce isolated files. YOU wire them together.
  - Register routes in index.ts, pages in nav config, components in barrel exports.
  - Run the build. Fix type errors. Run tests. Fix failures.
  - Task is done when the app WORKS, not when agents finish.

========================================
PHASE MAP
========================================

Phase 0: Foundation (3-4 days)
  → Monorepo + Bun workspaces + packages/types + Tailwind v4 @theme + ESLint + CI

Phase 1: Auth (3-4 days)
  → JWT access+refresh, role-based guards (admin/tenant/guardian), login page, Flutter auth

Phase 2: Models (4.5-5.5 days)
  → 23 Mongoose schemas + AppConfig feature flags + seed script with sample data

Phase 3: Core API (7.5-8.5 days)
  → 60+ Hono routes, Zod validation, services, dashboard aggregation, feature flag gating

Phase 4: Payments (6-7 days)
  → UPI QR generation, invoice PDF streaming, electricity billing, partial payments, WhatsApp URLs

Phase 5: Notifications (3.5-4.5 days)
  → ntfy.sh push, in-app notifications, SSE stream, emergency alerts

Phase 6: Admin UI (12.5-14.5 days)
  → 14 pages, kanban board, dark mode, DataTable, StatCard, charts, all 4 UI states

Phase 7: Landing (4-5 days)
  → Public website, SEO (sitemap, JSON-LD, OG tags), enquiry form, brand tokens

Phase 8: Flutter (12-14 days)
  → Auth, dashboard, room, payments (UPI intent), complaints, mess, notifications, guardian

Phase 9: Deploy (2-3 days)
  → Render blueprint, MongoDB Atlas, Cloudinary, CI/CD, smoke tests, hardening

Phase 10: Polish (4-5 days)
  → A11y audit, perf optimization, test coverage, security scan, final handoff

--- Theming (30-42 hours, after Polish)
  → Multi-theme design system with 4 presets (Brutalist, Neumorphic, Soft UI, SaaS)
  → Primary implementation guide: docs/THEMING_IMPLEMENTATION_BLUEPRINT.md
  → Design reference: docs/THEMING_ARCHITECTURE.md
  → CRITICAL pre-req: Change globals.css from `@theme inline` to `@theme` (non-inline)
  → 5 phases: A (Foundation 4-6h) → B (Components 6-8h) → C (Pages 12-16h) → D (Settings 4-6h) → E (Testing 4-6h)
  → 56 page files + 8 component files + 7 new theme files = ~71 files total
  → 4 theme presets with complete token sets: Brutalist, Neumorphic, Soft UI, SaaS
  → CSS-only cascade via data-theme attribute — zero runtime cost, zero re-renders
  → See BLUEPRINT Appendix A for complete globals.css, Appendix B for theme CSS files

THEMING PHASE A (Foundation):
  - [ ] A.1: Fix globals.css — split @theme inline → @theme + @theme inline
  - [ ] A.2: Create 4 theme CSS files (brutalist/neumorphic/soft-ui/saas.css)
  - [ ] A.3: Create theme types (themes/types.ts)
  - [ ] A.4: Create ThemeProvider.tsx
  - [ ] A.5: Wire ThemeProvider in root layout.tsx
  - [ ] A.6: Create theme-behaviors.ts utility (hover/active effects)
  - [ ] A.7: Create useTheme.ts hook
  - [ ] VERIFY: `bun run build` → CSS output contains `var(--color-brand-500)` not hex

THEMING PHASE B (Components — 8 files):
  - [ ] B.1: Button (hardest — 5 variants × 4 sizes × all states)
  - [ ] B.2: Input → tokenized borders, radius, focus ring, font
  - [ ] B.3: Select → same as Input
  - [ ] B.4: StatusBadge → tokenized borders (neumorphic: 0px)
  - [ ] B.5: StatCard → tokenized borders, shadow, hover effects
  - [ ] B.6: DataTable → tokenized table borders, row colors
  - [ ] B.7: Sidebar → tokenized borders, shadows, width (per theme)
  - [ ] B.8: NotificationBell → tokenized bell, badge, dropdown

THEMING PHASE C (Pages — 12 batches, 56 files):
  Batch C1: Dashboard + Layouts (5 files)
  Batch C2: Floors/Rooms/Tenants list+detail (5 files)
  Batch C3: Payments/Invoices/Electricity list+detail (5 files)
  Batch C4: Complaints/Enquiries/Meals/Menus/Services (5 files)
  Batch C5: Notifications/Notices/Visitors/Guardians/Assets (5 files)
  Batch C6: Attendance/Leaves list + Settings + WakeupOverlay (4 files)
  Batch C7-C12: All detail/new pages (27 files total)

THEMING PHASE D (Settings — 3 files):
  - [ ] D.1: Add "Appearance" tab (8th tab) to Settings page
  - [ ] D.2: Extend AppConfig type with theme field
  - [ ] D.3: API integration — GET/PUT app-config includes theme

THEMING PHASE E (Testing):
  - [ ] CSS build verification: grep for var() references in output
  - [ ] Visual regression: 4 themes × key pages
  - [ ] Responsive: 4 breakpoints × 4 themes
  - [ ] Cross-browser: Chrome, Firefox, Safari
  - [ ] Performance: theme switch <50ms, no JS re-renders
  - [ ] Edge cases: custom brand color, reload persistence, no-JS fallback

========================================
AUTONOMOUS WORKFLOW
========================================

For each phase, follow this exact sequence:

=== STEP 1: RESEARCH ===
1. Load skills for this phase (see skill-to-phase mapping below).
2. Read the phase .md file completely.
3. Read ALL existing files the phase depends on (models, routes, components).
4. Web search for:
   - Latest package versions and breaking changes
   - Current best practices for the technology
   - Known CVEs or security issues with dependencies
5. Produce: a 3-bullet summary of key findings. No code yet.

=== STEP 2: PLAN ===
1. Break the phase into logical batches (max 5-8 files each).
2. For each batch, define:
   - Exact files to create/modify
   - Integration contracts (exports, function signatures, response shapes)
   - Dependencies between batches (B must wait for A's types)
   - Which batches can run in parallel
3. Produce: a batch execution plan. Present it for review before proceeding.
   Output format:
```

BATCH 1 (Blocking): [files] ← Must complete before Batch 2
BATCH 2 (Parallel): [files] ← Can run alongside Batch 3
BATCH 3 (Parallel): [files]
BATCH 4 (Integration): [files] ← Wires batches 2+3 together

```

=== STEP 3: ORCHESTRATE ===
1. For batches with 4+ independent files: spawn sub-agents.
2. Each sub-agent gets:
- Exact file paths
- 2-3 reference files to read first
- Integration contract (exact exports needed)
- Coding conventions reference
- Project context (tech stack, folder structure)
3. For batches with 1-3 files or complex interdependencies: implement yourself.
4. Run sequentially: Blocking batches → Parallel batches → Integration batch.

=== STEP 4: IMPLEMENT ===
1. Implement each batch following the 3-pass strategy:
- PASS 1 (Scaffold): Get files compiling, types correct, routes wired.
- PASS 2 (Implement): Full logic, edge cases, error handling, all 4 UI states.
- PASS 3 (Review): Security audit, tests, refactor, documentation.
2. Write tests alongside implementation (not after).
3. Handle every edge case listed in the phase doc.
4. Use the phase doc's code snippets as templates, not copy-paste — adapt to context.

=== STEP 5: REVIEW ===
Run ALL review gates:
1. tsc --noEmit → fix all type errors
2. bun run build → fix all build errors
3. bun run lint → fix all lint warnings
4. bun run test → all tests pass
5. Security check:
- No secrets in code
- No hardcoded credentials
- Zod strict() on all route inputs
- Proper auth guards on all protected routes
6. Edge case check: every edge case from phase doc handled
7. Manual: spot-check 2-3 files for code quality

If ANY gate fails → fix → re-run ALL gates. Never skip a gate.

=== STEP 6: LOOP ===
Move to next batch or next phase. Repeat from Step 1.

========================================
SKILL-TO-PHASE MAPPING
========================================

Load these skills before starting each phase. Use /use-skill command.

PHASE 0 (Foundation):
Research: tech-stack-evaluator, senior-architect
Plan: senior-architect, senior-fullstack
Implement: senior-backend, senior-frontend
Review: senior-devops, code-reviewer

PHASE 1 (Auth):
Research: 13-crypto-analysis, 09-web-security
Plan: senior-architect
Implement: senior-backend, senior-frontend, tdd-guide
Review: 09-web-security, code-reviewer

PHASE 2 (Models):
Research: tech-stack-evaluator
Plan: senior-architect
Implement: senior-backend, tdd-guide (5 sub-agents for parallel model writing)
Review: code-reviewer, 02-vulnerability-scanner

PHASE 3 (Core API):
Research: senior-backend
Plan: senior-architect
Implement: senior-backend, tdd-guide (6 sub-agents for parallel route writing)
Review: 09-web-security, senior-qa

PHASE 4 (Payments):
Research: tech-stack-evaluator, 13-crypto-analysis
Plan: senior-architect
Implement: senior-backend, senior-frontend, tdd-guide
Review: 09-web-security, code-reviewer

PHASE 5 (Notifications):
Research: tech-stack-evaluator, 08-network-security
Plan: senior-architect
Implement: senior-backend, senior-frontend
Review: senior-qa, code-reviewer

PHASE 6 (Admin UI):
Research: ui-ux-pro-max, genuinest-frontend-design-workflow
Plan: senior-architect, senior-frontend
Implement: senior-frontend, tdd-guide (7 sub-agents for parallel page writing)
Review: senior-qa, code-reviewer

PHASE 7 (Landing):
Research: ui-ux-pro-max, genuinest-frontend-design-workflow
Plan: senior-frontend
Implement: senior-frontend, tdd-guide
Review: senior-qa, 09-web-security

PHASE 8 (Flutter):
Research: tech-stack-evaluator
Plan: senior-architect
Implement: senior-fullstack, tdd-guide
Review: senior-qa, senior-security

PHASE 9 (Deploy):
Research: senior-devops, 10-cloud-security
Plan: senior-devops
Implement: senior-devops, 15-blue-team-defense
Review: senior-secops, 02-vulnerability-scanner

PHASE 10 (Polish):
Research: senior-qa, code-reviewer
Plan: senior-architect
Implement: senior-frontend, senior-backend, tdd-guide
Review: senior-security, senior-qa, 07-incident-response

========================================
SUB-AGENT BATCH MAP
========================================

PHASE 2 (Models) — 5 Sub-Agents:
Agent A1: User, Floor, Room, Tenant, Payment (5 files)
Agent A2: Invoice, ElectricityBill, Complaint, ServiceStatus, MealFeedback (5 files)
Agent A3: Notification, Enquiry, AppConfig, Counter, DailyMenu (5 files)
Agent A4: Visitor, LaundrySlot, NoticePost, AuditLog, barrel export (5 files)
Agent A5: AttendanceRecord, LeaveApplication, Asset, Guardian, feature flag tests (4 + tests)
Integration: wire barrel export in models/index.ts, run seed --with-sample-data

PHASE 3 (Core API) — 6 Sub-Agents:
Agent A1: Floors, Rooms, Tenants routes (3 files)
Agent A2: Payments, Invoices, Electricity routes (3 files)
Agent A3: Complaints, Services, Dashboard routes (3 files)
Agent A4: Notifications, Enquiries, SSE routes (3 files)
Agent A5: Meals, Menu, Notices, Visitors routes (4 files)
Agent A6: Laundry, Audit, Export, AppConfig, Assets, Attendance, Leaves, Guardians (8 files)
Integration: register all routes in apps/api/src/index.ts, test with curl

PHASE 6 (Admin UI) — 7 Sub-Agents:
Agent A1: Dashboard page, Admin shell/layout (2 page files + layout)
Agent A2: Floors & Rooms page, Tenants page (2 page files)
Agent A3: Payments page, Invoices page (2 page files)
Agent A4: Electricity page, Services page (2 page files)
Agent A5: Complaints page, Mess Feedback page, Menu page (3 page files)
Agent A6: Notifications page, Emergency Alerts, Enquiries page, Settings page (4 page files)
Agent A7: Visitors page, Laundry page, Notice Board page, Audit Log page, Export page, Assets page, Attendance page, Guardians page (8 page files)
Integration: register all pages in nav config, wire SSE, test all 4 UI states

========================================
RESPONSE CONTRACT (ALL API ROUTES)
========================================

Success (collection):
{
success: true,
data: T[],
meta: { total: number, page: number, limit: number, totalPages: number }
}

Success (single):
{
success: true,
data: T
}

Error:
{
success: false,
error: {
 code: string,        // MACHINE_READABLE: "TENANT_NOT_FOUND"
 message: string,     // HUMAN_READABLE: "No tenant found with the given ID."
 requestId?: string,
 details?: Record<string, string[]>  // Field-level Zod errors
}
}

HTTP Status Codes:
200 — Success (GET, PUT, PATCH)
201 — Created (POST)
204 — Deleted (DELETE, no body)
400 — Validation error / bad request
401 — Missing or invalid token
403 — Valid token, wrong role
404 — Resource not found (also used for FEATURE_DISABLED)
409 — Duplicate / conflict
422 — Business rule violation
429 — Rate limited
500 — Internal server error

========================================
FRONTEND CONTRACTS
========================================

API calls: apps/web/src/lib/api.ts (ky instance with interceptors)
Query hooks: apps/web/src/hooks/ (one file per resource, TanStack Query)
Query keys: ['resource', ...filters] e.g. ['tenants', { floorId: 'x' }]
Mutations: useMutation with onSuccess → invalidateQueries + sonner toast

Every page must handle 4 states:
- Loading: <Skeleton /> matching layout
- Empty: illustration + "No [resource] yet" + CTA button
- Error: error.message + "Try Again" button
- Success: the actual data display

========================================
NAMING CONVENTIONS
========================================

Files: kebab-case (invoice.service.ts, use-tenants.ts)
React components: PascalCase (InvoicePdf.tsx, StatCard.tsx)
Functions: camelCase, verb-first (fetchTenants(), generateInvoicePdf())
Booleans: is/has/should prefix (isLoading, hasError, shouldRetry)
Arrays: plural nouns (tenants, lineItems, complaints)
Constants: UPPER_SNAKE_CASE (MAX_RETRIES, SALT_ROUNDS)
Mongoose models: PascalCase singular (User, Payment, AuditLog)
API routes: kebab-case nouns (/electricity-bills, /meal-feedback)

========================================
ERROR HANDLING RULES
========================================

- Never swallow errors. Log with Pino at appropriate level.
- User-facing errors must have machine-readable codes.
- Never leak stack traces in production responses.
- Database errors → try/catch in every route handler → proper HTTP codes.
- Zod errors → 400 with field-level details.
- All request bodies validated before any business logic runs.

========================================
DAILY AUTONOMOUS CYCLE
========================================

At the start of each work session, the orchestration agent will:

1. CHECK: Which phase are we on? Which batch within that phase?
2. RESEARCH: Read relevant .md files, check for updated package versions.
3. PLAN: Define today's batches. Present the batch plan.
4. ORCHESTRATE: Spawn sub-agents for parallel work.
5. IMPLEMENT: Execute batches, following 3-pass strategy.
6. REVIEW: Run all gates. Fix failures.
7. REPORT: What was completed, what passed review, what's next.
8. LOOP: Move to next batch.

========================================
EDGE CASE CHECKLIST (EVERY FILE)
========================================

Before marking any file complete, verify:
[ ] Very long strings → truncated with tooltip
[ ] Zero values → displayed correctly (₹0, 0 tenants — not errors)
[ ] Null/undefined → handled gracefully, not crashed
[ ] Empty arrays → empty state rendered
[ ] Concurrent requests → no race conditions
[ ] Invalid IDs → 404 with proper error code
[ ] Duplicate creation → 409 with proper error code
[ ] Unauthorized access → 401/403 with proper error code
[ ] Feature flags disabled → 404 with FEATURE_DISABLED code

========================================
SECURITY CHECKLIST (EVERY ROUTE)
========================================

[ ] Zod strict() on all inputs — rejects unknown fields
[ ] Auth guard on protected routes — 401 if no token
[ ] Role guard where needed — 403 if wrong role
[ ] Feature flag check before processing (attendanceEnabled, etc.)
[ ] No secrets hardcoded — all from env vars
[ ] No user data exposed in error messages
[ ] No SQL/NoSQL injection vectors (Mongoose parameterized + Zod type-checked)
[ ] Rate limiter on sensitive endpoints (login, enquiries)

========================================
EMERGENCY STOP CONDITIONS
========================================

Pause and report if:
- A package version has breaking changes not in our docs → research and update docs
- A sub-agent produces code that doesn't follow established patterns → fix and re-spawn
- Type errors cascade across 10+ files → diagnose root cause before fixing symptoms
- A security vulnerability is found → fix immediately, do not defer to later phase
- Build fails 3 times on same error → ask for human guidance

========================================
BEGIN EXECUTION
========================================

Start with Phase 0, Batch 1. Follow the workflow. Research first. Never skip gates.

Current project state: Planning complete. 14 phase docs ready. Tech stack audited. All versions verified latest as of June 2026.

Begin autonomous implementation.
```
Go through the entire website plan phase by phase. The pages for all planned features exist but are not functional; make each page fully functional with proper flow. Implement each design using only custom components. Apply the dynamic versatile theming we offer (neumorphic, SaaS, brutalist, and glassmorphic) to all sidebars, checkboxes, radio buttons, and every other element. Learn these theming patterns from the existing pages, then build all required functional pages, subpages, and sections as outlined in the plan. Explore and understand the plan, create a task breakdown, iterate via subagents, verify and check, and reiterate until all functional flows are tested and verified to be working, including the whole admin dashboard, its pages, all subpages, and all shared flows, with the dynamic theme and light and dark modes in mind, and fix the broken dark mode. Maintain a prioritized todo list and a self-healing prompt to iterate until the website admin panel plan is achieved. Do not stop or ask me for input; continue autonomously again and again until the output matches the planned phases. Do not modify the planned phases; make your own separate todos for this self-healing loop and enable auto-compact conversation.

Admin Suite doesnt have the whole crd module its all read only dig deeper you will know audit the codebase adn the plan make sure admin all pages and sub pages have their features fo curd features  created with right right schema and right set of skills ot plan this, audit current implementation and implement the right thing wiht our dynamic themeing, design, logica, funcaitonal requirements of admin and tenet pages in mind and impleemnt what all remains to be made, even slightest missing custom componets to any missing feature page sub pge or a funcaiton seciotn of each thign.