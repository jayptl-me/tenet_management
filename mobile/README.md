# Tenet PG Portal (Flutter)

Role-based **tenant**, **guardian**, and **visitor** portals for the Tenet PG management system.

> **Split:** Next.js (`apps/web`) = **admin only**. This Flutter app (`mobile/`) = **everyone else**, shipped as:
>
> - **Flutter Web** (browser)
> - **iOS** app
> - **Android** app
>
> One codebase, three targets. **Agents:** [docs/PORTAL_CONNECTIVITY.md](../docs/PORTAL_CONNECTIVITY.md).

## Platforms (all supported)

| Target | Folder | Run | Build |
|--------|--------|-----|-------|
| Flutter Web | `web/` | `flutter run -d chrome` | `flutter build web` |
| iOS | `ios/` | `flutter run -d ios` | `flutter build ios` |
| Android | `android/` | `flutter run -d android` | `flutter build apk` / `appbundle` |

```bash
# Web
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000/api/v1

# iOS
flutter run -d ios --dart-define=API_BASE_URL=http://localhost:8000/api/v1

# Android emulator (host machine API)
flutter run -d android --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

## Setup

```bash
# From monorepo root
bun run mobile:setup

# Or
cd mobile && flutter pub get
```

### API base URL

Default: `http://localhost:8000/api/v1` (`lib/core/config/env.dart`)

```bash
flutter run --dart-define=API_BASE_URL=https://your-api.example.com/api/v1
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000/api/v1
```

On Android emulators, use `http://10.0.2.2:8000/api/v1` (maps to host localhost).

### Backend CORS (required for Flutter web)

The API allows any `http://localhost:*` / `http://127.0.0.1:*` origin in **development**.

Production requires:

| Env | Purpose |
|-----|---------|
| `FRONTEND_URL` | Admin Next.js origin |
| `PORTAL_URL` | This Flutter web origin |
| `CORS_EXTRA_ORIGINS` | Optional extra origins (comma-separated) |

See `apps/api/src/lib/cors-origins.ts` and monorepo `apps/api/.env.example`.

## Roles & routes

| Role (JWT) | Shell | Main routes |
|------------|-------|-------------|
| `tenant` | Tenant shell | `/tenant`, invoices, payments, visitors, complaints, meals, laundry, notices |
| `guardian` | Guardian shell | `/guardian` (ward), `/guardian/attendance` |
| tenant → visitor desk | Visitor portal | `/visitor`, `/visitor/register`, `/visitor/status` |
| `admin` | **Rejected** | Use `apps/web` admin login |

## Architecture

```
lib/
  main.dart / app.dart
  core/           # config, theme, dio client, storage, router
  features/
    auth/         # login, session restore
    tenant/       # resident home + finance + facilities
    guardian/     # ward overview + attendance
    visitor/      # visitor register / list / status (tenant-owned)
    shared/       # shared UI widgets
```

- **State:** Riverpod  
- **Routing:** go_router (role redirects + shell routes)  
- **HTTP:** Dio against Hono API (`@pg/api`)  
- **Storage:** Secure storage (mobile) / SharedPreferences (web)

## Auth flow

1. `POST /auth/login`  
2. Reject `admin` (admin panel only)  
3. Persist tokens + user  
4. Redirect by role to tenant or guardian shell  
5. Visitor portal requires authenticated **tenant**

## Feature map (API)

| Portal | Endpoints used |
|--------|----------------|
| Tenant invoices | `GET /invoices/my` |
| Tenant payments | `GET /payments/my`, `POST /payments/submit-utr` |
| Tenant complaints | `GET /complaints/my`, `POST /complaints` |
| Tenant visitors | `GET /visitors/my`, `POST /visitors`, arrive/depart |
| Tenant laundry | `GET/POST /laundry-slots` |
| Tenant meals | `GET /menus/today`, `POST /meals/feedback` |
| Tenant notices | `GET /notices` |
| Guardian ward | `GET /guardians/me/ward` |
| Guardian attendance | `GET /guardians/me/ward/attendance` |

## Seed credentials

Use sample tenants/guardians from `bun run seed:sample` (see `docs/CREDENTIALS.md` if present).

## Notes

- Feature flags on the API (`laundryEnabled`, `visitorManagementEnabled`, `guardianPortalEnabled`, etc.) still apply.
- Do **not** add tenant/guardian/visitor App Router pages under `apps/web/(admin)`.
