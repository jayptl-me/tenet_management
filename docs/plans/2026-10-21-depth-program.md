# Depth program - plan of record (2026-10-21)

Approved by Jay on 2026-10-21: "you research, plan and fix everything ... keep pushing and working on
production grade fixes and creation or deletions". Live decisions: DR-10 B, DR-11 B now and C after,
DR-12 B. The audit that justifies all of it: `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md`.

Branch: `agent/tenet-depth` (forked from `main` at `143bc33` plus the unlanded Phase 3 work).
The agent never pushes (DR-9). Jay merges.

## Finish line

Every admin module that a resident or an operator touches reads like a product, not a scaffold:
the numbers on screen are the server's numbers, every state change closes the loop with the person
waiting on it, every status is legible as a progression, every module has its own shape, and every
control on the screen does something. The gates that prove it:

- `bun run lint` -> 0 warnings, 0 errors
- `bun run typecheck` -> green for @pg/types, @pg/web, @pg/api
- `bun run format:check` -> green (no CI mask)
- `bun run test` -> the API suite green
- `flutter analyze` -> clean
- `bun scripts/audit/check-contracts.ts` -> green against the module contracts
- `bun run build` -> api and web green

Every gate runs on a build box. The Mac runs no compute (root rule 23).

## The standard

The 20 checks in `docs/audit/FLOW_AND_LAYOUT_AUDIT_20261021.md` section 4, in three gates:
TRUTH (the server is the only authority), FLOW (every state has an owner, a trigger and a clock),
LAYOUT (one frame, one archetype, one protagonist). Each check is marked [M] (mechanically
enforceable) or [H] (human judgement with a written reason). Plus the per-module contract.

A module is called rebuilt only when it passes all three gates and has a filled contract.

## Waves and dependencies

| Wave | Depends on | Work                                                                                                                                                                                                               | Ships when                                                                                                                               |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | -          | The standard becomes executable: the contract type and its checker, the audit pipeline rewritten to check code instead of prose, the CI mask removed so a red format gate is visible                               | `check:contracts` runs, CI lint and format are separate steps, the pipeline no longer crashes off macOS                                  |
| 1    | 0          | Truth on the money path: server-computed balances on every read, receipts instead of success toasts, no copy that contradicts the API, no client-side money arithmetic                                             | the admin record-payment screen shows the server balance for a partly paid invoice and the API rejects nothing that the UI said was fine |
| 2    | 1          | Close the loops: notification on every state change a human waits for, resident-visible outcomes, resident dues view, portal status map fixed                                                                      | a resident learns that their payment was approved, their leave was rejected and why, and their KYC was verified                          |
| 3    | 1, 2       | One spine: one generated lifecycle vocabulary for both clients, one stepper per side from that source, URL is state so triage links land filtered                                                                  | every internal link with a query parameter is read by its target, and the same status renders the same way in admin and in the portal    |
| 4    | 3          | One frame: shell content frame with an optional rail, the sticky footer actually sticks, record actions pinned to the header, the four-tile band replaced by one module-specific band, first data row within 220px | the same record is reachable in one viewport, and no two module roots look alike                                                         |
| 5    | 4          | One type scale: no arbitrary `text-[Npx]`, nothing below 10px, no pinned table columns that should be tokens                                                                                                       | the type scale in globals.css is the only one, and the lint rule that enforces it is on                                                  |
| 6    | 0-5        | Per-module depth rebuilds in money order: payments, invoices, tenants, electricity, rooms, attendance, dashboard - one module per commit, each with its contract filled in and the three gates passed              | each module's contract exists and its checker passes                                                                                     |

## Parallel execution plan

Agents never share a file. One unit owns a file set; the main thread commits, so no agent runs a
git write command. Gates run centrally on a box after each batch lands.

| Batch | Units      | Owned paths                                                                                                                                                                                                                              | Notes                          |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1     | W0-infra   | `packages/types/src/contracts/**`, `packages/types/src/index.ts`, `scripts/audit/check-contracts.ts`, `package.json`, `.github/workflows/ci.yml`                                                                                         | wave 0                         |
| 1     | W0-format  | every prettier-failing file except the excluded paths                                                                                                                                                                                    | mechanical, formatting only    |
| 1     | W1-api     | `apps/api/src/routes/invoices.ts`, `apps/api/src/routes/tenants.ts`, `apps/api/src/models/invoice.ts`, `packages/types/src/invoice.ts`                                                                                                   | server owns the numbers        |
| 1     | W1-admin   | the 8 payments/invoices admin pages, `RecordPaymentModal.tsx`, `VerifyPaymentModal.tsx`, `ReceiptDocument.tsx`                                                                                                                           | the screen tells the truth     |
| 2     | W2-api     | `apps/api/src/routes/payments.ts`, `apps/api/src/services/invoice.service.ts`, `apps/api/src/routes/leaves.ts`, `apps/api/src/routes/tenants.ts` (verify-kyc + resident dues)                                                            | close the loops, API side      |
| 2     | W2-portal  | `mobile/lib/**`                                                                                                                                                                                                                          | close the loops, resident side |
| 3     | W3-spine   | `packages/types/src/lifecycle.ts` + generator, `apps/web/src/hooks/useUrlState.ts`, `apps/web/src/components/ui/StatusStepper.tsx`, `mobile/lib/features/shared/widgets/status_stepper.dart`, the list pages that must read query params | one vocabulary, generated      |
| 4     | W4-frame   | `apps/web/src/app/(admin)/layout.tsx`, `apps/web/src/components/ui/FormCard.tsx`, `apps/web/src/components/ui/ContentFrame.tsx` (new), the pages with the four-tile band                                                                 | one frame                      |
| 5     | W5-type    | `apps/web/src/app/globals.css`, every file with an arbitrary `text-[Npx]`, the pinned table columns                                                                                                                                      | one scale                      |
| 6     | W6-modules | one module per unit: list, detail, new, edit of that module plus its contract                                                                                                                                                            | money order                    |

## Review policy

Money paths, security, data writes and cross-module changes get one independent reviewer plus one
adversarial reviewer before the commit. Small reversible changes get mechanical checks plus one
reviewer. The audit that produced this program already had one independent review that returned
"request changes" and changed the plan - that is the standard, not an exception.

## Land policy

Commits are atomic Conventional Commits on `agent/tenet-depth`. Nothing is pushed (DR-9). Jay
merges. Every commit states what was gated on which box.

## Progress

| Unit             | State   | Notes                                                                                                                                                                                                                       |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| baseline         | done    | 4 commits protect the unlanded Phase 3 work                                                                                                                                                                                 |
| W0-infra         | landed  | contracts + checker + CI split; the checker caught its own bug (the model file is payment.ts, not payments.ts) and now reports 0 failures with 0 baselines                                                                  |
| W0-format        | landed  | 48 markdown files re-padded to prettier's rule, verified against prettier's own fixtures and this repo's history                                                                                                            |
| W1-api + repairs | landing | the server owns the money numbers; the settled amount is no longer capped, an unknown balance means outstanding, an idempotency key is on the payment model, and an invoice edit no longer rewrites a resident's UTR amount |
| W1-admin + fixes | landing | the record-payment screen reads the server balance, the lying copy is gone, the success toasts are gone, and the receipt path is fixed (the payment model drops _id, so the client read a field that never existed)         |
| W2-api           | landing | the resident is told on payment verified/rejected/voided, invoice issued, leave decided and KYC verified; the resident dues endpoint exists                                                                                 |
| W2-portal        | landing | the resident sees the real balance, the rejection reason, the fixed status colours, and every empty state has a next step or says none is needed                                                                            |
| W2-delete        | landing | the two dead endpoints and the hardcoded demo credentials are gone, with a negative control                                                                                                                                 |
| W2-status-writes | landed  | every success toast across nine modules now re-reads the server; three clipboard copies stay because a local copy is a local fact                                                                                           |
| W3-spine         | landed  | one generated vocabulary for both clients, one shared stepper, the parity gate green                                                                                                                                        |
| W3-contracts     | landing | a contract for every module, so the checker can name which modules promise more than the server delivers                                                                                                                    |
| W4-frame         | landing | one content width for the whole app, the header and the body share it, and a browser gate that measures it                                                                                                                  |
| W4-url-state     | landing | the triage links land filtered                                                                                                                                                                                              |
| Phase 4 CI       | landed  | honest gates, pinned bun, a committed lockfile, a runnable e2e job, a Flutter job                                                                                                                                           |
| W5-type          | queued  | starts when the page sweep lands                                                                                                                                                                                            |
| W6-modules       | queued  | starts when W5 lands                                                                                                                                                                                                        |
