# Status Snapshot -- resume here

> Update this file every working turn. Top block = current state for a fresh agent with no chat history.
> Append-only log at the bottom. ASCII only, no emojis.

## Resume here (updated 2026-09-30, Phase 2 closed)

**Program:** approved Gate P plan `docs/plans/2026-09-29-depth-implementation-plan.md` (4 phases), executed with sub-agents, research-verified direction per phase, no assumptions. Decisions DR-1..DR-8 in `pm/DECISIONS.md`.

| Phase | Progress | State                                                                                                          |
| ----- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | 100%     | Done. 6 atomic commits pushed 2026-09-29; CI run `36581880412` all green except e2e (known, fixed in Phase 4).   |
| 2     | 100%     | Done 2026-09-30. Lint 98 -> 0 warnings; typecheck green; flutter analyze clean; test 79/79 on the box. Committed + pushed (DR-7); CI verified at phase boundary. e2e DEFERRED to Phase 4: the harness itself cannot run yet (job/webServer needs `next build` + API + DB), which is exactly plan D5 -- gate honestly reported, not passed. |
| 3     | in progress | Step 4.1 audit pipeline DONE and verified (66/66 docs, 33 open / 232 closed rows, lint TOTAL FAIL: 0 with canary proof, reconcile 16/16 PASS, idempotent). Next: CrudFormPage design (worker wrote docs/plans/crud-form-page-design.md -- REVIEW before trusting), then extraction, then rebuild queue 3.2-3.9. |
| 4     | ~10%    | Facts verified against .github/workflows/ci.yml (all plan 5.2 claims confirmed). Not started: bun.lock commit, bun pin, lint/format split, Flutter CI job, e2e fix, checkout bump, Render checklist (DR-8). |

**Gates measured 2026-09-30 (main thread, real runs):**

- `bun run lint` -> exit 0, **0 warnings, 0 errors**.
- `bun run typecheck` -> green (@pg/types, @pg/web, @pg/api).
- `flutter analyze` (mobile/) -> no issues.
- API tests on the box: **79/79, 18/18 files, exit 0** (`vitest run --maxWorkers=2`).
- `test:e2e` -> NOT green, deferred to Phase 4 (harness not runnable; see above).

**Box (compute-mini) environment -- IMPORTANT for future sessions:**

- Repo synced at `~/projects/tenet_pg_management` (rsync from Mac, excludes node_modules/.next/build caches; re-sync before each gate run: source of truth is the Mac).
- Tests REQUIRE Node: vitest under the Bun runtime fails zod named-export interop (`z.object` undefined in env.ts-importing suites). Node v24.21.0 installed user-space: `~/toolchains/node-v24.21.0-linux-x64`, symlink `~/bin/node`. Run tests with `export PATH="$HOME/bin:$PATH"` first. Vitest reports `node-v24.21.0` when correct.
- Full suite needs `--maxWorkers=2` on this box: default parallelism spawns 18 Mongo replica sets and causes 30s test timeouts (re-verified: the timed-out test passes alone in 2.6s).
- Box has NO system node and NO git-tracked state guarantees; Mac never runs tests (owner rule). `bun` 1.4.2 and `flutter` 3.47.1 on both machines.
- Full suite takes ~11 min box wall-clock. Use script files scp'd to the box -- inline ssh quoting with `$(...)` breaks (two incidents this session, no damage).

**Decisions (pm/DECISIONS.md):** DR-5 keep notifications/new redirect, gap closed as deliberate. DR-6 admin-only modules deliberately have no Flutter parity -- never flag them. DR-7 commit + push at each phase end, CI verified per phase. DR-8 agent prepares Render checklist, Jay applies -- no production writes by agent.

**Next steps, in order:**

1. Review `docs/plans/crud-form-page-design.md` when the research worker reports; verify its cohort claims against the tree before implementing.
2. Extract `CrudFormPage` (implementer worker, then main-thread gates).
3. Rebuild queue in money order (payments, invoices, tenants, electricity, rooms, attendance, dashboard) per plan 4.2; close audit gaps per module; pipeline green each time (lint TOTAL FAIL: 0, reconcile PASS).
4. Phase 3 end: commit + push (audit docs + CrudFormPage + rebuilds), CI verified.
5. Phase 4: CI hardening (see plan 5.2; also reconcile `.bun-version` 1.3.0 vs actual bun 1.4.2 everywhere), e2e runnable + green, Render checklist handed to Jay (DR-8), closure report.

**Watch-outs:**

- Worker output must be re-measured (Phase 2 migration introduced 9 new warnings once; caught by re-running lint).
- e2e red in CI until Phase 4 fix -- expected, do not chase per-phase.
- Seed-admin defaults (`Admin1234!`) are a prod security hole until Jay applies the DR-8 checklist.
- `docs/plans/crud-form-page-design.md` is worker-written and unreviewed as of this update.

---

## Log (append-only)

- 2026-09-29: Gate P approved; Phase 1 landed as 6 commits (theme, api, web, lint, mobile, docs) pushed; CI verified (e2e red as predicted); plan updated with run `36581880412` findings; Phase 2 started (TanStack `useApiQuery`/`lib/query` infra + page migrations, 77 paths dirty, stopped ~20:41).
- 2026-09-30 (morning): Resumed; measured lint 98 -> 10, typecheck green; found 9 new exhaustive-deps warnings from the Phase 2 migration (owned, reported). DR-5..DR-8 picked by Jay. Workers: (a) last 10 warnings -> fixed, root cause `?? []` fresh-array-per-render + watch() -> useWatch; main thread re-verified lint 0 / typecheck green; (b) audit pipeline -> 66/66 docs, verified with own script runs + severity cross-check (33 open = 10 P2 + 23 P3, zero P0/P1) + one row spot-checked against live code.
- 2026-09-30 (Phase 2 close): First-ever repo sync to compute-mini. Box test saga: 10/18 files failed -> diagnosed vitest running under Bun (no Node on box) breaking zod interop; installed Node v24.21.0 user-space on box; 78/79 -> last failure was a 30s timeout from 18-way Mongo contention (passes alone: 2.6s); final `--maxWorkers=2` run: 79/79 exit 0. Two of my ssh inline-quoting bugs (premature `$(ls .env)` expansion; `bunx --cwd`) caused false alarms -- no damage, lesson: scp script files, never inline substitutions. Phase 2 committed + pushed (DR-7), CI verified at boundary.
