# Flutter Resident Portal -- Feature Audit

**Last verified:** 2026-07-16  
**Grade:** **B-** (MVP shell complete; several domains thin; guardian shallow; payment/QR and PDF gaps)  
**Path:** `mobile/` only (Flutter Web + iOS + Android)  
**Code is truth.** Re-verified against presentation screens, repositories, router, API routes, and feature flags.

Do **not** add resident UI under `apps/web` (Next.js is admin only).

---

## Product split confirmation

| Surface | Path | Platforms | Roles |
|---------|------|-----------|-------|
| Admin panel | `apps/web` | Browser (Next.js) | `admin` only |
| Resident portal | `mobile/` | Flutter Web + iOS + Android (one codebase) | `tenant`, `guardian`, visitor desk (tenant-auth) |
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

| Rule | Status |
|------|--------|
| Next.js has no tenant/guardian App Router trees | Confirmed by product docs + monorepo layout |
| Flutter rejects `admin` at login and router | Confirmed (`auth_repository.dart`, `app_router.dart`) |
| Clients talk HTTP only (no API source imports) | Confirmed (Dio + `Env.apiBaseUrl`) |
| API base | `API_BASE_URL` dart-define; default `http://localhost:8000/api/v1` (`mobile/lib/core/config/env.dart`) |

Connectivity details: [docs/PORTAL_CONNECTIVITY.md](../../PORTAL_CONNECTIVITY.md).

---

## Layout (code)

```
mobile/lib/
  core/
    config/env.dart          API_BASE_URL
    network/                 Dio client, unwrap success/data, 401 refresh
    router/app_router.dart   go_router + role guards
    storage/                 token + user session
    theme/app_theme.dart     Material 3 seed theme
    models/user.dart         AppRole, AppUser (tenantId, guardianId)
  features/
    auth/                    login, splash, providers
    tenant/                  shell + domain screens + TenantRepository
    guardian/                shell + ward + attendance + GuardianRepository
    visitor/                 shell + list/register/status + VisitorRepository
    shared/widgets/          EmptyState, ErrorBanner, StatusChip, FeatureDisabledWidget
```

Router: `mobile/lib/core/router/app_router.dart`.

---

## Screen inventory

| Role | Screen file | Route | Data repo | Wired vs half-baked vs stub | Notes |
|------|-------------|-------|-----------|-----------------------------|-------|
| Auth | `auth/presentation/splash_screen.dart` | `/` | `AuthRepository` + storage | **Wired** | Restores session, redirects by role |
| Auth | `auth/presentation/login_screen.dart` | `/login` | `AuthRepository.login` | **Wired** | Rejects admin client-side after login response |
| Tenant | `tenant/presentation/tenant_shell.dart` | shell | auth | **Wired** | Bottom nav Home/Invoices/Pay/Visitors/More + drawer |
| Tenant | `tenant/presentation/home_screen.dart` | `/tenant` | invoices/my, complaints/my, unread-count | **Wired** | Chips + snippets navigate detail; notification Badge |
| Tenant | `tenant/presentation/invoices_screen.dart` | `/tenant/invoices` | `myInvoices` | **Wired** | List + tap -> detail |
| Tenant | `tenant/presentation/invoice_detail_screen.dart` | `/tenant/invoices/:id` | detail + PDF + pay CTA | **Wired** | PDF download; Pay/UTR deep-link |
| Tenant | `tenant/presentation/payments_screen.dart` | `/tenant/payments` | payments, UTR, QR | **Wired** | UPI QR + UTR; invoiceId query preselect |
| Tenant | `tenant/presentation/visitors_tab_screen.dart` | `/tenant/visitors` | embeds visitor home | **Wired** | FAB -> register; hidden when flag off |
| Tenant | `tenant/presentation/more_screen.dart` | `/tenant/more` | app-config features | **Wired** | Hub filtered by flags + logout |
| Tenant | `tenant/presentation/complaints_screen.dart` | `/tenant/complaints` | list/create + ensureTenantId | **Wired** | Detail route; room via healed tenantId |
| Tenant | `tenant/presentation/meals_screen.dart` | `/tenant/meals` | menu + feedback | **Wired** | Categories + history; FeatureDisabledWidget |
| Tenant | `tenant/presentation/laundry_screen.dart` | `/tenant/laundry` | book + list | **Wired** | FeatureDisabledWidget + ensureTenantId; items P2 |
| Tenant | `tenant/presentation/notices_screen.dart` | `/tenant/notices` | notices | **Wired** | List + FeatureDisabledWidget; detail P2 |
| Tenant | `tenant/presentation/profile_screen.dart` | `/tenant/profile` | profile + change password | **Wired** | Read-only fields + password change |
| Tenant | `tenant/presentation/leaves_screen.dart` | `/tenant/leaves` | list/create/cancel | **Wired** | Cancel pending; FeatureDisabledWidget |
| Tenant | `tenant/presentation/attendance_screen.dart` | `/tenant/attendance` | check-in/out | **Wired** | FeatureDisabledWidget + ensureTenantId |
| Tenant | `tenant/presentation/notifications_screen.dart` | `/tenant/notifications` | list/read | **Wired** | Mark read; home Badge uses unread-count |
| Guardian | `guardian/presentation/guardian_shell.dart` | shell | auth | **Wired** | Ward + Attendance + Notices tabs |
| Guardian | `guardian/presentation/ward_screen.dart` | `/guardian` | ward | **Wired** | Overview; finance API not product scope |
| Guardian | `guardian/presentation/ward_attendance_screen.dart` | `/guardian/attendance` | attendance | **Wired** | FeatureDisabledWidget |
| Visitor | `visitor/presentation/visitor_shell.dart` | shell | auth | **Wired** | Tenant-only routes; back to tenant |
| Visitor | `visitor/presentation/visitor_home_screen.dart` | `/visitor` | `visitors/my` | **Wired** | List + status chip + navigate status |
| Visitor | `visitor/presentation/visitor_register_screen.dart` | `/visitor/register` | `createVisitor` | **Wired** | tenantId self-heal via `refreshUser`; phone normalize +91 |
| Visitor | `visitor/presentation/visitor_status_screen.dart` | `/visitor/status?id=` | getById, arrive, depart | **Wired** | Manual ID paste allowed; approve is admin-only (correct absence) |

**Stub count:** 0 pure stubs. Several **half-baked** screens (list/create only, missing secondary APIs).

---

## Auth matrix

| Concern | Behavior | Grade |
|---------|----------|-------|
| Login accepted | `tenant`, `guardian` | A |
| Login rejected | `admin` (exception message: use web admin panel); other roles "Unsupported" | A |
| Router blocks | `admin`/`unknown` forced to login; cross-role path redirects | A |
| Session restore | Tokens + user from storage; then `GET auth/me`; failure clears session | A |
| Token refresh | Dio interceptor on 401 via `auth/refresh` | A- |
| Logout | `POST auth/logout` best-effort + clear storage | A |
| tenantId heal (API) | `GET auth/me` looks up Tenant by userId and persists `User.tenantId` | A |
| tenantId heal (client) | `ensureTenantId` on profile, visitor register, laundry, leaves, attendance, complaints | A |
| Password | `PUT auth/password` on profile + logout after success | A |
| Forgot password | Login sheet -> `POST auth/forgot-password` | A |
| Feature flags | Prefetch `GET app-config` hides gated More/shell items | A- |

Visitor is **not** a JWT role. Visitor desk is a tenant-authenticated surface under `/visitor/*`.

---

## Feature depth matrix

| Domain | List | Detail | Create | Special | Status |
|--------|:----:|:------:|:------:|---------|--------|
| Auth | -- | -- | login | restore, refresh, reject admin | **PASS** |
| Home | snippets | -- | -- | action chips | **Thin** |
| Invoices | yes | yes | n/a | no PDF | **Partial** |
| Payments | yes | no | UTR submit | no QR/UPI | **Partial** |
| Complaints | yes | **no** | yes | roomId from profile | **Partial** |
| Visitors | yes | status | yes | arrive/depart | **PASS** (MVP) |
| Meals | menu + feedback history | -- | feedback | categories chips; mess flag | **PASS** |
| Laundry | yes | no | book | no cancel; weak flag UX | **Partial** |
| Notices | yes | no | n/a | no read/priority | **Thin** |
| Profile | yes (read) | -- | -- | docs uploaded flags only | **Partial** |
| Leaves | yes | no | yes | 403 UI | **PASS** (MVP) |
| Attendance | yes | -- | check-in/out | 403 UI; default flag off in seed | **PASS** (MVP) |
| Notifications | yes | -- | -- | mark read / all | **PASS** (MVP) |
| Guardian ward | overview | -- | -- | no invoices/payments | **Thin** |
| Guardian attendance | yes | -- | -- | no flag UX | **Thin** |

---

## Portal API coverage

| API area | Flutter uses | Missing / unused |
|----------|--------------|------------------|
| `auth/login`, `auth/me`, `auth/refresh`, `auth/logout` | Yes | `PUT auth/password`, `forgot-password`, `reset-password` |
| `invoices/my`, `invoices/:id`, `invoices/:id/pdf` | Yes | -- |
| `payments/my`, `POST payments/submit-utr`, `GET payments/qr-code` | Yes | WhatsApp share text optional UI |
| `complaints/my`, `POST complaints`, `GET complaints/:id` | Yes | Tenant comment updates if any |
| `visitors/my`, `POST visitors`, `GET visitors/:id`, arrive, depart | Yes | Admin approve (correctly not in portal) |
| `laundry-slots` GET/POST | Yes | Cancel/update slot; items optional not sent; weak 403 UX |
| `menus/today` | Yes | Future menus / week view |
| `meals/feedback`, `meals/feedback/my` | Yes | -- |
| `notices` | Yes | Detail prioritization; `noticeBoardEnabled` empty state |
| `tenants/:id` (profile read) | Yes | Document upload, profile edit, password |
| `leaves/my`, `POST leaves` | Yes | Cancel leave if API supports |
| `attendance/my`, check-in, check-out | Yes | -- |
| `notifications`, mark read, read-all | Yes | Push/FCM (none) |
| `guardians/me/ward`, `.../attendance` | Yes | No ward invoices/payments/notices endpoints used (likely none portal-scoped beyond these) |

### Feature flags (API `requireFeature`)

| Flag | Default (seed/middleware) | Portal impact | Flutter handling |
|------|---------------------------|---------------|------------------|
| `guardianPortalEnabled` | true | All guardian routes 403 when off | **Handled** FeatureDisabledWidget |
| `visitorManagementEnabled` | true | All visitor routes 403 | **Handled** FeatureDisabledWidget |
| `laundryEnabled` | true | Laundry 403 | **Handled** FeatureDisabledWidget |
| `attendanceEnabled` | **false** | Attendance 403 until admin enables | **Handled** on tenant attendance |
| `messFeedbackEnabled` | true | Meals feedback 403 | **Handled** on meals screen |
| `noticeBoardEnabled` | true | Notices 403 | **Handled** FeatureDisabledWidget |

Leaves: gated by `attendanceEnabled` (same as attendance API/nav) -- FLAG-leaves FIXED 2026-07-16.

---

## Half-baked / open gaps

### P0

None remaining for "missing MVP screens" (profile, leaves, attendance, notifications, invoice detail, meal categories exist). Remaining P0-class product risk is operational:

| ID | Gap | Paths |
|----|-----|-------|
| P0-F-OPS | Seed / create must still yield working tenant credentials + `User.tenantId` for first login; client heal only helps after `/auth/me` | `apps/api` seed/create tenant; Flutter login path |

(Do not re-file "missing Flutter screens for profile/leaves/attendance/notifications" -- fixed earlier; verified present 2026-07-16.)

### P1

| ID | Gap | Paths | Status |
|----|-----|-------|--------|
| P1-PAY-QR | Payments screen does not show UPI QR / deep link from `GET payments/qr-code` | `payments_screen.dart`, `tenant_repository.dart` | **FIXED 2026-07-16** -- QR image + UPI deep link + copy UPI ID |
| P1-INV-PDF | Invoice detail has no PDF open/download | `invoice_detail_screen.dart`; API `GET invoices/:id/pdf` | **FIXED 2026-07-16** -- authenticated download (web blob / native temp open) |
| P1-HOME | Home is chip + snippets; no room/rent header; invoices not navigable from home | `home_screen.dart` | **FIXED 2026-07-16** -- invoice + complaint snippets navigate to detail |
| P1-CMP-DET | Complaints list has no detail view; create blocked without roomId | `complaints_screen.dart` | **FIXED 2026-07-16** -- detail route + `GET complaints/:id` (roomId create still requires linked room) |
| P1-TID-HEAL | Consistent `refreshUser` before any `tenantId` mutation (laundry, leave, attendance) | laundry/leaves/attendance | **FIXED 2026-07-16** -- `AuthNotifier.ensureTenantId()` on write paths |
| P1-FLAG-UX | FeatureDisabledWidget only on meals/leaves/attendance; laundry, visitors, notices, guardian still raw 403 banners | respective presentation files | **FIXED 2026-07-16** -- laundry, visitors, notices, guardian ward/attendance/notices |
| P1-GUARD-DEPTH | Guardian only ward card + attendance list; no finance/notices/logout discoverability beyond drawer | `guardian/` | **FIXED 2026-07-16** -- notices tab via `GET notices` (ward-scoped); drawer destinations; no invented finance API |
| P1-AUTH-PW | No change-password or forgot-password UX | `login_screen.dart`, profile_screen | **FIXED 2026-07-16** -- forgot on login; change password on profile |
| P1-ATT-SEED | Seed sets `attendanceEnabled: false` | seed / app config | **Deferred P2** -- intentional ops default; enable in Settings; nav hides via app-config when off |
| P1-FLAG-PREFETCH | Nav always shows gated modules until 403 | more_screen / shell | **FIXED 2026-07-16** -- `app_features.dart` loads `GET app-config` |
| P1-UNREAD | No unread badge | home | **FIXED 2026-07-16** -- Badge + `notifications/unread-count` |
| P1-LEAVE-CANCEL | No tenant withdraw | leaves_screen | **FIXED 2026-07-16** -- `POST leaves/:id/cancel` + Cancel CTA |

### P2

| ID | Gap | Paths |
|----|-----|-------|
| P2-NTC | Notices are title+body list only; no pin/priority/date chips | `notices_screen.dart` |
| P2-LDY | Laundry no items count, no cancel, free-form time (not admin slot catalogue) | `laundry_screen.dart` |
| P2-PROF | Profile read-only; docs show Uploaded/Not only | `profile_screen.dart` |
| P2-NOTIF | Notifications no navigation to related invoice/complaint | `notifications_screen.dart` |
| P2-THEME | StatusChip monochrome primary only; some hardcoded `AppTheme.muted` vs ColorScheme | `portal_widgets.dart`, guardian/visitor screens |
| P2-TYPES | All repos parse `Map<String, dynamic>` (no typed Dart models) | `*/data/*_repository.dart` |

---

## Closed / do-not-refile

| Old claim | Live status (2026-07-16) |
|-----------|---------------------------|
| Profile / KYC / password screen **missing** | Profile **exists**; password change + forgot **wired** |
| Leaves **missing** | **Present** list + create + 403 UI |
| Attendance check-in **missing** | **Present** with check-in/out |
| Notifications **missing** | **Present** with mark read |
| Invoice detail **missing** | **Present** with PDF download |
| Meal category chips / feedback history **missing** | **Present** |
| tenantId P0 with no heal | API `/auth/me` self-heal + client `ensureTenantId` on write paths |
| "Build tenant portal in Next.js" | **Forbidden** -- Flutter only |
| Pure stub empty screens | **None** found under presentation trees |
| Payments QR / invoice PDF unused | **Wired** 2026-07-16 |

---

## Acceptance for later fix agents

Minimum portal MVP (smoke):

1. Seed tenant can login Flutter Web (and optionally iOS/Android) with `API_BASE_URL`.
2. View invoices list + detail + PDF; submit UTR; UPI QR on payments for open invoice.
3. Create complaint (tenant has room); open complaint detail; register visitor; meal feedback; book laundry (flags on).
4. Profile shows name/room/rent when `tenantId` linked.
5. Leaves list+create; attendance check-in when `attendanceEnabled`; notifications list.
6. Guardian sees ward + attendance + notices when `guardianPortalEnabled`.
7. Admin login rejected in Flutter; no admin CRUD screens.
8. `cd mobile && flutter analyze` clean.
9. No resident routes under `apps/web`.

Stretch (P1 closeout):

- [x] UPI QR on payments for selected invoice
- [x] Invoice PDF open (url_launcher / web blob)
- [x] FeatureDisabledWidget on laundry, visitors, notices, guardian
- [x] tenantId `ensureTenantId` / refreshUser before writes
- [x] Change password from profile
- [x] Home invoice/complaint tap-through (room/rent header still optional)
- [x] app-config feature prefetch + unread badge + leave cancel

---

## Remediation log

| Date | Note |
|------|------|
| 2026-07-12 | Portal scaffold + gap matrix; many screens marked missing |
| 2026-07-12 | MVP pass claimed: profile, invoice detail, leaves, attendance, notifications, meal categories, theme tokens |
| 2026-07-16 | **Full re-audit from source.** Confirmed MVP screens present and wired. |
| 2026-07-16 | **Queue D Flutter depth.** FIXED P1-PAY-QR, P1-INV-PDF, P1-HOME, P1-CMP-DET, P1-TID-HEAL, P1-FLAG-UX, P1-GUARD-DEPTH. |
| 2026-07-16 | **Goal pass.** FIXED P1-AUTH-PW, flag prefetch, unread badge, leave cancel; screen inventory reconciled to Wired. ATT-SEED deferred product. |

---

## Grades summary

| Area | Grade | One-liner |
|------|-------|-----------|
| **Overall** | **B+** | MVP + finance + flags + password + cancel leave |
| Auth / routing | A | Role gates + session + password + ensureTenantId |
| Tenant finance | B+ | List/UTR/detail + QR + PDF + pay bridge |
| Tenant ops (complaints/visitors/leaves/attendance) | A- | Detail + cancel leave + heal + flags |
| Tenant lifestyle (meals/laundry/notices) | B+ | Flag UX + app-config hide |
| Profile / notifications | A- | Profile + change password; Home unread Badge; inbox mark-read |
| Guardian | B | Ward + attendance + notices; finance API not product scope |
| Visitor desk | B | Register + lifecycle OK for tenant |
| Feature-flag UX | A- | app-config prefetch hides nav; FeatureDisabledWidget on gated screens |
| Design tokens | B | AppTheme present; StatusChip not semantic by status (P2) |
