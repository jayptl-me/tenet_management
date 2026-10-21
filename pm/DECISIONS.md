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

## DR-9 -- 2026-10-05 -- Agents never push (supersedes DR-7 for autonomous agents)

Jay's ruling (2026-10-05): OWNER.md rule 10 wins over DR-7 for every autonomous agent. The scheduled loop
(tenet-p3) commits only to its local branch `agent/tenet-p3` in its own worktree and never pushes; a pre-push hook
in the worktree refuses every push. Jay merges and pushes himself. DR-7's commit-and-push-at-phase-end still
describes what Jay does on `main`; it is not an instruction to agents.

---

## DR-10 -- 2026-10-21 -- What "rebuilt" means from now on (proposed, awaiting Jay's pick)

**Context:** the 2026-09-29 depth program graded component presence. It asked "does this page have a StatCard, an
EmptyState, a cross-link, a skeleton, a timeline" and marked the module WORKING when the answer was yes. Twenty-four
modules were rebuilt on that standard and the owner still reports the pages as badly laid out and the flows as
hollow. Evidence that the standard, not the execution, was the defect: `ResponsiveContainer.tsx` and
`KpiHeader.tsx` were written and never wired (0 importers); 27 pages carry the identical four-tile StatCard band;
`FormCard.tsx:61` sets a `sticky bottom-0` footer inside a card that is `overflow-hidden` at `:70`, so the Save
button scrolls away on all 35 FormCard pages; and the flows assert things the server never did
(`invoice.service.ts:160` creates invoices `sent` with no notification, `invoices/new/page.tsx:710` promises
"Draft status", `RecordPaymentModal.tsx:248-249` promises a credit the API hard-rejects at
`payments.ts:406`). Full analysis with file:line in `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md`.

**Options (Gate R):**

- A. Keep the component-presence standard and finish the queue 3.2-3.9 rebuilds on it.
- B. Replace it with a truth-and-flow standard: a module is rebuilt only when it passes a 20-check standard in
  three gates (TRUTH: server owns the numbers, receipts not toasts, notification on every state change, no control
  that does not act; FLOW: every status has an inbound trigger and a dwell, visible progression, next best action,
  URL is state, delivery chain ends in acknowledged; LAYOUT: one content frame, one archetype per module, one
  visual protagonist, primary action in view, one type scale) plus a per-module contract filled in before code.
- C. Freeze all module rebuilds until Phase 4 (CI and e2e) is done.
- D. Audit only the resident portal (Flutter), leave the admin panel as it is.

**Picked:** PROPOSED B -- awaiting Jay's pick (2026-10-21). Rationale: the complaint is about the standard's blind
spot, not about execution effort; A and C both leave the product hollow, D ignores the surface the complaint names.
B is also the only option that makes the existing audits falsifiable -- the contract fields resolve to live routes,
so a module that cannot fill them is reported hollow automatically.

**PICKED BY JAY (2026-10-21):** B. Jay's instruction: "you research, plan and fix everything ... keep pushing and
working on production grade fixes and creation or deletions". DR-10, DR-11 and DR-12 are therefore live as options B.
Execution runs on the branch `agent/tenet-depth`; the agent never pushes (DR-9), Jay merges.
Plan of record: `docs/plans/2026-10-21-depth-program.md`.

**Sources:** `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` sections 1-4; `apps/web/src/components/ui/FormCard.tsx:61,70`;
`apps/web/src/app/(admin)/layout.tsx:153`; `apps/web/src/components/ui/FormPage.tsx:27-33,71,109`;
`apps/web/src/components/ui/ResponsiveContainer.tsx` and `KpiHeader.tsx` (0 importers, measured);
`apps/api/src/services/invoice.service.ts:160`; `apps/web/src/app/(admin)/invoices/new/page.tsx:710`;
`apps/web/src/components/admin/RecordPaymentModal.tsx:248-249`; `apps/api/src/routes/payments.ts:406`.

---

## DR-11 -- 2026-10-21 -- Truth rules for money and state changes (proposed, awaiting Jay's pick)

**Context:** the money path lies in three places and the state-change path is silent in four. The record-payment form
computes the balance locally as `totalAmount - (paidAmount ?? 0)` (`payments/new/page.tsx:204,209-212`) because
`GET /invoices` returns lean invoices with no `paidAmount` or `balance` field
(`apps/api/src/routes/invoices.ts:109-134`; `apps/api/src/models/invoice.ts:21` has neither), so a partly paid
invoice shows the full total, pre-fills it, and is rejected with `AMOUNT_EXCEEDS_BALANCE`
(`apps/api/src/routes/payments.ts:406`). The resident invoice list shows gross totals while the detail shows the true
balance (`mobile/.../invoices_screen.dart:48-53` vs `apps/api/src/routes/invoices.ts:492-504`). Payment verify,
KYC verify, leave decisions and invoice creation write no notification
(`payments.ts:1054-1119`, `tenants.ts:1185-1200`, `leaves.ts:569,624`, `invoice.service.ts:151-173`), although
`createNotification` already exists and is used in ten other places.

**Options (Gate R):**

- A. Fix the copy only: correct the three strings and leave the numbers computed client-side.
- B. Server owns the truth: money fields on the API, a server-issued receipt on every mutating response (id, actor,
  server timestamp, before/after read from the database), no optimistic success paint, a notification on every
  state change a human is waiting on, and delete controls whose endpoint does not exist.
- C. Add a resident-facing receipt card in the portal too (B plus a visible artifact for the tenant).
- D. Leave the money path alone until Phase 4.

**Picked:** PROPOSED B, with C as a later wave -- awaiting Jay's pick (2026-10-21). Rationale: A leaves the wrong
number on screen, which is the thing that costs money and the thing the resident sees; D defers the only defect in
the product that is visible from outside. C is the same mechanism surfaced in the portal and is worth doing once B
exists.

**PICKED BY JAY (2026-10-21):** B now, C in the wave after B lands (the portal receipt card needs the server receipt
to exist first).

**Corrected by review (2026-10-21):** B does NOT need new API surface for the admin form. The record-payment page
already fetches `GET /tenants/:id/dues` (`payments/new/page.tsx:154`), already types
`unpaidInvoices[].remaining` (`:79-88`) and already renders the server-computed `totalDue` (`:342-347`); only the
pre-fill at `:204,210-211` re-derives the balance from the lean list. The fix is to use the value already on the
screen. New fields are still needed on the resident-facing list (`GET /invoices/my` returns lean invoices), and the
phantom `paidAmount` select at `apps/api/src/routes/tenants.ts:1832` should go. A receipt renderer already exists
(`apps/web/src/components/admin/ReceiptDocument.tsx:32-46`, rendered at `payments/[id]/page.tsx:705`) - B promotes it
rather than building one.

**Sources:** `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` section 3 (F1, F2, F3, F4, F11, F12) and Gate A;
`apps/web/src/app/(admin)/payments/new/page.tsx:79-88,154,204,210-211,342-347`;
`apps/api/src/routes/invoices.ts:109-134,206-218,492-504`; `apps/api/src/models/invoice.ts:8-24,21`;
`apps/api/src/routes/payments.ts:406,572-575,1054-1119`; `apps/api/src/routes/tenants.ts:1185-1200,1723,1743-1782,1832`;
`apps/api/src/services/invoice.service.ts:151-173`; `apps/api/src/routes/notifications.ts` and the eleven existing
`createNotification` call sites; `apps/web/src/components/admin/ReceiptDocument.tsx:32-46`.

---

## DR-12 -- 2026-10-21 -- One spine: shared lifecycle vocabulary, URL as state, one layout archetype (proposed, awaiting Jay's pick)

**Context:** 84 admin pages share one template, so no module has an identity and a cropped Tenants table is
interchangeable with a cropped Assets table. Statuses that the API enforces (`enquiries.ts:68-80` guards a real FSM)
are rendered as bare badges. The dashboard's act-now buttons navigate to `/payments?status=`,
`/complaints?status=`, `/enquiries?status=`, `/tenants?search=` while those pages contain zero `useSearchParams`
calls, so triage lands on an unfiltered list. The resident's `StatusChip` maps none of the visitor statuses, so
`expected`, `arrived` and `departed` all render the same grey
(`mobile/lib/features/shared/widgets/portal_widgets.dart`). Two layout components with exactly the frame the app
needs exist with zero importers.

**Options (Gate R):**

- A. Fix only the broken links: read the query params on the three list pages.
- B. One spine: a single `packages/types/src/lifecycle.ts` table (domain, status, allowed next, endpoint, actor) that
  the route guards read and that is **generated** for both clients (Dart cannot import TypeScript, so without a codegen
  step "one stepper" silently becomes two, which is the failure mode this decision exists to kill); `useUrlState` so
  filter, sort, tab and step live in the address bar; one content frame at the shell with an optional context rail;
  one declared archetype per module with a screenshot-confusion test; one module-exclusive number on each top band.
- C. Redesign the admin shell from scratch on a new layout kit.
- D. Keep the current layout and invest only in the portal.

**Picked:** PROPOSED B -- awaiting Jay's pick (2026-10-21). Rationale: A is a 4-file fix that removes the worst lie
(the dead triage links) but leaves the sameness; C replaces working, token-clean components and the dead-code fix is
already in the repo (`ResponsiveContainer.tsx`); D ignores the named surface. B is the smallest change that makes the
modules distinguishable and the states legible, and it makes the tablet/phone width behave.

**PICKED BY JAY (2026-10-21):** B, with the codegen requirement from the review kept in scope - one vocabulary,
generated for both clients, or the portal gets a second stepper and the fix fails.

**Corrected by review (2026-10-21):** the shared vocabulary must be generated, not hand-written twice, and the portal
needs its shared status map fixed first: `mobile/lib/features/shared/widgets/portal_widgets.dart:144-175` omits
`expected`, `arrived`, `departed`, `open`, `new` and `draft`, so every one of those domain states renders neutral grey
on every portal screen that shows a status. One function, whole-portal blast radius.

**Sources:** `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` sections 2 and 3 (L1, L2, L5, F4, F5) and Gate B/C;
`apps/web/src/app/(admin)/{payments,enquiries,tenants,complaints}/page.tsx` (0 `useSearchParams` in the first three,
measured; `complaints/page.tsx:286-288` reads dates only);
`apps/web/src/components/admin/AttentionRequiredBanner.tsx:105,123,159`;
`apps/web/src/app/(admin)/dashboard/page.tsx:788,812`; `apps/api/src/routes/enquiries.ts:68-80`;
`apps/api/src/models/visitor.ts:56`; `mobile/lib/features/shared/widgets/portal_widgets.dart:32-33,144-175`;
`apps/web/src/components/ui/ResponsiveContainer.tsx`, `KpiHeader.tsx`, `StatusTabs.tsx`, `FilterChips.tsx` (2 users each).
