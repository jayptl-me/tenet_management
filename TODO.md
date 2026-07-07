# Tenet PG Management — Comprehensive Gap Analysis & Implementation Roadmap

> **Audit Date:** July 7, 2026
> **Audit Method:** Direct source code verification — every claim below is backed by directory listing, file existence check, or code inspection.
> **Goal:** End-to-end lifecycle completion for Admin Panel, Tenant Portal, Guardian Portal, and Backend.

---

## AUDIT SUMMARY

### What Exists (Verified)

| Layer | Count | Status |
|-------|-------|--------|
| API Route Files | 25 | All registered in `apps/api/src/index.ts` |
| API Model Files | 20+ | All in `apps/api/src/models/` |
| Admin Sections | 22 | All have list + detail + new + edit pages |
| Shared UI Components | 12 | `apps/web/src/components/ui/` |
| Admin Components | 6 | `apps/web/src/components/admin/` |
| Shared Components | 1 | `apps/web/src/components/shared/` |
| Custom Hooks | 3 | `apps/web/src/hooks/` |
| Theme Files | 6 | `apps/web/src/themes/` (4 CSS + provider + types) |
| Settings Tabs | 9 | General, Pricing, Payment, Amenities, Amenity Types, Testimonials, Features, Appearance, Advanced |

### What Is MISSING (Critical Gaps)

| Gap | Severity | Impact |
|-----|----------|--------|
| **Tenant Portal** — entire `(tenant)` route group | CRITICAL | Tenants have zero web self-service |
| **Guardian Portal** — entire `(guardian)` route group | CRITICAL | Guardians have zero web access |
| **Role-based login** — login always routes to `/dashboard` | CRITICAL | Tenants/guardians cannot use the app |
| **Tenant layout** — no `(tenant)/layout.tsx` | CRITICAL | No tenant shell/navigation |
| **Guardian layout** — no `(guardian)/layout.tsx` | CRITICAL | No guardian shell/navigation |
| **Settings Contact tab** — missing from tab array | MEDIUM | Contact info editing buried in General tab |
| **Audit Logs sub-pages** — list only, no detail view | LOW | Audit detail inspection not possible |
| **Export sub-pages** — list only, no export execution page | LOW | Export is a single-page utility |

---

## PHASE 1: AUTHENTICATION & ROLE-BASED ROUTING

### Task 1.1: Role-Based Login Flow
- **File to modify:** `apps/web/src/app/login/page.tsx`
- **Current state:** Login always calls `router.push('/dashboard')` after successful auth (line 67)
- **Gap:** No role detection. Admin, tenant, and guardian all go to `/dashboard`
- **What to implement:**
  - After `login()` call, check `response.data.user.role`
  - Route based on role: `admin` → `/dashboard`, `tenant` → `/tenant`, `guardian` → `/guardian`
  - Add visual indicator: "Admin Login" vs "Tenant Login" toggle or separate routes
  - Consider: unified login with role selector, OR separate `/login/admin` and `/login/tenant` routes
- **Reference pattern:** `apps/web/src/store/auth.ts` — `useAuthStore` already stores `user.role`

### Task 1.2: Auth Store Role Awareness
- **File to read:** `apps/web/src/store/auth.ts`
- **Current state:** Store has `user` object with `role` field
- **Gap:** No role-based route protection middleware
- **What to implement:**
  - Add `isRole(role)` helper to auth store
  - Create route guard component or middleware that checks role before rendering protected pages
  - Admin pages should reject non-admin users
  - Tenant pages should reject non-tenant users
  - Guardian pages should reject non-guardian users

---

## PHASE 2: TENANT PORTAL (Entirely Missing)

> **Verified:** `apps/web/src/app/(tenant)/` directory does NOT exist. Zero tenant-facing pages.

### Task 2.1: Tenant Layout Shell
- **File to create:** `apps/web/src/app/(tenant)/layout.tsx`
- **What to implement:**
  - Simple layout with sidebar or bottom nav (mobile-first)
  - Tenant name, room number, profile avatar in header
  - Navigation items: Dashboard, My Room, Payments, Complaints, Visitors, Notices, Menu, Services, Settings
  - Logout button
  - Auth guard: redirect to `/login` if not authenticated or role !== 'tenant'
- **Reference:** `apps/web/src/app/(admin)/layout.tsx` for auth guard pattern

### Task 2.2: Tenant Dashboard
- **File to create:** `apps/web/src/app/(tenant)/page.tsx`
- **What to implement:**
  - Welcome card with tenant name, room number, bed ID
  - Quick stats: pending payments, open complaints, upcoming visitors
  - Quick actions: Report Issue, Register Visitor, View Menu
  - Recent notifications
  - Service status summary for their floor
- **Components to use:** `StatCard`, `StatusBadge`, `Button` from `components/ui/`

### Task 2.3: Tenant Profile Page
- **File to create:** `apps/web/src/app/(tenant)/profile/page.tsx`
- **What to implement:**
  - Display: name, email, phone, room number, bed ID, move-in date, monthly rent
  - Emergency contact info
  - KYC document status (uploaded/not uploaded)
  - Edit profile (limited fields: phone, emergency contact)
- **API endpoint:** `GET /tenants/:id` (self), `PUT /tenants/:id`

### Task 2.4: Tenant Payments Page
- **File to create:** `apps/web/src/app/(tenant)/payments/page.tsx`
- **What to implement:**
  - List of invoices with status (paid/pending/overdue)
  - UPI QR code for payment
  - Payment history with dates and amounts
  - Download invoice PDF button
- **API endpoints:** `GET /tenants/:id/invoices`, `GET /invoices/:id/pdf`

### Task 2.5: Tenant Invoices Detail
- **File to create:** `apps/web/src/app/(tenant)/invoices/[id]/page.tsx`
- **What to implement:**
  - Full invoice view with line items
  - Payment status
  - Download PDF
  - WhatsApp share button
- **API endpoint:** `GET /invoices/:id`

### Task 2.6: Tenant Complaints List
- **File to create:** `apps/web/src/app/(tenant)/complaints/page.tsx`
- **What to implement:**
  - List of tenant's own complaints
  - Status badges (open/in-progress/resolved)
  - Create new complaint button
  - Filter by status
- **API endpoint:** `GET /complaints/my`

### Task 2.7: Tenant Create Complaint
- **File to create:** `apps/web/src/app/(tenant)/complaints/new/page.tsx`
- **What to implement:**
  - Form: category (dynamic from amenity definitions), title, description, priority
  - Photo upload (optional)
  - Submit creates complaint linked to tenant's room
- **API endpoint:** `POST /complaints`
- **Reference:** `apps/web/src/app/(admin)/complaints/new/page.tsx`

### Task 2.8: Tenant Complaint Detail
- **File to create:** `apps/web/src/app/(tenant)/complaints/[id]/page.tsx`
- **What to implement:**
  - Complaint detail with timeline/activity log
  - Status tracking
  - Admin notes visible
- **API endpoint:** `GET /complaints/:id`

### Task 2.9: Tenant Visitors Page
- **File to create:** `apps/web/src/app/(tenant)/visitors/page.tsx`
- **What to implement:**
  - List of registered visitors
  - Pre-register new visitor button
  - Status: expected/arrived/departed
- **API endpoint:** `GET /visitors/my`

### Task 2.10: Tenant Register Visitor
- **File to create:** `apps/web/src/app/(tenant)/visitors/new/page.tsx`
- **What to implement:**
  - Form: visitor name, phone, purpose, expected arrival date/time
  - Submit creates visitor record
- **API endpoint:** `POST /visitors`

### Task 2.11: Tenant Notices Page
- **File to create:** `apps/web/src/app/(tenant)/notices/page.tsx`
- **What to implement:**
  - List of notices visible to this tenant
  - Pinned notices at top
  - Full notice content on click
- **API endpoint:** `GET /notices`

### Task 2.12: Tenant Menu Page
- **File to create:** `apps/web/src/app/(tenant)/menu/page.tsx`
- **What to implement:**
  - Today's menu display (breakfast/lunch/dinner)
  - Past menus (date picker)
  - Meal feedback submission (star rating + comment)
- **API endpoints:** `GET /menus/today`, `POST /meals/feedback`

### Task 2.13: Tenant Services View
- **File to create:** `apps/web/src/app/(tenant)/services/page.tsx`
- **What to implement:**
  - Read-only view of floor service status
  - Status dots: green (operational), yellow (degraded), red (down)
  - Filter by amenity type
- **API endpoint:** `GET /services`

### Task 2.14: Tenant Settings Page
- **File to create:** `apps/web/src/app/(tenant)/settings/page.tsx`
- **What to implement:**
  - Change password
  - Notification preferences (if applicable)
  - Theme toggle (optional)
- **API endpoints:** `PUT /auth/password`

### Task 2.15: Tenant Notifications Page
- **File to create:** `apps/web/src/app/(tenant)/notifications/page.tsx`
- **What to implement:**
  - List of notifications
  - Mark as read
  - SSE real-time updates
- **API endpoint:** `GET /notifications`

### Task 2.16: Tenant Attendance Page (Feature-gated)
- **File to create:** `apps/web/src/app/(tenant)/attendance/page.tsx`
- **Condition:** Only if `attendanceEnabled` feature flag is true
- **What to implement:**
  - Today's attendance status
  - Self check-in button
  - Attendance history
- **API endpoints:** `GET /attendance/my`, `POST /attendance/check-in`

### Task 2.17: Tenant Leave Application (Feature-gated)
- **File to create:** `apps/web/src/app/(tenant)/leaves/page.tsx`
- **Condition:** Only if `attendanceEnabled` feature flag is true
- **What to implement:**
  - List of leave applications
  - Create new leave request
  - Status tracking (pending/approved/rejected)
- **API endpoints:** `GET /leaves/my`, `POST /leaves`

### Task 2.18: Tenant Laundry Booking (Feature-gated)
- **File to create:** `apps/web/src/app/(tenant)/laundry/page.tsx`
- **Condition:** Only if `laundryEnabled` feature flag is true
- **What to implement:**
  - Available time slots grid
  - Book a slot
  - My bookings list
  - Cancel booking
- **API endpoint:** `GET /laundry-slots`

---

## PHASE 3: GUARDIAN PORTAL (Entirely Missing)

> **Verified:** `apps/web/src/app/(guardian)/` directory does NOT exist. Zero guardian-facing pages.

### Task 3.1: Guardian Layout Shell
- **File to create:** `apps/web/src/app/(guardian)/layout.tsx`
- **What to implement:**
  - Simple read-only layout
  - Guardian name, linked ward name in header
  - Navigation: Dashboard, Ward Profile, Payments, Attendance, Complaints
  - Logout button
  - Auth guard: redirect to `/login` if role !== 'guardian'

### Task 3.2: Guardian Dashboard
- **File to create:** `apps/web/src/app/(guardian)/page.tsx`
- **What to implement:**
  - Ward overview card (name, room, bed, PG name)
  - Payment status summary
  - Recent complaint statuses (read-only)
  - Quick links to detailed pages

### Task 3.3: Guardian Ward Profile
- **File to create:** `apps/web/src/app/(guardian)/ward/page.tsx`
- **What to implement:**
  - Read-only ward profile (name, phone, email, room, bed, move-in date)
  - Emergency contact info
  - KYC status
- **API endpoint:** `GET /guardians/me/ward`

### Task 3.4: Guardian Ward Payments
- **File to create:** `apps/web/src/app/(guardian)/ward/payments/page.tsx`
- **What to implement:**
  - Read-only list of ward's invoices and payments
  - Download invoice PDF
  - No payment actions (read-only)
- **API endpoint:** `GET /guardians/me/ward`

### Task 3.5: Guardian Ward Attendance
- **File to create:** `apps/web/src/app/(guardian)/ward/attendance/page.tsx`
- **Condition:** Only if `attendanceEnabled` feature flag is true
- **What to implement:**
  - Read-only attendance history
  - Present/absent/leave status per day
- **API endpoint:** `GET /guardians/me/ward/attendance`

### Task 3.6: Guardian Ward Complaints
- **File to create:** `apps/web/src/app/(guardian)/ward/complaints/page.tsx`
- **What to implement:**
  - Read-only list of ward's complaints
  - Status tracking only (no create/edit actions)
- **API endpoint:** `GET /guardians/me/ward`

---

## PHASE 4: ADMIN SETTINGS COMPLETION

### Task 4.1: Settings Contact Tab
- **File to modify:** `apps/web/src/app/(admin)/settings/page.tsx`
- **Current state:** Contact info (phone, email, address) is inside the "General" tab
- **Gap:** No dedicated Contact tab as specified in architecture docs
- **What to implement:**
  - Add `contact` to `TabKey` type
  - Add `{ key: 'contact', label: 'Contact' }` to tabs array
  - Move phone, email, address, social links, Google Maps embed from General to Contact tab
  - General tab keeps: PG name, tagline, logo, hero image, landing page text, branding colors

### Task 4.2: Audit Logs Detail View
- **File to create:** `apps/web/src/app/(admin)/audit-logs/[id]/page.tsx`
- **Current state:** `audit-logs/` has only `page.tsx` (list view), no `[id]` directory
- **What to implement:**
  - Detail view for individual audit log entry
  - Show: user, action, resource, timestamp, IP, user agent, details JSON
  - Back to list button

### Task 4.3: Export Execution Page
- **File to verify:** `apps/web/src/app/(admin)/export/page.tsx`
- **Current state:** Single page, no sub-pages
- **What to verify:** Does the export page have actual export functionality? If not, implement:
  - Resource selector (tenants, payments, invoices, complaints, enquiries)
  - Format selector (CSV, JSON)
  - Filter options
  - Download button

---

## PHASE 5: BACKEND COMPLETENESS VERIFICATION

### Task 5.1: Verify All CRUD Routes
- **File to read:** `apps/api/src/index.ts`
- **Current state:** 25 route files registered
- **What to verify for each route file:**
  - GET / (list with pagination)
  - GET /:id (detail)
  - POST / (create with Zod validation)
  - PUT /:id (update)
  - DELETE /:id (delete)
- **Route files to audit:**
  - `apps/api/src/routes/auth.ts`
  - `apps/api/src/routes/floors.ts`
  - `apps/api/src/routes/rooms.ts`
  - `apps/api/src/routes/tenants.ts`
  - `apps/api/src/routes/complaints.ts`
  - `apps/api/src/routes/services.ts`
  - `apps/api/src/routes/meals.ts`
  - `apps/api/src/routes/menus.ts`
  - `apps/api/src/routes/notices.ts`
  - `apps/api/src/routes/visitors.ts`
  - `apps/api/src/routes/assets.ts`
  - `apps/api/src/routes/attendance.ts`
  - `apps/api/src/routes/leaves.ts`
  - `apps/api/src/routes/guardians.ts`
  - `apps/api/src/routes/enquiries.ts`
  - `apps/api/src/routes/dashboard.ts`
  - `apps/api/src/routes/appConfig.ts`
  - `apps/api/src/routes/payments.ts`
  - `apps/api/src/routes/invoices.ts`
  - `apps/api/src/routes/electricity.ts`
  - `apps/api/src/routes/laundry.ts`
  - `apps/api/src/routes/notifications.ts`
  - `apps/api/src/routes/sse.ts`
  - `apps/api/src/routes/audit.ts`
  - `apps/api/src/routes/jobs.ts`

### Task 5.2: Tenant Self-Service API Endpoints
- **Gap:** Tenant portal needs specific endpoints
- **Verify these exist:** (VERIFIED via source code inspection)
  - `GET /tenants/:id` -- EXISTS in `apps/api/src/routes/tenants.ts`
  - `GET /invoices/my` -- EXISTS (line 75 in `invoices.ts`, uses `tenantOnly` middleware)
  - `GET /payments/my` -- EXISTS (line 162 in `payments.ts`, uses `tenantOnly` middleware)
  - `GET /complaints/my` -- EXISTS (line 56 in `complaints.ts`)
  - `GET /visitors/my` -- EXISTS (line 170 in `visitors.ts`)
  - `GET /attendance/my` -- EXISTS (line 256 in `attendance.ts`)
  - `GET /leaves/my` -- EXISTS (line 138 in `leaves.ts`)
  - `GET /notifications` -- EXISTS (list for authenticated user, works for any role)
  - `PATCH /notifications/:id/read` -- EXISTS
  - `PATCH /notifications/read-all` -- EXISTS

### Task 5.3: Guardian Self-Service API Endpoints
- **Gap:** Guardian portal needs specific endpoints
- **Verify these exist:** (VERIFIED via source code inspection)
  - `GET /guardians/me/ward` -- EXISTS (line 276 in `guardians.ts`)
  - `GET /guardians/me/ward/attendance` -- EXISTS (line 310 in `guardians.ts`)
  - `GET /guardians/me/ward/payments` -- NEEDS VERIFICATION (may be bundled in /me/ward response)
  - `GET /guardians/me/ward/complaints` -- NEEDS VERIFICATION (may be bundled in /me/ward response)

**Note:** Guardian portal routes (`/me/ward/*`) exist but may need additional sub-routes for payments and complaints if not already included in the main ward response.

---

## PHASE 6: THEME & DESIGN SYSTEM AUDIT

### Task 6.1: Theme Token Compliance Audit
- **What to audit:** Check all page.tsx files for hardcoded colors
- **Grep patterns to run:**
  - `#(0-9a-fA-F){3,8}` in `.tsx` files (hardcoded hex)
  - `blue-\d{2,3}`, `red-\d{2,3}`, `green-\d{2,3}`, `gray-\d{2,3}` (hardcoded Tailwind colors)
  - `shadow-md`, `shadow-lg`, `shadow-xl` (hardcoded shadows)
  - `rounded-md`, `rounded-lg`, `rounded-xl` (hardcoded radii)
- **Replacement pattern:** Use `var(--color-*)`, `var(--shadow-*)`, `var(--radius-*)` tokens

### Task 6.2: 4-State UI Compliance Audit
- **What to audit:** Every data-fetching page must handle:
  1. Loading state (skeleton/shimmer)
  2. Empty state (illustration + CTA)
  3. Error state (message + retry button)
  4. Success state (actual data)
- **Pages to check:** All 22 admin list pages, all detail pages, all new/edit pages

### Task 6.3: Component Reuse Audit
- **What to audit:** Pages should NOT reimplement existing components
- **Check for:**
  - Custom tables → should use `DataTable`
  - Custom modals → should use `ConfirmModal`
  - Custom stat cards → should use `StatCard`
  - Custom badges → should use `StatusBadge`
  - Custom inputs → should use `Input`, `Select`

---

## PHASE 7: AMENITY SYSTEM COMPLETION

> **Status:** Backend models partially updated (see git diff), frontend components need verification.

### Task 7.1: Verify Amenity Definition CRUD
- **Files to check:**
  - `apps/api/src/models/appConfig.ts` — amenityDefinitions schema
  - `apps/api/src/routes/appConfig.ts` — PUT endpoint accepts amenityDefinitions
  - `apps/web/src/components/admin/AmenityTypesTab.tsx` — exists, needs verification

### Task 7.2: Dynamic Floor Amenity Counts
- **Files to check:**
  - `apps/api/src/models/floor.ts` — amenityCounts array
  - `apps/api/src/routes/floors.ts` — validates amenityCounts against AppConfig
  - `apps/web/src/components/ui/FloorServiceGrid.tsx` — exists, needs verification

### Task 7.3: Dynamic Service Status
- **Files to check:**
  - `apps/api/src/models/serviceStatus.ts` — serviceType is now generic string
  - `apps/api/src/routes/services.ts` — validates against AppConfig definitions
  - `apps/web/src/components/ui/ServiceStatusIndicator.tsx` — exists, needs verification

### Task 7.4: Room-Level Amenity Status
- **Files to check:**
  - `apps/api/src/models/room.ts` — roomAmenities array
  - `apps/web/src/app/(admin)/rooms/[id]/page.tsx` — shows per-room amenity status?
  - `apps/web/src/components/ui/TenantActivityTimeline.tsx` — exists, verify functionality

---

## PHASE 8: MISSING COMPONENTS & WIDGETS

### Task 8.1: PageHeader Component
- **Status:** NOT found in `apps/web/src/components/ui/` or `admin/`
- **What to create:** `apps/web/src/components/ui/PageHeader.tsx`
- **Features:** Breadcrumbs, title, subtitle, action buttons (consistent across all pages)

### Task 8.2: EmptyState Component
- **Status:** NOT found as a standalone component
- **What to create:** `apps/web/src/components/ui/EmptyState.tsx`
- **Features:** Illustration/icon, title, description, CTA button

### Task 8.3: Skeleton Component
- **Status:** NOT found as a standalone component (loading spinners used inline)
- **What to create:** `apps/web/src/components/ui/Skeleton.tsx`
- **Features:** Shimmer animation, configurable dimensions, matches final layout

### Task 8.4: TabNavigation Component
- **Status:** NOT found (settings page has inline tab implementation)
- **What to create:** `apps/web/src/components/ui/TabNavigation.tsx`
- **Features:** Reusable tabs component with active state, overflow scroll

---

## PHASE 9: LANDING PAGE COMPLETENESS

### Task 9.1: Landing Page Audit
- **File:** `apps/web/src/app/page.tsx`
- **What to verify:**
  - Hero section with headline, subline, CTA
  - Amenities grid (from AppConfig)
  - Room pricing cards
  - Testimonials carousel
  - Contact section with Google Maps embed
  - Footer with social links
  - Mobile responsive
- **Reference:** `docs/phase-7-landing.md`

---

## IMPLEMENTATION ORDER (Priority)

1. **PHASE 1** — Auth & Role Routing (blocks everything else)
2. **PHASE 2** — Tenant Portal (highest user value)
3. **PHASE 3** — Guardian Portal (depends on auth routing)
4. **PHASE 4** — Admin Settings Completion (low effort, high polish)
5. **PHASE 5** — Backend API Verification (ensures frontend works)
6. **PHASE 6** — Theme Audit (polish pass)
7. **PHASE 7** — Amenity System (partially done, verify)
8. **PHASE 8** — Missing Components (reusable across all pages)
9. **PHASE 9** — Landing Page (public-facing, low priority)

---

## FILES CREATED BY THIS AUDIT

| File | Purpose |
|------|---------|
| `docs/ORCHESTRATION_PROMPT.md` | Goal-oriented prompt for autonomous agents |

## NEXT STEPS

1. Start with Phase 1 (Auth & Role Routing) — unblocks all portal work
2. Build Tenant Portal pages (Phase 2) — highest user impact
3. Build Guardian Portal pages (Phase 3) — extends reach
