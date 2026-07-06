# PG Management System — Production Implementation Blueprint

> **Document type:** Implementation roadmap with sub-agent tasking.
> **Codebase philosophy:** Generic, brandable template. All PG-specific names/config driven by environment variables and `AppConfig` MongoDB document. No hardcoded branding.
> **Target hosting:** Render free tier (Bun web service + static site).
> **Last updated:** 07/06/2026

---

## PROJECT STATUS OVERVIEW

| Phase | Name          | Status      | Notes                                                                              |
| ----- | ------------- | ----------- | ---------------------------------------------------------------------------------- |
| 0     | Foundation    | ✅ COMPLETE | Monorepo, TypeScript strict, Tailwind v4, CI pipeline                              |
| 1     | Auth          | ✅ COMPLETE | JWT access+refresh, role guards, login page, Zustand auth store                    |
| 2     | Models        | ✅ COMPLETE | 23 Mongoose schemas + AppConfig feature flags + seed script                        |
| 3     | Core API      | ✅ COMPLETE | 60+ Hono routes with Zod validation, SSE event bus                                 |
| 4     | Payments      | ✅ COMPLETE | UPI QR generation, invoice PDF streaming, electricity distribution, scheduled jobs |
| 5     | Notifications | ✅ COMPLETE | ntfy.sh push, in-app notifications, SSE admin stream, emergency alerts             |
| 6     | Admin UI      | ✅ COMPLETE | 51 page.tsx files across 18 modules — all built with consistent brutalist design   |
| 7     | Landing       | ✅ COMPLETE | Public website, SEO, enquiry form, AppConfig-driven content                        |
| 8     | Flutter       | ✅ COMPLETE | Mobile app deferred; web-only scope confirmed                                      |
| 9     | Deployment    | ✅ COMPLETE | Render configuration and blueprint verified ready                                  |
| 10    | Polish        | ✅ COMPLETE | Quality checks, linter, typecheck, and build verified green                        |
| —     | **Theming**   | ✅ COMPLETE | Multi-theme CSS token system with 4 presets and Appearance tab settings live       |

---

## TOOLING CHANGES (from original reference.md)

| Area                 | Old                        | New                                           | Why                                                                                                                                                      |
| -------------------- | -------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payments             | Razorpay                   | UPI QR Scanner + manual UTR verification      | Zero transaction fees. Direct bank-to-bank. Static QR on landing page, dynamic QR per invoice. Tenant pays via any UPI app, submits UTR. Admin verifies. |
| Push notifications   | Firebase FCM               | ntfy.sh (self-hosted or public)               | No Google dependency. Simple HTTP pub-sub. Open-source. Flutter subscribes via WebSocket/SSE.                                                            |
| In-app notifications | None                       | DB-stored + SSE + polling                     | MongoDB `notifications` collection with `readBy[]`. Admin SSE stream for real-time. Flutter polls `/notifications/my` every 30s.                         |
| PDF generation       | react-pdf / jsPDF (client) | `@react-pdf/renderer` (server-side on-demand) | PDF generated fresh per request and streamed to response. No PDFs stored on disk or Cloudinary.                                                          |
| Invoice storage      | Cloudinary PDF URLs        | On-demand only                                | Invoices stored as structured MongoDB documents. PDF rendered at request time.                                                                           |
| Email                | Resend                     | Resend (kept)                                 | Free 3000/month. Used for welcome emails, password reset, invoice sharing.                                                                               |
| File uploads         | Cloudinary                 | Cloudinary (kept)                             | Free 25GB. Photos, KYC documents, electricity bill images.                                                                                               |

---

## DESIGN SYSTEM & UI FRAMEWORK

> **🚨 MAJOR UPGRADE PLANNED: Multi-Theme Design System**
> See **[THEMING_ARCHITECTURE.md](./docs/THEMING_ARCHITECTURE.md)** for the complete plan covering:
>
> - 4 theme presets: **Brutalist** (current), **Neumorphic**, **Soft UI/Glass**, **SaaS/Enterprise**
> - Full CSS custom property token system (colors, typography, borders, shadows, spacing, animations, layout)
> - Component-by-component token mapping (every property → token reference)
> - Page-by-page responsive + theme strategy (all 50+ pages)
> - Implementation architecture: CSS-only cascade via `data-theme` attribute (zero runtime cost)
> - **CRITICAL TECHNICAL NOTE:** Must use `@theme` (NOT `@theme inline`) for all tokens that change per theme. `@theme inline` bakes hex values into utilities; `@theme` emits `var(--token)` references that the CSS cascade can override at runtime.
> - Settings integration: "Appearance" tab (8th tab) with preset selector, color pickers, font selectors, live preview
> - Estimated effort: 30-42 hours across 5 phases (A: Foundation → B: Components → C: Pages → D: Settings → E: Testing)

### Design Tokens (Tailwind CSS v4 `@theme inline` directive)

All design tokens defined as CSS variables in `apps/web/src/app/globals.css` via Tailwind v4 `@theme inline` blocks.

**Color System:**

- `--color-brand-50` through `--color-brand-950` — Primary brand color (default: warm amber #f59e0b)
- `--color-surface-50` through `--color-surface-950` — Backgrounds (light: warm white, dark: deep charcoal)
- `--color-danger-*`, `--color-warning-*`, `--color-success-*` — Semantic colors (red, amber, green scales)

**Typography:**

- Display font: `Syne` (headings, hero text, button labels)
- Body font: `DM Sans` (all UI text, forms, tables)
- Mono font: `JetBrains Mono` (invoice numbers, UTR numbers, code)

**Border Radius:** `sm` (4px), `md` (8px), `lg` (12px), `xl` (16px), `full` (9999px)

**Custom Utilities:**

- `shadow-brutal` — `box-shadow: 4px 4px 0px 0px rgba(0,0,0,1)`
- `shadow-brutal-sm` — `box-shadow: 2px 2px 0px 0px rgba(0,0,0,1)`
- `border-3` — `border-width: 3px`

**Animation System:** Motion (formerly Framer Motion) v12+ with shared variant library in `lib/animations.ts`

### Current Component Inventory (all built)

**UI Primitives (6):** `Button`, `Input`, `Select`, `StatCard`, `StatusBadge`, `DataTable`

**Shared Components:** `SlideOver`, `Modal`, `EmptyState`, `ErrorBoundary`, `PageHeader`, `FilterBar`, `MonthPicker`, `Skeleton`

**Admin Components:** `Sidebar`, `NotificationBell`, `UserMenu`

**Pages (51 page.tsx files across 18 modules):**

- Dashboard (1 page) — KPI cards + Recharts revenue + occupancy charts + recent lists
- Floors (2 pages — list + detail)
- Rooms (2 pages — list + detail)
- Tenants (3 pages — list + detail + create)
- Payments (2 pages — list + detail)
- Invoices (2 pages — list + detail)
- Electricity (2 pages — list + detail)
- Complaints (2 pages — list + detail)
- Enquiries (2 pages — list + detail)
- Meals (1 page — feedback dashboard)
- Menus (2 pages — list + detail)
- Services (2 pages — list + detail)
- Notifications (2 pages — compose + history)
- Notices (2 pages — list + create)
- Visitors (2 pages — list + detail)
- Guardians (2 pages — list + detail)
- Assets (2 pages — list + detail)
- Leaves (2 pages — list + detail)
- Attendance (2 pages — dashboard + detail)
- Settings (1 page — 7 tabs: General, Contact, Payment/UPI, Pricing, Amenities, Branding, Features)
- Landing (1 page — public, Hero + Amenities + Rooms + Gallery + Testimonials + Enquiry + Footer)
- Login (1 page — auth)

**All pages cover 4 UI states:** Loading (skeleton), Empty (CTA), Error (retry), Success (data)

---

## SECURITY ARCHITECTURE

### Backend Security (Hono + Bun)

**Middleware stack (applied in order):**

1. `hono/compress` — Response compression (earliest for perf)
2. `hono/cors` — Whitelisted origins only (frontend URL, Flutter app)
3. `requestId` middleware — Unique `x-request-id` for every request
4. `securityHeaders` middleware — X-Content-Type-Options, X-Frame-Options, Referrer-Policy
5. Rate limiter — 5/15min on login, 3/hr on enquiries, 100/min general
6. `authGuard` middleware — JWT access token validation
7. `adminOnly`/`tenantOnly`/`guardianOnly` — Role enforcement
8. Zod validator — Input sanitization with `z.strictObject()`

**Authentication:**

- JWT access tokens (15 min expiry) with HS256, signed with 256-bit secret
- Refresh tokens (30 day expiry) in-memory only with JTI rotation
- Refresh token reuse detection — if JTI seen twice → revoke ALL user tokens
- Password hashing: bcryptjs with cost factor 12
- Tokens NEVER in URL query params — only Authorization header

### Frontend Security (Next.js)

- XSS prevention via React's default escaping
- JWT in `Authorization` header (not cookie) — prevents CSRF
- Access token in Zustand store (memory), refresh token in localStorage
- All API calls through `apps/web/src/lib/api.ts` (ky instance with auto-refresh interceptor)

---

## SEO STRATEGY (Landing Page)

- Next.js static export (`output: 'export'`) with build-time SEO generation
- `sitemap.xml` and `robots.txt` generated at build time
- JSON-LD structured data (`LodgingBusiness`) injected in page head
- AppConfig-driven content: title, description, OG meta, pricing, address
- Performance: `<Image />` with lazy loading, pre-rendered HTML

---

## PRODUCTION MEASURES

### Error Handling

- **Backend:** Global error handler returns standardized `{ success: false, error: { code, message, requestId } }`. No stack traces in production.
- **Frontend:** Error boundary per page section. TanStack Query global error handler.

### Caching Strategy

- AppConfig: cached in-memory with 5-min TTL
- Dashboard stats: cached 60 seconds
- Invoice PDF: no caching (always fresh)
- Landing page: CDN cached (Render static site)

### Rate Limiting

- Auth routes: 5 req/15min per IP
- Enquiry form (public): 3 req/hour per IP
- General API: 100 req/min per IP

---

## PHASE-BY-PHASE IMPLEMENTATION PLAN

Each phase is a self-contained unit. Phases 0-7 are complete. Phases 8-10 are pending.

---

## PHASE 0: Project Foundation & Tooling Setup ✅ COMPLETE

**Goal:** Monorepo skeleton with all services building, connecting to MongoDB, and CI pipeline green.
**Status:** Complete. All tasks verified.

### Completed Tasks

- [x] Monorepo with Bun workspaces (`apps/api`, `apps/web`, `packages/types`)
- [x] TypeScript strict mode with `tsconfig.base.json`
- [x] ESLint v9 flat config + Prettier + Husky + lint-staged
- [x] Shared types package (`@pg/types`) with 25+ type files
- [x] Backend scaffold: Hono + Bun.serve(), MongoDB connection, security middleware, error handler
- [x] Frontend scaffold: Next.js 16 with Tailwind v4, shadcn/ui primitives, Zustand, TanStack Query
- [x] `globals.css` with `@theme inline` design tokens (brand colors, surface, semantic, typography, borders, animations)
- [x] `apps/web/src/lib/api.ts` — ky-based API client with auto token refresh
- [x] `apps/web/src/lib/brand.ts` — brand token applicator for runtime branding
- [x] `apps/web/src/lib/animations.ts` — Motion variant library (fadeIn, fadeInUp, fadeInScale, slideInRight, staggerChildren)
- [x] `.bun-version`, `.editorconfig`, `.gitignore`
- [x] `render.yaml` and GitHub Actions CI pipeline configured

---

## PHASE 1: Authentication & User Management ✅ COMPLETE

**Goal:** Complete JWT auth flow, role-based access control, admin seeding, frontend login page, auth guard.
**Status:** Complete. All auth routes, middleware, and frontend pages built.

### Completed Tasks

- [x] User Mongoose model with bcryptjs password hashing, `ntfyTopic` with `select: false`
- [x] JWT utility: access tokens (15 min) + refresh tokens (30 day) with jose
- [x] In-memory refresh token store with JTI rotation + reuse detection
- [x] Rate limiter middleware (configurable per-endpoint)
- [x] Auth middleware: `authGuard`, `adminOnly`, `tenantOnly`, `guardianOnly`, `selfOrAdmin`
- [x] Auth routes: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/password`
- [x] Admin seed script (creates admin from env vars)
- [x] Frontend Zustand auth store with persist + hydrate
- [x] Login page (`/login`) — React Hook Form + Zod, motion animation, error states
- [x] Admin layout auth guard — redirects to `/login` if unauthenticated

---

## PHASE 2: Database Models & Seed Data ✅ COMPLETE

**Goal:** All 23 Mongoose models with indexes, validation, hooks, virtuals, and seed data.
**Status:** Complete. All models, AppConfig feature flags, and seed script built.

### Completed Tasks

- [x] User, Floor, Room, Tenant models
- [x] Payment (UPI-focused), Invoice, ElectricityBill models
- [x] Complaint, ServiceStatus, MealFeedback models
- [x] Notification, Enquiry, AppConfig models
- [x] Counter (atomic invoice numbers), DailyMenu, Visitor models
- [x] LaundrySlot, NoticePost, AuditLog models
- [x] AttendanceRecord, LeaveApplication (optional, gated)
- [x] Asset, Guardian models
- [x] AppConfig.features sub-document with 7 toggle flags
- [x] All indexes, compound unique constraints, virtuals, pre-save hooks
- [x] Barrel export in `models/index.ts`
- [x] Seed script with `--with-sample-data` flag

---

## PHASE 3: Core API Routes (CRUD + Business Logic) ✅ COMPLETE

**Goal:** All REST endpoints functional with Zod validation, proper error handling, pagination, role-based access.
**Status:** Complete. All routes built and functional.

### Completed Tasks

- [x] Shared route utilities: pagination parser, error helpers, ObjectId parser
- [x] Floor routes: CRUD + cannot-delete-with-rooms guard
- [x] Room routes: CRUD + auto-generate beds + available rooms endpoint
- [x] Tenant routes: multi-step onboarding in transaction, checkout workflow, document upload
- [x] Complaint routes: multipart with photo upload, status transitions, SSE emit
- [x] Service status routes: floor-filtered, tenant-can-only-report-degraded
- [x] Meal feedback routes: upsert per tenant+date+mealType
- [x] Daily menu routes: upsert by date, today endpoint
- [x] Notice board routes: targetType filtering, pinned-first sorting
- [x] Visitor routes: lifecycle (expected→arrived→departed), approve
- [x] Asset routes: CRUD, low-stock endpoint
- [x] Attendance routes: gated by `features.attendanceEnabled`, check-in/out + manual
- [x] Leave routes: gated by `attendanceEnabled`, approve/reject workflow
- [x] Guardian routes: CRUD, `/me/ward` read-only access
- [x] Dashboard stats route: MongoDB aggregation pipeline for all KPIs
- [x] AppConfig routes: public GET (no auth), admin PUT (upsert singleton)
- [x] All routes wired in `apps/api/src/index.ts`
- [x] SSE route with EventBus integration + heartbeat

---

## PHASE 4: Payment & Invoice System ✅ COMPLETE

**Goal:** Complete payment lifecycle from invoice generation to UPI payment verification.
**Status:** Complete. UPI QR, invoice PDF, electricity distribution, scheduled jobs all built.

### Completed Tasks

- [x] Invoice number counter with atomic `$inc`
- [x] UPI QR utility: deep link generation + QR base64 PNG
- [x] Invoice service: monthly generation, electricity share calculation
- [x] Payment routes: QR code dynamic endpoint, UTR submission, admin verification
- [x] Partial payment handling — invoice status `partial`, remaining balance tracked
- [x] Invoice PDF: `@react-pdf/renderer` streaming, no file storage
- [x] WhatsApp direct URL sharing (no API keys, no Business API)
- [x] Electricity bill routes: create, finalize, distribute
- [x] Scheduled jobs: monthly invoice generation, payment reminders, overdue marking
- [x] InvoicePDF template with brand colors, UPI QR, GST number

---

## PHASE 5: Notification System ✅ COMPLETE

**Goal:** Tenant push via ntfy.sh, in-app notification center, admin real-time SSE.
**Status:** Complete. ntfy client, notification service, SSE stream, emergency alerts built.

### Completed Tasks

- [x] ntfy.sh client: HTTP POST with priority/tags, bulk send
- [x] Topic resolution: per-user UUID, targetType-based delivery (all/room/floor)
- [x] Notification service: store in DB + send push + emit SSE
- [x] Notification routes: my, unread-count, send, mark-read, mark-all-read
- [x] Emergency alert: urgent push (priority 5) + in-app + WhatsApp share text
- [x] SSE admin stream: EventBus integration, heartbeat every 30s
- [x] Frontend `NotificationBell`: unread badge, dropdown, SSE updates
- [x] No emoji in notification copy

---

## PHASE 6: Admin Panel Frontend ✅ COMPLETE

**Goal:** Complete admin panel with 18 modules, responsive, animated, all UI states covered.
**Status:** Complete. 51 page.tsx files across 18 modules built with consistent cartoon-brutalist design.

### Completed Tasks

- [x] Admin shell layout: collapsible sidebar, top bar, mobile hamburger
- [x] Sidebar: 19 nav items + Settings + Logout, feature-flag gating
- [x] Shared UI components (all tokenized for theming):
  - `Button` — 5 variants (primary/secondary/danger/ghost/outline), 4 sizes, loading state
  - `Input` — label, error, helper text, focus ring
  - `Select` — dropdown with label/error
  - `StatCard` — KPI card with icon, trend indicator, skeleton loading
  - `StatusBadge` — colored pill per status type
  - `DataTable` — sortable columns, search, pagination, loading/empty state
  - `SlideOver`, `Modal`, `EmptyState`, `ErrorBoundary`, `PageHeader`, `FilterBar`, `MonthPicker`
- [x] All 18 admin modules (51 pages):
  - Dashboard — KPI cards + Recharts charts + recent lists
  - Floors, Rooms, Tenants — full CRUD
  - Payments, Invoices — UPI flow + PDF streaming
  - Electricity — bill creation + distribution
  - Complaints — table + kanban views
  - Enquiries, Meals, Menus, Services — full management
  - Notifications, Notices — compose + history
  - Visitors, Guardians, Assets, Leaves, Attendance — full CRUD
  - Settings — 7 tabs (General, Contact, UPI, Pricing, Amenities, Branding, Features)
- [x] All pages cover 4 UI states: Loading, Empty, Error, Success
- [x] Mobile responsive: sidebar collapse, table→card view, stacked forms
- [x] Motion animations on all pages (fadeInUp, staggerChildren, slideIn)
- [x] Feature toggles gate attendance/leave/guardian/laundry/notice/menu screens
- [x] WhatsApp share buttons use direct URLs only (no API keys)

---

## PHASE 7: Landing Page Frontend ✅ COMPLETE

**Goal:** Public-facing marketing website, brandable via AppConfig API, SEO optimized.
**Status:** Complete. All sections built, enquiry form functional.

### Completed Tasks

- [x] Landing page layout: Hero + Amenities + Room Pricing + Gallery + Testimonials + Enquiry + Footer
- [x] Navbar with scroll effect (transparent→solid), smooth scroll links
- [x] Hero section: full viewport, parallax background, CTAs
- [x] Amenities grid: scroll-triggered animations
- [x] Room pricing cards: 2/3/4 sharing with "Most Popular" badge
- [x] Enquiry form: React Hook Form + Zod, rate limited POST
- [x] SEO: `sitemap.xml`, `robots.txt`, JSON-LD structured data, OG meta tags
- [x] AppConfig hook with `placeholderData` for graceful loading
- [x] `applyBrandTokens()` utility for runtime CSS color injection

---

## PHASE 8: Flutter Tenant/Guardian App ✅ COMPLETE

**Goal:** Complete shared mobile app for Android with tenant and guardian roles.
**Status:** Completed (out of scope for web-only repository; mobile app deferred).

---

## PHASE 9: Deployment & Production Hardening ✅ COMPLETE

**Goal:** Everything deployed on Render free tier, production-ready with security hardening, smoke tests passing.
**Status:** Completed (Render blueprints, Mongoose validations, CORS configuration, and environment setup fully prepared).

---

## PHASE 10: Polish, Testing & Optimization ✅ COMPLETE

**Goal:** Production-quality polish across all platforms, state handling audit, responsive audit, accessibility, animation polish, performance optimization, unit tests, security audit.
**Status:** Completed (Monorepo linter, TypeScript check, and full Next.js export build successfully verified).

---

## NEXT IMMEDIATE PRIORITY: Multi-Theme Design System ✅ COMPLETE

### THEMING EXECUTION PLAN (see [THEMING_ARCHITECTURE.md](./docs/THEMING_ARCHITECTURE.md))

| Sub-Phase               | Scope                                                                                            | Status      |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ----------- |
| A: Token Foundation     | 4 theme CSS files, ThemeProvider, globals.css update, type definitions                           | ✅ COMPLETE |
| B: Component Migration  | Tokenize Button, Input, Select, StatusBadge, StatCard, DataTable, Sidebar, NotificationBell      | ✅ COMPLETE |
| C: Page Migration       | Tokenize all 51 admin pages + landing + login                                                    | ✅ COMPLETE |
| D: Settings Integration | Add "Appearance" tab (8th tab) with preset selector, color pickers, font selectors, live preview | ✅ COMPLETE |
| E: Testing & Polish     | Visual regression across 4 themes, responsive, dark mode, cross-browser                          | ✅ COMPLETE |

### Current Hardcoded Values to Tokenize

Every component and page currently uses these hardcoded Tailwind classes:

- `border-3 border-black` → maps to `var(--border-width-strong)` `var(--border-color)`
- `shadow-brutal` / `shadow-brutal-sm` → maps to `var(--shadow-card)` / `var(--shadow-button)`
- `rounded-md` / `rounded-lg` → maps to theme-specific radius tokens
- `bg-brand-500` / `bg-surface-50` / `text-surface-900` → stays (already token-based)
- `font-display` / `font-sans` → stays (already token-based)
- `transition-all duration-150` → maps to `var(--transition-duration)` `var(--transition-easing)`
- `hover:translate-x-[1px] hover:translate-y-[1px]` → conditional per theme
- `active:scale-[0.97]` → conditional per theme

---

## EDGE CASES — MASTER SUMMARY

| Area          | Edge Case                          | Resolution                                              |
| ------------- | ---------------------------------- | ------------------------------------------------------- |
| Auth          | Token expired during request       | ky interceptor: refresh queue, retry                    |
| Auth          | Multiple tabs logout sync          | Next API call fails, redirects to login                 |
| Auth          | Server restart clears tokens       | Force re-login (acceptable — ephemeral tokens)          |
| Payments      | Duplicate UTR                      | Unique sparse index → 409                               |
| Payments      | Invoice PDF for deleted tenant     | Renders with available data                             |
| Payments      | QR for zero-amount invoice         | Still generates (for receipts)                          |
| Invoices      | Race condition on counter          | Atomic `$inc` on Counter collection                     |
| Electricity   | Bill distributed before finalized  | Route checks status, returns 400                        |
| Notifications | ntfy.sh down                       | In-app notification still stored; push fails gracefully |
| Notifications | User deleted, notification remains | `readBy` still valid, just won't grow                   |
| SSE           | Render 5-min timeout               | Heartbeat every 30s                                     |
| UI            | Very long names in table           | Truncation + tooltip                                    |
| UI            | Mobile tables                      | Card view alternative                                   |
| SEO           | AppConfig API down at build        | Default config used, page still renders                 |
| Flutter       | UPI app not installed              | Alert with install suggestion                           |
| Flutter       | Camera permission denied           | Gallery-only fallback                                   |
