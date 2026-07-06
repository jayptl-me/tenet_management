# PG Management System — Global Implementation Guide

**Status:** Phases 0-7 COMPLETE | Phases 8-10 PENDING | Theming PLANNED
**Date:** 07/06/2026
**Audience:** Senior engineers & AI agents implementing this system
**Philosophy:** Production-first, security-reviewed, tested, iteratively delivered
**Sub-agent Strategy:** Parallel phase passes with strict integration contracts
**Mandatory Workflow:** Research → Plan & Understand Goal → Orchestrate with Skills → Implement → Review

**Available Skills (28 installed in `~/.claude/skills/`):**

- **Architecture & Planning:** `senior-architect`, `tech-stack-evaluator`
- **Implementation:** `senior-backend`, `senior-frontend`, `senior-fullstack`
- **Quality:** `senior-qa`, `tdd-guide`, `code-reviewer`
- **Security (15):** `09-web-security`, `13-crypto-analysis`, `15-blue-team-defense`, `02-vulnerability-scanner`, `07-incident-response`, `10-cloud-security`, `08-network-security`, `01-recon-osint`, `03-exploit-development`, `04-reverse-engineering`, `05-malware-analysis`, `06-threat-hunting`, `11-csoc-automation`, `12-log-analysis`, `14-red-team-ops`
- **Design:** `ui-ux-pro-max`, `genuinest-frontend-design-workflow`
- **DevOps:** `senior-devops`, `senior-security`, `senior-secops`
- **Meta:** `skill-creator`

---

## Table of Contents

1. [Engineering Standards](#1-engineering-standards)
2. [Security Architecture & Review Gates](#2-security-architecture--review-gates)
3. [Testing Strategy (Multi-Layer)](#3-testing-strategy-multi-layer)
4. [Code Quality & Clean Code Rules](#4-code-quality--clean-code-rules)
5. [Sub-Agent Workflow & Phase Passes](#5-sub-agent-workflow--phase-passes)
6. [Integration Contracts Between Phases](#6-integration-contracts-between-phases)
7. [Phase-by-Phase Adaptive Execution Plan](#7-phase-by-phase-adaptive-execution-plan)
8. [Review Gates Per Phase](#8-review-gates-per-phase)
9. [Modern Stack Exploration Log](#9-modern-stack-exploration-log)

---

## 1. Engineering Standards

### 1.0 Product Copy Rules

- No emoji in visible UI copy, notification titles/bodies, generated WhatsApp messages, seed content, or PDF text.
- WhatsApp support uses direct URLs only (`wa.me` / platform share links). Do not add WhatsApp Business API, SMS APIs, paid templates, or messaging API keys.
- Generated documents and media are data-derived: stream PDFs and generate QR images on demand instead of storing generated files.
- Attendance is important but optional. Gate attendance, QR attendance, leave requests, attendance reports, and guardian attendance visibility behind `AppConfig.features.attendanceEnabled`.

### 1.1 File Structure Rules (Enforced)

- **One component per file.** Never define two React components or two Mongoose models in one file.
- **One hook per file.** Custom hooks go in `apps/web/src/hooks/`, one file per hook.
- **One service per file.** Business logic in `apps/api/src/services/`, one file per domain.
- **Types in shared package.** All interfaces in `packages/types/src/`. Never duplicate type definitions across apps.
- **150-line ceiling.** If a file exceeds 150 lines, split it. Extract helpers, sub-components, or utilities.

### 1.2 Naming Conventions (Enforced)

| Category         | Rule                       | Example                                  |
| ---------------- | -------------------------- | ---------------------------------------- |
| Files            | kebab-case                 | `invoice.service.ts`, `use-tenants.ts`   |
| React components | PascalCase                 | `InvoicePdf.tsx`, `StatCard.tsx`         |
| Functions        | camelCase, verb-first      | `fetchTenants()`, `generateInvoicePdf()` |
| Booleans         | `is`/`has`/`should` prefix | `isLoading`, `hasError`, `shouldRetry`   |
| Arrays           | Plural nouns               | `tenants`, `lineItems`, `complaints`     |
| Constants        | UPPER_SNAKE_CASE           | `MAX_RETRIES`, `SALT_ROUNDS`             |
| Mongoose models  | PascalCase singular        | `User`, `Payment`, `AuditLog`            |
| API routes       | kebab-case nouns           | `/electricity-bills`, `/meal-feedback`   |

### 1.3 Function Rules

- **Single responsibility.** One function = one clear purpose (20-40 lines).
- **Max 3 parameters.** If more, use an options object.
- **No `any` type.** Ever. Use `unknown` and type guard.
- **Pure where possible.** Side effects only in route handlers and services, never in utilities.
- **Return early.** Guard clauses at top, main logic below.

### 1.4 Error Handling Rules

- **Never swallow errors.** Log with Pino at appropriate level: `warn` for recoverable, `error` for unrecoverable.
- **User-facing errors must have codes.** Format: `RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`.
- **Never leak stack traces** in production responses. Log them, return generic message to client.
- **Database errors get try/catch** in every route handler. Convert Mongo errors to HTTP status codes.
- **Zod errors → 400** with field-level details. All request bodies validated before any business logic.

---

## 2. Security Architecture & Review Gates

### 2.1 Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUEST LIFECYCLE                         │
│                                                              │
│  Client ──► CORS ──► requestId ──► Rate Limiter ──►         │
│            SecurityHeaders ──► Auth Guard ──► Role Guard ──►│
│            Zod Validation ──► Route Handler ──► Response     │
└─────────────────────────────────────────────────────────────┘
```

**Security Middleware Order (critical — do not reorder):**

1. `compress()` — response compression (earliest for perf)
2. `cors()` — origin validation, credential handling
3. `requestId` — trace ID for every request
4. `securityHeaders` — XSS, clickjacking, MIME sniffing protection
5. Rate limiter — per-endpoint (login: 5/min, enquiries: 3/hr)
6. `authGuard` — JWT access token validation
7. `adminOnly`/`tenantOnly` — role enforcement
8. Zod validator — input sanitization

### 2.2 JWT Security Checklist

- [ ] Access tokens: 15 min expiry, HS256, signed with 256-bit secret
- [ ] Refresh tokens: 30 day expiry, server-side JTI tracking, rotated on every use
- [ ] Refresh token reuse detection: if any JTI seen twice → revoke ALL user tokens (potential theft)
- [ ] Tokens NEVER in URL query params (only Authorization header)
- [ ] Secrets generated via `openssl rand -hex 32`, never hardcoded

### 2.3 Input Validation (Zod — Strict Mode)

- All request bodies, query params, and URL params validated with `z.strictObject()` — rejects unknown fields
- String sanitization: trim(), toLowerCase() on emails, regex on phone numbers
- File uploads: validate MIME type before upload, max 5MB, only image/jpeg, image/png, application/pdf
- SQL/NoSQL injection: Mongoose parameterized queries prevent injection. Still: never string-concat queries.

### 2.4 Rate Limiting Strategy

| Endpoint            | Limit | Window | Reason                 |
| ------------------- | ----- | ------ | ---------------------- |
| POST /auth/login    | 5     | 15 min | Brute force protection |
| POST /auth/refresh  | 10    | 1 min  | Token refresh abuse    |
| POST /enquiries     | 3     | 1 hour | Spam prevention        |
| POST /complaints    | 10    | 1 hour | Abuse prevention       |
| All other endpoints | 100   | 1 min  | General DoS protection |

### 2.5 Data Privacy

- **Tenant KYC documents**: Cloudinary signed URLs (30 min expiry), never public
- **Tenant data isolation**: Tenant routes check `userId === c.get('user').id` before returning data
- **Admin audit trail**: Every admin write action logged with userId, IP, userAgent
- **PII**: Phone numbers and emails never exposed in SSE events or public endpoints

### 2.6 Dependency Audit

Run before every deployment:

```bash
bun update          # Update all deps to latest patch versions
bun audit           # Check for known vulnerabilities
# Fix any HIGH or CRITICAL findings before proceeding
```

---

## 3. Testing Strategy (Multi-Layer)

### 3.1 Test Pyramid (Enforced)

```
         ╱  E2E  ╲          Playwright — Critical user journeys
        ╱─────────╲         5-10 scenarios (login, pay, raise complaint)
       ╱ Integration ╲       Vitest — Service-level tests
      ╱───────────────╲     20-30 scenarios (invoice gen, UTR verify, notification send)
     ╱   Unit Tests    ╲     Vitest — Pure logic
    ╱───────────────────╲   40-50 scenarios (JWT utils, QR gen, color scale, Zod schemas)
```

### 3.2 What to Test (Per Phase)

**Phase 1 (Auth) — Unit Tests:**

- JWT generation and verification (valid, expired, wrong type)
- Password hashing and comparison
- Refresh token rotation (use → revoke old → issue new)
- Refresh token reuse detection (same JTI twice → all revoked)

**Phase 2 (Models) — Integration Tests:**

- Model validation (required fields, unique constraints, enum values)
- Pre-save hooks (bed occupancy, invoice total, electricity calculations)
- Compound unique indexes (duplicate rejection)
- Virtual population (tenant.user resolves correctly)
- Feature flag defaults, especially `attendanceEnabled: false`
- Guardian to tenant linkage and role isolation

**Phase 3 (Core API) — Integration Tests:**

- CRUD for each resource (create, read, update, delete)
- Pagination (page 1, page 2, edge: empty page)
- Filtering (by status, by date range, by floor)
- Authorization (tenant cannot access other tenant's data)
- 404 for non-existent resources
- 400 for invalid input
- 409 for duplicate creation

**Phase 4 (Payments) — Integration Tests:**

- Invoice generation (all tenants, skip existing)
- UPI QR generation (valid deep link, QR data URL)
- UTR submission (valid UTR, duplicate UTR)
- UTR verification (approve, reject)
- Partial payment recording
- PDF invoice streaming (valid content-type, not empty)
- WhatsApp direct URL generation with no API keys
- Generated PDFs/QRs are not stored as files

**Phase 5 (Notifications) — Integration Tests:**

- ntfy.sh send (mock HTTP, verify correct topic + payload)
- In-app notification storage (correct targetType filtering)
- readBy tracking (mark single, mark all)
- SSE event emission on payment_submitted
- Emergency alert storage, urgent push, and direct WhatsApp share text
- Notification copy contains no emoji

**Phase 6 (Admin UI) — E2E Tests (Playwright):**

- Login → dashboard loads with KPIs
- Create floor → room → tenant (full flow)
- Tenant submits UTR → admin verifies → status updates
- Kanban drag: complaint moves to new column → status changes
- Settings: change brand color → landing page reflects new color

**Phase 7 (Landing) — E2E Tests:**

- Page loads with all sections
- Enquiry form submits successfully
- Smooth scroll to sections works
- Brand colors from API applied

**Phase 8 (Flutter) — Widget/Integration Tests:**

- Auth flow (login, token storage, auto-refresh)
- Payment flow (QR display, UPI intent, UTR submit)
- Laundry booking (slot selection, booking confirmation)

### 3.3 Test Run Commands

```bash
bun run test              # All unit + integration tests
bun run test:watch        # Watch mode during development
bun run test:e2e          # Playwright E2E tests
```

### 3.4 CI Test Requirements

- All tests must pass before merge to `main`
- Coverage not enforced initially (set up after Phase 10)
- Test MongoDB runs as GitHub Actions service container

---

## 4. Code Quality & Clean Code Rules

### 4.1 Pre-Commit Hooks (Enforced)

```bash
# .husky/pre-commit
bun lint-staged
# Runs: prettier --write + eslint --fix on staged files
```

### 4.2 Linting Rules (Non-Negotiable)

- `@typescript-eslint/no-explicit-any`: warn (never use `any`)
- `@typescript-eslint/no-unused-vars`: warn with `_` prefix exception
- `no-console`: warn (use Pino logger, only `console.warn`/`console.error` allowed)
- React: `react/react-in-jsx-scope`: off (React 19 JSX transform)
- Max line length: 100 chars (Prettier enforced)

### 4.3 TypeScript Strict Checks

Before merging any PR:

```bash
bun run typecheck   # Must return exit code 0
```

- `strict: true` in tsconfig
- `noUncheckedIndexedAccess: true` — forces null checks on array/object access
- `verbatimModuleSyntax: true` — prevents `import elision` issues

### 4.4 Git Workflow

```
main         ─── production-ready, auto-deploys to Render
  │
  ├─ phase/0  ─── foundation branch
  ├─ phase/1  ─── auth branch
  ├─ phase/2  ─── models branch
  └─ ...
```

- Each phase on its own branch
- Squash merge to `main` after phase completion
- Commit messages: `phase(N): description` e.g., `phase(2): add visitor and laundry models`

---

## 5. Skill Orchestration Framework (MANDATORY BEFORE EVERY PHASE)

### 5.0 The Iron Law: Research → Plan → Orchestrate → Implement → Review

**Never jump into implementation.** Before writing a single line of code for any phase or batch, you MUST follow this sequence:

```
STEP 1: RESEARCH ──────────► Understand the problem domain
  ├─ Web search for latest patterns, alternatives, CVEs
  ├─ Read existing code files for context
  └─ Skill: tech-stack-evaluator, 01-recon-osint

STEP 2: PLAN & UNDERSTAND ─► Define the goal and approach
  ├─ Read the phase .md file completely
  ├─ Map dependencies (what models/routes/components are needed)
  ├─ Identify integration contracts (API shapes, component props)
  └─ Skill: senior-architect

STEP 3: ORCHESTRATE ───────► Assign the right skills and sub-agents
  ├─ Pick relevant skills from the inventory below
  ├─ Spawn sub-agents for parallelizable work
  ├─ Provide exact file paths, contracts, and context
  └─ Skill: senior-fullstack (orchestration role)

STEP 4: IMPLEMENT ─────────► Write production code
  ├─ Follow engineering standards (Section 1)
  ├─ 3-pass strategy per batch: Scaffold → Implement → Review
  └─ Skills: senior-backend, senior-frontend, tdd-guide

STEP 5: REVIEW ────────────► Verify quality and security
  ├─ Run all 6 review gates (Section 8)
  ├─ Security audit with web-security and vulnerability-scanner
  ├─ Code review with code-reviewer
  └─ Skills: code-reviewer, senior-qa, senior-security
```

### 5.1 Skill-to-Phase Mapping (Which Skill For What)

**Every Phase — Always Active (Background Skills):**

- `code-reviewer` — Run on every PR/diff before marking done
- `tdd-guide` — Generate test stubs before implementing
- `senior-security` — Continuous security mindset

**Phase 0 (Foundation):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `tech-stack-evaluator`, `senior-architect` | Validate Bun vs Node, Hono vs Express, monorepo structure |
| Plan | `senior-architect`, `senior-fullstack` | Design folder structure, middleware stack, type inventory |
| Orchestrate | `senior-fullstack` | Coordinate package.json configs, tsconfig, CI YAML |
| Implement | `senior-backend`, `senior-frontend` | Write env.ts, db.ts, logger.ts, security middleware, globals.css |
| Review | `senior-devops`, `code-reviewer` | Verify CI pipeline, build succeeds, health endpoint responds |

**Phase 1 (Auth):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `13-crypto-analysis`, `09-web-security` | Validate JWT algorithm choice (HS256 vs RS256), bcrypt cost factor |
| Plan | `senior-architect` | Design token rotation flow, refresh token store, rate limiting strategy |
| Orchestrate | `senior-backend` | Coordinate User model, JWT utils, auth middleware, routes |
| Implement | `senior-backend`, `senior-frontend`, `tdd-guide` | Write auth routes, login page, auth guard, Flutter auth provider |
| Review | `09-web-security`, `code-reviewer` | Test JWT alg:none, refresh token reuse detection, brute force rate limit |

**Phase 2 (Models):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `tech-stack-evaluator` | Validate mongoose vs prisma for MongoDB, embedded vs reference patterns |
| Plan | `senior-architect` | Design 19 schemas, index strategy, compound unique constraints |
| Orchestrate | `senior-backend` | Spawn 4 sub-agents for parallel model writing |
| Implement | `senior-backend`, `tdd-guide` | Write all 23 models + AppConfig feature flags + barrel export + seed script |
| Review | `code-reviewer`, `02-vulnerability-scanner` | Verify indexes, test compound uniques, check for NoSQL injection vectors |

**Phase 3 (Core API):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `senior-backend` | Best practices for Hono route organization, Zod validation patterns |
| Plan | `senior-architect` | Design 60+ endpoint map, service layer contracts, pagination standard |
| Orchestrate | `senior-backend` | Spawn 6 sub-agents for parallel CRUD route writing |
| Implement | `senior-backend`, `tdd-guide` | Write routes, services, Zod schemas, error handling |
| Review | `09-web-security`, `senior-qa` | IDOR/BOLA testing on every endpoint, integration tests |

**Phase 4 (Payments):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `tech-stack-evaluator`, `13-crypto-analysis` | Validate UPI QR approach, @react-pdf/renderer vs alternatives |
| Plan | `senior-architect` | Design invoice generation flow, UTR verification workflow, scheduled jobs |
| Orchestrate | `senior-backend` | Coordinate Counter, Invoice service, Payment routes, PDF template |
| Implement | `senior-backend`, `senior-frontend`, `tdd-guide` | Write invoice service, UPI QR utility, PDF renderer, payment routes |
| Review | `09-web-security`, `code-reviewer` | Test UTR uniqueness, PDF injection, payment status transitions |

**Phase 5 (Notifications):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `tech-stack-evaluator`, `08-network-security` | Validate ntfy.sh vs Gotify, WebSocket vs polling, SSE best practices |
| Plan | `senior-architect` | Design topic strategy (per-user UUID), in-app notification schema, SSE stream |
| Orchestrate | `senior-backend` | Coordinate ntfy client, notification service, SSE route, Flutter listener |
| Implement | `senior-backend`, `senior-frontend` | Write notification routes, SSE hook, Flutter ntfy WebSocket |
| Review | `senior-qa`, `code-reviewer` | Test push delivery, read tracking, SSE heartbeat/reconnect |

**Phase 6 (Admin UI):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `ui-ux-pro-max`, `genuinest-frontend-design-workflow` | Design system tokens, component library selection, animation patterns |
| Plan | `senior-architect`, `senior-frontend` | Design 20+ page layout, shared component API, nav structure |
| Orchestrate | `senior-frontend`, `senior-fullstack` | Spawn 7 sub-agents for parallel page writing |
| Implement | `senior-frontend`, `tdd-guide` | Write admin shell, DataTable, StatCard, all pages with 4 UI states |
| Review | `senior-qa`, `code-reviewer` | E2E tests with Playwright, responsive audit, accessibility audit |

**Phase 7 (Landing):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `ui-ux-pro-max`, `genuinest-frontend-design-workflow` | Landing page patterns, SEO best practices, JSON-LD schemas |
| Plan | `senior-frontend` | Design sections, AppConfig-driven content, animation strategy |
| Orchestrate | `senior-frontend` | Coordinate section components, SEO script, brand token application |
| Implement | `senior-frontend`, `tdd-guide` | Write all sections, enquiry form, SEO files |
| Review | `senior-qa`, `09-web-security` | Test form rate limiting, brand token rendering, SEO crawlability |

**Phase 8 (Flutter):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `tech-stack-evaluator` | Validate Riverpod vs Bloc, Dio vs http, go_router patterns |
| Plan | `senior-architect` | Design feature structure, navigation tree, state management |
| Orchestrate | `senior-fullstack` | Coordinate Dio client, auth provider, screens, ntfy integration |
| Implement | `senior-frontend`, `tdd-guide` | Write all screens, Riverpod providers, Dio interceptors |
| Review | `senior-qa`, `senior-security` | Test UPI intent, secure storage, certificate pinning |

**Phase 9 (Deploy):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `senior-devops`, `10-cloud-security` | Render free tier limits, MongoDB Atlas config, Cloudinary setup |
| Plan | `senior-devops` | Design deployment pipeline, env var strategy, keep-alive |
| Orchestrate | `senior-devops` | Coordinate Render YAML, CI/CD, seed script, smoke tests |
| Implement | `senior-devops`, `15-blue-team-defense` | Write render.yaml, CI workflow, hardening checklist |
| Review | `senior-secops`, `02-vulnerability-scanner` | Dependency audit, secret scan, smoke test all endpoints |

**Phase 10 (Polish):**
| Pass | Skills to Load | Purpose |
|------|---------------|---------|
| Research | `senior-qa`, `code-reviewer` | Performance audit tools, Lighthouse thresholds, a11y standards |
| Plan | `senior-architect` | Design optimization strategy, state audit matrix, test coverage targets |
| Orchestrate | `senior-fullstack` | Coordinate performance, a11y, security, and testing passes |
| Implement | `senior-frontend`, `senior-backend`, `tdd-guide` | Dynamic imports, query tuning, image optimization, test gap filling |
| Review | `senior-security`, `senior-qa`, `07-incident-response` | Full security audit, final E2E run, incident response plan validation |

### 5.2 Skill Loading Protocol

**How to load a skill:**

```
/use-skill <skill-name>
# Example: /use-skill senior-backend
# Example: /use-skill 09-web-security
```

**When to load multiple skills (batch orchestration):**

- Load **architect** first → understand structure
- Load **domain skill** (backend/frontend/security) next → implementation guidance
- Load **qa + code-reviewer** last → verification

**Skill loading is not optional.** Each phase description in its .md file MUST list the required skills at the top. See `docs/phase-0-foundation.md` for the template format.

---

## 6. Sub-Agent Workflow & Phase Passes

### 5.1 When to Use Sub-Agents

**Spawn sub-agents for:**

- Writing 4+ model files in parallel (Phase 2 — 19 models)
- Writing 10+ route files in parallel (Phase 3 — 60+ endpoints)
- Writing 10+ page components in parallel (Phase 6 — full admin surface)
- Writing boilerplate with strict templates (CRUD routes follow exact same pattern)

**Do NOT spawn sub-agents for:**

- Files with complex interdependencies (auth middleware + JWT utils + rate limiter must be written together)
- Single files or 2-3 small files
- Files requiring architectural decisions (Phase 0 foundation, API entry point)

### 5.2 Phase Pass Strategy (Iterative Loops)

Each phase goes through **3 passes**, not one big write:

```
PASS 1: Scaffold ───► Get files compiling, types correct, routes wired
PASS 2: Implement ──► Full logic, edge cases, error handling
PASS 3: Review ─────► Security audit, tests, refactor, documentation
```

**Example — Phase 3 (Core API):**

- **Pass 1**: Write all route files with empty handlers returning 501. Wire them in index.ts. Verify they compile and routes are reachable.
- **Pass 2**: Implement each route with Zod validation, service calls, error handling, pagination. Spawn sub-agents for CRUD boilerplate routes.
- **Pass 3**: Review every route for: authorization gaps, missing edge cases, N+1 queries, response shape consistency. Write integration tests.

### 5.3 Sub-Agent Instruction Template

When spawning sub-agents, provide:

1. **Exact file paths** to create/modify
2. **Files to read first** for context (existing models, existing routes to copy pattern from)
3. **Integration contract** — exact exports, function signatures, API response shapes
4. **Coding conventions** — naming, error handling pattern, import style
5. **Project context** — tech stack, folder structure, existing patterns
6. **Do NOT** invent new dependencies or patterns not established in Phase 0

### 5.4 Integration After Sub-Agent Completion

After sub-agents finish, the human/senior agent MUST:

1. Wire routes into `apps/api/src/index.ts`
2. Wire pages into navigation config
3. Run `bun run typecheck` — fix any type errors
4. Run `bun run build` — fix any build errors
5. Run `bun run test` — fix any test failures
6. Do a manual review of at least one agent's output for quality

---

## 6. Integration Contracts Between Phases

### 6.1 API Response Contract (ALL routes must follow)

**Success (collection):**

```typescript
{
  success: true,
  data: T[],
  meta: { total: number, page: number, limit: number, totalPages: number }
}
```

**Success (single):**

```typescript
{
  success: true,
  data: T
}
```

**Error:**

```typescript
{
  success: false,
  error: {
    code: string,        // MACHINE_READABLE: "TENANT_NOT_FOUND"
    message: string,     // HUMAN_READABLE: "No tenant found with the given ID."
    requestId?: string,
    details?: Record<string, string[]>  // Field-level validation errors
  }
}
```

### 6.2 HTTP Status Codes (Strict Mapping)

| Code | When                                    |
| ---- | --------------------------------------- |
| 200  | Successful GET, PUT, PATCH              |
| 201  | Successful POST (resource created)      |
| 204  | Successful DELETE (no body)             |
| 400  | Validation error, bad request           |
| 401  | Missing or invalid auth token           |
| 403  | Valid token but wrong role              |
| 404  | Resource not found                      |
| 409  | Duplicate/resource conflict             |
| 422  | Unprocessable (business rule violation) |
| 429  | Rate limited                            |
| 500  | Unexpected server error                 |

### 6.3 Frontend ↔ Backend Contract

- **All API calls** go through `apps/web/src/lib/api.ts` (ky instance with interceptors)
- **All TanStack Query hooks** go in `apps/web/src/hooks/`, one file per resource
- **Query key convention**: `['resource', ...filters]` e.g., `['tenants', { floorId: 'x' }]`
- **Mutation convention**: `useMutation` with `onSuccess: invalidate queries + toast`

### 6.4 API Service ↔ MongoDB Contract

- **Models in** `apps/api/src/models/`, follow Phase 2 patterns exactly
- **Services in** `apps/api/src/services/`, one file per domain (invoice.service.ts, notification.service.ts)
- **Routes call services**, never models directly (except for simple CRUD)
- **Jobs in** `apps/api/src/jobs/`, one file per schedule group

---

## 7. Phase-by-Phase Adaptive Execution Plan

### Phase 0: Foundation (3-4 days)

**Pass 1**: Initialize monorepo, write configs, create package.json files
**Pass 2**: Write env validation, DB connection, logger, event bus, security middleware, error handler
**Pass 3**: Wire everything, verify health endpoint, run seed, CI green
**Review Gate**: `bun run typecheck && bun run test && bun run build`

### Phase 1: Auth (3-4 days)

**Pass 1**: User model (extends Phase 0), JWT utils, refresh token store
**Pass 2**: Auth routes (login, refresh, logout, me, change password), rate limiter, auth middleware
**Pass 3**: Admin seed script, frontend login page, auth guard layout, Flutter auth provider skeleton
**Review Gate**: All 12 verification checkpoints from Phase 1 pass. Refresh token rotation + reuse detection tested.

### Phase 2: Models (4.5-5.5 days)

**Pass 1**: Spawn 5 sub-agents — each writes 4-5 model files from templates. Review all 23 models plus AppConfig feature flags.
**Pass 2**: Write seed script with `--with-sample-data`. Fix any validation errors found during seeding.
**Pass 3**: Verify all indexes in MongoDB. Test compound unique constraints manually.
**Review Gate**: `bun run seed -- --with-sample-data` populates all planned collections. All indexes and feature flag defaults verified.

### Phase 3: Core API (7.5-8.5 days)

**Pass 1**: Spawn 6 sub-agents — each writes route files for 2-3 resources (CRUD boilerplate). Wire in index.ts.
**Pass 2**: Implement business logic in services (dashboard aggregation, tenant occupancy calculation). Add Zod schemas.
**Pass 3**: Integration tests for each resource. Authorization testing (tenant can't access admin routes).
**Review Gate**: All endpoints documented and tested, including guardians, assets, menu, notices, visitors, and attendance/leave feature-disabled behavior. Pagination works. Authorization enforced.

### Phase 4: Payments (6-7 days)

**Pass 1**: Counter model, invoice service, scheduled jobs, PDF template
**Pass 2**: UPI QR utility, payment routes, partial payments, UTR verification flow, electricity distribution
**Pass 3**: Direct WhatsApp URL generation, generated artifact checks, integration tests. Manual UPI QR scan test with real UPI app.
**Review Gate**: End-to-end payment flow works: generate invoice -> scan QR -> pay via UPI -> submit UTR -> admin verify -> PDF download -> direct WhatsApp share. PDFs and QR images are generated on demand, not stored.

### Phase 5: Notifications (3.5-4.5 days)

**Pass 1**: ntfy.sh client, notification service, notification model, notification routes
**Pass 2**: SSE admin stream, EventSource hook, notification trigger integration, emergency alert flow
**Pass 3**: Flutter ntfy WebSocket listener. Test push delivery to actual ntfy.sh topic.
**Review Gate**: Admin sends notification/emergency alert -> tenant and guardian Flutter users receive via WebSocket + in-app list. Direct WhatsApp share text is available without APIs.

### Phase 6: Admin UI (12.5-14.5 days)

**Pass 1**: Admin shell (sidebar, layout, nav config), shared components (DataTable, StatCard, StatusBadge, etc.)
**Pass 2**: Spawn 7 sub-agents — each writes 2 pages. Dashboard first, remaining pages in parallel.
**Pass 3**: Wire SSE, notification bell, dark mode polish, responsive audit, animation polish.
**Review Gate**: All admin pages render, including attendance toggle behavior, guardians, assets, menu, notices, and emergency alerts. All 4 UI states covered (loading, empty, error, success). Dark mode works. Mobile responsive.

### Phase 7: Landing (4-5 days)

**Pass 1**: All section components, AppConfig hook with `placeholderData`, page layout
**Pass 2**: SEO build script, JSON-LD, animations (whileInView), mobile responsive
**Pass 3**: Brand token application (colors, fonts from API). Enquiry form rate limiting.
**Review Gate**: Landing page renders with brand colors from AppConfig. SEO files generated. Enquiry form submits.

### Phase 8: Flutter (12-14 days)

**Pass 1**: Auth flow (login screen, Dio interceptor, flutter_secure_storage), navigation shell
**Pass 2**: Tenant dashboard, guardian dashboard, payments (QR + UPI intent + WhatsApp share), complaints, room, service status screens
**Pass 3**: New screens (laundry booking, visitor register, menu view, notice board, optional attendance/leave). ntfy WebSocket. Local notifications.
**Review Gate**: APK builds. Tenant and guardian flows work. Attendance/leave hides when disabled and works when enabled. UPI deep link opens UPI app. Direct WhatsApp share works or copies text. Notifications and emergency alerts received.

### Phase 9: Deploy (2-3 days)

**Pass 1**: Render configs, MongoDB Atlas setup, Cloudinary setup, Resend setup, ntfy.sh topic verification
**Pass 2**: CI/CD pipeline verification, environment variable audit, seed admin user in production
**Pass 3**: Smoke tests (health endpoint, login, dashboard load, invoice PDF generation)
**Review Gate**: Production API + Web live. Admin can log in. Seed data present. Keep-alive working.

### Phase 10: Polish (4-5 days)

**Pass 1**: State handling audit (every page checked for 4 states). Accessibility audit (keyboard, ARIA, contrast).
**Pass 2**: Performance optimization (dynamic imports, query staleTime tuning, image lazy loading). Security audit (dependency scan, secret scan, rate limit test, role bypass test).
**Pass 3**: Unit + integration + E2E test suite final run. Documentation review. Final production handoff.
**Review Gate**: All tests pass. No HIGH/CRITICAL vulnerabilities. Lighthouse > 90. README reviewed.

---

## 8. Review Gates Per Phase

Every phase must pass these gates before being considered complete:

### Gate 1: TypeScript Compilation

```bash
bun run typecheck   # Exit 0, zero errors
```

### Gate 2: Build

```bash
bun run build       # Both API and web build successfully
```

### Gate 3: Lint & Format

```bash
bun run lint        # Exit 0, zero warnings
bun run format:check # Exit 0
```

### Gate 4: Tests

```bash
bun run test        # All tests pass
bun run test:e2e    # All E2E tests pass (Phase 6+)
```

### Gate 5: Security Review (Phase 4+)

- [ ] Run `bun audit` — no HIGH/CRITICAL vulnerabilities
- [ ] Verify no secrets in client bundle: `grep -r "NEXT_PUBLIC" apps/web/src/ | grep -v "API_URL"`
- [ ] Rate limit test: 6 rapid login attempts → 429
- [ ] Role bypass test: tenant token → admin endpoint → 403
- [ ] XSS test: `<script>alert(1)</script>` in form input → escaped, not executed

### Gate 6: Edge Case Coverage (All Phases)

- [ ] Empty state handled (no data → helpful CTA)
- [ ] Error state handled (API down → error message + retry)
- [ ] Loading state handled (shimmer matching final layout)
- [ ] Concurrent requests handled (refresh token queue, no race conditions)
- [ ] Very long strings handled (truncation with tooltip)
- [ ] Zero values handled (₹0, 0 tenants — displayed correctly, not as errors)

---

## 9. Security Testing Playbook (Injected from CyberSecurity Skills)

### 9.1 Web Application Security Review (Skill 09)

**Pre-Deployment Security Header Verification:**
Every response must include these headers (already configured in Phase 0 middleware):

- [ ] `Strict-Transport-Security`: max-age=31536000; includeSubDomains
- [ ] `Content-Security-Policy`: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:
- [ ] `X-Content-Type-Options`: nosniff
- [ ] `X-Frame-Options`: DENY
- [ ] `Referrer-Policy`: strict-origin-when-cross-origin
- [ ] `Permissions-Policy`: camera=(), microphone=(), geolocation=()

**API Security Testing Checklist (Every Phase 3+ Endpoint):**

```
Authentication:
[ ] Endpoint accessible without token? (must return 401)
[ ] JWT alg:none attack blocked? (jose library rejects by default)
[ ] JWT expired token accepted? (must return 401)
[ ] JWT wrong signature accepted? (must return 401)

Authorization (IDOR/BOLA):
[ ] Can tenant A access tenant B's resource by changing ID? (must return 403)
[ ] Can tenant access admin-only endpoints? (must return 403)
[ ] Can unauthenticated user access protected endpoints? (must return 401)

Input Validation:
[ ] SQL injection in parameters? (Mongoose parameterized queries prevent)
[ ] NoSQL injection in JSON body? ($where, $gt operators rejected by Zod)
[ ] XSS in text fields? (React escapes by default)
[ ] Mass assignment: extra fields in POST body? (Zod strict() rejects)
[ ] Overly long strings? (Zod maxLength enforces)
[ ] Negative amounts in payment? (Zod min() enforces)

Data Exposure:
[ ] Response includes passwordHash? (Mongoose select: false)
[ ] Response includes refreshTokens? (Mongoose select: false)
[ ] Error messages reveal stack traces? (globalErrorHandler strips in production)
[ ] Debug endpoints exposed in production? (/api/debug, /api/swagger — disabled)
```

**JWT Security Specifics (Validated Against Skill 13 — Cryptographic Analysis):**

- [ ] Algorithm: HS256 (HMAC-SHA256) with 256-bit secret — acceptable strength
- [ ] Key length: 256 bits minimum (JWT_ACCESS_SECRET and JWT_REFRESH_SECRET)
- [ ] Token expiry: 15 min access, 30 day refresh — appropriate for web app
- [ ] alg:none attack: jose library rejects tokens without algorithm by default
- [ ] Key confusion: HS256 only (no RS256/HS256 confusion possible since we use symmetric key)
- [ ] JTI tracking: Refresh tokens have unique JTI, rotation on every use
- [ ] Reuse detection: JTI seen twice → all user tokens revoked (theft detection)

**CORS Configuration Verified:**

- [ ] Origin list: strict whitelist (production: frontend URL only; dev: localhost only)
- [ ] `Access-Control-Allow-Credentials`: true (needed for token header)
- [ ] `Access-Control-Allow-Origin` never `*` with credentials
- [ ] Null origin rejected (prevents sandboxed iframe attacks)

### 9.2 Dependency Vulnerability Scanning (Skill 02)

**Pre-Deployment Scan:**

```bash
# Check for known CVEs in dependencies
bun audit

# For critical dependencies, check specific CVEs
bun audit --json | grep -E '"severity":"(high|critical)"'
```

**Critical Dependencies to Monitor:**
| Package | Risk | Check |
|---------|------|-------|
| mongoose | NoSQL injection if misused | All queries use parameterized filters |
| jose | JWT algorithm confusion | HS256 symmetric only |
| bcryptjs | Timing attacks | Constant-time comparison by library |
| zod | None (validation library) | All schemas use `.strict()` |
| hono | None (framework) | Keep updated to latest patch |

### 9.3 Blue Team Hardening (Skill 15)

**Server Hardening Checklist (Pre-Production):**

- [ ] Run API as non-root user (Render handles this)
- [ ] Set `NODE_ENV=production` (disables debug logging, stack traces)
- [ ] MongoDB auth enabled (username + password, not default credentials)
- [ ] MongoDB network access: IP whitelist (Render IP or `0.0.0.0/0` with strong password)
- [ ] Cloudinary: signed URLs for sensitive documents (Aadhaar), unsigned for public images
- [ ] Rate limiting enabled on all auth endpoints
- [ ] Request size limiting: Hono body limit 5MB (prevents DoS via large uploads)
- [ ] Helmet-like security headers via custom middleware (already in Phase 0)

**Database Hardening:**

- [ ] MongoDB Atlas: encryption at rest enabled (default on M0+)
- [ ] Database user has minimum required privileges (readWrite on app DB only, not admin)
- [ ] Connection string uses SRV record with `retryWrites=true&w=majority`
- [ ] No database credentials in code — only in environment variables

**Secrets Management:**

- [ ] All secrets in `.env` (never committed — in `.gitignore`)
- [ ] `.env.example` provided with placeholder values (safe to commit)
- [ ] JWT secrets: generated via `openssl rand -hex 32`, unique per environment
- [ ] Render env vars: marked as `sync: false` for sensitive values (manual input)
- [ ] No API keys in client-side code (NEXT*PUBLIC*\* only for non-sensitive config)

### 9.4 Incident Response Readiness (Skill 07)

**What to Do If:**
| Incident | Response |
|----------|----------|
| Unauthorized admin login detected | Check AuditLog for IP, revoke all refresh tokens, change admin password, review recent changes |
| Payment fraud (fake UTR) | Check Payment.verifiedBy, Payment.screenshotUrl, cross-reference with bank statement |
| Data breach (tenant data exposed) | Identify affected endpoint via AuditLog, fix authorization gap, notify affected tenants, rotate all JWT secrets |
| Service downtime | Check Render dashboard, MongoDB Atlas status, Cloudinary status. Health endpoint self-ping monitors uptime. |
| Rate limit triggered (possible brute force) | Check AuthLog for failed login patterns, block IP if malicious, alert admin |

---

## 10. Modern Stack Exploration Log

### Why We Chose What We Chose

| Technology                  | Alternatives Explored                                 | Why This Won                                                                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bun**                     | Node.js, Deno                                         | 4x faster HTTP server, native TS, built-in .env, workspace support. Deno less mature ecosystem. Node.js slower.                                                                                                                                 |
| **Hono**                    | Express, Fastify, Elysia                              | Web standards-based, works on any runtime (Bun, Node, Cloudflare). Ultrafast router. Express is legacy, Fastify is Node-only.                                                                                                                   |
| **Mongoose 8**              | Prisma, Drizzle, raw MongoDB driver                   | Most mature MongoDB ODM. Prisma MongoDB support is beta. Drizzle ORM has no official MongoDB support.                                                                                                                                           |
| **Tailwind v4 @theme**      | styled-components, vanilla-extract, Panda CSS         | CSS-first configuration with zero JS config file. CSS custom properties bridge to AppConfig. **CRITICAL: Use `@theme` (non-inline) for theme-able tokens — `@theme inline` bakes hex values into utilities, preventing CSS cascade overrides.** |
| **Tailwind v4 multi-theme** | CSS-in-JS, runtime theming, CSS modules               | CSS-only cascade via `data-theme` attribute. Zero runtime cost. 4 presets (brutalist, neumorphic, soft UI, SaaS). `@theme` emits `var(--token)` references; `data-theme` on `<html>` redefines the custom properties.                           |
| **shadcn/ui new-york**      | MUI, Ant Design, Chakra UI, Radix primitives directly | Copy-paste components (full control), Radix primitives (accessible), Tailwind styling. No npm dependency for UI library.                                                                                                                        |
| **@react-pdf/renderer**     | jsPDF, pdfmake, Puppeteer HTML→PDF                    | Declarative JSX templates. Streaming (no temp files). jsPDF is imperative (hard to template). Puppeteer needs Chromium (heavy).                                                                                                                 |
| **ntfy.sh**                 | Firebase FCM, Gotify, OneSignal, Pushover, Apprise    | Simple HTTP POST. WebSocket for real-time. Self-hostable. No Google account needed. Gotify has no official Flutter client.                                                                                                                      |
| **UPI QR (zero-fee)**       | Razorpay, Stripe, PayU, Cashfree, UPIExpress          | Zero transaction fees. No KYC/business verification needed. Direct bank-to-bank. Downside: manual UTR verification (acceptable for PG with <100 tenants).                                                                                       |
| **Zustand**                 | Redux Toolkit, Jotai, Recoil, Context API             | Minimal boilerplate, TypeScript-first, persist middleware (localStorage). 1KB bundle. Redux is overkill for this app size.                                                                                                                      |
| **TanStack Query v5**       | SWR, RTK Query, Apollo Client                         | Mature cache invalidation, background refetch, devtools. Works with any HTTP client. SWR has fewer features.                                                                                                                                    |
| **ky**                      | axios, fetch, ofetch                                  | Lightweight fetch wrapper with retry, timeout, hooks (interceptors). Smaller than axios. Native fetch with better DX.                                                                                                                           |
| **Motion (Framer Motion)**  | react-spring, CSS animations, GSAP                    | Declarative animations. Layout animations with `layout` prop. `whileInView` for scroll-triggered. Reduced motion support.                                                                                                                       |
| **Pino**                    | Winston, Bun console, tslog                           | Fastest Node.js logger. Bun transport in dev, JSON in prod. Redaction built-in. Winston is slower.                                                                                                                                              |
| **Zod 3**                   | Yup, Joi, io-ts, TypeScript type guards               | TypeScript-first (infer types from schemas). `.strict()` mode. Used on both frontend (React Hook Form) and backend (Hono routes).                                                                                                               |
| **jose**                    | jsonwebtoken, @node-rs/jwt                            | Web Crypto API native. Works in Bun, Node, Cloudflare Workers, Edge. Zero dependencies. jsonwebtoken is Node-only with native deps.                                                                                                             |
| **cloudinary**              | S3, Uploadthing, Bunny CDN                            | Free tier 25GB. Image transformation on URL. CDN delivery. No S3 setup complexity for small PG app.                                                                                                                                             |
| **resend**                  | Nodemailer, SendGrid, SES                             | Simple REST API. Render blocks SMTP ports (Nodemailer won't work). Free 3000 emails/month. React email templates.                                                                                                                               |

---

## Appendix A: Sub-Agent Assignment Map

### Phase 2 (Models) — 5 Sub-Agents

| Agent | Models                                                                  | Files                 |
| ----- | ----------------------------------------------------------------------- | --------------------- |
| A1    | User, Floor, Room, Tenant, Payment                                      | 5 files               |
| A2    | Invoice, ElectricityBill, Complaint, ServiceStatus, MealFeedback        | 5 files               |
| A3    | Notification, Enquiry, AppConfig, Counter, DailyMenu                    | 5 files               |
| A4    | Visitor, LaundrySlot, NoticePost, AuditLog, barrel export               | 5 files               |
| A5    | AttendanceRecord, LeaveApplication, Asset, Guardian, feature flag tests | 4 model files + tests |

### Phase 3 (Core API) — 6 Sub-Agents

| Agent | Routes                                                                   | Files         |
| ----- | ------------------------------------------------------------------------ | ------------- |
| A1    | Floors, Rooms, Tenants                                                   | 3 route files |
| A2    | Payments, Invoices, Electricity                                          | 3 route files |
| A3    | Complaints, Services, Dashboard                                          | 3 route files |
| A4    | Notifications, Enquiries, SSE                                            | 3 route files |
| A5    | Meals, Menu, Notices, Visitors                                           | 4 route files |
| A6    | Laundry, Audit, Export, AppConfig, Assets, Attendance, Leaves, Guardians | 8 route files |

### Phase 6 (Admin UI) — 7 Sub-Agents

| Agent | Pages                                                                             | Files                 |
| ----- | --------------------------------------------------------------------------------- | --------------------- |
| A1    | Dashboard, Shell/Layout                                                           | 2 page files + layout |
| A2    | Floors & Rooms, Tenants                                                           | 2 page files          |
| A3    | Payments, Invoices                                                                | 2 page files          |
| A4    | Electricity, Services                                                             | 2 page files          |
| A5    | Complaints, Mess Feedback, Menu                                                   | 3 page files          |
| A6    | Notifications, Emergency Alerts, Enquiries, Settings/Feature Toggles              | 4 page areas          |
| A7    | Visitors, Laundry, Notice Board, Audit Log, Export, Assets, Attendance, Guardians | 8 page areas          |

---

## Appendix B: Daily Standup Checklist (Per Developer/Agent)

Before marking a phase step as "done":

- [ ] File written following naming conventions
- [ ] TypeScript compiles without errors (local `bun run typecheck`)
- [ ] No `any` types used
- [ ] Error handling present (try/catch with proper error codes)
- [ ] Edge cases documented in the file's Edge Cases table
- [ ] Route/file registered in barrel export or index.ts
- [ ] Test file exists (at minimum a placeholder) for services/utilities
- [ ] Prettier + ESLint pass on the file
- [ ] No secrets, API keys, or hardcoded credentials
- [ ] Import paths use `@/` alias (not relative `../../` chains)

---

_Document version 1.0 — PG Management System Global Implementation Guide_
_This guide is the single source of truth for engineering standards across all 10 phases._
