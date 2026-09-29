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
