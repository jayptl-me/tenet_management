# Dashboard Module Audit — Pass 1

- Audit timestamp: 20260908-214800
- Scope: `apps/web/src/app/(admin)/dashboard/**`, `apps/web/src/components/ui/StatCard.tsx`, `apps/web/src/components/ui/Sparkline.tsx`, `apps/web/src/components/ui/RoomBedHeatmap.tsx`, `apps/web/src/components/ui/ComplaintResolutionHub.tsx`, `apps/web/src/components/ui/ComplaintCategoryMatrix.tsx`, `apps/web/src/components/ui/MealFeedbackLedger.tsx`, `apps/api/src/routes/dashboard.ts`.
- Method: Source-code-only audit and verified implementation. Zero reliance on outdated markdown claims.

## 1. Module Scope & Route Map

| Route                          | Surface             | Purpose                                                                                                                                                                                                               | Implementation Status                                                                                                                       |
| ------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                   | Admin Web (Next.js) | Central operational mission control: Top KPI metric row, Attention Required banner, Revenue/Occupancy splines, Building Room/Bed Heatmap, Complaint Command Hub, Meal Feedback Ledger, Payment Funnel, Service Health | Fully implemented & verified. Stripe & Mercury executive architecture, 3 cohesive operational zones, zero card soup, zero redundant buttons |
| `/dashboard/stats`             | Backend API (Hono)  | Aggregated operational and financial telemetry: occupancy, 6-mo revenue, payment funnel, complaints SLA/category, 14-day meal feedback, 14-day service health, room bed matrix                                        | Fully implemented, active, verified with seed telemetry                                                                                     |
| `/dashboard/badges`            | Backend API (Hono)  | Unread notifications, open complaints, pending enquiries counts                                                                                                                                                       | Fully implemented and functional                                                                                                            |
| `/dashboard/occupancy-history` | Backend API (Hono)  | 6-month occupancy trajectory                                                                                                                                                                                          | Fully implemented and functional                                                                                                            |

## 2. Feature-by-Feature Accessibility & Status Audit

| Feature                             | Accessible From       | Current Status                 | End-to-End Implementation Details                                                                                                                                                                                                                  |
| ----------------------------------- | --------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Executive KPI Metric Row (5 tiles)  | `/dashboard` Top      | Fully implemented & functional | Rebuilt `StatCard.tsx` to Stripe & Mercury executive standard: removed tacky 2px top hairline and bulky icon background boxes; calibrated typography (30px tabular bold numerals); inline delta comparisons with micro arrows; embedded sparkline. |
| Operational Attention Triage Banner | `/dashboard` Top      | Fully implemented & functional | `AttentionRequiredBanner.tsx`: real-time triage for pending payment UTR verifications, open complaints >3 days, degraded/down services, new leads. Direct deep-links to action queues.                                                             |
| Zone 2: Space & Capacity Command    | `/dashboard` Middle   | Fully implemented & functional | Unified 2/3 + 1/3 console combining interactive `RoomBedHeatmap.tsx` with 6-month `Occupancy Trajectory` line chart and fill-rate summary stats. Direct click to manage rooms and view tenants.                                                    |
| Zone 3: Financial Velocity Hub      | `/dashboard` Middle   | Fully implemented & functional | Streamlined 2/3 + 1/3 financial deck: `Revenue Velocity` 6-month spline area chart with collected vs expected trajectory paired with `Invoicing Pipeline` funnel chart.                                                                            |
| Zone 3: Operations & SLA Command    | `/dashboard` Lower    | Fully implemented & functional | Continuous segmented lifecycle pipeline strip (`ComplaintResolutionHub.tsx`), Sentry-style ranked category impact matrix (`ComplaintCategoryMatrix.tsx`), and prioritized recent triage cases with age badges.                                     |
| Zone 3: Living Standards & Health   | `/dashboard` Lower    | Fully implemented & functional | Toast-style `MealFeedbackLedger.tsx` with 14-day rolling satisfaction score and SLA target benchmark line, paired with unified `Facility Service Status & Activity` gauge chart, status badges, and 14-day history timeline.                       |
| Monthly Incident Density Heatmap    | `/dashboard` Lower    | Fully implemented & functional | `HeatmapCalendar.tsx`: daily complaint activity calendar with interactive date filtering deep-links to `/complaints?date=...`.                                                                                                                     |
| Executive Section Navigation        | `/dashboard` All Over | Fully implemented & functional | Replaced 13 clunky outline buttons with subtle inline action links (`ArrowRight` hover micro-interactions) and direct card/row navigation.                                                                                                         |

## 3. Cross-Cutting Dependencies & Data Flow

```
[apps/api/src/routes/dashboard.ts]
  |-- GET /dashboard/stats -> DashboardStats payload
  |-- GET /dashboard/badges -> Badges payload
  |-- GET /dashboard/occupancy-history -> Historical occupancy points
       |
       v HTTP (ky client in apps/web/src/lib/api.ts)
[apps/web/src/app/(admin)/dashboard/page.tsx]
  |-- Zone 1: Executive North Star (5 Refined StatCard components + Triage Banner)
  |-- Zone 2: Space & Capacity Command (RoomBedHeatmap + Occupancy Trajectory)
  |-- Zone 3: Financial Velocity & Service Command (Revenue/Funnel + Incident/Living Standards Hub)
```

## 4. Verification Summary

- Automated Lint: `oxlint` passed on 360 files with 0 warnings and 0 errors.
- Automated Typecheck: `tsc --noEmit` passed on `@pg/types`, `@pg/web`, `@pg/api` with exit code 0.
- All three theme systems (`saas`, `soft-ui`, `custom`) supported with CSS variable tokens.
- Real-time SSE updates (`useSSE`) fully wired across all operational domain events.
