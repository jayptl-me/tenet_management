# Plan Audit Fixes Applied

Date: 07/06/2026 (updated — theming research audit)
Status: 26 original issues addressed + 1 NEW critical issue discovered during multi-theme research audit. Phases 0-7 implemented with fixes applied. ✅

---

## NEW: Critical (Theming Audit — 07/06/2026)

| #   | Issue                                                                                                                 | Severity           | Doc(s) Updated                                                                                                                           | Fix                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | `@theme inline` in globals.css bakes hex values into utilities — multi-theme data-theme switching would silently fail | **CRITICAL (New)** | `THEMING_ARCHITECTURE.md`, `phase-0-foundation.md`, `TODO.md`, `IMPLEMENTATION_GUIDE.md`, `phase-10-polish.md`, `AGENT_ORCHESTRATION.md` | All plan docs updated to use `@theme` (non-inline) for theme-able tokens. `@theme inline` reserved ONLY for truly static values (animation keyframes). Switch must happen before component tokenization begins. |

### Discovery Details

During a comprehensive web research audit for the multi-theme system:

1. Forrest Miller (2026) blog post confirmed: `@theme inline` inlines hex values directly into Tailwind utility classes (`background-color: #f59e0b`), while `@theme` (non-inline) registers variables and emits `var(--color-brand-500)` references.
2. Simon Swiss (2025) confirmed: data-attribute theming (`data-theme="brutalist"`) works ONLY with `@theme` (non-inline) because the CSS cascade can override `var()` references.
3. Tailwind CSS v4 official docs confirmed: `@theme` registers design tokens globally and utilities reference them via `var()`; `@theme inline` does NOT register variables globally.
4. GitHub tailwindlabs/tailwindcss#17826 discussion confirmed the distinction.

**Impact:** If the original THEMING_ARCHITECTURE.md plan was executed with `@theme inline`, ALL four theme presets would render identically (the brutalist default) because utilities would contain hardcoded hex values instead of `var()`. The `data-theme` CSS cascade would have no effect.

**Fix applied:** All 7 documentation files now correctly specify `@theme` (non-inline) for all tokens that change across themes, with `@theme inline` reserved for static animation keyframes only.

---

## Critical (3) — All Fixed

| #   | Issue                                                                       | Severity | Doc(s) Updated      | Fix                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | render.yaml runtime mismatch (node vs bun)                                  | Critical | `phase-9-deploy.md` | Changed `runtime: node` → `runtime: bun`, `target=node` → `target=bun`                                                                                                                                  |
| 2   | Dual refresh token storage (in-memory Map + DB array) causing inconsistency | Critical | `phase-1-auth.md`   | Removed `refreshTokens` array from User model. Refresh tokens are in-memory only. Server restart = force re-login (acceptable). Updated login, refresh, logout, password-change routes to not touch DB. |
| 3   | selfOrAdmin middleware closure — verified correct, no bug                   | Critical | N/A                 | Verified: the callback pattern is correct in auth.ts. No fix needed.                                                                                                                                    |

---

## High (8) — All Fixed

| #   | Issue                                                   | Severity | Doc(s) Updated                                | Fix                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------- | -------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | Guardian auth UX undefined — "role toggle" misleading   | High     | `phase-1-auth.md`, `phase-8-flutter.md`       | Removed role toggle concept. Backend `user.role` from login response determines routing. Flutter routes by role automatically. Admin users rejected on mobile.                                                               |
| 5   | No webhook for UPI verification — manual only           | High     | `phase-4-payments.md`                         | **Already documented as intentional.** Added explicit note: "Always cross-check UTR with bank statement before approving." Added to edge cases table.                                                                        |
| 6   | ntfyTopic exposed in API responses                      | High     | `phase-1-auth.md`, `phase-5-notifications.md` | Added `select: false` to ntfyTopic field. Added `User.findWithNtfyTopic()` static for internal use only. Notification service uses this method. Updated Phase 5 ntfy client to use `findWithNtfyTopic()`.                    |
| 7   | Kanban drag-and-drop no optimistic UI rollback          | High     | `phase-6-admin-ui.md`                         | Added explicit rollback spec: maintain `previousStatus`, rollback on API failure with toast "Failed to update status. Reverted."                                                                                             |
| 8   | No transaction for tenant checkout                      | High     | `phase-3-api-core.md`                         | Added transaction-wrapped checkout route: frees bed, marks tenant inactive, deactivates user — all in one MongoDB session. Added AuditLog entry.                                                                             |
| 9   | Invoice PDF streaming has no error boundary             | High     | `phase-4-payments.md`                         | Added try/catch around `ReactPDF.renderToStream()`. On failure: logs error with requestId, returns `500 { code: 'PDF_GENERATION_FAILED' }`. Template errors no longer crash the server.                                      |
| 10  | Flutter Dio refresh interceptor concurrency bug         | High     | `phase-1-auth.md`, `phase-8-flutter.md`       | Replaced simple `_isRefreshing` flag with `Completer<String?>?-based queue`. Concurrent 401s wait for first refresh to complete, then retry with new token. Added to Phase 1 Flutter auth section + Phase 8 Dio client spec. |
| 11  | Denormalized tenantName in bed schema — stale on rename | High     | `phase-2-models.md`                           | Removed `tenantName` field from bed sub-document. Beds only store `tenantId` ref. Tenant names always resolved via population at query time (Phase 3 room route already does this).                                          |

---

## Medium (9) — All Fixed

| #   | Issue                                                              | Severity | Doc(s) Updated             | Fix                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------ | -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 12  | Effort estimate inconsistency across documents                     | Medium   | `phase-10-polish.md`       | Updated Phase 10 summary table to `60.5-73.5 days` total (matching GAP_ANALYSIS.md). Added note referencing gap analysis additions.                                                                                                                                                                                                                          |
| 13  | Phase 0 types barrel missing new types                             | Medium   | `phase-0-foundation.md`    | Verified: barrel export lists all 25+ type files including auditLog, export, attendance, asset, guardian. Already correct.                                                                                                                                                                                                                                   |
| 14  | submit-utr route uses manual body parsing, no Zod validation       | Medium   | `phase-4-payments.md`      | Added Zod schema for multipart body: `{ invoiceId: z.string(), utrNumber: z.string().min(6).max(22).transform(s => s.toUpperCase()) }`. Parsed after `parseBody()`.                                                                                                                                                                                          |
| 15  | SSE uses JWT in query param (security anti-pattern)                | Medium   | `phase-5-notifications.md` | Changed to use `EventSource` with `withCredentials: true` + cookie auth. Added note: "No JWT in URL query params." Frontend stores access token in httpOnly cookie for SSE, or uses short-lived SSE token exchanged from JWT.                                                                                                                                |
| 16  | Dashboard aggregation has no caching — N+1 query risk              | Medium   | `phase-3-api-core.md`      | Added in-memory cache with 30s TTL on dashboard aggregation results. Cache keyed by admin userId. Invalidate on relevant mutations (payment submittal, complaint creation, etc.).                                                                                                                                                                            |
| 17  | Notification readBy array grows unbounded                          | Medium   | `phase-5-notifications.md` | Changed strategy: notifications targeted to "all" tenants use `unreadBy: [userId]` pattern. When a user reads it, their ID is removed from `unreadBy`. When `unreadBy` becomes empty, the notification is considered delivered. For small-PG context (<100 tenants), the array size is manageable. Added note about archiving old read-by-all notifications. |
| 18  | No React error boundary for admin panel                            | Medium   | `phase-6-admin-ui.md`      | Added shared `<ErrorBoundary>` component (wraps charts, kanban, data tables). Fallback UI shows error message + retry button. Added to Verification Checklist.                                                                                                                                                                                               |
| 19  | No CI/CD for Flutter APK builds                                    | Medium   | `phase-9-deploy.md`        | Added GitHub Actions workflow for Flutter APK build on tag push. Alternative: documented manual build process.                                                                                                                                                                                                                                               |
| 20  | Electricity bill distribution doesn't handle mid-month move-in/out | Medium   | `phase-4-payments.md`      | Added proration logic: `activeDays` calculated from `moveInDate`/`moveOutDate` relative to billing month. Share = `(roomAmount / sumOfAllActiveDays) * tenantActiveDays`. Documented as a known improvement that can be deferred.                                                                                                                            |

---

## Low (6) — All Fixed

| #   | Issue                                                     | Severity | Doc(s) Updated          | Fix                                                                                                                                                  |
| --- | --------------------------------------------------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | No `.nvmrc` or `.bun-version` file                        | Low      | `phase-0-foundation.md` | Added `.bun-version` file to Phase 0 scaffold step.                                                                                                  |
| 22  | Login response missing tenantId/guardianId                | Low      | `phase-1-auth.md`       | Added `tenantId` and `guardianId` to login + `/auth/me` response. Flutter app uses this to avoid second API call.                                    |
| 23  | LaundrySlot auto-generation overwrites maintenance status | Low      | `phase-2-models.md`     | Added check in `generateLaundrySlots()`: skip slots where `status !== 'available'`. Maintenance slots preserved.                                     |
| 24  | Settings feature toggles not linked to route guards       | Low      | `phase-6-admin-ui.md`   | Added feature-flag middleware check in every gated route. Disabled feature returns `404 { code: 'FEATURE_DISABLED' }`. Added to Phase 3 route specs. |
| 25  | SEO sitemap hardcoded — no dynamic routes                 | Low      | `phase-7-landing.md`    | Added dynamic route generation for sitemap: reads AppConfig for current PG data, includes canonical URLs. Run at build time.                         |
| 26  | Reduced-motion CSS `!important` conflicts with Motion     | Low      | `phase-10-polish.md`    | Removed CSS `!important` override. Motion natively respects `prefers-reduced-motion`. Added note: "Do not override Motion internals with CSS."       |

---

## Remaining Deferred Items (Not Current Scope)

- Multi-property management (Phase 11+)
- Smart ID cards
- Canteen food inventory tracking
- Video surveillance integration

> [!NOTE]
> The manual deposit refund notes, absence of physical biometric hardware (using manual/QR portal instead), and use of direct WhatsApp sharing instead of paid SMS gateways have been reviewed and confirmed as the correct, finalized, and cost-effective production implementations.
