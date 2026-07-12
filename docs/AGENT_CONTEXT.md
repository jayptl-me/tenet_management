# Agent Context -- Permanent Reference

> Load this file (and [AGENTS.md](../AGENTS.md)) at the start of multi-step work.
> Code is truth. Specs and audits can lag; re-verify against source before implementing.
> **No emojis** in code, commits, comments, or documentation.

**Last aligned:** 2026-07-12 (audit docs refreshed -- see docs/audit/LIVE_GAP_INVENTORY.md)

---

## 1. Product split (do not violate)

| Surface | Codebase | Platforms | Authenticated roles |
|---------|----------|-----------|---------------------|
| Admin panel | `apps/web` (Next.js 16 App Router) | Browser only | `admin` only |
| Resident portal | `mobile/` (Flutter) | **Flutter Web + iOS + Android** (one codebase) | `tenant`, `guardian` |
| Visitor desk | `mobile/` visitor shell | Same Flutter targets | Tenant-authenticated (not a JWT role) |
| API | `apps/api` (Bun + Hono) | Server | All roles via JWT |

```
  Next.js apps/web  [admin only]
        |
        |  HTTP + SSE
        v
  apps/api  /api/v1/*  ---- MongoDB
        ^
        |  HTTP (Dio)
        |
  mobile/ Flutter  [ONE app]
     +-- web/      Flutter Web
     +-- ios/      iOS
     +-- android/  Android
```

### Hard rules

1. **Never** add tenant, guardian, or visitor App Router pages under `apps/web`.
2. **Never** import `apps/api` source from `apps/web` or Flutter. HTTP only.
3. Admin web login **rejects** non-admin; Flutter login **rejects** admin.
4. Resident UI work belongs in `mobile/lib/features/{tenant,guardian,visitor,auth}/`.
5. Admin UI work belongs in `apps/web/src/app/(admin)/` and shared `components/`.
6. API contract changes must keep admin + Flutter clients in mind.

---

## 2. Where to look first

| Need | Open |
|------|------|
| Build commands, conventions | [AGENTS.md](../AGENTS.md) |
| Connectivity, CORS, auth, API map | [PORTAL_CONNECTIVITY.md](PORTAL_CONNECTIVITY.md) |
| Live gap backlog | [audit/README.md](audit/README.md), [audit/LIVE_GAP_INVENTORY.md](audit/LIVE_GAP_INVENTORY.md) |
| File map | [.sixthrules/workflows/codebase-index.md](../.sixthrules/workflows/codebase-index.md) |
| Package boundaries | [.sixthrules/workflows/monorepo-boundaries.md](../.sixthrules/workflows/monorepo-boundaries.md) |
| Domain entities | [specs/README.md](specs/README.md) |
| Flutter setup | [mobile/README.md](../mobile/README.md) |
| Deploy / env | [deployment-verification](../.sixthrules/workflows/deployment-verification.md), `render.yaml` |

---

## 3. Commands

### API + admin web (Bun)

```bash
bun run dev              # API + Next admin
bun run typecheck
bun run lint
bun run test             # API unit tests
bun run seed:sample
```

### Flutter resident portal

```bash
bun run mobile:setup
cd mobile

# Flutter Web
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000/api/v1

# iOS
flutter run -d ios --dart-define=API_BASE_URL=http://localhost:8000/api/v1

# Android emulator (API on host)
flutter run -d android --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1

flutter analyze
flutter build web --dart-define=API_BASE_URL=https://api.example.com/api/v1
flutter build ios --dart-define=API_BASE_URL=https://api.example.com/api/v1
```

---

## 4. Connectivity summary

| Item | Value / location |
|------|------------------|
| API prefix | `/api/v1` |
| Admin base URL env | `NEXT_PUBLIC_API_URL` |
| Flutter base URL | `API_BASE_URL` dart-define (`mobile/lib/core/config/env.dart`) |
| CORS allowlist | `apps/api/src/lib/cors-origins.ts` |
| Admin origin env | `FRONTEND_URL` |
| Flutter Web origin env (prod) | `PORTAL_URL` |
| Extra origins | `CORS_EXTRA_ORIGINS` (comma-separated) |
| Dev CORS | Any `http://localhost:*` / `http://127.0.0.1:*` Origin allowed |
| Auth | Bearer JWT; `POST /auth/login`, `/auth/refresh`, `GET /auth/me` |

Full detail: [PORTAL_CONNECTIVITY.md](PORTAL_CONNECTIVITY.md).

---

## 5. Flutter layout (resident portal)

```
mobile/lib/
  main.dart
  app.dart
  core/           config, network (Dio), router, storage, theme, models
  features/
    auth/         login; rejects admin
    tenant/       home, invoices, payments, visitors tab, complaints, meals, laundry, notices
    guardian/     ward, attendance
    visitor/      list, register, status (tenant-owned desk)
    shared/       shared widgets
```

Routing: `mobile/lib/core/router/app_router.dart` (go_router, role redirects).

---

## 6. Admin layout (Next.js)

```
apps/web/src/app/
  (admin)/        all CRUD modules (tenants, rooms, finance, ...)
  login/          admin only
  page.tsx        marketing landing (public)
  reset-password/
```

No `(tenant)` or `(guardian)` route groups.

---

## 7. Task routing for agents

| User request about... | Work in | Do not touch for UI |
|-----------------------|---------|---------------------|
| Admin CRUD, settings, dashboard | `apps/web`, maybe `apps/api` | `mobile/` UI |
| Tenant/guardian/visitor screens | `mobile/` | `apps/web` App Router |
| Auth/CORS/API contracts | `apps/api` (+ clients) | -- |
| Shared TS DTOs | `packages/types` then API + admin web | Flutter uses Dart models/HTTP |

After structural file adds/renames: update [codebase-index.md](../.sixthrules/workflows/codebase-index.md).

---

## 8. Quality gates

### JS monorepo

- `bun run typecheck`
- `bun run lint`
- Relevant tests: `bun run test` / `bun run test:e2e`

### Flutter

- `cd mobile && flutter analyze`
- Manual smoke on Web and/or iOS when changing portal flows

### Definition of done

- No emojis introduced
- Portal boundaries respected
- Connectivity docs updated if CORS/env/auth changed
- Re-read target files before edit

---

## 9. Anti-patterns

| Mistake | Correct approach |
|---------|------------------|
| Building tenant UI in Next.js | Implement in `mobile/` (Web + iOS + Android) |
| Admin login accepting tenants | Reject; point to Flutter |
| Hardcoding CORS to only FRONTEND_URL in prod with hosted Flutter web | Set `PORTAL_URL` |
| Importing Mongoose models into web/Flutter | HTTP + types/repositories only |
| Trusting old audit P0 "missing portal" without checking `mobile/` | Re-verify; Flutter portal exists |
| Using emojis in docs or code | ASCII only |

---

## 10. Related workflow files

Load as needed from `.sixthrules/workflows/` (mirrored under `.claude/rules/`):

- master.md -- turn router
- automation-loop.md -- research-plan-execute-verify
- monorepo-boundaries.md -- client boundaries
- database-schema-protocol.md -- Mongoose safety
- deployment-verification.md -- Render / env
- code-quality-verification-gates.md -- completion checks
