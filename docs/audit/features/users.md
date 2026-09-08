# Module 28: Users & Role-Based Access Control -- Feature Audit

Audit Pass: 1  
Audit Timestamp: 2026-09-08T03:35:00+05:30 (Asia/Kolkata)  
Audit Status: Complete & Remediated (Pass 1)  
Grade: A+  
Priority: All P1 & P2 Remediations Closed

> Ruthless, code-verified audit across Bun/Hono identity services, Next.js administrative login barriers, and Flutter resident mobile routing guards. Cryptographic token rotation, token reuse detection, account lockouts on brute-force, bcrypt 12-round hashing, comprehensive audit logging across all auth operations, and strict role separation are verified directly against active source code.

---

## 1. Executive Summary & Product Split

The Users & Role-Based Access Control (RBAC) subsystem provides centralized authentication, session state lifecycle, cryptographic credential management, and authorization enforcement across all client tiers. It ensures strict domain isolation between facility administrators and PG residents.

The product split is enforced at both the HTTP API layer and the individual client application shells:

| Surface          | Path / Package                                    | Platform / Framework          | Permitted Roles                 | Notes                                                                                                                                       |
| :--------------- | :------------------------------------------------ | :---------------------------- | :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin Panel      | `apps/web/src/app/login/page.tsx` & `(admin)/**`  | Next.js (Browser)             | `admin` only                    | Web login strictly rejects `tenant` and `guardian` accounts with clear descriptive guidance directing them to the mobile/Flutter web portal |
| Resident Portal  | `mobile/lib/features/auth/**` & `app_router.dart` | Flutter (Web + iOS + Android) | `tenant`, `guardian`            | Mobile router explicitly checks `user.role` and redirects `admin` or unknown roles immediately back to `/login`                             |
| Visitor Desk     | `mobile/lib/features/visitor/**`                  | Flutter (Web + iOS + Android) | `tenant` (kiosk / resident)     | Visitor desk operates as a tenant-authorized surface within the Flutter codebase, not an independent JWT role                               |
| API Layer        | `apps/api/src/routes/auth.ts` & `middleware/**`   | Bun + Hono + Mongoose         | All roles via JWT               | Stateless access tokens (15m expiry) paired with stateful rotating refresh tokens (7d expiry) and in-memory revocation store                |
| Shared Contracts | `packages/types/src/user.ts`                      | TypeScript DTOs               | Shared (`apps/api`, `apps/web`) | Canonical `IUser`, `IUserRole`, `IUserCreate`, `IUserWithTokens`, `ILoginRequest`, `IChangePasswordRequest`                                 |

---

## 2. Source Code Map

| Layer / Role         | Path                                                                                                                                                                                                                                              | Function & Scope                                                                                           |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| Mongoose Model       | [user.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/models/user.ts)                                                                                                                             | MongoDB schema, bcrypt 12-round pre-save hashing, brute force lockout logic, and `ntfyTopic` generation    |
| API Route Handler    | [auth.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/routes/auth.ts)                                                                                                                             | Login, refresh rotation, logout revocation, self profile (`/auth/me`), password reset, and change password |
| Token Management     | [jwt.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/lib/jwt.ts) & [tokenStore.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/lib/tokenStore.ts) | Access/refresh signing, JTI rotation, revocation tracking, and automatic token-reuse threat mitigation     |
| Auth Middleware      | [auth.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/middleware/auth.ts)                                                                                                                         | Bearer token extractor and JWT verification; populates `c.set('user', payload)`                            |
| Role Middleware      | [roles.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/middleware/roles.ts)                                                                                                                       | `adminOnly`, `tenantOnly`, `adminOrTenant`, and `selfOrAdmin` resource owner matching                      |
| Rate Limiter         | [rateLimiter.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/middleware/rateLimiter.ts)                                                                                                           | Rate limiters for auth attempts (`authLimiter`: 10 req/min) and password resets (`passwordResetLimiter`)   |
| Shared TS Types      | [user.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/user.ts)                                                                                                                              | Canonical role enums and user interfaces                                                                   |
| Admin Web Login      | [page.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/app/login/page.tsx)                                                                                                                        | Next.js login page with immediate client-side role check rejecting non-admins                              |
| Admin Auth Store     | [authStore.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/lib/authStore.ts)                                                                                                                      | Zustand persisted store holding access token and user metadata                                             |
| Mobile Auth Models   | [user.dart](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/core/models/user.dart)                                                                                                                      | `AppUser`, `AppRole` (`admin`, `tenant`, `guardian`), `AuthTokens`, and `AuthSession`                      |
| Mobile Auth Provider | [auth_provider.dart](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/features/auth/providers/auth_provider.dart)                                                                                        | Riverpod state notifier managing credentials, session restore, and `ensureTenantId()` self-heal            |
| Mobile Router Guards | [app_router.dart](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/core/router/app_router.dart)                                                                                                          | GoRouter redirect logic rejecting `admin` and isolating `/tenant` vs `/guardian` routes                    |

---

## 3. Data Model Audit

### Schema Definition (`apps/api/src/models/user.ts`)

- **Fields:**
  - `name` (`String`, required: true, trim: true, minlength: 2, maxlength: 100).
  - `email` (`String`, required: true, unique: true, lowercase: true, trim: true).
  - `phone` (`String`, required: true, unique: true, match: `/^\+91[6-9]\d{9}$/`).
  - `passwordHash` (`String`, required: true, `select: false` -- hidden from default queries).
  - `role` (`String`, enum: `['admin', 'tenant', 'guardian']`, default: `'tenant'`).
  - `ntfyTopic` (`String`, unique: true, default: `randomUUID()`, `select: false`).
  - `isActive` (`Boolean`, default: true).
  - `profilePhoto` (`String`, optional).
  - `tenantId` (`String`, optional) -- linked tenant profile ID.
  - `guardianId` (`String`, optional) -- linked guardian profile ID.
  - `passwordResetToken` (`String`, `select: false`, optional) -- sha256 hash.
  - `passwordResetExpires` (`Date`, `select: false`, optional).
  - `loginAttempts` (`Number`, default: 0, `select: false`).
  - `lockedUntil` (`Date`, default: null, `select: false`).
  - `createdAt`, `updatedAt` (`timestamps: true`).
- **Indexes:**
  - `{ email: 1 }` (unique, built-in).
  - `{ phone: 1 }` (unique, built-in).
  - `{ ntfyTopic: 1 }` (unique, built-in).
  - `{ role: 1 }` (optimizes role filtering).
  - `{ isActive: 1 }` (optimizes active user queries).
- **Security & Instance Methods:**
  - `pre('save')`: Hashes `passwordHash` with bcrypt using **12 salt rounds** whenever modified.
  - `comparePassword(candidate)`: Executes `bcrypt.compare`.
  - `recordLoginSuccess()`: Resets `loginAttempts = 0` and `lockedUntil = null`.
  - `recordLoginFailed()`: Increments `loginAttempts`; when reaching 5 attempts, sets `lockedUntil = now + 15 minutes`.
  - `toPublicJSON()`: Strips internal MongoDB properties and excludes `passwordHash`.
  - `findByEmail(email)`: Queries user selecting `+passwordHash +loginAttempts +lockedUntil`.

---

## 4. API Surface & Authorization Matrix

| Method | Path                    | Auth / Guard           | Purpose & Request Schema                                                                      | Response / Side Effects                                                                                                    | Status  |
| :----- | :---------------------- | :--------------------- | :-------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------ |
| `POST` | `/auth/login`           | `authLimiter` (10/min) | `{ email, password }`; validates format, checks lockout status, compares password             | Returns `{ accessToken, refreshToken, user }`; writes audit log `login` with IP/UserAgent                                  | WORKING |
| `POST` | `/auth/refresh`         | `authLimiter` (10/min) | `{ refreshToken }`; validates token signature, rotates JTI                                    | Returns `{ accessToken, refreshToken }`; on reuse detection: revokes all user sessions, returns 401 `TOKEN_REUSE_DETECTED` | WORKING |
| `POST` | `/auth/logout`          | `authGuard`            | Revokes all active refresh tokens in `tokenStore` for the authenticated user                  | Returns success message; writes audit log `logout`                                                                         | WORKING |
| `GET`  | `/auth/me`              | `authGuard`            | Retrieves authenticated user profile; automatically self-heals missing `tenantId` for tenants | Returns sanitized `IUser` object                                                                                           | WORKING |
| `POST` | `/auth/forgot-password` | `passwordResetLimiter` | `{ email }`; generates 32-byte random token, stores sha256 hash with 1h expiry                | Always returns 200 (anti-enumeration); dispatches email with reset URL                                                     | WORKING |
| `POST` | `/auth/reset-password`  | Public                 | `{ token, password }`; verifies token hash and expiration; updates password                   | Revokes all existing user sessions; writes audit log `password_reset`; returns success                                     | WORKING |
| `PUT`  | `/auth/password`        | `authGuard`            | `{ currentPassword, newPassword }`; verifies current password; hashes new password            | Revokes all existing user sessions; writes audit log `password_change`; returns success                                    | WORKING |

---

## 5. Security & Cryptographic Architecture

```
                       +-----------------------------+
                       |        Client Login         |
                       +-----------------------------+
                                       |
                                       v
                              [Brute-Force Check]
                           5 failures -> 15 min lock
                                       |
                                       v
                            [Bcrypt Hash Comparison]
                                12 Salt Rounds
                                       |
                         +-------------+-------------+
                         |                           |
                     (Success)                   (Failure)
                         |                           |
                         v                           v
                [Issue Token Pair]         [Increment Failures]
             Access Token:  15 min        Lock if attempts >= 5
             Refresh Token:  7 days
             (Rotated JTI Store)
```

### Security Invariants

1. **Bcrypt Salt Rounds:** All passwords are salted and hashed using 12 rounds via `bcryptjs`. Plaintext passwords are never stored in the database.
2. **Refresh Token Rotation & Reuse Detection:** Every call to `POST /auth/refresh` consumes the current refresh token's JTI and issues a new one. If an already-consumed token is re-submitted, `rotateRefreshToken` detects reuse, instantly revokes all tokens for that user, and logs a security warning.
3. **Account Lockout:** 5 consecutive invalid password attempts automatically locks the account for 15 minutes (`lockedUntil = Date.now() + 15m`). Subsequent login requests receive HTTP 423 `ACCOUNT_LOCKED` indicating remaining minutes.
4. **Account Inactivity Guard:** Deactivated accounts (`isActive: false`) receive HTTP 403 `ACCOUNT_DISABLED`.
5. **Session Revocation on Password Change:** Both `POST /auth/reset-password` and `PUT /auth/password` immediately invoke `revokeAllUserTokens(userId)` to invalidate all outstanding refresh tokens across all devices.
6. **Audit Trail Completeness:** All sensitive authentication actions (`login`, `logout`, `password_reset`, `password_change`) emit structured audit records with source IP and UserAgent details.

---

## 6. Detailed UI & Component Audit

### Admin Web Panel (`apps/web`)

1. **Login Screen (`apps/web/src/app/login/page.tsx`):**
   - Theme-aware background with subtle brand glow accents.
   - Form state management via `react-hook-form` + Zod schema validation (`email`, `password`).
   - Role enforcement check directly after token receipt:
     ```ts
     if (user.role !== 'admin') {
       setError(
         'This login is for administrators only. Tenant/Guardian accounts use the Tenet mobile / Flutter web portal.',
       );
       useAuthStore.getState().logout();
       return;
     }
     ```
   - Successful admin login navigates to `/dashboard`.
2. **Layout Route Guard (`apps/web/src/app/(admin)/layout.tsx`):**
   - Verifies active session and `role === 'admin'`. If token is absent or role is non-admin, redirects to `/login`.

### Flutter Mobile Portal (`mobile/`)

1. **Login Screen (`mobile/lib/features/auth/presentation/login_screen.dart`):**
   - Clean, centered card layout responsive across Mobile and Web viewports (max-width 420px).
   - Password visibility toggle with eye icon.
   - Bottom sheet for "Forgot Password?" requesting account email.
   - Bottom helper text: "Admins use the web admin panel. This app is for residents and guardians."
2. **Mobile Router Redirect (`mobile/lib/core/router/app_router.dart`):**
   - Admin rejection guard:
     ```dart
     if (user.role == AppRole.admin || user.role == AppRole.unknown) {
       return loggingIn ? null : '/login';
     }
     ```
   - Role boundary partitioning:
     - Tenants visiting `/guardian/*` are redirected to `/tenant`.
     - Guardians visiting `/tenant/*` or `/visitor/*` are redirected to `/guardian`.
3. **Session Auto-Restore & Healing (`mobile/lib/features/auth/providers/auth_provider.dart`):**
   - `restore()` re-hydrates tokens from secure storage and calls `/auth/me`.
   - `ensureTenantId()` automatically verifies or fetches the resident's linked `tenantId`.

---

## 7. Remediations & Gap Closure

| Gap ID       | Severity | Description                                              | Status     | Resolution                                                                                                                                    |
| :----------- | :------- | :------------------------------------------------------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **USR-P1-1** | P1       | Salt rounds discrepancies between documentation and code | **CLOSED** | Verified `SALT_ROUNDS = 12` in active model code                                                                                              |
| **USR-P2-1** | P2       | Audit log parity on password reset and change operations | **CLOSED** | Added `writeAuditLog` for `password_reset` and `password_change` in `apps/api/src/routes/auth.ts` capturing user ID, email, IP, and UserAgent |

---

## 8. Acceptance Checklist

- [x] Product split strictly respected: Admin panel in `apps/web`, resident/guardian portals in `mobile/`.
- [x] Admin login screen rejects `tenant` and `guardian` users with explicit error.
- [x] Mobile router rejects `admin` logins and routes tenants to `/tenant` and guardians to `/guardian`.
- [x] Bcrypt hashing with 12 salt rounds enforced on all password creation and updates.
- [x] Account lockout (5 failed attempts -> 15-minute lock) active and verified.
- [x] Cryptographic refresh token rotation with automatic session-wide revocation upon reuse detection.
- [x] Password reset generates 32-byte cryptographic token with 1-hour expiration and sha256 storage.
- [x] Session revocation on password reset and password change.
- [x] Comprehensive audit logging across login, logout, password reset, and password change.
- [x] Zero emojis introduced in documentation or source files.
