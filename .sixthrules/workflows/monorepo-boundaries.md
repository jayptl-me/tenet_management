# monorepo-boundaries.md

> Enforces monorepo boundaries, package encapsulation, and shared TypeScript type structures.

This protocol is active when working on cross-package imports, adding NPM dependencies, modifying types in `packages/types/`, or configuring workspaces.

## When to Use

- When sharing data structures or models between `@pg/api` and `@pg/web`.
- When adding, updating, or removing a node module dependency.
- When importing backend configurations, models, or types into components.

## Boundary Rules

```
     +-------------------------------------------------------------+
     |                       @pg/web (React)                       |
     +-------------------------------------------------------------+
               |                                         |
               | (HTTP/REST / SSE)                       | (Imports types)
               v                                         v
     +-------------------------------------+   +-------------------+
     |           @pg/api (Hono)            |   |     @pg/types     |
     +-------------------------------------+   +-------------------+
               |                                         ^
               | (Imports types)                         |
               +-----------------------------------------+
```

### Encapsulation Rules

1. **No Backend Imports on Frontend:** `@pg/web` must not import any modules directly from `apps/api/src/`. This includes Mongoose models, Express/Hono controllers, environment configs, or backend libraries. All communication between the frontend and backend must occur over HTTP/HTTPS networks (REST endpoints, SSE streams).
2. **Types Workspace Integration:** All shared request/response models, state entities, and DTOs must live inside [packages/types/src/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/). Both the API and Frontend must import from `@pg/types`.
3. **Workspace Link Format:** Dependencies in `package.json` referencing monorepo workspaces must use workspace flags:
   - `"@pg/types": "workspace:*"`
4. **Single-Version Policy:** Maintain matched versions of shared dependencies (e.g. `zod`, `typescript`, `eslint`) across all workspaces.

## Step-by-Step Protocol (Modifying Shared Structs)

### Phase 1: Shared Definition

1. Create or edit the entity typescript file inside [packages/types/src/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/).
2. Export the types and validation schemas (Zod schemas) in the entity file.
3. Register the exports inside the barrel file [packages/types/src/index.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/index.ts).
4. Run `bun --filter '@pg/types' typecheck` to verify no syntactic errors exist.

### Phase 2: Backend Synchronization

1. Import the types and Zod schemas into the relevant Mongoose schemas and Hono routes (e.g. using `@hono/zod-validator`).
2. Run `bun --filter '@pg/api' typecheck` to ensure compile-time safety.
3. Update and run local API test suites using `bun --filter '@pg/api' test`.

### Phase 3: Frontend Synchronization

1. Import the updated types into Ky HTTP client calls, React components, React hooks, or Zustand stores in `apps/web/src/`.
2. Run `bun --filter '@pg/web' typecheck` to verify layout compliance.
3. Run `bun run lint` to clean formatting issues.

## Verification & Gates

Before code changes are committed, confirm:

- Run `bun run typecheck` across all workspaces. Exit code must be 0.
- Check that no files in `apps/web/src/` import files in `apps/api/src/`.
- Verify that `packages/types/package.json` is not importing external client libraries (like React or Hono components).

## Failure Modes & Anti-Patterns

- **Direct API Import:** Importing `import { User } from '../../api/src/models/user'` from a Next.js component. This causes build breaks during deployment. Use `import type { User } from '@pg/types'` instead.
- **Out of Sync Types:** Updating the Hono endpoint return shape without updating the corresponding interface in `@pg/types`. This leads to runtime failures on the frontend.
- **Direct Workspace Pathing:** Using relative paths across directories (e.g. `../../packages/types/src/user`) instead of importing from `@pg/types`. Always use the workspace alias.

## Cross-References

- See [automation-loop.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/automation-loop.md) for compilation checks.
- See [code-quality-verification-gates.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/code-quality-verification-gates.md) Gate 1 (Type Safety) and Gate 7 (Integration).
