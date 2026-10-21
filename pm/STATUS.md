# Status Snapshot -- resume here

> Update this file every working turn. Top block = current state for a fresh agent with no chat history.
> Append-only log at the bottom. ASCII only, no emojis.

## Resume here (updated 2026-10-21, the depth program wave 1 shipped, everything green)

**Program:** the depth program of record is `docs/plans/2026-10-21-depth-program.md`, built on the
audit `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md`. Decisions DR-1..DR-12 in `pm/DECISIONS.md`.
Jay picked DR-10 B, DR-11 B then C, DR-12 B on 2026-10-21 and told the agent to research, plan and
fix everything with parallel background agents.

**Branch `agent/tenet-depth` (58 commits, never pushed, Jay merges).** Twenty-five commits on top of
`main` plus the baseline that protected the loose Phase 3 work. The tree is clean.

**What the program found and fixed.** Two defects explain most of the "the pages feel hollow and the
flows feel empty" complaint, and both were mechanical, not taste:

1. **The admin session did not survive a full page load.** The shell decided "nobody is signed in"
   from the store before the persisted session was restored, so every refresh, shared link or
   bookmark dumped a signed-in admin on the login page. Found by making the end-to-end suite
   runnable: the onboarding form test kept landing on the login page. Fixed, with a regression spec.
2. **The `Input` control was dropping its value and its change handler.** Every input in the admin app
   was an uncontrolled, silent box: react-hook-form's `register` lost its change handler in 48 places
   (live validation never ran) and a controlled field never showed what it held. Fixed, with a test
   that fails on the old code.

Around them: the server now owns every money number (one helper, no client arithmetic, an unknown
total means outstanding and never zero), the offline write is idempotent, an invoice edit no longer
rewrites a resident's declared transfer amount, deleting an invoice no longer destroys transfer
evidence, every state change a human waits on now reaches the resident, the admin app has one content
width, the triage links land filtered, the portal shows the real balance and the rejection reason, the
dead endpoints and the hardcoded demo credentials are gone, the docs no longer advertise what was
deleted, and every module has a contract that the checker validates against the live code.

**Gates (all on a build box, never on the Mac):**

| Gate                       | Result                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| `bun run lint`             | **0 warnings, 0 errors**, 407 files, 143 rules                               |
| `bun run typecheck`        | **green** for @pg/types, @pg/web, @pg/api                                    |
| `bun run format:check`     | **clean** (the CI mask that hid this is gone)                                |
| `bun run test` (API)       | **139 of 139 green, 26 files** (60 more tests than the program started with) |
| `bun test src/` (web unit) | **green**                                                                    |
| `bun run test:e2e`         | **9 of 9 green** (the CI job that has been red since 2026-09-30)             |
| `bun run build`            | **green** for api and web (all 84 admin routes compile)                      |
| `bun run check:contracts`  | **23 contracts, 0 failures, 0 known baselines**                              |
| `bun run check:lifecycle`  | **0 failures** (the generated Dart matches the JSON)                         |
| audit pipeline             | **TOTAL FAIL: 0**, reconcile **16/16**, field matrix **16/16**               |
| `flutter analyze`          | **no issues**                                                                |

**Still to do:** the per-module depth rebuilds in money order (the invoices module is in flight, then
tenants, electricity, rooms, attendance, dashboard), the type-scale sweep for the admin pages (the
shared components are done and guarded; the pages still carry the allowlisted exceptions), the
resident-facing receipt card (DR-11 option C), the leftover audit gaps the contracts name (a visitor
arriving or leaving is still silent, a room retirement and a bed move are still silent, the
cron-secret route that marks invoices overdue still tells nobody, and tenant checkout cannot reach
the resident because it deactivates the login), and Phase 4 leftovers (the Render env checklist for
Jay, and the e2e suite running against a real API rather than stubs).

**Watch-outs:**

- Two independent reviewers read the money change before it landed. One found a dead receipt path,
  the other found the capped settled amount, the backwards default on an unknown balance and the
  double-record hole. **A green gate set is not a review.** Both findings were real and neither
  gate could see them.
- Before 2026-10-21 the pipeline gate could only run on the Mac (both audit scripts hardcoded a
  macOS temp path). Fixed and re-verified on Linux. Treat any gate that "only worked locally" the
  same way.
- The ARM box has no Flutter SDK (the official Linux build is x86 only), so Flutter analyze runs on
  the x86 box and takes about 30 minutes under load.
- The contract checker is now the instrument for "is this module hollow": a contract that promises a
  notification the server does not send goes red. Add a contract before rebuilding a module.
- Contracts describe the code as it is, including the places where a person is still not told: a
  visitor arriving or leaving, a room being retired, a bed moving, the cron-secret route that marks
  invoices overdue without telling the tenant, and tenant checkout (which deactivates the login, so
  the resident cannot be reached).
- Never push from an agent (DR-9). Jay merges.

---

## Log (append-only)

- 2026-10-21 (wave 4: the modules, in parallel): nine units ran at once with disjoint file sets, and the modules went through the standard one by one - payments, invoices, tenants, electricity, rooms, assets, services, visitors and leaves are rebuilt, and attendance, dashboard, floors, meals, menus, laundry, washing machines and guardians are in flight. Two units found defects outside their own pages: the date picker was delivering a change event where every caller expected a string, so a filter typed for a string wrote an object into the address bar and silently did not apply, and the audit trail could not be filtered by record id. Both are fixed. The type scale is finished across the pages and the components with a guard that reports zero failures and zero stale entries, and the display ramp turned out to be declared but never registered, so text-lg was rendering Tailwind's 18px while the file declared 17px - the declared scale was the one nobody saw. Two unused banners are deleted with their zero consumers.
- 2026-10-21 (wave 3: the module rebuilds): the payments module was rebuilt to the depth standard first (filters in the address bar, counts read for the same filtered set the table shows, an export that walks the pages the API clamps and reports both numbers, every payment linked to its tenant, room and invoice, a refused payment no longer indistinguishable from one never submitted), then the invoices module (the ledger filters live in the URL, the compose form's dead discount preset removed, a duplicate bill is a wall with the existing bill linked, the detail page can cancel from where the operator stands) and the tenants module (the roster shows each resident's dues from the server, the resident page renders the onboarding progression the product actually has, every office action sits in one place, checkout re-reads the server). Each module wrote its depth audit first, filled its contract, and recorded what it could not close - those sit in the contracts as open gaps rather than in prose. Three fixes came out of the modules themselves: the audit trail could not be filtered by record id, the office write sent no idempotency key, and an edited payment told the resident nothing.
- 2026-10-21 (wave 2: the type scale and the first module through the new standard): the shared components now render on one canonical type scale (the semantic names alias the numeric tokens, so nothing changed size), the four remaining sub-10px sizes were raised to the 10px floor, and a guard (`bun run check:type-scale`, wired into CI) fails on a new arbitrary size, a hardcoded pixel dimension, a size under the floor or a semantic name that does not render at its token's size. The payments module was then rebuilt end to end: its filters live in the address bar, its counts are read for the same filtered set the table shows, its export walks the pages the API clamps and reports both numbers, every payment links to its tenant, room and invoice, and a refused payment is no longer indistinguishable from one that was never submitted. It found two gaps in its own path - the office write sent no idempotency key and an edited payment told the resident nothing - and both were closed immediately after.
- 2026-09-29: Gate P approved; Phase 1 landed as 6 commits (theme, api, web, lint, mobile, docs) pushed; CI verified (e2e red as predicted); plan updated with run `36581880412` findings; Phase 2 started (TanStack `useApiQuery`/`lib/query` infra + page migrations, 77 paths dirty, stopped ~20:41).
- 2026-09-30 (morning): Resumed; measured lint 98 -> 10, typecheck green; found 9 new exhaustive-deps warnings from the Phase 2 migration (owned, reported). DR-5..DR-8 picked by Jay. Workers: (a) last 10 warnings -> fixed, root cause `?? []` fresh-array-per-render + watch() -> useWatch; main thread re-verified lint 0 / typecheck green; (b) audit pipeline -> 66/66 docs, verified with own script runs + severity cross-check (33 open = 10 P2 + 23 P3, zero P0/P1) + one row spot-checked against live code.
- 2026-09-30 (Phase 2 close): First-ever repo sync to compute-mini. Box test saga: 10/18 files failed -> diagnosed vitest running under Bun (no Node on box) breaking zod interop; installed Node v24.21.0 user-space on box; 78/79 -> last failure was a 30s timeout from 18-way Mongo contention (passes alone: 2.6s); final `--maxWorkers=2` run: 79/79 exit 0. Two of my ssh inline-quoting bugs (premature `$(ls .env)` expansion; `bunx --cwd`) caused false alarms -- no damage, lesson: scp script files, never inline substitutions. Phase 2 committed + pushed (DR-7), CI verified at boundary.
- 2026-10-21 (status read + strict audit): Read the books, the branch history, the loop queue and the CI runs, then re-measured the gates on the Mac (lint 0/0, typecheck green, audit pipeline 0 FAIL and 16/16 PASS, format:check red with 64 files). Found: nothing pushed since 2026-09-30; 87 dirty paths of finished Phase 3 work sitting unlanded; the tenet-p3 loop never ran; CI red only on e2e. Ran the strict flow and layout audit for the owner's complaint ("pages are shitty laid out and feature flows feel hollow"): five divergent audit frames plus two evidence sweeps, then I re-verified every load-bearing claim against source myself. Wrote `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` and refreshed this book. No product code changed. DR-10..DR-12 drafted and awaiting Jay's pick.
- 2026-10-21 (compute policy + independent review + box gates): Jay ruled "no compute on mac strictly, use arm mini and the compute mini, update rules with this". Updated the root rule file (rule 23 now forbids builds, tests, linters, typechecks, formatters, installs and background jobs on the Mac; rule 10 now says "a compute box"), added one generic pointer line to the project's `AGENTS.md` with no box names or paths, and removed the `node_modules` my earlier Mac install had created. Re-ran every gate on boxes: lint 0/0, typecheck green, format check red (61 files), audit pipeline green, api build green, web build green on the ARM box after installing Node 22.23.3 user-space there (the first attempt failed because that box has Node 18 and Next 16 needs 20.9+; the API test box was too small and too loaded to build concurrently). Found and fixed a real portability bug: `scripts/audit/reconcile-open-gaps.py` and `scripts/audit/spotcheck-field-matrix.py` hardcoded a macOS temp path, so the pipeline gate crashed on Linux and in CI; now portable and re-verified on the ARM box (16/16 both). The independent reviewer came back "request changes" on the audit: nine wrong numbers and several mislabelled citations (createNotification 11 not 10, the mobile StatusChip omits six domain statuses not four, the four-tile band is 6 list + 9 detail, rail pages 7 not 4, FormPage default 2xl not 4xl, sidebar hidden below 1024px not above, 14 sub-10px text occurrences in 9 files, 25 hex lines, 19 mobile empty-state call sites). Two corrections changed the plan: the record-payment fix is one line because the page already has the server balance, and a receipt renderer already exists (`ReceiptDocument.tsx`); and "one shared stepper across admin and portal" needs codegen because Dart cannot import TypeScript, or it becomes two steppers. All corrections folded into the audit and into DR-11 and DR-12.
- 2026-10-21 (the program ran): eleven parallel background units across the waves, each owning a disjoint file set, with the main thread running every gate on a box and committing per unit. Two money-path reviews ran before the money landed and both found real defects no gate could see (the dead receipt path; the capped settled amount, the backwards unknown-balance default, the double-record hole). The program also found two mechanical causes of the hollow feeling that nobody had looked for: the admin session did not survive a full page load (the shell decided nobody was signed in before the persisted session was restored), and the shared `Input` control dropped its value and its change handler, so live validation never ran anywhere and controlled fields never showed their value. The session defect was found by making the end-to-end suite runnable; the Input defect by a money unit that hit a wall and dug into the component instead of working around it.
- 2026-10-21 (wave 1 shipped): 25 commits on `agent/tenet-depth`, tree clean, every gate green on a box: lint 0/0, typecheck green, format clean, API 139/139, web unit green, e2e 9/9 (the job that has been red since September), both builds green, contracts 23/0/0, lifecycle 0 failures, audit pipeline 0 FAIL and 16/16, flutter analyze clean. Ten products of the rebuild also had to be repaired after the fact: the seed data in four new test files violated the model validators (the invoice number format and the Indian mobile format), the guardians dues summary still treated an unknown total as zero, the money helper's type did not allow the unknown case, and two components read a ref during render.
