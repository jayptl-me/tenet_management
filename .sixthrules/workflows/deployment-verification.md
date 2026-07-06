# deployment-verification.md

> Deployment readiness, environment validation, and Render compatibility verification.

This protocol is active when configuring CI/CD pipelines, modifying `render.yaml`, changing build commands, or preparing a release to the production environment.

## When to Use

- Before merging a Pull Request into the `main` branch.
- When adding new environment variables in `apps/api/.env.example` or `apps/web/.env.example`.
- When updating dependencies that alter the compilation or bundling commands.
- When configuring Render static settings or web settings.

## Step-by-Step Protocol

Follow this checklist prior to pushing changes:

### Phase 1: Environment Variable Audit

1. Verify that all environment variables used in `apps/api/src/lib/env.ts` are documented in [apps/api/.env.example](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/.env.example).
2. Verify that all public environment variables used in `apps/web/` are documented in [apps/web/.env.example](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/.env.example).
3. If new environment configurations are introduced, check that they are added to the services configuration in [render.yaml](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/render.yaml).

### Phase 2: Local Production Build Emulation

Verify that both projects compile using production settings:

1. Run the API build:
   - `cd apps/api && bun install && bun run build`
2. Run the Web build:
   - `cd apps/web && bun install && bun run build`
3. Confirm that no warnings, TypeScript compilation failures, or syntax warnings are present.
4. Verify that the Next.js export outputs files to `apps/web/out` (or matching directory configurations defined in `render.yaml`).

### Phase 3: CI/CD Pipeline Checks

Ensure that your changes do not break GitHub Actions configurations:

1. Check that [ci.yml](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.github/workflows/ci.yml) commands align with the actual test commands in `package.json`.
2. Verify that database tests do not depend on external services other than the local container configuration (`mongo:7` mapped to port 27017).

### Phase 4: Post-Deployment Smoke Test

Once changes are deployed:

1. Hit the `/health` endpoint of the live backend API (e.g. `https://<api-url>/api/v1/health`) to check that:
   - `status` returns `"ok"`
   - `mongodb` state returns `"connected"`
2. Access the frontend domain and check page rendering, theme loads, and login flows.
3. Review Render logs for any uncaught exceptions or database connection retry loops.

## Verification & Gates

- Verify that all environment variables declared as `sync: false` in `render.yaml` are set manually in the Render dashboard.
- Verify that `render.yaml` build commands match local scripts exactly.
- Confirm that `ci.yml` runs successfully on all steps before merging.

## Failure Modes & Anti-Patterns

- **Missing Render Env Vars:** Pushing code that requires a new environment variable without adding it to the Render dashboard. This leads to server boot failures or fatal exceptions.
- **Mismatched Build Targets:** Using a runtime feature in Hono that is supported by Node.js but missing in Bun. Since the Render runtime is specified as `bun`, verify using Bun environments.
- **Broken Static Export Paths:** Pointing `staticPublishPath` to `apps/web/out` when Next.js is outputting to `.next`. Ensure Next.js is configured for static exports if deploying to a static site instance on Render.

## Cross-References

- See [automation-loop.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/automation-loop.md) Phase 4 for verification steps.
- See [code-quality-verification-gates.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/code-quality-verification-gates.md) for quality gates.
- See [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md) for files map.
