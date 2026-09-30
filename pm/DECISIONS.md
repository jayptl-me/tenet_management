# Decision Register

Gate R / Gate P decisions for this project. Numbering is independent per project (see root `AGENTS.md` Two-Gate Law). ASCII only, no emojis.

Format: `DR-<n>` -- date, decision, options considered, pick, sources.

---

## DR-1 -- 2026-09-29 -- How to land the 219 dirty paths

**Context:** 3 weeks of uncommitted work (200 files, +13.4k/-6.6k) mixing a lint-tooling migration, a dark-variant theme fix, and genuine feature work.

**Options (Gate R):**

- A. Atomic Conventional Commits via `git add -p`, one push
- B. Stacked PRs (Graphite-style)
- C. Squash-ship now, adopt trunk-based discipline later
- D. Worktree quarantine, two slices (cross-cutting vs local)

**Picked:** A -- Atomic Conventional Commits.

**Follow-on (2026-09-29):** exploration forced a refinement -- commit order becomes theme -> api -> web -> **lint last** -> mobile -> docs, with exactly 2 files requiring hunk-level splits (`package.json`, `notifications/page.tsx`). Picked "reorder + hunk-split".

**Sources:** conventionalcommits.org/en/v1.0.0/ (verified), git-scm.com/docs/git-add (verified), graphite.dev/docs (verified), docs.github.com about-pull-requests (verified), trunkbaseddevelopment.com (verified), git-scm.com/docs/git-worktree (verified).

---

## DR-2 -- 2026-09-29 -- How to clear the 98 lint warnings

**Context:** 78 `react(set-state-in-effect)`, 10 `next(no-img-element)`, 5 `react-hook-form` `watch()`, 3 purity, 1 refs, 1 immutability. `@tanstack/react-query` v5.62 already installed with `QueryClientProvider` wired but only 1 consumer.

**Options (Gate R):**

- A. Adopt TanStack Query for the fetch patterns
- B. Pure React refactor, no new deps
- C. Enable React Compiler
- D. Ratchet a warning budget

**Picked:** A -- Adopt TanStack Query.

**Follow-on (2026-09-29):** scope set to **all 98 to zero** (TanStack covers the 78; `next/image`, `useWatch`, purity, refs, immutability handled by their own workstreams).

**Sources:** tanstack.com/query/latest docs (verified), react.dev/learn/you-might-not-need-an-effect (verified, fetched in full), react.dev/reference/react/useSyncExternalStore (verified), react.dev/learn/react-compiler (verified), eslint-plugin-react-hooks README rule table (verified), oxc.rs linter docs (verified).

---

## DR-3 -- 2026-09-29 -- Next development priority

**Context:** open P0 = 0, open P1 = 0, remaining work is P2 polish across 24 admin modules.

**Options (Gate R):** A. P2 polish sweep | B. Flutter portal depth | C. Finance + compliance | D. Hardening pass.

**Picked (Jay, free text):** none of the four as written -- _"each page being shallow and built for the sake of building, making each thing smarter and cohesive and working, research audit for each module and feature is the priority."_

**Restated and approved under Gate P:** a per-module audit-then-rebuild program -- audit what exists, identify scaffolding pages, redesign each to be smart (derived context, cross-links, visible state machine, real empty/loading/error states) and cohesive (theme tokens, shared components, one pattern), implement, gates green, next module.

**Method refinement (2026-09-29):** restore the audit pipeline's required `## Open gaps` / `## Closed` sections first (currently passes vacuously -- 0 files contain them), then extract a shared `CrudFormPage` for the 14 clone pages, then run modules in money order (payments, invoices, tenants, electricity, rooms, attendance, dashboard).

**Sources:** docs/audit/LIVE_GAP_INVENTORY.md, docs/audit/features/floors_audit_pass1_20260908-235500.md, scripts/audit/*.py, adda.io (verified), mygate.com (verified), nobroker.in (verified), zolostays.com (verified), stanzaliving.com (verified).

---

## DR-4 -- 2026-09-29 -- How to ship

**Context:** `render.yaml` = 2 `runtime: bun` services + external `MONGODB_URI`; SSE at `/sse/admin`; no Dockerfile in repo.

**Options (Gate R):**

- A. Harden Render (status quo + previews + gates)
- B. Split -- API on Render, admin on Vercel, Flutter Web on Firebase Hosting
- C. Fly.io full migration
- D. VPS + Coolify self-host

**Picked:** A -- Harden Render.

**Follow-on (2026-09-29):** two sub-decisions -- **full CI hardening** (commit `bun.lock`, pin bun 1.3.0, split the `lint || format:check` mask, add Flutter job, make e2e runnable) and **skip preview environments** (they need Render Pro at $25/mo, a `previews:` key render.yaml lacks, and `sync:false` vars are not copied into previews -- this repo has 13).

**Sources:** render.com/docs/native-runtimes (verified -- "JavaScript / TypeScript (supports both Node.js and Bun)"), render.com/docs/web-services (verified), render.com/pricing (verified -- Hobby $0, Pro $25, Scale $499), render.com/docs/preview-environments (verified), vercel.com/docs (verified), firebase.google.com/docs/hosting/quickstart (verified), fly.io/docs/reference/configuration (verified), fly.io/docs/about/pricing (verified), coolify.io/docs (verified).

---

## DR-5 -- 2026-09-30 -- notifications/new stub: keep, delete, or build

**Context:** plan 4.3 called it the shallowest page (18 lines, `router.replace('/notifications?tab=compose')`). Re-inspection shows a deliberate design: the page's own comment says the compose form lives in the Compose tab on `/notifications` and the redirect avoids dual compose entry points.

**Options (Gate R):** A. Keep redirect, close the gap as intentional | B. Delete the route (old links 404) | C. Build a standalone compose page (duplicates the tab).

**Picked (Jay, 2026-09-30):** A -- keep the redirect; the depth audit records it as intentional, no code change.

**Sources:** `apps/web/src/app/(admin)/notifications/new/page.tsx:7-15` (deliberate-redirect comment), `apps/web/src/app/(admin)/notifications/page.tsx:98-393` (working Compose tab), plan 4.3.

---

## DR-6 -- 2026-09-30 -- Intent for admin-only modules (Flutter parity)

**Context:** plan 4.5 listed admin modules with no resident screen and warned that without declared intent the depth audit keeps flagging deliberate parity gaps: enquiries, floors, menus, rooms (self only), audit-logs, export, settings, assets, dashboard (partial).

**Options (Gate R):** A. Admin-only is deliberate -- no parity flags, no Flutter scope added | B. Resident screens planned for named modules | C. Decide per module at each flag.

**Picked (Jay, 2026-09-30):** A -- admin-only is deliberate for that whole list; the audit must not flag missing resident screens for them; no Flutter work is added to this program.

**Sources:** plan 4.5 parity table; Jay's pick 2026-09-30.

---

## DR-7 -- 2026-09-30 -- Git landing cadence for Phases 2-4

**Context:** standing rule is commits/pushes only when Jay says so; the approved plan ends phases in verified states, and Phase 2 currently sits in 77 dirty paths.

**Options (Gate R):** A. Commit + push at each phase end (CI gates each phase) | B. Commit per phase, push only at the end | C. Leave uncommitted for Jay.

**Picked (Jay, 2026-09-30):** A -- one Conventional Commit per phase boundary, pushed immediately, CI verified per phase (same pattern as the Phase 1 push, run `36581880412`).

**Sources:** Jay's pick 2026-09-30; plan 2.4 and 5.2 (CI run `36581880412`); root profile version-control rule (owner-authorized here).

---

## DR-8 -- 2026-09-30 -- How Phase 4 Render dashboard verification happens

**Context:** plan 5.1 requires verifying 13 `sync:false` vars in the Render dashboard; unset `ADMIN_*` vars mean the seed admin password falls back to `Admin1234!` in production. Dashboard writes are production and Jay-owned.

**Options (Gate R):** A. Agent prepares an exact checklist, Jay applies it in the dashboard | B. Read-only Render API token, agent diffs and proposes each write behind a typed gate line | C. Docs only this round.

**Picked (Jay, 2026-09-30):** A -- agent verifies code against docs and hands over var names, values, and ordering; Jay applies them. No production writes by the agent.

**Sources:** plan 5.1 env table (`apps/api/src/lib/env.ts`), Jay's pick 2026-09-30.
