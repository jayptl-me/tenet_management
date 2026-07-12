# Portal Connectivity (Admin Web + Flutter + API)

> Source of truth for how clients talk to `@pg/api`. Agents must follow this when changing CORS, auth, or portals.

## Product split (non-negotiable)

| Product | Codebase | Platforms | Who logs in |
|---------|----------|-----------|-------------|
| **Admin panel** | `apps/web` (Next.js) | Browser only | `admin` only |
| **Resident portal** | `mobile/` (Flutter) | **Flutter Web + iOS + Android** (one codebase) | `tenant`, `guardian` (+ visitor desk for tenants) |

Same Flutter app binary sources ship to:

- **Flutter Web** (`mobile/web/`) -- browser portal for residents
- **iOS** (`mobile/ios/`) -- App Store / simulator
- **Android** (`mobile/android/`) -- Play Store / emulator

**Do not** add tenant/guardian/visitor App Router pages under `apps/web`. Next.js stays admin-only.

## Clients (technical)

| Client | Path | Roles | Transport |
|--------|------|-------|-----------|
| Admin web | `apps/web` | `admin` only | Ky HTTP + SSE to `/api/v1` |
| Flutter (Web + iOS + Android) | `mobile/` | `tenant`, `guardian` (+ visitor desk) | Dio HTTP to `/api/v1` |

CORS applies to **Flutter Web** (browser Origin). **iOS/Android** native apps usually send no Origin; CORS does not block them.

## Base URL

All REST paths are under:

```
{API_BASE}/api/v1/...
```

| Environment | Typical API base |
|-------------|------------------|
| Local API | `http://localhost:8000/api/v1` |
| Android emulator | `http://10.0.2.2:8000/api/v1` |
| Production | `https://<api-host>/api/v1` |

### Flutter (one app, three targets)

Defined in `mobile/lib/core/config/env.dart` (`API_BASE_URL`).

```bash
# Flutter Web (resident portal in browser)
cd mobile && flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000/api/v1

# iOS simulator / device
cd mobile && flutter run -d ios --dart-define=API_BASE_URL=http://localhost:8000/api/v1
# Physical device: use your machine LAN IP, e.g. http://192.168.1.10:8000/api/v1

# Android emulator
cd mobile && flutter run -d android --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

Release builds:

```bash
cd mobile && flutter build web --dart-define=API_BASE_URL=https://api.example.com/api/v1
cd mobile && flutter build ios --dart-define=API_BASE_URL=https://api.example.com/api/v1
cd mobile && flutter build apk --dart-define=API_BASE_URL=https://api.example.com/api/v1
```

### Admin web (Next.js only)

`NEXT_PUBLIC_API_URL` (see `apps/web/.env.example`) defaults to `http://localhost:8000/api/v1`.

## Auth contract

1. `POST /auth/login` `{ email, password }` -> `{ accessToken, refreshToken, user }`
2. Send `Authorization: Bearer <accessToken>` on protected routes
3. `POST /auth/refresh` `{ refreshToken }` -> new token pair
4. `GET /auth/me` -> public user shape

| Role | Where to log in | Rejected by |
|------|-----------------|-------------|
| `admin` | Next.js `apps/web` `/login` only | Flutter login (throws) |
| `tenant` | Flutter Web **or** iOS/Android app | Admin web login |
| `guardian` | Flutter Web **or** iOS/Android app | Admin web login |

JWT payload includes `sub` (user id) and `role`. Flutter and admin never share layouts.

## CORS (backend)

Implemented in:

- `apps/api/src/lib/cors-origins.ts`
- `apps/api/src/index.ts` (Hono `cors` middleware)
- Env: `apps/api/src/lib/env.ts`, `apps/api/.env.example`

| Variable | Purpose |
|----------|---------|
| `FRONTEND_URL` | Admin Next origin; email reset links |
| `PORTAL_URL` | Production Flutter web origin |
| `CORS_EXTRA_ORIGINS` | Comma-separated extra origins |

**Development:** any `http://localhost:*` or `http://127.0.0.1:*` Origin is allowed (Flutter web random ports).

**Production:** only `FRONTEND_URL`, `PORTAL_URL`, and `CORS_EXTRA_ORIGINS`. Set `PORTAL_URL` when hosting Flutter web.

Native mobile requests typically omit `Origin`; CORS does not block them.

## Feature flags

Portal API routes still respect AppConfig flags (`requireFeature`):

| Flag | Affects |
|------|---------|
| `guardianPortalEnabled` | Entire `/guardians` router including `/me/ward` |
| `visitorManagementEnabled` | `/visitors` |
| `laundryEnabled` | `/laundry-slots` |
| `messFeedbackEnabled` | `/meals` |
| `noticeBoardEnabled` | `/notices` |
| `attendanceEnabled` | `/attendance` |

If a Flutter screen 403s with feature-disabled, check admin Settings feature toggles.

## Primary portal API map

### Tenant (role `tenant`)

| Area | Methods |
|------|---------|
| Profile | `GET /tenants/:id` (self) |
| Invoices | `GET /invoices/my` |
| Payments | `GET /payments/my`, `POST /payments/submit-utr` |
| Complaints | `GET /complaints/my`, `POST /complaints` |
| Visitors | `GET /visitors/my`, `POST /visitors`, `POST /visitors/:id/arrive|depart` |
| Laundry | `GET/POST /laundry-slots` |
| Meals | `GET /menus/today`, `POST /meals/feedback` |
| Notices | `GET /notices` |

### Guardian (role `guardian`)

| Area | Methods |
|------|---------|
| Ward | `GET /guardians/me/ward` |
| Attendance | `GET /guardians/me/ward/attendance` |

### Visitor desk

Not a JWT role. Implemented as a Flutter shell for **authenticated tenants** under `/visitor/*`.

## Agent rules (connectivity)

1. Changing API response shapes used by Flutter: update `mobile/lib/features/*/data/*_repository.dart` and prefer documenting shapes in `@pg/types` when shared.
2. Changing CORS: update `cors-origins.ts` + `.env.example` + this doc + `render.yaml` if new env keys.
3. Never call Mongo/Mongoose from Flutter or Next; HTTP only.
4. Do not mount resident portal UI under `apps/web/(admin)`.
5. After API auth or CORS changes, smoke-test: admin login, Flutter tenant login, Flutter guardian login.

## Smoke checklist

```bash
# API health
curl -s http://localhost:8000/api/v1/health

# CORS preflight from Flutter-like origin (dev)
curl -s -I -X OPTIONS http://localhost:8000/api/v1/auth/login \
  -H "Origin: http://localhost:55555" \
  -H "Access-Control-Request-Method: POST"

# Expect Access-Control-Allow-Origin reflecting the Origin in development
```

## Related files

| File | Role |
|------|------|
| `mobile/README.md` | Flutter setup and routes |
| `AGENTS.md` | Agent steering + portal boundaries |
| `docs/specs/01-core-architecture.md` | Architecture overview |
| `.sixthrules/workflows/monorepo-boundaries.md` | Package boundaries including mobile |
| `.sixthrules/workflows/codebase-index.md` | Path index |
