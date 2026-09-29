# Depth Implementation Plan -- Gate P

**Date:** 2026-09-29
**Gate R:** finalized (4 decisions, named options with verified sources)
**Gate P:** approved by Jay, 2026-09-29
**Scope:** land the dirty tree, clear all 98 lint warnings, run a per-module depth audit and rebuild program, harden the Render deployment.

> Code is truth. This plan was built from live exploration of the tree on 2026-09-29 (four parallel read-only agents + direct verification). Re-verify any line here against source before acting on it. ASCII only, no emojis.

---

## 0. Decisions locked

| #   | Decision                 | Selection                               | Consequence                                                                                                                                   |
| --- | ------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Land the 219 dirty paths | **Reorder + hunk-split**                | Commit order is theme -> api -> web -> **lint last** -> mobile -> docs; exactly 2 files need `git add -p`                                     |
| D2  | Lint warning target      | **All 98 to zero**                      | TanStack Query for the 78, plus `next/image` (10), `useWatch` (5), purity (3), refs (1), immutability (1); oxlint then runs at zero tolerance |
| D3  | Audit pipeline           | **Restore required sections**           | Every `docs/audit/features/*.md` gains literal `## Open gaps` + `## Closed` sections so the 4 scripts check real rows                         |
| D4  | Rebuild method           | **Shared form shell, then money order** | Extract `CrudFormPage` for the 14 clone pages first; then payments, invoices, tenants, electricity, rooms, attendance, dashboard              |
| D5  | CI + reproducibility     | **Full CI hardening**                   | Commit `bun.lock`, pin bun 1.3.0, split the `lint \|\| format:check` mask, add Flutter job, make e2e runnable                                 |
| D6  | Render preview envs      | **Skip previews**                       | Need Pro ($25/mo) + `previews:` key + env-group migration for 13 `sync:false` vars; deploy from `main` after CI green                         |

---

## 1. Ground truth (verified 2026-09-29)

### 1.1 Tree state

- Branch `main`, in sync with `origin` (`https://github.com/jayptl-me/tenet_management.git`).
- **219 dirty paths** = 192 modified + 8 deleted + 19 untracked. Diff: 200 files, +13,429 / -6,573.
- Last commit `aaf5cee` (2026-09-08). Three weeks of uncommitted work.
- `bun.lock` **gitignored** (`.gitignore:37`); `.bun-version` = `1.3.0`.
- `node_modules` was absent mid-session (restored with `bun install`, 438 packages). Re-run `bun install` before any gate.

### 1.2 Gate state at plan time

| Gate                | Result                                            |
| ------------------- | ------------------------------------------------- |
| `bun run typecheck` | green (`@pg/types`, `@pg/web`, `@pg/api`)         |
| `bun run lint`      | exit 0, **98 warnings, 0 errors** across 67 files |
| `bun run test`      | 79/79 in 18 files                                 |
| `flutter analyze`   | 0 issues                                          |

### 1.3 Warning inventory (all 98)

| Rule                          | Count | Notes                                              |
| ----------------------------- | ----- | -------------------------------------------------- |
| `react(set-state-in-effect)`  | 78    | shape A 57, B 5, C 5, D 5, E 3, F 1, G 2 (see 3.2) |
| `next(no-img-element)`        | 10    | raw `<img>` -> `next/image`                        |
| `react(incompatible-library)` | 5     | all `react-hook-form` `watch()`                    |
| `react(purity)`               | 3     | `Date.now()` during render                         |
| `react(refs)`                 | 1     | `hooks/useUnsavedGuard.ts:13`                      |
| `react(immutability)`         | 1     | `notices/[id]/page.tsx:59`                         |

`react(incompatible-library)` sites: `floors/[id]/edit:508`, `invoices/[id]/edit:148`, `payments/[id]/edit:112`, `rooms/[id]/edit:104`, `rooms/new:102`.
`react(purity)` sites: `components/ui/AssetVisuals.tsx:147`, `visitors/[id]:168`, `visitors/new:147`.

`.oxlintrc.json` declares only `react-hooks/rules-of-hooks` (error) and `react-hooks/exhaustive-deps` (warn). The 89 `react(...)` compiler diagnostics are enabled implicitly by oxlint's plugin defaults -- they are not tunable there today, so D2 requires actually fixing them (no config dodge available without adding rule overrides).

### 1.4 Data layer

- `apps/web/src/lib/api.ts` -- single export `api`, a Proxy-wrapped `ky` instance: `api.get/post/put/delete(...).json<T>()`. Handles bearer token from `localStorage['pg-auth-storage']`, 401 -> `/auth/refresh` -> replay, and decrements `useApiLoadingStore` on settle. 184 lines.
- `parseApiError` at `apps/web/src/lib/errorParser.ts:94`.
- **`@tanstack/react-query` v5.62.0 installed and `QueryClientProvider` wired** in `components/shared/AppProviders.tsx`. Config: `staleTime: 60_000`, `retry: 1`, `refetchOnWindowFocus: false`. **Only consumer: `hooks/useAppConfig.ts`.**
- `apps/web/src/hooks/` has 5 files, no barrel export. No other fetch abstraction exists (`useResource|useFetch|useApiRequest` -> 0 matches).

---

## 2. Phase 1 -- Land the tree as atomic Conventional Commits (D1)

### 2.1 Commit order and content

Order is forced by dependencies; the planned 1-2-3-4 order would be red.

| #      | Type           | Content                                                                  | Paths                                                                                                                                                                                                                                                                                                                 |
| ------ | -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C2** | `fix(theme)`   | `dark:` bound to `[data-mode]`, new type tokens, `color-scheme`          | `apps/web/src/app/globals.css`, `apps/web/src/themes/{brutalist,custom,neumorphic,saas,soft-ui}.css`, `apps/web/src/lib/chart-theme.ts`, `apps/web/src/lib/field-styles.ts`                                                                                                                                           |
| **C3** | `feat(api)`    | storage service, PDF templates, `kyc_uploaded`, dashboard telemetry seed | `apps/api/**` (12 routes, 2 services, 2 models, tests, `package.json` script), `packages/types/src/{notification,tenant}.ts`, untracked `apps/api/src/{services/storage.service.ts,scripts/seed-dashboard-telemetry.ts,templates/{PoliceVerificationPdf,StatementPdf}.tsx}` + **2 hunks** of `notifications/page.tsx` |
| **C4** | `feat(web)`    | everything else under `apps/web/src`                                     | 137 paths: 82 admin pages, 3 auth/landing pages, 13 `components/admin`, 37 `components/ui`, `ErrorBoundary`, `lib/notificationLinks.ts`, untracked `QuickBedAssignModal`, `QuickResolveModal`, `RecordPaymentModal`, `ComplaintCategoryMatrix`, `MealFeedbackLedger`                                                  |
| **C1** | `chore(lint)`  | ESLint -> oxlint + `@shadcn/lint`                                        | root `package.json` (lint hunks only), `.oxlintrc.json`, `apps/web/package.json`, deleted `eslint.config.mjs` + `apps/web/eslint.config.mjs`, lint-gate docs in `.claude/rules/` + `.sixthrules/workflows/`, `AGENTS.md`                                                                                              |
| **C5** | `feat(mobile)` | resident portal                                                          | `mobile/**` (12 files) -- **must be atomic**: `app_router.dart` imports untracked `my_room_screen.dart`; profile/complaints need `image_picker`/`file_picker` in `pubspec.yaml` + iOS `Info.plist` strings                                                                                                            |
| **C6** | `docs`         | audits + agent docs                                                      | `docs/**` (10 M / 6 D / 6 ??), `apps/web/{AGENTS,CLAUDE}.md`, both `codebase-index.md` mirrors, `docs/TYPESCRIPT7.md`                                                                                                                                                                                                 |

**Hard constraints:** `C2 < C4`, `C3 < C4`, `C1 after C4`, `C5` atomic, `C6` last.

Why C1 is last: `.oxlintrc.json` turns `shadcn/no-raw-colors`, `no-arbitrary-values`, `no-inline-styles`, `no-restyle`, `require-static-classes`, `no-unknown-classes` into **errors for `apps/web/src/app/**`**, and HEAD pages still contain `text-emerald-600`, `text-[color:var(--x)]`, `text-[11px]`. No file-level assignment fixes this -- only ordering. 78 of 131 changed web files are lint-conversion-only; **50 are mixed** (token conversion + feature in one file).

### 2.2 The two required hunk splits

**1. `package.json`** -- two disjoint hunks, plain `y/n`:

- `+ "seed:dashboard"` -> **C3**
- eslint deps removed / `@shadcn/lint` added / `oxlint` 1.78 -> 1.85 / `typescript-eslint` removed -> **C1**

**2. `apps/web/src/app/(admin)/notifications/page.tsx`** -- this is the one thing that breaks `bun run typecheck` if mishandled:

- `packages/types/src/notification.ts` adds `'kyc_uploaded'` to `INotificationType`.
- `apps/api/src/routes/tenants.ts:1071` emits `type: 'kyc_uploaded'` (needs the union), and `apps/api/src/services/notification.service.ts:25` types it.
- `apps/web/.../notifications/page.tsx` has `const typeIconsMap: Record<INotificationType, ReactNode>` -- missing key = TS error **at any commit where the union is in but the map line is not**.
- **Resolution (D1, option A):** in C3 stage only 2 hunks of that file -- the `FileCheck` import hunk and the `typeIconsMap` hunk. Leave the `size="compact"` hunks for C4 (they need `Select.tsx` from C4 and `fieldControlCompact` from C2). No other file has this collision (`Record<INotificationType` exists in exactly one file).

Also atomic with C3: `apps/web/src/lib/notificationLinks.ts` is C4 and its importers (`NotificationBell.tsx:20`, `notifications/[id]/page.tsx:22`) are C4 -- fine, C4 follows C3.

### 2.3 Fix before staging C3

`apps/api/src/models/notification.ts` carries a formatting defect introduced in this diff:

```
-    },
-    type:
+    },      type: {
```

Run `bun run format` (or hand-fix) before staging, otherwise `format:check` fails from C3 onward.

### 2.4 Verification per commit

1. Before starting: `bun install` (required -- `.oxlintrc.json` adds `jsPlugins: ["@shadcn/lint"]` and oxlint aborts if unresolved), then baseline `bun run typecheck`, `bun run lint`, `bun run test`.
2. After each commit: `git worktree add /tmp/pg-cN <sha>` and run `typecheck` + `lint` inside it. `bun run test` only for C3 (API changes).
3. Final tree: full gates + `cd mobile && flutter analyze`.
4. Commit messages follow Conventional Commits v1.0.0 (verified source: conventionalcommits.org/en/v1.0.0/).

**Notes:** `bun.lock` stays ignored for now (see Phase 4); there is no lockfile to stage. Deletions pair up: `floors.md` folded into `tenants-rooms_audit_pass1_20260908-192930.md`, 5 old timestamped audit MDs superseded by newer `*_20260908-2*` files, both `eslint.config.mjs` superseded by `.oxlintrc.json`.

---

## 3. Phase 2 -- 98 warnings to zero (D2)

### 3.1 Workstreams

| WS   | Target                        | Technique                                                                                          | Source                                 |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| WS-1 | 78 `set-state-in-effect`      | TanStack Query `useQuery` + shared typed hooks over existing `ky` `api`                            | tanstack.com/query docs                |
| WS-2 | 10 `next(no-img-element)`     | `<img>` -> `next/image` with correct sizing/domain config                                          | Next.js docs                           |
| WS-3 | 5 `react-hook-form` `watch()` | `watch()` -> `useWatch({ control })` (memoizable)                                                  | react-hook-form docs                   |
| WS-4 | 3 `purity`                    | hoist `Date.now()` out of render (compute at event/init or via `useMemo` on a stable input)        | react.dev You Might Not Need an Effect |
| WS-5 | 1 `refs`                      | `useUnsavedGuard.ts:13` -- stop reading refs during render                                         | react.dev                              |
| WS-6 | 1 `immutability`              | `notices/[id]:59` -- `resolveTargetNames` read during its own initialization; reorder declarations | react.dev                              |

### 3.2 WS-1 shape breakdown (all 78 sites inventoried)

| Shape                                                                                                     | Count | Fix                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** loading flag + `api.get` + `setState` (57; A1 `useCallback`+effect-invoked 44, A2 inline effect 13) | 57    | `useQuery({ queryKey, queryFn: () => api.get(...).json<T>().then(r => r.data) })`; loading/error from query state; `queryKey` includes page/search/filter |
| **B** modal/prop-driven reset (`useEffect(..., [target])`)                                                | 5     | reset during render (adjust-state pattern) or remount via `key={target.id}`                                                                               |
| **C** derived state computed in an effect                                                                 | 5     | calculate during render or `useMemo`                                                                                                                      |
| **D** URL/search-param -> state sync                                                                      | 5     | keep effect but move the set to the event/router path, or read params via `useSearchParams` without mirroring                                             |
| **E** mount/hydration flag                                                                                | 3     | `useSyncExternalStore` / suppress hydration mismatch properly                                                                                             |
| **F** external-store sync (zustand -> local)                                                              | 1     | subscribe directly (`useSyncExternalStore`)                                                                                                               |
| **G** prop -> state re-init                                                                               | 2     | derive during render with prev-prop comparison                                                                                                            |

Shape A is 73% of the work and is the TanStack migration. Shapes B-G (21 sites) are **not** fixed by TanStack -- they need the react.dev patterns.

**Anchor sites (highest count):** `invoices/` 8, `attendance/` 6, `payments/` 6, `menus/` 3, `rooms/` 3, `tenants/` 3, then 2 each across 11 modules. Non-page: `components/admin/` 8, `components/ui/` 8, `hooks/useTheme.ts:48`, `app/login/page.tsx:71`.

### 3.3 Sequence

1. **WS-1a infrastructure:** review `QueryClient` config (60s staleTime is wrong for list pages that mutate), define query-key conventions, add typed hooks (`useResourceQuery`) wrapping `api` + `parseApiError`. Keep auth in zustand.
2. **WS-1b tranches:** detail `[id]` pages -> list pages -> `new`/`edit` -> components/modals. Measure warning count after each tranche.
3. **WS-2..WS-6** in parallel once WS-1b is >50% (they are independent files).
4. **Gate:** `bun run lint` prints `Found 0 warnings and 0 errors`; `bun run typecheck` green; `bun run test` 79/79; `bun run test:e2e` green locally; `flutter analyze` clean.
5. Only then enforce zero tolerance in CI (see 4.2).

**Watch-out:** `useApiLoadingStore` global loading bar is driven by `api.ts` Proxy, not by component state. Query migration must not double-count or orphan that counter.

---

## 4. Phase 3 -- Per-module depth audit and rebuild (D3, D4)

### 4.1 Restore the audit pipeline first

The pipeline passes **vacuously**: 0 of 31 feature MDs contain the literal `## Open gaps` / `## Closed` headings the scripts key on, so `normalize` moves 0 rows, `build` emits placeholder rows, `lint` has nothing to check. Verified live: `python3 scripts/audit/lint-gap-sections.py` -> `TOTAL FAIL: 0`, exit 0, on zero input.

**Required structure** (per `scripts/audit/*.py`):

- `## Open gaps` -- table rows `| ID | Severity | Gap | Paths |` or `| ID | Gap | Paths |`
- `## Closed` (or `## Closed / do-not-refile`) -- appended before `## Acceptance` / `## Remediation` / EOF
- Row IDs must match `[A-Z][A-Z0-9][A-Z0-9_\-/]*` (e.g. `ELEC-P1-1`, `FL-1`); no `FIXED|CLOSED|DONE` tokens inside Open gaps; no duplicate open-vs-closed IDs
- `docs/audit/LIVE_GAP_INVENTORY.md` markers already present: `AUTO:OPEN-P1` (91/97), `AUTO:RECENTLY-CLOSED` (78/84)

**Commands, in order, from repo root:**

```
python3 scripts/audit/normalize-gap-sections.py
python3 scripts/audit/build-live-gap-tables.py
python3 scripts/audit/lint-gap-sections.py     # must print TOTAL FAIL: 0
python3 scripts/audit/reconcile-open-gaps.py   # must PASS
```

**Also repair the doc graph** (dangling refs to deleted files, verified):

| Referring file:line                                           | Missing target                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `docs/audit/README.md:47`                                     | `features/floors.md` (deleted)                                       |
| `docs/audit/LIVE_GAP_INVENTORY.md:53`                         | `features/floors.md` (deleted)                                       |
| `docs/audit/features/dashboard.md:7`                          | `dashboard_audit_pass1_20260908-204500.md` (actual: `...-214800.md`) |
| `docs/audit/interconnections/tenant-lifecycle.md:59`          | `tenants_audit_pass1_20260907-230647.md` (deleted)                   |
| `docs/audit/interconnections/occupancy-bed-consistency.md:54` | same                                                                 |
| `floors_audit_pass1_20260908-235500.md:6`                     | `features/floors.md` (deleted)                                       |
| `theme-system-x-dashboard-cards_...-234500.md:6`              | `...-232244.md` (never existed)                                      |

Structural gaps to close: `floors` has no base feature doc (only the pass1 file, which self-declares `Supersedes`); `rooms` has no module-scoped pass1 (folded into `tenants-rooms_...-192930.md`).

### 4.2 Depth-audit method (per module)

For each of the 24 admin modules:

1. **Inventory** -- pages (list/detail/new/edit), line counts, API route, types file, existing audit doc.
2. **Signals** -- for each page: line count, `useEffect` count, error state, empty state, loading state, distinct cross-module links, charts/derived metrics, shared-component usage (`DataTable`/`FormPage`/`DetailCard`). Score = 100 - depth (formula in exploration output).
3. **Depth verdict** -- write `## Open gaps` rows for: pages with no error handling, no empty state, zero cross-links, boilerplate-only loading, hand-rolled markup where the shared stack exists, stub/redirect pages.
4. **Redesign spec** -- what makes the page _smart_ (derived metrics, context, cross-links, visible state machine, real states) and _cohesive_ (theme tokens, shared components, one pattern).
5. **Implement**, then gates + smoke.
6. **Pipeline**: normalize -> build -> lint (must be 0) -> reconcile (must PASS).

### 4.3 Baseline findings already collected (start here)

**Stub:** `notifications/new/page.tsx` is **18 lines** -- only `router.replace('/notifications?tab=compose')`. Score 98.2 shallow. Either delete the route or promote to a real compose page.

**Hand-rolled, outside the shared stack (4):** `settings` 1,371 lines, `invoices/new` 784, `export` 442 (`nav=0`, dead end), `dashboard` 1,154 (legitimate widget surface, not a defect).

**Template-clone cohort (14)** -- near-identical metric signature (`ue=0..1, err=1 boilerplate, load=1..7, nav=1, xmod=0, viz=0, api=1..2`), scoring 55-64 shallow: `laundry/new` 155, `washing-machines/new` 166, `meals/new` 161, `enquiries/new` 186, `attendance/new` 230, `assets/new` 325, `guardians/new` 280, `laundry/edit` 201, `guardians/edit` 211, `leaves/new` 313, `washing-machines/edit` 235, `meals/edit` 249, `visitors/new` 363, `enquiries/edit` 295, `services/edit` 213, `complaints/edit` 321, `payments/edit` 377, `visitors/edit` 414, `notices/new` 242, `leaves/edit` 334, `invoices/edit` 443, `menus/new` 310, `electricity/new` 469, `rooms/new` 405, `complaints/new` 428, `rooms/edit` 430, `assets/edit` 463, `tenants/new` 583, `notices/edit` 278, `attendance/edit` 332, `notifications/edit` 328, `menus/edit` 340, `services/new` 237, `tenants/edit` 712, `floors/new` 454.

**Cross-linking gap:** 68 of 84 pages have **zero** cross-module links. `audit-logs` and `export` have `nav=0` (dead ends).

**Deepest pages (do not regress):** `tenants/[id]` (1,172 lines, 12 API calls, 67 shared tokens, 4 cross-links), `invoices/list` (982, 12 API calls), `complaints/list` (1,091), `floors/edit` (794), `dashboard` (1,154).

### 4.4 Rebuild queue (D4: shared shell first, then money order)

| Step | Work                                                                                                                          | Rationale                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 3.1  | Extract `CrudFormPage` covering the 14-clone cohort (shared loading/error/empty/cross-link/dirty-state scaffold)              | root-cause fix; one abstraction retires ~25 pages |
| 3.2  | `notifications/new` stub -- delete or build                                                                                   | most shallow page in repo                         |
| 3.3  | **payments** (money 1,250 / occ 317)                                                                                          | rank 1                                            |
| 3.4  | **invoices** (1,095 / 264) -- includes hand-rolled `invoices/new` 784                                                         | rank 2                                            |
| 3.5  | **tenants** (484 / 778)                                                                                                       | rank 3                                            |
| 3.6  | **electricity** (825 / 135)                                                                                                   | rank 4                                            |
| 3.7  | **rooms** (104 / 441)                                                                                                         | rank 5                                            |
| 3.8  | **attendance** (10 / 265)                                                                                                     | rank 6                                            |
| 3.9  | **dashboard** (139 / 125)                                                                                                     | rank 7                                            |
| 3.10 | floors (pilot audit already written) + complaints, guardians, leaves                                                          | rank 9-12                                         |
| 3.11 | visitors, laundry, enquiries, washing-machines, settings, notifications, notices, assets, export, audit-logs, services, menus | remainder                                         |

**Money/occupancy ranking source:** keyword evidence summed across each module's `page.tsx` set plus its API route file (exploration table).

### 4.5 Flutter parity (decide intent before rebuilding)

Admin UI with **no resident screen**: `enquiries`, `floors`, `menus` (folded into meals), `rooms` (self only), `audit-logs`, `export`, `settings`, `assets` (documented as no-portal-surface), `dashboard` (partial: 12 hard-coded tiles in `home_screen.dart`, no charts).

Before rebuilding any of these, confirm whether a resident surface is intended -- otherwise the depth audit will keep flagging parity gaps that are deliberate.

---

## 5. Phase 4 -- Harden on Render + full CI (D5, D6)

### 5.1 Environment reconciliation

**13 `sync:false` vars that must be set manually in the Render dashboard** (missing = silent failure, verified against `env.ts`):

| Var                                                  | If unset                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                        | **boot throws** (`env.ts:59` at import) -> process never starts                                      |
| `NEXT_PUBLIC_API_URL`                                | **inlined at `next build`** -> bundle hardcodes `http://localhost:8000/api/v1`, build still succeeds |
| `FRONTEND_URL`                                       | admin CORS + password-reset links default to localhost in prod                                       |
| `PORTAL_URL`                                         | Flutter Web origin blocked on every browser request in prod                                          |
| `CORS_EXTRA_ORIGINS`                                 | optional extra origins                                                                               |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | boot with `demo` creds -> uploads fail at runtime                                                    |
| `RESEND_API_KEY`                                     | email silently fails                                                                                 |
| `ADMIN_EMAIL` / `_PASSWORD` / `_NAME` / `_PHONE`     | seed admin uses `Admin1234!` etc. -- **prod security hole**                                          |

**Doc gaps to close in `.env.example` files:** `RATE_LIMIT_ENABLED_IN_DEV`, `PG_TIMEZONE` missing from `apps/api/.env.example`; `NEXT_PUBLIC_PG_PHONE` and `NEXT_PUBLIC_TENANT_APP_URL` used in code but documented nowhere; `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` documented but **dead** (0 code refs). `apps/web/.env.example` is **gitignored** (`.gitignore:34`) so it never reaches CI or a clean clone -- un-ignore or move the doc.

### 5.2 CI changes (D5)

Current jobs: `typecheck`, `lint`, `test-api` (mongo:7), `build-web`, `build-api`, `e2e`. Triggers: push/PR to `main`.

| Change         | From                                                                                                                                                                                            | To                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Lockfile       | `bun.lock` gitignored, CI runs `--frozen-lockfile` on a fresh checkout                                                                                                                          | commit `bun.lock`, drop it from `.gitignore:37`                                                                             |
| Bun version    | `bun-version: latest` (5 jobs)                                                                                                                                                                  | pin to `.bun-version` = `1.3.0`                                                                                             |
| Lint gate      | `bun run lint \|\| bun run format:check` (lint failure falls through to prettier; prettier never runs when lint passes)                                                                         | two separate steps, both fail the job                                                                                       |
| Flutter        | absent                                                                                                                                                                                          | add `flutter analyze` job (AGENTS.md definition of done #2)                                                                 |
| e2e            | job has no `next build` and no artifact sharing, but `webServer` runs `next start` (needs `.next`) -> all specs fail; also installs chromium only while config declares chromium/firefox/webkit | build in-job (or upload/download artifact from `build-web`), restrict projects to chromium in CI, add `NEXT_PUBLIC_API_URL` |
| Zero tolerance | n/a                                                                                                                                                                                             | after Phase 2: `bun run lint` must print 0 warnings                                                                         |

### 5.3 Deployment facts and doc drift

- `render.yaml`: `pg-api` (bun, `healthCheckPath: /api/v1/health`) + `pg-web` (bun, `next start` on `.next`). **No `previews:` key** (D6: skipping).
- Health endpoint `apps/api/src/index.ts:73-86` returns 200/503 based on `mongoose.connection.readyState === 1` -- **state only, no ping round-trip**. A transient Mongo blip -> 503 -> Render deploy failure. `Bun.serve` listens before `connectDatabase()` completes, so early probes return 503.
- SSE: heartbeat every **30s** (`sse.ts:104-111`) vs Bun `idleTimeout: 120s` (`index.ts:135`) -> healthy streams survive. Cleanup on abort is implemented; no server-side max-client cap or per-client TTL; **JWT travels in the query string** (`sse.ts:16`, `useSSE.ts:35`) -> lands in access logs. Flag for a later hardening item.
- Build risks: API bundle does **not** use `--packages=external` (mongoose/@react-pdf/renderer get inlined); dev-only dynamic `await import('mongodb-memory-server')` must resolve at bundle time; `next.config.ts` has `typescript.ignoreBuildErrors: true`.
- **Doc drift to fix:** `deployment-verification.md:34,63` still describes a static `apps/web/out` export and a `staticPublishPath` that do not exist (`render.yaml:46-48` comment contradicts it); `:21` points at the gitignored `apps/web/.env.example`; `PORTAL_CONNECTIVITY.md:102` says prod allows only `FRONTEND_URL`/`PORTAL_URL`/`CORS_EXTRA_ORIGINS`, but `cors-origins.ts:42-47` also hardcodes localhost:3000/5173/8080, 127.0.0.1:3000/8080, `capacitor://localhost`.

---

## 6. Cross-cutting rules

- Portal boundaries: admin = `apps/web` (admin only), residents = `mobile/` (Web + iOS + Android). No tenant/guardian App Router routes.
- No direct imports of `apps/api` from web or Flutter -- HTTP only.
- ASCII only, no emojis anywhere.
- `bun run typecheck` + `bun run lint` green for every JS commit; `bun run test` after API changes; `flutter analyze` for Flutter changes.
- Kebab-case files/dirs; TS strict, no `any`; shared DTOs in `packages/types` first.
- Update `docs/AGENT_CONTEXT.md`, `docs/PORTAL_CONNECTIVITY.md`, `.sixthrules/workflows/codebase-index.md` (+ `.claude/rules` mirror) when structure, CORS, or env changes.
- Log the four Gate R picks in `pm/DECISIONS.md`.

## 7. Definition of done

1. Working tree committed as 6 atomic Conventional Commits, each individually verifiable in a temp worktree.
2. `bun run lint` -> **0 warnings, 0 errors**; `bun run typecheck`, `bun run test`, `flutter analyze` green.
3. CI: lockfile committed, bun pinned, lint/format/flutter/e2e all actually gating.
4. Every `docs/audit/features/*.md` has real `## Open gaps` / `## Closed` sections; pipeline reports non-vacuous results with `TOTAL FAIL: 0` and reconcile PASS.
5. `CrudFormPage` extracted; queue 3.2-3.9 modules rebuilt to the depth standard with no regression on the deepest pages.
6. 13 Render `sync:false` vars verified in dashboard; env examples complete; doc drift resolved.
7. Connectivity and agent docs updated; no emojis.

## 8. Risks

| Risk                                                                          | Mitigation                                                                                           |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Intermediate commit turns out red despite worktree verification               | re-stage at hunk level; never rewrite published history (push only after all 6 verify)               |
| Query migration changes list-page behavior (pagination, filters, stale reads) | tranche-by-tranche with e2e + manual smoke; keep `staleTime` explicit per resource                   |
| `CrudFormPage` abstraction fights edge-case forms (invoices/new, electricity) | extract only from the 14 proven clones; hand-rolled pages stay hand-rolled until explicitly migrated |
| Health 503 on Mongo blip fails a Render deploy                                | Phase 4 candidate: readiness vs liveness split (flag, do not silently change)                        |
| `node_modules` disappeared mid-session                                        | always `bun install` before gates; investigate, do not assume                                        |
