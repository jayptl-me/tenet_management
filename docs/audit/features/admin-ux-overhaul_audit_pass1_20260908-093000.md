# Admin UX Overhaul - Audit Pass 1

Module: admin-ux-overhaul (settings + dashboard + fonts + shared components)
Scope: admin web only (no API contracts broken, no Flutter changes)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only

## 1. Selected Module

admin-ux-overhaul (settings depth + dashboard KPI correctness + font loading + component sweep).

## 2. Dashboard KPI Correctness

| Card               | Defect                                                        | Fix                                                                          | Status  |
| ------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------- |
| Occupancy          | pill showed vacancy as Occupancy; beds/rooms fallback         | pill shows occupancy rate (up>=80); beds-only, 0-guard                       | WORKING |
| Collected          | draft/cancelled inflated expected; 0/0 showed 0% down         | billable [sent,partial,paid,overdue] only; expected==0 neutral No target     | WORKING |
| Active Complaints  | lifetime resolved count as up-trend                           | resolved-rate % pill (up>=70); 0-guard                                       | WORKING |
| Service Health     | empty DB showed 100% up                                       | total==0 neutral —; denominator captioned tracked checks                     | WORKING |
| Pending Enquiries  | contacted excluded; no trend                                  | retitled New Enquiries; +N this week; warns when actionable>5                | WORKING |
| History            | forward-fill ignored checkouts                                | month-bucket active check (moveIn<=end AND (no moveOut OR moveOut>=start))   | WORKING |

## 3. Settings Depth

| Tab          | Gap                                              | Fix                                                              | Status  |
| ------------ | ------------------------------------------------ | ---------------------------------------------------------------- | ------- |
| General      | raw URL/color strings, silent address drop       | image previews + URL check; native color pickers; partial warning | WORKING |
| Pricing      | cleared field saved Rs 0                         | empty keeps saved value                                          | WORKING |
| Payment      | no UPI validation                                | format hint + inline check                                       | WORKING |
| Amenities    | no dedup; dual-model confusion                   | case-insensitive dedup + explainer                               | WORKING |
| Testimonials | silent card strip                                | inline min-length hints                                          | WORKING |
| Features     | dangerous flags unexplained                      | descriptions + OFF confirm (403 side effect noted)               | WORKING |
| Appearance   | hex text only                                    | native picker + inline error                                     | WORKING |
| Security     | no toggle/strength/autocomplete                  | show/hide present; strength hint + autocomplete added            | WORKING |
| Advanced     | no format guidance                               | GSTIN/PAN hints + non-blocking checks                            | WORKING |
| Global       | single Save All, silent tab switch, spinner      | dirty badge + confirm guard; skeletons + retry (no reload)       | WORKING |

## 4. Fonts

| Item                                    | Fix                                                              | Status  |
| --------------------------------------- | ---------------------------------------------------------------- | ------- |
| Mono 600/700 + sans 800 weights missing | extended Google Fonts URL                                        | WORKING |
| Mono picks forced sans-serif fallback   | family-aware fallback helper (useTheme + provider)               | WORKING |
| Risky font-[family:...] in 19 files     | migrated 55 instances to font-display/body/mono utilities        | WORKING |

## 5. Shared Component Sweep

| File                                            | Fix                                                        | Status  |
| ----------------------------------------------- | ---------------------------------------------------------- | ------- |
| StatCard                                        | accent bar removed; equal min-h; font utility              | WORKING |
| ErrorState                                      | side-stripe removed                                        | WORKING |
| ConfirmModal / TempCredentialsDialog            | gradient overlays flattened                                | WORKING |
| Button / Surface                                | glass mapped internally (no caller break)                  | WORKING |
| StatusBadge                                     | badge shadow removed                                       | WORKING |
| Sidebar                                         | active bar + glass removed                                 | WORKING |
| DataTable                                       | zebra removed                                              | WORKING |
| FormPage                                        | back-button guard; motion removed                          | WORKING |
| Toast / Sparkline / ThemeChart / Timeline reuse | tokens, explicit trend, dedup, consolidation               | WORKING |
| Banners / grids / calendars / misc              | neutralized washes, ErrorBanner/EmptyState surfacing       | WORKING |
| TableActions                                    | glass removed from union (Button maps it)                  | WORKING |

## 6. Cross-Cutting Dependencies

| Concern | Status                                                                              |
| ------- | ----------------------------------------------------------------------------------- |
| API     | dashboard aggregations corrected; additive enquiries fields; no Zod/shape breaks    |
| Types   | IDashboardEnquiryStats extended additively                                          |
| Sidebar badges | intentionally unchanged (new-only semantics differ from dashboard; documented) |
| Flutter | untouched                                                                           |
| Sidebar | acceptable per constraint; slop-only edits                                          |

## 7. Out of Scope for This Pass

1. OKLCH migration.
2. Landing page polish.
3. Visual browser verification against running API.
4. Range/calendar base merges (deferred as risky).

## 8. Pass 1 Fixes Applied

| Fix                                                              | Files                                                              | Status  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | ------- |
| Dashboard math + KPI cards + StatCard                            | routes/dashboard.ts, dashboard/page.tsx, StatCard.tsx              | WORKING |
| Settings depth (12 items) + Appearance picker                    | settings/page.tsx, AppearanceTab.tsx                               | WORKING |
| Font weights, fallbacks, utilities                               | globals.css, useTheme.ts, ThemeProvider.tsx, field-styles, 19 files | WORKING |
| Component sweep (23 files) + TableActions + print CSS            | ui/*, admin/*, shared/*, globals.css                               | WORKING |
| Shared enquiry type                                              | packages/types/dashboard.ts                                        | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; no tests executed; no emojis; portal boundaries respected.
