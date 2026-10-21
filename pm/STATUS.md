# Status Snapshot -- resume here

> Update this file every working turn. Top block = current state for a fresh agent with no chat history.
> Append-only log at the bottom. ASCII only, no emojis.

## Resume here (updated 2026-10-21, Phase 3 still open, program standard replaced)

**Program:** approved Gate P plan `docs/plans/2026-09-29-depth-implementation-plan.md` (4 phases), executed with sub-agents, research-verified direction per phase, no assumptions. Decisions DR-1..DR-9 in `pm/DECISIONS.md`.

**Newest input:** `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` -- strict flow and layout audit answering the owner's complaint ("pages are badly laid out, flows feel hollow"). Root causes RC1 (the truth gap: the UI asserts what the server never did), RC2 (the missing close: state changes never reach the resident), RC3 (the missing spine: 84 pages on one template, no module identity). It replaces component-presence auditing with a 20-check standard in three gates (TRUTH, FLOW, LAYOUT) plus a per-module contract, and a 7-wave rebuild program. It was fact-checked by an independent reviewer on 2026-10-21 ("request changes"); every correction is folded in and the corrections changed the plan (see the review notes in section 5 below). Proposed as DR-10..DR-12, awaiting Jay's pick.

| Phase | Progress          | State                                                                                                                                                                                                                                                                                                                                  |
| ----- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 100%              | Done. 6 atomic commits pushed 2026-09-29; CI run `36581880412` all green except e2e (known, fixed in Phase 4).                                                                                                                                                                                                                         |
| 2     | 100%              | Done 2026-09-30. Lint 98 -> 0 warnings; typecheck green; flutter analyze clean; test 79/79 on the box. Committed + pushed (DR-7); CI verified at phase boundary. e2e DEFERRED to Phase 4.                                                                                                                                              |
| 3     | in progress, ~25% | Step 4.1 audit pipeline DONE and green on a Linux box. CrudFormPage EXTRACTED, 3 pilot pages migrated, and the admin web now BUILDS on a box -- but that work is UNCOMMITTED and never verified in CI. The depth model it used (component presence) is superseded by the 2026-10-21 audit; do not keep rebuilding on the old standard. |
| 4     | ~10%              | Facts verified against .github/workflows/ci.yml (all plan 5.2 claims confirmed). Not started: bun.lock commit, bun pin, lint/format split, Flutter CI job, e2e fix, checkout bump, Render checklist (DR-8).                                                                                                                            |

**Working tree state 2026-10-21 (91 dirty paths, all unlanded):**

- `apps/web/src/components/ui/CrudFormPage.tsx` (274 lines, untracked) -- the shared CRUD form shell, built to `docs/plans/crud-form-page-design.md` (worker-written, still unreviewed).
- 3 pilot pages migrated onto it: `laundry/new`, `laundry/[id]/edit`, `washing-machines/new`. `PageShell.tsx` deleted (0 importers). `useUnsavedGuard` now navigates with `router.push` instead of `window.location.assign`.
- 65 audit feature docs given real `Open gaps` / `Closed` sections; new `docs/audit/features/floors.md` and `payments_depth_pass1_20260930.md` (the payments rebuild spec).
- New this session: `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md`; `scripts/audit/reconcile-open-gaps.py` and `scripts/audit/spotcheck-field-matrix.py` portability fix; `pm/STATUS.md`, `pm/DECISIONS.md` (DR-10..DR-12); codebase index and its `.claude/rules` mirror.
- `AGENTS.md` and root `CLAUDE.md` are excluded via `.git/info/exclude` and staged for deletion; `apps/web/CLAUDE.md` deleted.

**Compute policy (changed 2026-10-21, Jay's typed instruction):** the Mac no longer runs any compute -- no builds, tests, linters, typechecks, formatters or installs. Root rule file updated; the project's `AGENTS.md` carries one generic pointer and no box details. Every gate below was measured on a box.

**Gates measured 2026-10-21 on the boxes (no Mac compute):**

| Gate                                    | Where                          | Result                                                                                                                   |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `bun run lint`                          | mini-arm                       | **0 warnings, 0 errors**, 364 files, 143 rules, exit 0                                                                   |
| `bun run typecheck`                     | mini-arm                       | **green** for @pg/types, @pg/web, @pg/api                                                                                |
| `bun run format:check`                  | mini-arm                       | **RED, 61 files** (pre-existing debt; CI masks it with `lint \|\| format:check`, so CI stays green while this is broken) |
| audit pipeline `lint-gap-sections`      | mini-arm                       | **TOTAL FAIL: 0**                                                                                                        |
| audit pipeline `reconcile-open-gaps`    | mini-arm                       | **16/16 PASS** (after the portability fix below)                                                                         |
| audit pipeline `spotcheck-field-matrix` | mini-arm                       | **16/16 PASS**                                                                                                           |
| `bun --filter '@pg/api' build`          | mini-arm                       | **green** (1340 modules, 9.51 MB bundle)                                                                                 |
| `bun --filter '@pg/web' build`          | mini-arm                       | **green**, exit 0, all 84 admin routes compiled (Node 22.23.3 installed user-space on the box for this)                  |
| API test suite                          | compute-mini                   | **RUNNING** at the time of writing; last known good 79/79 on 2026-09-30, no `apps/api` source has changed since          |
| `flutter analyze`                       | not run                        | no `mobile/` file has changed since the 2026-09-30 clean run                                                             |
| `next build` prerender                  | covered by the web build above | green                                                                                                                    |

**CI on `main` (last run `36689730596`, 2026-09-30):** typecheck, lint, test-api, build-web, build-api all green; **e2e red** (known, Phase 4). Nothing has been pushed since 2026-09-30.

**Loop status:** branch `agent/tenet-p3` was seeded 2026-10-05 with a 12-unit queue (`pm/loops/tenet-p3/queue.json`, units T00-T11). **It never ran a single unit.** Its worktree is gone and the loop infrastructure now points at other projects. Treat the queue as a plan, not as progress.

**Decisions (pm/DECISIONS.md):** DR-5 keep notifications/new redirect, gap closed as deliberate. DR-6 admin-only modules deliberately have no Flutter parity -- never flag them. DR-7 commit + push at each phase end, CI verified per phase. DR-8 agent prepares Render checklist, Jay applies -- no production writes by agent. DR-9 agents never push; they commit to their own branch and Jay merges.

**Next steps, in order:**

1. Jay's pick on DR-10..DR-12 (the new audit standard, the truth/receipt rules, the one-spine rule). Every wave below depends on it.
2. Land the in-flight Phase 3 work: this book is refreshed; run `prettier --write` over the repo as its own commit so the format gate stops being masked; then commit `CrudFormPage` + the 3 pilot pages + the audit docs + the pipeline portability fix to a branch for Jay to merge. Do not push (DR-9).
3. Wave 0 of the new program: rewrite the audit pipeline so it checks code rather than audit prose; write the contract template and its checker (scoped per module, with a known-baseline allowlist so it is not red from day one).
4. Wave 1 (truth on the money path): use the server balance the record-payment page already has (`payments/new/page.tsx:154,79-88,342-347`) instead of the local fallback at `:204,210-211`; promote the existing `ReceiptDocument.tsx` to the write path and clear the 11 `toast.success` sites; delete the "Draft status" and "Excess will be credited" copy; drop the phantom `paidAmount` select at `tenants.ts:1832`.
5. Wave 2 (close the loops): notify on invoice issued, payment verified/rejected/voided, leave decided, KYC verified; render the leave rejection reason in the portal; give the resident a dues view (one authorization flag over an existing computation).
6. Waves 3-6 (spine with codegen, frame and band removal, type cleanup, per-module depth rebuilds with contracts filled in) per `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` section 5.
7. Phase 4: CI hardening (see plan 5.2; also reconcile `.bun-version` 1.3.0 vs actual bun 1.4.2/1.4.3 everywhere), e2e runnable + green, Render checklist handed to Jay (DR-8), closure report.

**Watch-outs:**

- Worker output must be re-measured (Phase 2 migration introduced 9 new warnings once; caught by re-running lint).
- `docs/plans/crud-form-page-design.md` is worker-written and unreviewed.
- The 2026-09-29 depth program graded component presence. That is why the product feels hollow: the standard itself was the defect. Do not run more of it as written.
- The audit pipeline scripts police the audit documents, not the code. They stayed green while the flows stayed hollow. Do not treat pipeline green as product truth.
- e2e red in CI until Phase 4 fix -- expected, do not chase per-phase.
- Seed-admin defaults (`Admin1234!`) are a prod security hole until Jay applies the DR-8 checklist.
- The login page ships hardcoded demo credentials (`apps/web/src/app/login/page.tsx:301,309`). Known finding F10, not yet fixed.
- Before 2026-10-21 the pipeline gate could only run on the Mac: both audit scripts hardcoded a macOS temp path. Fixed and re-verified on a Linux box. Any other gate that "only worked locally" needs the same treatment.

---

## Log (append-only)

- 2026-09-29: Gate P approved; Phase 1 landed as 6 commits (theme, api, web, lint, mobile, docs) pushed; CI verified (e2e red as predicted); plan updated with run `36581880412` findings; Phase 2 started (TanStack `useApiQuery`/`lib/query` infra + page migrations, 77 paths dirty, stopped ~20:41).
- 2026-09-30 (morning): Resumed; measured lint 98 -> 10, typecheck green; found 9 new exhaustive-deps warnings from the Phase 2 migration (owned, reported). DR-5..DR-8 picked by Jay. Workers: (a) last 10 warnings -> fixed, root cause `?? []` fresh-array-per-render + watch() -> useWatch; main thread re-verified lint 0 / typecheck green; (b) audit pipeline -> 66/66 docs, verified with own script runs + severity cross-check (33 open = 10 P2 + 23 P3, zero P0/P1) + one row spot-checked against live code.
- 2026-09-30 (Phase 2 close): First-ever repo sync to compute-mini. Box test saga: 10/18 files failed -> diagnosed vitest running under Bun (no Node on box) breaking zod interop; installed Node v24.21.0 user-space on box; 78/79 -> last failure was a 30s timeout from 18-way Mongo contention (passes alone: 2.6s); final `--maxWorkers=2` run: 79/79 exit 0. Two of my ssh inline-quoting bugs (premature `$(ls .env)` expansion; `bunx --cwd`) caused false alarms -- no damage, lesson: scp script files, never inline substitutions. Phase 2 committed + pushed (DR-7), CI verified at boundary.
- 2026-10-21 (status read + strict audit): Read the books, the branch history, the loop queue and the CI runs, then re-measured the gates on the Mac (lint 0/0, typecheck green, audit pipeline 0 FAIL and 16/16 PASS, format:check red with 64 files). Found: nothing pushed since 2026-09-30; 87 dirty paths of finished Phase 3 work sitting unlanded; the tenet-p3 loop never ran; CI red only on e2e. Ran the strict flow and layout audit for the owner's complaint ("pages are shitty laid out and feature flows feel hollow"): five divergent audit frames plus two evidence sweeps, then I re-verified every load-bearing claim against source myself. Wrote `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` and refreshed this book. No product code changed. DR-10..DR-12 drafted and awaiting Jay's pick.
- 2026-10-21 (compute policy + independent review + box gates): Jay ruled "no compute on mac strictly, use arm mini and the compute mini, update rules with this". Updated the root rule file (rule 23 now forbids builds, tests, linters, typechecks, formatters, installs and background jobs on the Mac; rule 10 now says "a compute box"), added one generic pointer line to the project's `AGENTS.md` with no box names or paths, and removed the `node_modules` my earlier Mac install had created. Re-ran every gate on boxes: lint 0/0, typecheck green, format check red (61 files), audit pipeline green, api build green, web build green on the ARM box after installing Node 22.23.3 user-space there (the first attempt failed because that box has Node 18 and Next 16 needs 20.9+; the API test box was too small and too loaded to build concurrently). Found and fixed a real portability bug: `scripts/audit/reconcile-open-gaps.py` and `scripts/audit/spotcheck-field-matrix.py` hardcoded a macOS temp path, so the pipeline gate crashed on Linux and in CI; now portable and re-verified on the ARM box (16/16 both). The independent reviewer came back "request changes" on the audit: nine wrong numbers and several mislabelled citations (createNotification 11 not 10, the mobile StatusChip omits seven statuses not four, the four-tile band is 6 list + 9 detail, rail pages 7 not 4, FormPage default 2xl not 4xl, sidebar hidden below 1024px not above, 14 sub-10px text occurrences in 9 files, 25 hex lines, 19 mobile empty-state call sites). Two corrections changed the plan: the record-payment fix is one line because the page already has the server balance, and a receipt renderer already exists (`ReceiptDocument.tsx`); and "one shared stepper across admin and portal" needs codegen because Dart cannot import TypeScript, or it becomes two steppers. All corrections folded into the audit and into DR-11 and DR-12.
