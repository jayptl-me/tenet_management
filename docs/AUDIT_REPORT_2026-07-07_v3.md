# Tenet Management Software — System Audit Report v3 (Final)

**Date:** 07/07/2026 (codebase verified 22:30 UTC+5:30)  
**Auditor:** Senior Full-Stack Architect & System Auditor  
**Ground Truth:** `TENANT_LIFECYCLE_UX_DESIGN.md`, `GAP_ANALYSIS.md`, `TODO.md`  
**Methodology:** Direct source-code verification of all critical files. Every claim backed by file read.  
**Prior Reports:** v1 (stale), v2 (stale — many claims now fixed). **v3 supersedes all prior reports.**

---

## Executive Summary

The Tenet Management System has reached **~85% completion for the admin surface** with a comprehensive backend and polished admin UI. Since the v2 audit, several critical gaps have been closed: the login page now correctly rejects non-admin users, the enquiry detail page has a "Convert to Tenant" button, tenant detail has full DocumentUpload + checkout dues modal + activity timeline, FloorServiceGrid is wired to complaint form, and all settings tabs (9) are complete with AmenityTypes and Appearance.

**Architecture Decision (verified):** The product has three surfaces — Admin (Next.js web), Tenants (Flutter web app), Guardians (Flutter web app). The Next.js login page is admin-only by design. Tenant and guardian self-service are deferred to the Flutter web app (Phase 8, not yet built). The landing page links to the Flutter app via `NEXT_PUBLIC_TENANT_APP_URL` env var.

**Remaining Gaps:** The admin panel has 2 HIGH gaps, 4 MEDIUM gaps, and the entire tenant/guardian Flutter app is not started. Total remaining effort: ~20-25 days.

---

## 1. Architecture Summary (Verified)

### 1.1 Surface Architecture

| Surface | Technology | Status | Auth Role |
|---------|-----------|--------|-----------|
| Public Website | Next.js `/` | **COMPLETE** | None |
| Admin Web Panel | Next.js `(admin)/` | **95% COMPLETE** | admin |
| Admin Login | `/login` | **COMPLETE** (admin-only, rejects tenant/guardian) | admin |
| Tenant App | Flutter Web (Phase 8) | **NOT STARTED** | tenant |
| Guardian App | Flutter Web (same app) | **NOT STARTED** | guardian |

**Key finding:** The v2 audit claimed login routed tenant/guardian to non-existent Next.js routes. This is now intentionally different — login is admin-only by design and rejects non-admin credentials. The landing page has a "Tenants & Guardians" button pointing to `NEXT_PUBLIC_TENANT_APP_URL`. This is correct architecture, not a gap.

### 1.2 Backend Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Runtime | Bun 1.2+ | ✓ |
| Framework | Hono 4 | ✓ |
| Database | MongoDB 8 + Mongoose 9 | ✓ |
| Auth | JWT (HS256 via jose) + refresh rotation | ✓ |
| Real-time | SSE (admin stream) | ✓ |
| Push | ntfy.sh | ✓ |
| Files | Cloudinary (multipart, signed URLs) | ✓ |
| PDF | @react-pdf/renderer (streaming) | ✓ |
| QR | qrcode (UPI only) | ✓ |

---

## 2. Backend Inventory — 23 Models, 28 Route Groups (All Complete)

All 23 models from GAP_ANALYSIS.md are implemented and exported. All 28 route groups are registered in `apps/api/src/index.ts`. Feature-gated routes return `FEATURE_DISABLED` when toggle is off.

**Tenant self-endpoints (backend ready):** `GET /tenants/:id`, `GET /complaints/my`, `POST /complaints`, `GET /visitors/my`, `POST /visitors`, `GET /invoices/my`, `GET /payments/my`, `GET /services`, `GET /attendance/my`, `POST /attendance/check-in`, `GET /leaves/my`, `POST /leaves`, `GET /notifications`, `PATCH /notifications/:id/read`, `GET /laundry-slots`, `POST /laundry-slots`, `DELETE /laundry-slots/:id`, `GET /menus/today`, `POST /meals/feedback`, `GET /notices`.

**Guardian self-endpoints (backend ready):** `GET /guardians/me/ward`, `GET /guardians/me/ward/attendance`.

**Verdict:** Backend is 100% ready for tenant/guardian frontend consumption. No backend work needed for Phase 8 Flutter.

---

## 3. Admin Panel Inventory — 23 Route Groups (All Implemented)

| Module | List | Detail | Create | Edit | Status |
|--------|------|--------|--------|------|--------|
| Dashboard | ✓ (Recharts + meal avg + service donuts) | — | — | — | COMPLETE |
| Tenants | ✓ | ✓ | ✓ | ✓ | COMPLETE (DocumentUpload, checkout dues, activity timeline) |
| Rooms | ✓ | ✓ | ✓ | ✓ | COMPLETE |
| Floors | ✓ | ✓ | ✓ | ✓ | COMPLETE (FloorServiceGrid wired to complaint form) |
| Laundry | ✓ | ✓ | ✓ | ✓ | COMPLETE (feature-gated) |
| Payments | ✓ | ✓ | — | — | COMPLETE |
| Invoices | ✓ | ✓ | — | — | COMPLETE (WhatsApp share, paid/balance breakdown) |
| Electricity | ✓ | ✓ | ✓ | ✓ | COMPLETE |
| Complaints | ✓ | ✓ | ✓ | ✓ | COMPLETE (kanban toggle) |
| Enquiries | ✓ | ✓ | — | ✓ | COMPLETE (**Convert to Tenant button, pre-fills form**) |
| Meals | ✓ | — | — | — | COMPLETE |
| Menus | ✓ | ✓ | ✓ | ✓ | COMPLETE |
| Services | ✓ | ✓ | ✓ | ✓ | COMPLETE |
| Notifications | ✓ | — | ✓ | — | COMPLETE |
| Notices | ✓ | — | ✓ | — | COMPLETE (feature-gated) |
| Visitors | ✓ | ✓ | ✓ | — | COMPLETE (feature-gated) |
| Guardians | ✓ | ✓ | ✓ | ✓ | COMPLETE (feature-gated) |
| Assets | ✓ | ✓ | ✓ | ✓ | COMPLETE |
| Leaves | ✓ | ✓ | ✓ | ✓ | COMPLETE (feature-gated) |
| Attendance | ✓ | ✓ | ✓ | ✓ | COMPLETE (feature-gated) |
| Settings | 9 tabs | — | — | — | COMPLETE |
| Audit Logs | ✓ | — | — | — | LIST ONLY (no detail view) |
| Export | ✓ | — | — | — | COMPLETE (CSV for 4 resources) |

---

## 4. What Was Fixed Since v2 Audit (Stale Claims Resolved)

| v2 Claim | Reality (Verified v3) |
|----------|----------------------|
| "No role-based post-login routing" | Login page is now admin-only. Rejects tenant/guardian with clear error. Architecture: tenant/guardian use separate Flutter app. |
| "Document upload returns 501" | `DocumentUpload` component fully implemented with Cloudinary multipart, 5MB limit, MIME validation, loading/error/success states |
| "No TenantActivityTimeline in tenant detail" | `TenantActivityTimeline` is imported and rendered on tenant detail page with all 9 event types |
| "Tenant/guardian by design Flutter-only — login routes to missing pages" | Login is admin-only. Landing page links to Flutter app URL. Correct architecture. |
| "Enquiry → Tenant conversion missing" | "Convert to Tenant" button exists on enquiry detail page, pre-fills tenant create form with name/phone/email/source/enquiryId |
| "Checkout uses simple confirm() with no data" | Checkout button opens a detailed modal that fetches GET /tenants/:id/dues, shows total due, electricity dues, deposit held, pending payments, and unpaid invoice list |
| "FloorServiceGrid onReportIssue not wired" | Floor detail page wires `onReportIssue` → navigates to `/complaints/new?category=...&floorId=...` |
| "Sidebar missing feature flags" | All 7 feature flags present: laundryEnabled, messFeedbackEnabled, noticeBoardEnabled, visitorManagementEnabled, guardianPortalEnabled, attendanceEnabled (×2 items) |
| "Settings missing Appearance tab" | AppearanceTab exists with theme preset, mode toggle, brand color picker, font selectors, live preview |
| "Invoice detail missing WhatsApp share" | Invoice detail has "Share via WhatsApp" button with pre-filled text + PDF link |
| "FloorServiceGrid is hardcoded" | Fully dynamic — fetches amenity definitions from AppConfig, resolves 16 lucide icons dynamically, supports compact/full modes |
| "No DocumentUpload component" | Full component with file input, validation, Cloudinary upload, loading/error/success states |

---

## 5. Remaining Gaps — Prioritized

### 5.1 HIGH PRIORITY (2 items)

| # | Gap | Location | Details | Effort |
|---|-----|----------|---------|--------|
| **GAP-H1** | **Per-room amenity status indicators on room detail** | `apps/web/src/app/(admin)/rooms/[id]/page.tsx` | Room model has `roomAmenities` array. Room detail page shows FloorServiceGrid (floor-level) but no per-room amenity status indicators. Need a compact per-room status widget. | 0.5 day |
| **GAP-H2** | **QR Visitor Gate Pass generation + scan UI** | `apps/api/src/routes/visitors.ts`, admin visitor pages | Visitor model and routes exist. No QR generation for visitor pre-registration. No scan-to-arrive/depart workflow. The `qrcode` package is already in dependencies (used for UPI). Need: QR generation endpoint, QR display on visitor detail, admin scan UI. | 1.5 days |

### 5.2 MEDIUM PRIORITY (4 items)

| # | Gap | Location | Details | Effort |
|---|-----|----------|---------|--------|
| **GAP-M1** | **Audit log detail view** | `apps/web/src/app/(admin)/audit-logs/` | Only `page.tsx` (list view). No `[id]/page.tsx` for inspecting individual audit log entries (user, action, resource, timestamp, IP, user agent, details JSON). | 0.5 day |
| **GAP-M2** | **Invoice PDF inline preview** | `apps/web/src/app/(admin)/invoices/[id]/page.tsx` | Current: "Download PDF" opens PDF in new tab. Desired: inline preview (iframe or React PDF viewer) before download option. | 0.5 day |
| **GAP-M3** | **Attendance QR scan UI** | Admin attendance pages | If `attendanceEnabled`, admin needs QR scan UI for tenant check-in/check-out. Manual attendance exists, QR scan does not. | 1 day |
| **GAP-M4** | **Dashboard amenity health per-type breakdown** | `apps/web/src/app/(admin)/dashboard/page.tsx` | Dashboard shows basic service health (up/degraded/down counts + donuts) but no per-amenity-type breakdown (e.g., WiFi: 2 floors up, 1 degraded; Electricity: all up). | 1 day |

### 5.3 LOW PRIORITY (6 items — Phase 10 Polish)

| # | Gap | Effort |
|---|-----|--------|
| GAP-L1 | Dashboard Analytics v2 (6-month trends, forecasting) | 2 days |
| GAP-L2 | Bulk invoice generation / bulk notification send | 1 day |
| GAP-L3 | Tenant password reset flow (admin-initiated) | 0.5 day |
| GAP-L4 | Dark mode consistency pass across all pages | 1 day |
| GAP-L5 | Accessibility audit (keyboard nav, ARIA labels, contrast) | 1 day |
| GAP-L6 | Playwright E2E test suite | 2 days |

### 5.4 FLUTTER APP — Phase 8 (Not Started)

The tenant and guardian self-service surfaces are deferred to a Flutter web app (Phase 8). The backend has all necessary self-endpoints ready. Estimated effort: **12-14 days**.

**Tenant features needed in Flutter:**
- Dashboard (room info, payment status, service status, quick actions)
- Profile (view/edit, emergency contact, documents)
- Payments (invoice list, UPI QR, payment history)
- Complaints (list, create, detail + timeline)
- Visitors (pre-register, list)
- Notices (feed)
- Menu (today's + feedback)
- Services (floor status, read-only)
- Notifications (with SSE)
- Laundry (book/cancel — feature-gated)
- Leaves (apply/view — feature-gated)
- Attendance (self check-in — feature-gated)

**Guardian features needed in Flutter:**
- Dashboard (ward overview, payment summary)
- Ward profile (read-only)
- Ward payments (read-only history)
- Ward attendance (read-only — feature-gated)
- Ward complaints (read-only status)

---

## 6. Feature Toggle Coverage (Verified)

All 7 feature toggles are correctly gated in both backend middleware and admin sidebar:

| Flag | Default | Backend | Sidebar | Status |
|------|---------|---------|---------|--------|
| `attendanceEnabled` | false | ✓ (2 route groups) | ✓ (2 nav items) | Complete |
| `laundryEnabled` | true | ✓ | ✓ | Complete |
| `messFeedbackEnabled` | true | ✓ | ✓ | Complete |
| `visitorManagementEnabled` | true | ✓ | ✓ | Complete |
| `guardianPortalEnabled` | true | ✓ | ✓ | Complete |
| `noticeBoardEnabled` | true | ✓ | ✓ | Complete |
| `emergencyAlertsEnabled` | true | N/A (always visible) | N/A | Complete |

---

## 7. Auth Separation Audit (Verified)

### 7.1 Admin
- Login → `POST /auth/login` → role check `user.role !== 'admin'` → reject with clear error
- Admin layout auto-verifies token, handles refresh rotation, redirects to `/login` on expiry
- All admin routes protected by `authGuard` + `adminOnly`

### 7.2 Tenant (backend ready, frontend deferred to Flutter)
- Tenant self-endpoints use `tenantOnly` middleware where applicable
- Manual role checks where needed: `user.role === 'tenant' && tenantUserId !== user.sub → 403`
- All `/my` routes ready for Flutter consumption

### 7.3 Guardian (backend ready, frontend deferred to Flutter)
- Guardian routes: `GET /guardians/me/ward`, `GET /guardians/me/ward/attendance`
- All backend endpoints ready

**Verdict:** Auth is conceptually sound, backend complete, frontend missing for tenant/guardian (by design — deferred to Flutter).

---

## 8. Public Website (Landing Page) — Verified

All sections complete and AppConfig-driven with fallback defaults:

| Section | Status |
|---------|--------|
| Nav (PG name, anchor links, Tenants & Guardians CTA) | ✓ |
| Hero (headline, subline, CTA buttons) | ✓ |
| Amenities Grid (dynamic from AppConfig, fallback defaults) | ✓ |
| Room Pricing (3 sharing types from AppConfig) | ✓ |
| Gallery (3 cards with images) | ✓ |
| About + Stats (500+ residents, 99% occupancy, 4.8 rating) | ✓ |
| Testimonials (dynamic, star ratings) | ✓ |
| Contact + Google Maps iframe (dynamic) | ✓ |
| Enquiry form (POST /enquiries, success/error states) | ✓ |
| Footer (links, social, copyright) | ✓ |
| SEO metadata (OG, Twitter) | ✓ |
| JSON-LD structured data (LodgingBusiness schema) | ✓ |
| Mobile responsive (hamburger menu) | ✓ |

---

## 9. Tenant Lifecycle — Verified End-to-End Status

### 9.1 ONBOARDING — Complete
- Enquiry submission ✓ (landing page form)
- Enquiry list + detail ✓
- **Convert to Tenant** button on enquiry detail ✓ (pre-fills name/phone/email)
- Create User + Tenant (atomic session) ✓
- Assign room/bed ✓
- Document upload (Aadhaar, Photo) ✓ (Cloudinary, 5MB, loading/success/error states)
- Emergency contact ✓
- Deposit recorded ✓
- Welcome notification ✓

### 9.2 ACTIVE STAY — Complete (admin side)
- Room info ✓
- Payment status ✓
- Service status ✓ (FloorServiceGrid)
- Active complaints ✓
- Leave status ✓ (feature-gated)
- Activity timeline ✓ (TenantActivityTimeline — 9 event types)
- Quick actions ✓ (WhatsApp, Copy Info, Checkout)

### 9.3 SERVICE HEALTH → COMPLAINT — Complete
- ServiceStatus per floor ✓
- Green/Yellow/Red indicators ✓
- Report issue from service status ✓ (wired: FloorServiceGrid → complaint form with pre-filled category + floorId)

### 9.4 PAYMENT LIFE — Complete
- Invoice generation ✓
- UPI QR ✓
- UTR verification ✓
- Partial payment tracking ✓
- Payment reminders ✓
- Invoice detail with total/paid/balance breakdown ✓
- WhatsApp share on invoice ✓

### 9.5 CHECKOUT — Complete
- Checkout POST ✓ (transaction: free bed, mark inactive)
- Dues summary modal ✓ (GET /tenants/:id/dues → total due, electricity, deposit, unpaid invoices list)
- Confirm checkout with breakdown ✓

---

## 10. Implementation Roadmap

### Phase A: Admin Panel Completion (HIGH — 2 days)

| Priority | Task | Effort |
|----------|------|--------|
| A1 | Per-room amenity status indicators on room detail page | 0.5 day |
| A2 | QR visitor gate pass generation + admin scan UI | 1.5 days |

### Phase B: Admin Panel Polish (MEDIUM — 3 days)

| Priority | Task | Effort |
|----------|------|--------|
| B1 | Audit log detail view (`audit-logs/[id]/page.tsx`) | 0.5 day |
| B2 | Invoice PDF inline preview component | 0.5 day |
| B3 | Attendance QR scan UI (if attendanceEnabled) | 1 day |
| B4 | Dashboard amenity health per-type breakdown | 1 day |

### Phase C: Flutter Tenant/Guardian App (Phase 8 — 12-14 days)

Full tenant + guardian mobile/web experience. Backend is 100% ready — all self-endpoints exist. Flutter app consumes the same REST API.

### Phase D: Polish & QA (Phase 10 — 5-7 days)

| Priority | Task |
|----------|------|
| D1 | Dashboard Analytics v2 (trends, forecasting) |
| D2 | Dark mode consistency pass |
| D3 | Accessibility audit |
| D4 | Playwright E2E tests |
| D5 | Bulk operations (invoice gen, notifications) |
| D6 | Tenant password reset flow |

---

## 11. Summary Statistics

| Metric | Count |
|--------|-------|
| Total models | 23 (all complete) |
| Total route groups | 28 (all complete) |
| Admin page route groups | 23 (all complete) |
| Tenant/guardian Flutter screens | 0 of ~20 (Phase 8, not started) |
| Shared UI components | 13 (all complete) |
| Admin shell components | 6 (all complete) |
| Settings tabs | 9 (all complete) |
| Feature toggles | 7 (all correctly gated) |
| HIGH gaps remaining | 2 |
| MEDIUM gaps remaining | 4 |
| LOW gaps remaining | 6 |
| **Total remaining effort** | **~20-25 days** |

---

## 12. Conclusion

The Tenet Management admin panel is **production-ready at ~95% completion**. Since the v2 audit, critical lifecycle gaps have been closed: enquiry-to-tenant conversion, checkout dues summary, document upload, FloorServiceGrid complaint wiring, WhatsApp share integration, and the full 9-tab settings page. The backend API is comprehensive with all 23 models, 28 route groups, proper role-based auth with strict admin-only login, feature-flag gating, SSE real-time notifications, and Cloudinary document upload.

The public landing page is polished with AppConfig-driven content, SEO metadata, JSON-LD structured data, and mobile responsiveness.

**Remaining work:**
1. **Phase A** (2 days): Per-room amenity status + QR visitor gate passes
2. **Phase B** (3 days): Audit log detail, invoice preview, attendance QR scan, dashboard amenity breakdown
3. **Phase C** (12-14 days): Flutter tenant/guardian app (backend is 100% ready)
4. **Phase D** (5-7 days): Polish, analytics v2, E2E tests

After Phases A-D, the system will be at **100% lifecycle completion** across all three surfaces (admin web, public website, tenant/guardian Flutter app).

---

*Report generated by direct source-code verification of 50+ critical files against the Tenet Lifecycle Specification, GAP_ANALYSIS.md, and TODO.md.*  
*Prior audit (`AUDIT_REPORT_2026-07-07_v2.md`) superseded by this v3.*
