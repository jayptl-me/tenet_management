# AGENTS.md

> Root steering file for AI agents. ASCII only. No emojis in code, commits, or docs.

Load for multi-step work: **[docs/AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md)** and **[docs/PORTAL_CONNECTIVITY.md](docs/PORTAL_CONNECTIVITY.md)**.

Code is truth. Specs and audits can lag; re-verify against source before implementing.

---

## Product split (non-negotiable)

| Surface | Path | Platforms | Roles |
|---------|------|-----------|-------|
| Admin panel | `apps/web` | Browser (Next.js) | `admin` only |
| Resident portal | `mobile/` | **Flutter Web + iOS + Android** (one app) | `tenant`, `guardian`, visitor desk |
| API | `apps/api` | Server | JWT for all roles |

```
  [Next.js apps/web]  ADMIN ONLY
         | HTTP + SSE
         v
  [apps/api /api/v1]
         ^
         | HTTP (Dio)
  [mobile/ Flutter ONE codebase]
     +-- web/      Flutter Web
     +-- ios/      iOS
     +-- android/  Android
```

Rules:

1. Next.js = admin only. Login rejects tenant/guardian. No resident App Router trees under `apps/web`.
2. Everyone else = Flutter `mobile/` (Web and iOS and Android). Do not re-add Next tenant/guardian routes.
3. Clients never import `apps/api` source. HTTP only.
4. CORS: admin origin + Flutter Web origins (`cors-origins.ts`). Native iOS/Android do not rely on CORS.
5. No emojis anywhere in the repo content agents write.

---

## Build and test commands

### Bun (API + admin web)

- `bun run dev` -- API + Next admin
- `bun run build` / `typecheck` / `lint` / `test` / `test:e2e`
- `bun run seed` / `seed:sample`
- `bun run format` / `format:check` / `clean` / `seo`

### Flutter (resident portal)

- `bun run mobile:setup` -- `flutter pub get` in `mobile/`
- `bun run mobile:gen` -- codegen if configured
- Web: `cd mobile && flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000/api/v1`
- iOS: `cd mobile && flutter run -d ios --dart-define=API_BASE_URL=http://localhost:8000/api/v1`
- Android emulator: `cd mobile && flutter run -d android --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1`
- `cd mobile && flutter analyze`

---

## Architecture map

| Path | Role |
|------|------|
| `apps/api/` | Bun + Hono + Mongoose. HTTP contracts. |
| `apps/web/` | Next.js admin UI only. |
| `mobile/` | Flutter resident portal (Web + iOS + Android). |
| `packages/types/` | Shared TS types for API + admin web. |
| `docs/AGENT_CONTEXT.md` | Full agent context load. |
| `docs/PORTAL_CONNECTIVITY.md` | Connectivity, CORS, auth, API map. |
| `docs/audit/` | Gap backlog. |
| `render.yaml` | Render deploy. |

---

## Backend connectivity (quick)

| Concern | Location |
|---------|----------|
| Env | `apps/api/src/lib/env.ts` -- `FRONTEND_URL`, `PORTAL_URL`, `CORS_EXTRA_ORIGINS` |
| CORS | `apps/api/src/lib/cors-origins.ts`, wired in `apps/api/src/index.ts` |
| Env template | `apps/api/.env.example` |
| Flutter API base | `mobile/lib/core/config/env.dart` (`API_BASE_URL`) |
| Admin API base | `NEXT_PUBLIC_API_URL` in apps/web |
| Guide | [docs/PORTAL_CONNECTIVITY.md](docs/PORTAL_CONNECTIVITY.md) |

When changing auth, CORS, or portal APIs: update API + env + render.yaml if needed + Flutter data layer + connectivity docs. Smoke health, admin login, Flutter tenant and guardian login (Web and/or iOS).

---

## Code style

1. Files/dirs kebab-case; React components PascalCase; hooks `use*`.
2. TypeScript strict; no `any`. Shared DTOs in `packages/types/`.
3. API: Zod in routes; logic in `apps/api/src/services/`.
4. Flutter: `mobile/lib/features/{auth,tenant,guardian,visitor}` + `mobile/lib/core/`.
5. Barrel exports for types/models.
6. Schema changes: defaults for backward compatibility.
7. No emojis.

---

## Critical rules

- Never direct-import API into web/Flutter.
- Re-read files immediately before editing.
- Feature flags may 403 portal routes (`guardianPortalEnabled`, `visitorManagementEnabled`, `laundryEnabled`, etc.).
- After file tree changes: update `.sixthrules/workflows/codebase-index.md` (and `.claude/rules` mirror).

---

## Task routing

| Topic | Primary work area |
|-------|-------------------|
| Admin CRUD / settings / dashboard UI | `apps/web` |
| Tenant / guardian / visitor UI | `mobile/` only |
| API / CORS / auth | `apps/api` (+ clients) |
| Shared TS contracts | `packages/types` then API + web |

---

## Workflows

`.sixthrules/workflows/` (mirrored under `.claude/rules/`):

- master.md
- codebase-index.md
- monorepo-boundaries.md
- automation-loop.md
- adaptive-research-protocol.md
- code-quality-verification-gates.md
- database-schema-protocol.md
- deployment-verification.md

---

## Definition of done (minimum)

1. Portal boundaries respected (admin Next / residents Flutter).
2. `bun run typecheck` and lint green for JS changes; `flutter analyze` for Flutter changes.
3. No emojis introduced.
4. Connectivity and agent docs updated when architecture or CORS changes.
