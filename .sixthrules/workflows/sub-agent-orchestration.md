# sub-agent-orchestration.md

> Framework for delegating tasks to sub-agents, defining input/output contracts, and safely integrating code.

Using sub-agents can help parallelize development in large codebases. This file defines when to delegate work and how to guarantee that the output remains type-safe and consistent.

## Decision Framework

### Solo Mode (Default)

Do not spawn sub-agents for:

- Simple bug fixes or direct endpoint creations.
- Single-file edits.
- Refactoring tasks within a single directory.

### Spawning Mode

Spawn sub-agents when the task involves:

- **High Independence:** A new route, service, or component that does not modify existing common modules.
- **Multiple Sub-projects:** Modifying Next.js pages and Hono routes concurrently.
- **Parallel Workloads:** Creating multiple React components that share a defined interface.

## Phase 1: Understand

Before spawning a sub-agent:

1. Examine the parent workspace state, layout, and configuration.
2. Identify existing code conventions (e.g. PascalCase for components, camelCase for variables, folder names, TypeScript import paths).
3. Document the database schemas and utility functions that the sub-agent will need to call.

## Phase 2: Prepare Contracts

Define a strict input/output contract to keep sub-agents focused.

### Input Contract

- File paths of existing modules the sub-agent should read for patterns.
- TypeScript definitions (`@pg/types`) of variables they will consume or yield.
- The environment specifications (e.g. Bun, Next.js, Hono, React 19).

### Output Contract

- The exact file paths the sub-agent is allowed to create or modify.
- The exact function names, routes, or exports the sub-agent must deliver.
- The constraint that the sub-agent must not introduce new NPM dependencies.

## Phase 3: Spawn

Format the sub-agent invocation with:

- A clear description of the specific task (e.g. "Create React component X in folder Y").
- The complete Input/Output contracts.
- A reminder that they must use ASCII characters only and adhere to the guidelines in [automation-loop.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/automation-loop.md).

## Phase 4: Integrate

Once a sub-agent finishes its task, the parent agent MUST complete these integration steps:

1. Read the generated code to check readability, variable naming, and architectural alignment.
2. Check imports to ensure they use correct workspace link formats (e.g. importing shared types from `@pg/types`).
3. Compile the workspaces by running `bun run typecheck`.
4. Run code formatting (`bun run lint` or `prettier --write`).
5. Run the tests in the target workspace (`bun run test` or `bun run test:e2e`) to verify no regressions were introduced.
6. Verify integration by confirming the code is linked into the main app (e.g. route mounted in `index.ts`, component imported in layout/page).
