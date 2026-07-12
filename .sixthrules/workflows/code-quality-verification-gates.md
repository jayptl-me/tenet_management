# code-quality-verification-gates.md

> Validation gates that must be satisfied before declaring any task complete.

Every code change must pass through these quality gates before the agent can request completion.

## Verification Gates

### Gate 1: Type Safety

- Enforce TypeScript compilation with zero errors.
- Action: Run `bun run typecheck` (which triggers `bun --filter '*' typecheck`).

### Gate 2: Linting & Formatting

- Enforce eslint style compliance.
- Action: Run `bun run lint` and `bun run format:check`.

### Gate 3: Compilation & Build

- Ensure the production builds succeed without warnings or compile-time failures.
- Action: Run `bun run build`.

### Gate 4: Test Safety

- Ensure existing and new tests pass cleanly.
- Action: Run `bun run test` (Vitest for backend) and `bun run test:e2e` (Playwright for frontend integration).

### Gate 5: Backend Route Verification

- Verify that newly added endpoints are reachable and secure.
- Action: Run `bun run dev`, use `curl` to verify response status and response body shape (both matching the zod schemas). Verify authentication middleware is active.

### Gate 6: UI Interface Verification

- Ensure the interface displays correctly on desktop and mobile viewports.
- Action: Launch `apps/web` on dev server. Check for React console warnings, layout shifts, or styling breaks. Verify dark and light themes.

### Gate 7: Integration Completeness

- Confirm that new components, endpoints, and helpers are reachable in the application flow.
- Actions:
  - Check that Hono routes are mounted inside [apps/api/src/index.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/index.ts).
  - Check that new pages are accessible from navigation sidebars or routers.
  - Check that models are exported in `index.ts` files of models directories.

### Gate 8: Code Structure

- Follow single-responsibility principles (one concern per file).
- Use barrel exports in packages/types and models directories.
- Eliminate dead code, commented-out test code, and debugging logs.

### Gate 9: Naming Conventions

- File names must be lowercase with hyphens (kebab-case).
- React components must be PascalCase.
- Custom hooks must start with `use`.
- Database model variables must be camelCase singular (e.g. `attendanceRecord`).
- Functions must start with action verbs (e.g. `getRooms`, `verifyUser`).

### Gate 10: Documentation

- Update [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md) if files are added, deleted, or renamed.
- Update `.env.example` if new environment configurations are introduced.
- Write JSDoc comments for complex calculations, helper scripts, and services.

## Domain-Specific Gates

### Monorepo Boundaries

- Imports inside `@pg/web` must not reference paths in `apps/api/src/`. Communication must occur exclusively over HTTP.
- Dependencies between packages must use workspace references (`workspace:*`).

### Mongoose Database Safety

- Any schema modifications must support backward compatibility (using schema default values).
- Performance indexing must be verified (no duplicate indexes, background index creation on large tables).

### CI/CD Deployment

- Build checks must match Render constraints (check `render.yaml` build commands).
- Environment variables must match those declared in `render.yaml` template variables.

## Minimum Completion Criteria

Before submitting any work to the user, the agent must confirm:

1. For JS/TS changes: `bun run typecheck` and `bun run lint` exit 0; build when production-sensitive.
2. For Flutter (`mobile/`) changes: `cd mobile && flutter analyze` exits 0.
3. Portal boundaries held: admin UI only in `apps/web`; resident UI only in `mobile/` (Flutter Web + iOS + Android).
4. No emojis introduced in code or docs.
5. Structural file changes documented in [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md).
6. Connectivity/env changes reflected in [docs/PORTAL_CONNECTIVITY.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/docs/PORTAL_CONNECTIVITY.md) and `.env.example` / `render.yaml` when needed.
