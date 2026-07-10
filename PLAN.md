# Comprehensive Redesign & Technical Overhaul Plan

## Executive Summary

The current admin panel is already well-structured with 51 functional page files across 15 modules, a sophisticated SaaS-themed design system, and properly wired API endpoints. However, there are specific issues to resolve: merge artifacts, relational field gaps on edit forms, status option mismatches, some plain-text ObjectId inputs, and missing CRUD operations. This plan covers a systematic 7-pass overhaul addressing all gaps.

**Current state**: ~80% complete -- good foundation, specific broken edges.
**Target state**: 100% production-ready, all CRUD complete, consistent UX across all modules.

---

## Pass 1: Critical Bug Fixes

**Goal**: Fix immediate bugs and merge artifacts that would cause runtime errors or crashes.

| File                                                      | Issue                                      | Fix                                                                     |
| --------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `apps/web/src/app/(admin)/visitors/[id]/edit/page.tsx:78` | `++++++++ REPLACE` merge artifact          | Remove merge artifact, ensure proper code structure                     |
| `apps/web/src/app/(admin)/meals/[id]/edit/page.tsx:83`    | `++++++++ REPLACE` merge artifact          | Remove merge artifact, ensure proper code structure                     |
| `apps/web/src/app/(admin)/attendance/[id]/edit/page.tsx`  | Status dropdown uses complaint statuses    | Replace with correct attendance statuses (present/absent/on_leave/late) |
| `apps/web/src/app/(admin)/menus/[id]/edit/page.tsx`       | Cannot edit meal items                     | Add meal items form fields                                              |
| `apps/web/src/app/(admin)/enquiries/[id]/edit/page.tsx`   | Status options mismatch with detail schema | Sync status options with zod schema                                     |

**Files modified**: ~5 files
**Scope**: Frontend only
**Risk**: Low -- well-defined mechanical fixes

---

## Pass 2: Relational Field Completeness

**Goal**: Fix all edit forms that are missing relation fields (tenant, floor, etc.) and convert plain-text ObjectId inputs to ResourceSelect components.

| File                            | Issue                                                 | Fix                         |
| ------------------------------- | ----------------------------------------------------- | --------------------------- |
| `guardians/[id]/edit/page.tsx`  | Missing tenantId field                                | Add tenantId ResourceSelect |
| `visitors/[id]/edit/page.tsx`   | Missing tenant field                                  | Add tenantId ResourceSelect |
| `attendance/[id]/edit/page.tsx` | Missing tenant field                                  | Add tenantId ResourceSelect |
| `meals/[id]/edit/page.tsx`      | Missing tenant field                                  | Add tenantId ResourceSelect |
| `leaves/[id]/edit/page.tsx`     | Missing tenant field                                  | Add tenantId ResourceSelect |
| `services/[id]/edit/page.tsx`   | Missing floorId field                                 | Add floorId ResourceSelect  |
| `attendance/new/page.tsx`       | tenantId is plain-text Input                          | Convert to ResourceSelect   |
| `meals/new/page.tsx`            | tenantId is plain-text Input                          | Convert to ResourceSelect   |
| `leaves/new/page.tsx`           | tenantId is plain-text Input                          | Convert to ResourceSelect   |
| `leaves/new/page.tsx`           | `fromDate`/`toDate` vs `startDate`/`endDate` mismatch | Standardize field names     |

**Files modified**: ~10 files
**Scope**: Frontend only
**Risk**: Low -- follows existing ResourceSelect pattern used in other forms

---

## Pass 3: API & Backend Completeness

**Goal**: Audit and fix all missing CRUD endpoints, fix backend issues found during research.

**Backend tasks**:

- Audit all route files for missing PUT/DELETE endpoints
- Ensure consistent response structure (`{ success, data/meta }`)
- Fix any pagination missing on list endpoints
- Add missing population of referenced documents

**Frontend API client fixes**:

- Fix auth token double source-of-truth (localStorage + Zustand)
- Fix `useSidebarBadges` broken SSE connection (no auth token, hardcoded URL)
- Ensure consistent error handling across all API calls

**Files modified**: ~8-12 files (routes + hooks + api client)
**Scope**: Backend + Frontend
**Risk**: Medium -- requires verifying each endpoint's behavior

---

## Pass 4: Design System Enhancement

**Goal**: Expand the existing design system with richer tokens, enhanced components, and polished micro-interactions.

**Current state**: Already sophisticated with SaaS theme (light + dark), brand/semantic color scales, typography, shadow system, micro-interactions via motion.

**Enhancements**:

- Add additional semantic status indicator components (StatusBadge already exists -- ensure all pages use consistent variants)
- Add date-range picker component for filtering
- Add a proper multi-select component
- Enhance mobile responsiveness of DataTable with consistent mobileCardRenderer patterns
- Add loading skeleton patterns to all list pages (some are missing them)
- Add consistent empty state patterns to all pages
- Ensure consistent border/radius/spacing tokens across all forms

**Files modified**: UI components + scattered page updates
**Scope**: Primarily `apps/web/src/components/ui/` + some pages
**Risk**: Low -- additive changes, no breaking changes

---

## Pass 5: Data Visualization Enhancement

**Goal**: Expand data visualization strategy across the dashboard and detail pages.

**Current state**: Dashboard already has LineChart, GaugeChart, DonutChart, FunnelChart, StackedBarChart, HeatmapCalendar, Sparkline, Timeline.

**Enhancements**:

- Add line chart to payment detail page showing payment history over time
- Add occupancy trend visualization to room detail page
- Add complaint trend visualization to complaint pages
- Add revenue waterfall to invoice detail page
- Ensure all charts use proper empty states
- Ensure all charts are responsive

**Files modified**: ~5-8 page files
**Scope**: Frontend pages
**Risk**: Low -- extends existing chart components

---

## Pass 6: Comprehensive Form Audit & Enhancement

**Goal**: Ensure every create/edit form is production-ready with consistent UX patterns.

**Checklist for each form**:

- [ ] Uses react-hook-form with zodResolver
- [ ] All relation fields use ResourceSelect (not plain-text ObjectId)
- [ ] Zod schema matches backend validation
- [ ] Error state for each field shown inline
- [ ] Loading state on submit button
- [ ] Proper field types (date, number, email, etc.)
- [ ] Cancel/save buttons consistent styling
- [ ] Back navigation after successful submit
- [ ] Submit error displayed as banner
- [ ] Form field ordering matches logical grouping

**Priority targets** (forms with most issues):

1. `attendance/new/page.tsx` + `attendance/[id]/edit/page.tsx` -- 4 bugs
2. `menus/[id]/edit/page.tsx` -- missing meal items
3. `leaves/new/page.tsx` -- plain-text + field naming mismatch
4. `meals/new/page.tsx` -- plain-text input
5. `enquiries/[id]/edit/page.tsx` -- status + source mismatch
6. `notices/[id]/edit/page.tsx` -- missing target fields

**Files modified**: ~8-10 page files
**Scope**: Frontend
**Risk**: Low -- follows established patterns

---

## Pass 7: Code Quality & Integration Verification

**Goal**: Run all quality gates, verify integration, document changes.

**Verification gates**:

- [ ] `bun run typecheck` exits with code 0
- [ ] `bun run lint` exits with code 0
- [ ] `bun run format:check` passes
- [ ] `bun run build` exits with code 0
- [ ] Verify no emojis in code
- [ ] Verify all relation fields are properly wired (Floor -> Room -> Tenant -> Guardian/Payment/Invoice/etc.)
- [ ] Update `codebase-index.md` if files were added/deleted/renamed

**Files modified**: Build config, documentation
**Scope**: Repository-wide
**Risk**: Low -- verification only

---

## Execution Strategy

### Sub-agent orchestration

Passes 1-2 are quick, sequential fixes that I'll handle directly.
Passes 3-6 can be parallelized using sub-agents (Sonnet 5 models as requested):

- Sub-agent A: Pass 3 (API + Backend)
- Sub-agent B: Pass 4 (Design System)
- Sub-agent C: Pass 5 (Data Visualization)
- Sub-agent D: Pass 6 (Form Audit)

### Priority order

1. Fix crashing bugs first (Pass 1) -- mechanical, well-defined
2. Fix relational gaps (Pass 2) -- mechanical, follows established patterns
3. Backend completeness (Pass 3) -- enables all frontend work
4. Design + visualization + forms (Passes 4-6) -- parallelizable
5. Final quality gates (Pass 7)

### Rollback safety

- Each pass is independently verifiable
- No database schema changes -- additive only
- No breaking API contract changes
- All existing components preserved, only enhanced
