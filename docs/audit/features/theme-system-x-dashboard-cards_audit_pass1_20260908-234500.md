# Theme System and Dashboard Card Surfaces - Audit Pass 1

Module: theme-system-x-dashboard-cards
Source verified: live source code, 2026-09-08
Timestamp: 20260908-234500
Supersedes: theme-system-x-dashboard-cards_audit_pass1_20260908-232244.md, theme-system_audit_pass1_20260908-091310.md, dashboard_audit_pass1_20260908-214800.md
Access rule: theme selection = admin only via /settings Appearance tab; applied panel-wide via data-theme/data-mode attributes on html.

## 1. Module Scope

- Admin web only (apps/web). Flutter resident portal untouched (uses native Flutter Material theme).
- Two tightly coupled surfaces:
  1. Shared Theme Token System: themes/{saas,brutalist,neumorphic,soft-ui,custom}.css + globals.css + lib/field-styles.ts + lib/chart-theme.ts + ThemeProvider/useTheme/colorScale.ts.
  2. Dashboard Module and Card Primitives: apps/web/src/app/(admin)/dashboard/page.tsx and all widgets/cards rendered within it (StatCard, Surface, AttentionRequiredBanner, RoomBedHeatmap, LineChart, Sparkline, FunnelChart, ComplaintResolutionHub, ComplaintCategoryMatrix, MealFeedbackLedger, GaugeChart, Timeline, HeatmapCalendar, Quick Jump cards, DashboardSkeleton, Button, StatusBadge).
- Sidebar: untouched per project non-negotiable rule.

## 2. Pages and Routes

| Surface | Route / File | Implementation Status | Issues Identified |
| --- | --- | --- | --- |
| Dashboard Page | apps/web/src/app/(admin)/dashboard/page.tsx | Partially Implemented / UX Weak | Metric cards lack premium visual hierarchy; service chips and age badges hardcode raw semantic scales (-50/-700); FunnelChart stages omit ink; hover border tokens dark in dark mode |
| Theme Provider | apps/web/src/themes/ThemeProvider.tsx | Fully Functional | Handles data-theme and data-mode attributes, mounts custom brand color scale |
| Theme Settings | apps/web/src/components/admin/AppearanceTab.tsx | Fully Functional | Allows selecting preset (saas, brutalist, neumorphic, soft-ui, custom) and mode (light, dark) |
| Mode Toggle | apps/web/src/components/admin/DarkModeToggle.tsx | Fully Functional | Switches data-mode between light and dark |
| Global Styles | apps/web/src/app/globals.css | Incomplete Tokens | Missing fallback tokens for --color-on-*, --badge-*-*, and hover highlight tokens; @theme misses on-fill semantic tokens |
| Theme Presets | apps/web/src/themes/*.css (5 presets) | Partially Implemented | Card backgrounds in light mode for brutalist/soft-ui/neumorphic use surface-100 (muddy gray) instead of elevated white; dark mode hover borders resolve to darker colors; chart on-fill contrast issues |

## 3. Feature Accessibility and Reachability Map

| Feature | Route | Reachable | Visibility Conditions |
| --- | --- | --- | --- |
| KPI Metric Strip (5 StatCards) | /dashboard | Yes | Always visible; renders live occupancy, revenue, complaints, services, enquiries |
| Operational Triage Banner | /dashboard | Yes | Renders normal state if zero alerts; renders amber/red triage pill actions when alerts > 0 |
| Building Floor & Bed Heatmap | /dashboard | Yes | Interactive; floor filter tabs, horizontal scroll row, bed occupancy tooltips |
| Occupancy Trajectory Area Chart | /dashboard | Yes | Shows 6-month filled vs capacity trajectory |
| Revenue Velocity Area Chart | /dashboard | Yes | Shows 6-month collected vs expected billing |
| Invoicing Pipeline Funnel Chart | /dashboard | Yes | Shows current billing cycle stages (paid, sent, partial, overdue, draft) |
| Complaint SLA Command Hub | /dashboard | Yes | Interactive lifecycle pipeline and SLA aging horizon |
| Complaint Impact Categories Matrix | /dashboard | Yes | Ranked category bars with volume and percentage share |
| Recent Complaints Triage Stream | /dashboard | Yes | Lists top active complaints with aging badges and direct links |
| Meal Quality & Resident Feedback Ledger | /dashboard | Yes | 14-day rolling satisfaction spline, meal progress bars, sentiment tags |
| Facility Health Gauge & Timeline | /dashboard | Yes | Semi-circular radial gauge, service status pills, 14-day event log |
| Lead Pipeline Stream | /dashboard | Yes | Recent inquiries with status badges |
| Incident Density Heatmap Calendar | /dashboard | Yes | Monthly calendar grid with date click filters |
| Quick Management Links | /dashboard | Yes | 4 quick jump cards to tenants, payments, rooms, notices |
| Theme and Mode Switcher | /settings#appearance, Header | Yes | Admin role authenticated |

## 4. Component Inventory and Defect Audit

| Component | File Path | Current Status | Detailed Defects |
| --- | --- | --- | --- |
| StatCard | components/ui/StatCard.tsx | Major Deficiencies (P2) | 1. Icon is an unstyled, naked 16px SVG without accent tile or background container.<br>2. Separator dot uses invalid token var(--color-border-color) which resolves to transparent.<br>3. Hardcoded dead classes dark:text-[color:var(--color-success-400)] and danger equivalents in renderDeltaInline.<br>4. Unused dead props variant and tone declared in StatCardProps.<br>5. Hover state hover:border-[color:var(--color-brand-300)] darkens in dark mode.<br>6. Progress bar track uses raw surface-200 with low contrast on card surfaces. |
| Surface | components/ui/Surface.tsx | Functional | Wrapper around surfaceCardClass and surfaceNestedClass; padding options md (p-5 sm:p-6) and sm (p-4). |
| AttentionRequiredBanner | components/admin/AttentionRequiredBanner.tsx | Token Defect (P1) | 1. Action pills hardcode raw scales border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-800)]. In dark mode and brutalist/neumorphic themes, this causes muddy or inverted contrast.<br>2. Success normal state hardcodes success-100 and success-700 with washed appearance on dark cards.<br>3. Must use unified --badge-*-* tokens. |
| RoomBedHeatmap | components/ui/RoomBedHeatmap.tsx | Contrast Defect (P1) | 1. Hardcoded text-white on occupied bed cells (bg-[color:var(--color-brand-500)] text-white). In brutalist dark where brand is amber, contrast ratio is 1.6:1 (WCAG failure). Must use text-[color:var(--color-on-brand)].<br>2. Room tags hardcode -50/-700/-200 scales.<br>3. Floor filter active tab uses text-[color:var(--color-card-bg)] instead of text-[color:var(--color-text-inverted)]. |
| LineChart | components/ui/LineChart.tsx | Functional (P3) | Grid lines, tooltips, and area fills function; requires verified contrast for axis labels and legend swatches across themes. |
| FunnelChart | components/ui/FunnelChart.tsx | Contrast Defect (P1) | Line 98 falls back to chartTokens.onFill (white) for bar values. For partial (amber) and draft (gray) bars, white text has 2.1:1 contrast (WCAG failure). Requires explicit ink passed from dashboard or theme-aware on-fill token. |
| ComplaintResolutionHub | components/ui/ComplaintResolutionHub.tsx | Token Defect (P2) | SLA compliance pill and aging horizon buttons use hardcoded -50/-100/-700/-800 semantic pairs. |
| ComplaintCategoryMatrix | components/ui/ComplaintCategoryMatrix.tsx | Token Defect (P2) | Overdue badge uses hardcoded -50 and -600 red classes. |
| MealFeedbackLedger | components/ui/MealFeedbackLedger.tsx | Token Defect (P2) | Top icon tile hardcodes bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-600)]; meal satisfaction text and progress bars need theme token consistency. |
| GaugeChart | components/ui/GaugeChart.tsx | Functional | Semi-circular radial gauge works with SVG stroke-dashoffset; colorVar defaults to --color-success-500. |
| HeatmapCalendar | components/ui/HeatmapCalendar.tsx | Contrast Defect (P1) | Line 200 hardcodes text-white on active date cells. On level 1/2 light tint fills, white text fails contrast. |
| StatusBadge | components/ui/StatusBadge.tsx | Functional | Uses --badge-*-* tokens with accent dot. Fully theme-aware. |
| Button | components/ui/Button.tsx | Functional | Uses --color-on-brand and --color-on-danger. Fully theme-aware. |
| Quick Jump Cards | dashboard/page.tsx lines 1119-1125 | Minor UX (P3) | Hover border uses var(--color-brand-300), which darkens instead of glows in dark mode. |
| Service Status Chips | dashboard/page.tsx lines 966-987 | Token Defect (P1) | Hardcode bg-[color:var(--color-success-50)] text-[color:var(--color-success-700)] and warning/danger equivalents directly in page. |
| Age Badges | dashboard/page.tsx lines 876-885 | Token Defect (P1) | Hardcode bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]. |

## 5. Theme Token System Defect Registry

| ID | Token / Location | Exact Defect | Impact | Priority |
| --- | --- | --- | --- | --- |
| T1 | globals.css :root fallback | Missing default values for --color-on-brand, --color-on-danger, --color-on-warning, --color-on-success, and --badge-*-* tokens. | If theme CSS is delayed or elements render outside theme scope, buttons and badges have transparent/broken text. | P0 |
| T2 | globals.css [data-mode="dark"] fallback | Missing dark mode fallback values for --color-on-* and --badge-*-* tokens. | In fallback dark mode, badge and button text lack contrast. | P0 |
| T3 | Light mode card backgrounds in brutalist.css, soft-ui.css, neumorphic.css | --color-card-bg is set to var(--color-surface-100) (#f5f5f4, #f1f5f9, #f0f2f8). Cards are muddy gray and darker than or identical to page background. | Cards look recessed, dirty, and lack elevation in light mode. | P1 |
| T4 | Hover border highlight tokens in dark mode (all themes) | Hover states across StatCard, Quick Jump cards, and room cards use var(--color-brand-300). In dark mode, brand-300 is dark indigo/purple (e.g., #4338ca), causing cards to darken on hover rather than glow. | Inverted, counter-intuitive interaction feedback in dark mode. | P1 |
| T5 | StatCard invalid token var(--color-border-color) | Line 186 references nonexistent variable --color-border-color. | Dot separator between trend and delta is invisible/broken. | P1 |
| T6 | StatCard dead dark: utilities | renderDeltaInline includes dark:text-[color:var(--color-success-400)] and danger equivalents, which override dark-adjusted theme tokens with wrong luminosity. | Semantic delta values fight theme scales. | P1 |
| T7 | StatCard unstyled, bare icon presentation | Icons render as raw unboxed 16px text-muted SVGs pushed to the top right. | Cards feel unpolished, flat, and substandard compared to Stripe/Mercury/Linear. | P2 |
| T8 | FunnelChart value label text fill | Values inside bars fall back to chartTokens.onFill (white). White text on partial (amber) or draft (gray) bars has 2.1:1 contrast ratio. | WCAG contrast failure on payment pipeline chart. | P1 |
| T9 | RoomBedHeatmap and HeatmapCalendar text-white literals | Hardcoded text-white on occupied bed cells and calendar date cells. Fails contrast on amber brand fills (brutalist dark) and light heatmap tiers. | WCAG contrast failure in data visualizers. | P1 |
| T10 | Raw semantic scale classes in dashboard/page.tsx and banner | Service status chips, age badges, and AttentionRequiredBanner hardcode -50/-100/-700/-800 classes. | In dark mode and across themes, produces washed, dark mud, or unreadable chips. | P1 |

## 6. End-to-End Dependency Mapping

The full flow traces across:
Page (apps/web/src/app/(admin)/dashboard/page.tsx)
  -> Page Components (StatCard, AttentionRequiredBanner, RoomBedHeatmap, LineChart, FunnelChart, ComplaintResolutionHub, ComplaintCategoryMatrix, MealFeedbackLedger, GaugeChart, HeatmapCalendar)
  -> Shared Style Utilities (lib/field-styles.ts: surfaceCardClass, surfaceNestedClass; lib/chart-theme.ts: chartTokens, heatmapRamp)
  -> CSS Design Tokens (themes/{saas,brutalist,neumorphic,soft-ui,custom}.css per [data-theme][data-mode])
  -> Fallbacks & Tailwind Mappings (globals.css: :root, [data-mode="dark"], @theme)
  -> Runtime Theme Application (themes/ThemeProvider.tsx + hooks/useTheme.ts setting data-theme and data-mode attributes on documentElement)
  -> Persistence (lib/api.ts -> GET/PATCH /app-config -> AppConfig MongoDB document)
  -> UI Presentation (correct WCAG AA contrast in every theme x mode combination)

## 7. Prioritized Implementation Work

### P0 — Critical Broken Functionality & Core Token Fallbacks
- Add fallback definitions for --color-on-brand, --color-on-danger, --color-on-warning, --color-on-success, and --badge-*-* tokens to globals.css :root and [data-mode="dark"].
- Fix StatCard invalid token var(--color-border-color) to var(--border-color).
- Remove dead/conflicting dark: utilities in StatCard.tsx renderDeltaInline.

### P1 — Missing End-to-End Theme Contrast & Token Correctness
- Fix card backgrounds in brutalist.css, soft-ui.css, and neumorphic.css so light mode uses crisp elevated white (#ffffff or theme-appropriate clean white) with proper shadow/border.
- Add and wire hover highlight border token (--border-color-hover or --color-brand-400 in dark mode) so interactive cards glow rather than darken on hover.
- Replace text-white literals in RoomBedHeatmap (bed cells) with text-[color:var(--color-on-brand)] and HeatmapCalendar with dynamic/token-based contrast.
- Fix FunnelChart value label fills in dashboard/page.tsx by providing contrast-safe ink values for amber and gray stages.
- Refactor service status chips, complaint age badges, and AttentionRequiredBanner to use verified --badge-*-* tokens instead of hardcoded -50/-700 classes.

### P2 — Major UX/UI Redesign: World-Class Dashboard Metric Cards
- Redesign StatCard component to executive enterprise standard (Stripe, Mercury, Linear):
  - Add purpose-built icon container tile with theme-aware tinted background and icon color (e.g., brand-tint for beds, success-tint for revenue, warning/danger-tint for complaints, info-tint for services/leads).
  - Implement structured contextual comparison pills with clear trend arrows, tabular typography, and subtitle rhythm.
  - Wire tone/variant props to drive semantic accent treatment (brand, success, warning, danger, default).
  - Add refined micro-progress bar with high-contrast track and smooth fill.
  - Deliver seamless interactive states with spring motion, subtle lift, and luminous border highlight.

### P3 — Secondary UI Refinements
- Update Quick Jump navigation cards with matching border glow and icon container.
- Ensure SectionHeader action links have proper contrast and hover affordance across all 5 themes.
- Verify chart legends and tooltip contrast across all 5 themes in both light and dark modes.

### P4 — Verification & Polish
- Run bun lint to verify zero lint errors.
- Verify all 5 themes x 2 modes (10 permutations) in browser.
- Ensure zero emojis in code, commits, and documentation.

## 8. Definition of Done
1. All 5 theme presets (saas, brutalist, neumorphic, soft-ui, custom) in both light and dark modes render dashboard cards with crisp elevation, high contrast, and zero illegible text.
2. StatCards transformed into world-class executive widgets with tinted icon tiles, crisp tabular values, and elegant delta pills.
3. Zero hardcoded text-white literals on colored backgrounds without theme-token fallback.
4. Zero hardcoded -50/-700 semantic chips on dark cards.
5. All interactive cards have intuitive hover highlight states in dark mode.
6. bun lint passes with zero errors.
7. Portal boundaries respected (admin only in apps/web, sidebar untouched).
8. ASCII only, no emojis anywhere.

## 9. Completion Status

- Status: Completed (Pass 1)
- Core Token Fallbacks: Implemented (--color-on-*, --badge-*-*, --border-color-hover in globals.css).
- Theme Presets: Updated (light card-bg elevated to crisp white in brutalist/soft-ui; dark mode hover borders aligned across all 5 themes).
- StatCard Primitives: Redesigned (executive accent icon tiles, semantic tone wiring, tokenized delta pills, contrast-safe progress tracks).
- Dashboard Widgets: Remediated (AttentionRequiredBanner, RoomBedHeatmap, HeatmapCalendar, ComplaintResolutionHub, ComplaintCategoryMatrix, Quick Jump cards).
- Quality Gates: bun run lint (oxlint) passed with 0 errors across 364 files; bun run typecheck passed with code 0 across @pg/types, @pg/web, and @pg/api.

