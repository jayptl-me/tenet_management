# automation-loop.md

> Core goal-driven iterative execution loop: Research -> Plan -> Execute -> Verify -> Iterate.

This file governs all code changes. Never stop at "code written"; only stop when the code is verified as running, building, and passing all checks in the local development environment.

## Phase 1: Research

Gather complete context before outlining changes.

### Actions

- Read [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md) to locate relevant modules.
- Read target files fully to identify existing patterns, helpers, and models.
- Run `bun run typecheck` or view workspace types if imports are involved.
- Use [adaptive-research-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/adaptive-research-protocol.md) if error messages or external libraries are involved.

### Knowledge Summary Output

Prepare a mental or scratchpad summary:

- Current state of the system
- List of files that need to change
- Code conventions and libraries to use
- Unknowns and risks (CORS, schema constraints, etc.)

### Gate

- Answer: "Can I explain exactly what needs to change, where, and WHY?"
- If NO -> Return to research.

## Phase 2: Plan

Design the changes before touching any code.

### Actions

- Break the task into sequential, independent steps.
- Identify steps that can be run in parallel (candidates for sub-agents).
- Define precise verification criteria for each step (e.g. "Command X runs with exit code 0", "Endpoint returns 200").

### Gate

- Answer: "Is each step independently testable and verifiable?"
- If NO -> Decompose steps further.

## Phase 3: Execute

Modify the codebase safely, one step at a time.

### Actions

- ALWAYS re-read the target file right before editing it (avoid applying outdated diffs).
- Make exactly ONE change corresponding to the current step.
- Verify immediately.
- If the verification passes -> Mark step completed and proceed to the next step.
- If the verification fails -> Apply a fix.

### Fix Limits

- Max 3 fix attempts per step.
- If it fails 3 times, stop. Re-read the file, check imports, check [adaptive-research-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/adaptive-research-protocol.md), and plan an alternative approach.

### Safeguards

- NEVER batch unrelated modifications into a single execution step.
- NEVER proceed to step N+1 if step N is failing.

## Phase 4: Verify

Verify that the changes are correct and build cleanly in the workspace.

### Core Gates

- **Type Safety:** Run `bun run typecheck` (or `bun --filter '*' typecheck`). Zero errors.
- **Linting:** Run `bun run lint` (or `bun --filter '*' lint`). Zero warnings/errors.
- **Build Cleanliness:** Run `bun run build` (or `bun --filter '*' build`). Zero compilation errors.
- **Unit and Integration Tests:** Run `bun run test` for the backend. All tests must pass.

### API Changes Verification

- Run the server locally using `bun run dev` (which triggers `@pg/api`).
- Call the modified endpoints using `curl` (happy path + failure states) or test scripts.
- Validate response HTTP status code and Zod validation schema matches the expected shape.

### UI Changes Verification

- Run the frontend locally using `bun run dev` (which triggers `@pg/web`).
- Access the routes in the browser.
- Verify there are no console errors, layout collapses, or broken navigation paths.
- Run `bun run test:e2e` (Playwright) if UI integration tests are altered.

### Domain Verification

- For Mongoose schema updates: see [database-schema-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/database-schema-protocol.md).
- For Monorepo/dependency changes: see [monorepo-boundaries.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/monorepo-boundaries.md).

## Phase 5: Iterate

- If all verification gates pass and all steps are complete:
  - Run the final checks in [code-quality-verification-gates.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/code-quality-verification-gates.md).
  - Declare completion.
- If a verification gate fails:
  - Diagnose the issue (check type definitions, CORS parameters, environment variables).
  - Apply the fix and run Phase 4 again.

## Anti-Patterns

| Action                  | Mistake                                                   | Correct Alternative                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coding without research | Guessing database fields or routing paths                 | Check [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md) and Mongoose schemas first |
| Batching changes        | Modifying 5 files across API and web in one step          | Split into a Types pass, then API pass, then Web pass. Verify each step.                                                                                                     |
| Skipping lint/build     | Assuming "code looks correct" and committing              | Run `bun run lint` and `bun run build` locally on every loop.                                                                                                                |
| Neglecting schemas      | Changing API database fields without updating `@pg/types` | Define types in `@pg/types/src/` first, compile/typecheck, then import in API.                                                                                               |
