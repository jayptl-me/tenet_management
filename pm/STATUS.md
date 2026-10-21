# Status Snapshot -- resume here

> Update this file every working turn. Top block = current state for a fresh agent with no chat history.
> Append-only log at the bottom. ASCII only, no emojis.

## Resume here (updated 2026-10-21, Phase 3 still open, program standard replaced)

**Program:** approved Gate P plan `docs/plans/2026-09-29-depth-implementation-plan.md` (4 phases), executed with sub-agents, research-verified direction per phase, no assumptions. Decisions DR-1..DR-9 in `pm/DECISIONS.md`.

**Newest input:** `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` -- strict flow and layout audit answering the owner's complaint ("pages are badly laid out, flows feel hollow"). Root causes RC1 (the truth gap: the UI asserts what the server never did), RC2 (the missing close: state changes never reach the resident), RC3 (the missing spine: 84 pages on one template, no module identity). It replaces component-presence auditing with a 20-check standard in three gates (TRUTH, FLOW, LAYOUT) plus a per-module contract, and a 7-wave rebuild program. It was fact-checked by an independent reviewer on 2026-10-21 ("request changes"); every correction is folded in and the corrections changed the plan (see the review notes in section 5 below).

**LIVE (2026-10-21):** Jay picked DR-10 B, DR-11 B now and C after, DR-12 B, and instructed "you research, plan and fix everything ... keep pushing and working on production grade fixes and creation or deletions". Plan of record: `docs/plans/2026-10-21-depth-program.md`. Work happens on branch **`agent/tenet-depth`** (never pushed, DR-9; Jay merges). Six commits are on that branch: four baseline commits that protect the unlanded Phase 3 work, then the module contracts and their gate, then the shared lifecycle spine.

| Phase | Progress          | State                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 100%              | Done. 6 atomic commits pushed 2026-09-29; CI run `36581880412` all green except e2e (known, fixed in Phase 4).                                                                                                                                                                                                                                                                                             |
| 2     | 100%              | Done 2026-09-30. Lint 98 -> 0 warnings; typecheck green; flutter analyze clean; test 79/79 on the box. Committed + pushed (DR-7); CI verified at phase boundary. e2e DEFERRED to Phase 4.                                                                                                                                                                                                                  |
| 3     | in progress, ~45% | The old depth program is superseded. The new one is running: contracts + contract gate (landed), the shared lifecycle spine (landed), the money truth on the API and in the admin (in review-driven repair), the loop closures on the API (in flight), the resident portal truth (in flight), the dead affordances deleted (in flight), the status-write sweep (in flight), the content frame (in flight). |
| 4     | ~25%              | The lint job no longer hides a red format gate, and a contracts job now runs in CI. The bun pin, the committed lockfile, the Flutter CI job and a runnable e2e suite are being done now (in flight). Still owed: the Render checklist handover (DR-8).                                                                                                                                                     |

**Working tree state 2026-10-21 (~118 dirty paths; the in-flight units are deliberately uncommitted until their gates and reviews clear):**

- Landed on the branch: the baseline four, `feat(audit): module contracts and the contract gate`, `feat(spine): one status vocabulary for both clients`.
- In flight: the API money truth plus the reviewer-driven repairs, the API loop closures, the resident portal truth, the dead-affordance deletions, the status-write sweep across the other modules, the content frame, the CI hardening, and the repo-wide prettier pass.
- `AGENTS.md` and root `CLAUDE.md` are excluded via `.git/info/exclude` and staged for deletion; `apps/web/CLAUDE.md` deleted.

**Compute policy (changed 2026-10-21, Jay's typed instruction):** the Mac no longer runs any compute -- no builds, tests, linters, typechecks, formatters or installs. Root rule file updated; the project's `AGENTS.md` carries one generic pointer and no box details. Every gate below was measured on a box.

**Gates measured 2026-10-21 on the boxes (no Mac compute):**

| Gate                                    | Where        | Result                                                                                                                                                      |
| --------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                          | mini-arm     | **0 warnings, 0 errors** on the landed units; the in-flight sweep units still carry 1 warning and 3 errors (a Tailwind class the project does not know)     |
| `bun run typecheck`                     | mini-arm     | **green** for @pg/types, @pg/web, @pg/api on the landed units; red on the in-flight money helper signature until that unit lands                            |
| `bun run format:check`                  | mini-arm     | **RED** (pre-existing debt plus the new files). The CI mask that hid it is being removed, so this gate will be visible from now on                          |
| audit pipeline `lint-gap-sections`      | mini-arm     | **TOTAL FAIL: 0**                                                                                                                                           |
| audit pipeline `reconcile-open-gaps`    | mini-arm     | **16/16 PASS** (after the portability fix below)                                                                                                            |
| audit pipeline `spotcheck-field-matrix` | mini-arm     | **16/16 PASS**                                                                                                                                              |
| `bun --filter '@pg/api' build`          | mini-arm     | **green** (1340 modules, 9.51 MB bundle)                                                                                                                    |
| `bun --filter '@pg/web' build`          | mini-arm     | **green**, exit 0, all 84 admin routes compiled (Node 22.23.3 installed user-space on the box for this)                                                     |
| API test suite                          | mini-arm     | **19 files, 82 tests, exit 0** (the 3 new invoice-balance tests included)                                                                                   |
| `bun run check:contracts`               | mini-arm     | **0 failures, 0 known baselines** - the baseline that allowed the missing resident notification is deleted because the checker proved it is closed          |
| `bun run check:lifecycle`               | mini-arm     | **0 failures** - the generated Dart lifecycle matches the JSON, every status has a step and every endpoint exists                                           |
| `flutter analyze`                       | compute-mini | running against the new portal work                                                                                                                         |
| API suite on the x86 box                | compute-mini | **inconclusive**: 69/79, every failure a 30s timeout on a box at load 24. Environment limit, not a product failure - the same suite is 82/82 on the ARM box |

**Boxes (private, never in this repo):** the ARM box now has Node 22.23.3 in a user-space toolchain directory and an arm64 mongod cached, so the whole gate set runs there. Both boxes are shared and often at load 8-25, so gate runs are slow and timeouts must be read as environment noise until confirmed on a quiet box.

**CI on `main` (last run `36689730596`, 2026-09-30):** typecheck, lint, test-api, build-web, build-api all green; **e2e red** (known, Phase 4). Nothing has been pushed since 2026-09-30.

**Loop status:** branch `agent/tenet-p3` was seeded 2026-10-05 with a 12-unit queue (`pm/loops/tenet-p3/queue.json`, units T00-T11). **It never ran a single unit.** Its worktree is gone and the loop infrastructure now points at other projects. Treat the queue as a plan, not as progress.

**Decisions (pm/DECISIONS.md):** DR-5 keep notifications/new redirect, gap closed as deliberate. DR-6 admin-only modules deliberately have no Flutter parity -- never flag them. DR-7 commit + push at each phase end, CI verified per phase. DR-8 agent prepares Render checklist, Jay applies -- no production writes by agent. DR-9 agents never push; they commit to their own branch and Jay merges.

**Next steps, in order (live program, wave order in `docs/plans/2026-10-21-depth-program.md`):**

1. Wave 0, batch 1 (four parallel agents, each owning a disjoint file set): the contract type and its checker plus the CI mask removal; the repo-wide prettier pass; the API money truth (server-computed balances); the admin money UI (server balance, receipts instead of toasts, no copy that contradicts the API).
2. Gate the batch on the boxes (lint, typecheck, format, contracts, audit pipeline, build), review the money units with one independent plus one adversarial reviewer, commit atomically on `agent/tenet-depth`.
3. Wave 2, batch 2: notifications on every state change a human waits for (payment verify/reject/void, invoice issued, leave decided, KYC verified), the resident dues view, the portal status map fix, and the portal rendering the leave rejection reason.
4. Wave 3: one generated lifecycle vocabulary for both clients, the stepper per side, `useUrlState`, and the list pages reading their query parameters so the dashboard triage links land filtered.
5. Wave 4: the shell content frame with an optional rail, the sticky footer fixed, record actions pinned to the header, the four-tile band replaced, the first data row within 220px.
6. Wave 5: one type scale, no arbitrary font sizes, nothing below 10px, no pinned table columns.
7. Wave 6: the per-module depth rebuilds in money order, one module per commit, each with its contract filled in.
8. Phase 4 (still owed): CI hardening, the e2e suite runnable and green, the Render checklist handed to Jay (DR-8), closure report.

**Reviews on the money path (2026-10-21) -- why the money units are not merged yet:**

Two reviewers read the wave 1 money change. The independent one said "ship after fixes" and named
four blockers; the adversarial one said "request changes" and named twelve findings. Both were
right, and both caught things the gates did not:

- The receipt was dead code: the payment model deletes `_id` from its JSON (`apps/api/src/models/payment.ts:101-104`), so the client read a field that never exists and an admin collecting cash would have seen no receipt, no confirmation and no error. Found by the adversarial reviewer, confirmed by reading the model, fixed.
- The settled amount was capped at the invoice total, so an overpaid invoice showed "paid 12000, balance 0" while the ledger showed 24000 collected.
- The money helpers defaulted an unknown balance to zero, which means "settled" rather than "outstanding" - the wrong direction for money, and it let the checkout guard release a tenant who still owed.
- The write path had no idempotency, so a double click or two tabs could record the same cash twice.
- Editing an invoice rewrote a resident's pending UTR amount and never recomputed the invoice status, so the screen could say "partial" with a zero balance.
- Deleting an invoice could wipe the only record that a resident transferred money.
- The client still promised the server's outcome from a stale snapshot, and a late response could overwrite the amount the operator had typed.

All of these are being closed before the money units are committed. The lesson for the books: a green
gate set is not a review. Both reviewers read the code and found things no automated check did.

**Watch-outs:**

- Worker output must be re-measured (Phase 2 migration introduced 9 new warnings once; caught by re-running lint).
- `docs/plans/crud-form-page-design.md` is worker-written and unreviewed.
- The 2026-09-29 depth program graded component presence. That is why the product feels hollow: the standard itself was the defect. Do not run more of it as written.
- The audit pipeline scripts police the audit documents, not the code. They stayed green while the flows stayed hollow. Do not treat pipeline green as product truth.
- e2e red in CI until Phase 4 fix -- expected, do not chase per-phase.
- Seed-admin defaults (`Admin1234!`) are a prod security hole until Jay applies the DR-8 checklist.
- The login page shipped hardcoded demo credentials (`apps/web/src/app/login/page.tsx:301,309`). The button is deleted; the seed credentials themselves still exist server-side (`apps/api/src/lib/env.ts:33`, `apps/api/.env.example:13-14`) and are part of the DR-8 handover.
- A green gate set is not a review. Two reviewers read the money change and found a dead receipt path, a capped settled amount, a backwards default on unknown balances, a double-record hole and a resident UTR being rewritten - none of which any automated check in the repo caught.
- Before 2026-10-21 the pipeline gate could only run on the Mac: both audit scripts hardcoded a macOS temp path. Fixed and re-verified on a Linux box. Any other gate that "only worked locally" needs the same treatment.

---

## Log (append-only)

- 2026-09-29: Gate P approved; Phase 1 landed as 6 commits (theme, api, web, lint, mobile, docs) pushed; CI verified (e2e red as predicted); plan updated with run `36581880412` findings; Phase 2 started (TanStack `useApiQuery`/`lib/query` infra + page migrations, 77 paths dirty, stopped ~20:41).
- 2026-09-30 (morning): Resumed; measured lint 98 -> 10, typecheck green; found 9 new exhaustive-deps warnings from the Phase 2 migration (owned, reported). DR-5..DR-8 picked by Jay. Workers: (a) last 10 warnings -> fixed, root cause `?? []` fresh-array-per-render + watch() -> useWatch; main thread re-verified lint 0 / typecheck green; (b) audit pipeline -> 66/66 docs, verified with own script runs + severity cross-check (33 open = 10 P2 + 23 P3, zero P0/P1) + one row spot-checked against live code.
- 2026-09-30 (Phase 2 close): First-ever repo sync to compute-mini. Box test saga: 10/18 files failed -> diagnosed vitest running under Bun (no Node on box) breaking zod interop; installed Node v24.21.0 user-space on box; 78/79 -> last failure was a 30s timeout from 18-way Mongo contention (passes alone: 2.6s); final `--maxWorkers=2` run: 79/79 exit 0. Two of my ssh inline-quoting bugs (premature `$(ls .env)` expansion; `bunx --cwd`) caused false alarms -- no damage, lesson: scp script files, never inline substitutions. Phase 2 committed + pushed (DR-7), CI verified at boundary.
- 2026-10-21 (status read + strict audit): Read the books, the branch history, the loop queue and the CI runs, then re-measured the gates on the Mac (lint 0/0, typecheck green, audit pipeline 0 FAIL and 16/16 PASS, format:check red with 64 files). Found: nothing pushed since 2026-09-30; 87 dirty paths of finished Phase 3 work sitting unlanded; the tenet-p3 loop never ran; CI red only on e2e. Ran the strict flow and layout audit for the owner's complaint ("pages are shitty laid out and feature flows feel hollow"): five divergent audit frames plus two evidence sweeps, then I re-verified every load-bearing claim against source myself. Wrote `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` and refreshed this book. No product code changed. DR-10..DR-12 drafted and awaiting Jay's pick.
- 2026-10-21 (compute policy + independent review + box gates): Jay ruled "no compute on mac strictly, use arm mini and the compute mini, update rules with this". Updated the root rule file (rule 23 now forbids builds, tests, linters, typechecks, formatters, installs and background jobs on the Mac; rule 10 now says "a compute box"), added one generic pointer line to the project's `AGENTS.md` with no box names or paths, and removed the `node_modules` my earlier Mac install had created. Re-ran every gate on boxes: lint 0/0, typecheck green, format check red (61 files), audit pipeline green, api build green, web build green on the ARM box after installing Node 22.23.3 user-space there (the first attempt failed because that box has Node 18 and Next 16 needs 20.9+; the API test box was too small and too loaded to build concurrently). Found and fixed a real portability bug: `scripts/audit/reconcile-open-gaps.py` and `scripts/audit/spotcheck-field-matrix.py` hardcoded a macOS temp path, so the pipeline gate crashed on Linux and in CI; now portable and re-verified on the ARM box (16/16 both). The independent reviewer came back "request changes" on the audit: nine wrong numbers and several mislabelled citations (createNotification 11 not 10, the mobile StatusChip omits six domain statuses not four, the four-tile band is 6 list + 9 detail, rail pages 7 not 4, FormPage default 2xl not 4xl, sidebar hidden below 1024px not above, 14 sub-10px text occurrences in 9 files, 25 hex lines, 19 mobile empty-state call sites). Two corrections changed the plan: the record-payment fix is one line because the page already has the server balance, and a receipt renderer already exists (`ReceiptDocument.tsx`); and "one shared stepper across admin and portal" needs codegen because Dart cannot import TypeScript, or it becomes two steppers. All corrections folded into the audit and into DR-11 and DR-12.
