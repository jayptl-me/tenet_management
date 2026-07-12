# monorepo-boundaries.md

> Enforces monorepo boundaries, package encapsulation, and multi-client communication.

This protocol is active when working on cross-package imports, adding NPM dependencies, modifying types in `packages/types/`, configuring workspaces, or changing admin/portal connectivity.

## When to Use

- Sharing data structures between `@pg/api` and `@pg/web`.
- Adding, updating, or removing a node module dependency.
- Changing Flutter portal API clients or CORS.
- Importing backend configurations, models, or types into UI packages.

## Boundary Rules

```
     +---------------------------+     +----------------------------------+
     |  @pg/web (Next.js)        |     |  mobile/ (Flutter -- ONE app)    |
     |  ADMIN ONLY (browser)     |     |  targets: Flutter Web + iOS +    |
     |                           |     |  Android                         |
     |                           |     |  roles: tenant / guardian /      |
     |                           |     |  visitor desk                    |
     +-------------+-------------+     +-------------+--------------------+
                   | HTTP/SSE                          | HTTP (Dio)
                   v                                   v
     +-------------+-----------------------------------+
     |              @pg/api (Hono + Mongoose)            |
     +-------------+-----------------------------------+
                   |
                   | imports types (TS clients only)
                   v
     +-------------+-----------------------------------+
     |              @pg/types (TS only)                  |
     +-------------------------------------------------+
```

Flutter does not import `@pg/types` at runtime; it talks HTTP only. Same Flutter codebase builds web, iOS, and Android.

### Encapsulation Rules

1. **No Backend Imports on Admin Web:** `@pg/web` must not import any modules from `apps/api/src/`. Communication only over HTTP/HTTPS (REST, SSE).
2. **No Backend Imports on Flutter:** `mobile/` must not import TypeScript packages as runtime deps. Use Dio against `/api/v1`. Mirror DTO shapes in Dart repositories; optionally document in `@pg/types` for API/web.
3. **No Resident UI in Admin Web:** Do not create `apps/web` routes for tenant, guardian, or visitor portals. Those live under `mobile/`.
4. **Types Workspace Integration:** Shared request/response models for API + admin web live in `packages/types/src/`. Import as `@pg/types`.
5. **Workspace Link Format:** Use `"@pg/types": "workspace:*"` in JS package.json files.
6. **Single-Version Policy:** Match shared TS deps (`zod`, `typescript`, `eslint`) across JS workspaces.

## Step-by-Step Protocol (Modifying Shared Structs)

### Phase 1: Shared Definition (TS)

1. Edit entity file in `packages/types/src/`.
2. Export from `packages/types/src/index.ts`.
3. Run `bun --filter '@pg/types' typecheck`.

### Phase 2: Backend Synchronization

1. Import types/Zod into models and Hono routes.
2. Run `bun --filter '@pg/api' typecheck` and `bun --filter '@pg/api' test`.

### Phase 3: Admin Web Synchronization

1. Import types into Ky clients / components / stores.
2. Run `bun --filter '@pg/web' typecheck` and lint.

### Phase 4: Flutter Portal Synchronization (when portal-facing)

1. Update Dart repositories under `mobile/lib/features/*/data/`.
2. Run `cd mobile && flutter analyze`.
3. If CORS or base URL changed, update `docs/PORTAL_CONNECTIVITY.md` and env examples.

## Connectivity / CORS Protocol

When adding a new browser client origin:

1. Prefer `PORTAL_URL` or `CORS_EXTRA_ORIGINS` env (see `apps/api/src/lib/env.ts`).
2. Keep `apps/api/src/lib/cors-origins.ts` as the single allowlist implementation.
3. Document in `docs/PORTAL_CONNECTIVITY.md` and `apps/api/.env.example`.
4. Add production keys to `render.yaml` when introducing new env vars.

## Verification & Gates

- `bun run typecheck` exits 0 for JS workspaces.
- No `apps/web` imports from `apps/api/src/`.
- No new resident portal pages under `apps/web`.
- `flutter analyze` clean for portal work.
- CORS smoke for Flutter web origin in development (localhost any port).

## Failure Modes & Anti-Patterns

- **Direct API Import from Next:** `import { User } from '../../api/src/models/user'` -- use `@pg/types` + HTTP.
- **Resident portals in Next:** Re-adding `app/(tenant)` after Flutter migration -- forbidden.
- **CORS hardcode only production FRONTEND_URL:** Breaks Flutter web -- set `PORTAL_URL` or use `cors-origins` localhost rule in dev.
- **Out of Sync Types:** Changing Hono response without updating admin types and/or Flutter parsers.

## Cross-References

- [docs/PORTAL_CONNECTIVITY.md](../../docs/PORTAL_CONNECTIVITY.md)
- [automation-loop.md](automation-loop.md)
- [code-quality-verification-gates.md](code-quality-verification-gates.md)
- [codebase-index.md](codebase-index.md)
