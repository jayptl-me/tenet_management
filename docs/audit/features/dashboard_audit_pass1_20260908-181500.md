# Dashboard Module Audit — Pass 1

- Audit timestamp: 20260908-181500
- Scope: `apps/web/src/app/(admin)/dashboard/**`, backend `apps/api/src/routes/dashboard.ts`, `apps/api/src/lib/broadcast-badges.ts`, shared UI components (`StatCard.tsx`, `KpiHeader.tsx`, `Skeleton.tsx`, `Sparkline.tsx`, `GaugeChart.tsx`, `LineChart.tsx`), theme system integration.
- Method: Source-code only audit. No reliance on legacy documentation.

## 1. Module Scope & Route Map

| Route | Surface | Purpose | Current Implementation Status |
|---|---|---|---|
| `/dashboard` | Admin Web (Next.js) | Central operational & financial mission control: 5 KPI metric cards, 8 telemetry/chart panels, live SSE auto-refresh, recent activity lists, system timeline, quick action links | Built, but major UX/UI card deficiencies, uneven heights, squished 5-column layout, missing actionable triage queue |
| `/dashboard/stats` | Backend API (Hono) | Returns live aggregated metrics: occupancy (rooms, beds, occupied, vacancy rate), revenue (collected, expected, month), complaints by status, services by status, enquiries, recent lists, 6-month revenue history, 6-month occupancy history, 14-day meal feedback, 14-day service history, amenity breakdown, payment funnel, complaint heatmap | Built and functional; lacks pending payment verification count and overdue debt summary in top-level payload |
| `/dashboard/badges` | Backend API (Hono) | Returns sidebar badge counts: `unreadNotifications`, `openComplaints`, `pendingEnquiries` | Built and functional; currently unwired in dashboard page |
| `/dashboard/occupancy-history` | Backend API (Hono) | Standalone 6-month occupancy history | Built and functional; duplicate of `stats.occupancyHistory` |

## 2. Feature-by-Feature Accessibility & Status Audit

| Feature | Accessible From | Current Status | End-to-End Flow & Deficiencies |
|---|---|---|---|
| Occupancy Metric Card | Dashboard top grid | Shallow UI / Suboptimal | Displays occupied/total beds with percentage. Fixed-pixel 100px SVG sparkline floats in corner without scaling. Missing visual progress bar and available bed count. Card links to `/tenants` rather than room/bed inventory. |
| Monthly Revenue Metric Card | Dashboard top grid | Broken flow / Suboptimal | Displays collected amount, target percentage, and MoM delta. Missing visual progress bar towards monthly billable goal. Contains hardcoded explanation paragraph that causes card height mismatch. Missing `onClick` handler (not clickable to `/payments`). |
| Active Complaints Metric Card | Dashboard top grid | Shallow UI | Displays active count (`open + inProgress`) and resolution rate. Does not separate urgent open from in-progress. Clicking links to bare `/complaints` instead of `/complaints?status=open`. |
| Service Health Metric Card | Dashboard top grid | Shallow UI | Displays operational/total checks. Contains hardcoded explanation paragraph causing card height mismatch. Lacks direct status pips (down/degraded). Links to `/services`. |
| New Enquiries Metric Card | Dashboard top grid | Shallow UI | Displays pending count and weekly delta. Lacks status breakdown. Links to bare `/enquiries` instead of `/enquiries?status=new`. |
| Urgent Action / Attention Queue | Dashboard | Missing entirely | Critical PG operational alerts (payments pending UTR verification, complaints open >72h, degraded/down services, new uncontacted enquiries) are not surfaced in a triage banner or action strip. |
| Revenue Trend Line Chart | Dashboard Row 2 | Built & Functional | Multi-line SVG chart for last 6 months (collected vs expected). Working tooltips, currency formatting, and empty states. |
| Service Health Gauge & Breakdown | Dashboard Row 2 | Built & Functional | Radial SVG gauge with operational ratio and status pill counts (Up/Degraded/Down). |
| Occupancy Trend Line Chart | Dashboard Row 3 | Built & Functional | Multi-line SVG chart for last 6 months (occupied vs total capacity). Accurate overlap algorithm from tenants. |
| Service Health History Timeline | Dashboard Row 4 | Built & Functional | 14-day audit log of service status changes across floors. |
| Complaint Resolution Gauge & Status Bars | Dashboard Row 5 | Built & Functional | Radial gauge showing resolved percentage + status progress bars (Open, In Progress, Resolved, Dismissed). |
| Payment Collection Funnel | Dashboard Row 5 | Built & Functional | Funnel chart displaying current month invoice stage counts and amounts (Paid, Sent, Partial, Overdue, Draft). |
| Complaint Categories Donut | Dashboard Row 6 | Built & Functional | Donut chart with category labels, count tooltips, and center count. |
| Meal Feedback Trend & Ratings | Dashboard Row 6 | Built & Functional | 14-day rolling line chart + 3 meal scorecards (breakfast, lunch, dinner) with 5-star visual rating. |
| Amenity Health Breakdown | Dashboard Row 7 | Built & Functional | Stacked horizontal bar chart for amenity types showing operational, degraded, down segments. |
| Complaint Activity Heatmap | Dashboard Row 7 | Built & Functional | Calendar heatmap for current month. Deep-links day click to `/complaints?date=YYYY-MM-DD`. |
| Recent Complaints List | Dashboard Row 8 | Built & Functional | List of 5 latest complaints with age badges (>3d, >7d), tenant name, status badge, and deep-link to detail. |
| Recent Enquiries List | Dashboard Row 8 | Built & Functional | List of 5 latest enquiries with contact name, phone, status badge, and deep-link to detail. |
| Unified Activity Timeline | Dashboard Row 9 | Shallow UI | Combines complaints and enquiries; omits payment events, tenant check-in/out, and real audit logs. |
| Quick Action Links | Dashboard Row 10 | Shallow UI | Plain buttons linking to `/tenants`, `/payments`, `/rooms`, `/notices`. |
| Real-time SSE Auto-Refresh | Background listener | Built & Functional | Subscribed to 11 event types (`payment_received`, `payment_verified`, `new_complaint`, `complaint_updated`, `service_update`, `new_enquiry`, `tenant_checkin`, `tenant_checkout`, `notification_created`, `meal_feedback_submitted`, `emergency_alert`). |

## 3. Cross-Cutting Dependencies & Data Flow

### Backend Route Dependencies (`apps/api/src/routes/dashboard.ts`)
- `GET /dashboard/stats`: Returns complete aggregated payload. Aggregates:
  - `Room`: active rooms count, total bed capacity, occupied beds, vacancy rate.
  - `Payment`: sum of amount for `status: 'paid'` and `month: currentMonth` + last 6 months trend.
  - `Invoice`: sum of totalAmount for `status in ['sent', 'partial', 'paid', 'overdue']` and `month: currentMonth` + last 6 months trend + status funnel stages.
  - `Complaint`: status counts, category counts, latest 5 items, daily counts for current month.
  - `ServiceStatus`: status counts, amenity breakdown, 14-day history populated with floor label.
  - `Enquiry`: new, contacted, new within 7 days, latest 5 items.
  - `MealFeedback`: 14-day rolling average per meal type (breakfast, lunch, dinner).
  - `Tenant`: 6-month historical stay date-overlap calculation (`moveInDate <= monthEnd && (!moveOutDate || moveOutDate >= monthStart)`).
- `GET /dashboard/badges`: Returns `{ unreadNotifications, openComplaints, pendingEnquiries }`.
- `GET /payments/pending-verification`: Count and list of payments awaiting UTR verification.

### Frontend Component Dependencies (`apps/web/src/components/ui/`)
- `StatCard.tsx`: Metric card container. Currently has hardcoded arrows, fixed icon backgrounds, and inconsistent vertical content flow.
- `KpiHeader.tsx`: Stripe-style KPI header with hairline top accent and delta pill.
- `Surface.tsx`: Foundational card/panel surface respecting design tokens.
- `Skeleton.tsx`: `DashboardSkeleton` loading placeholder (requires alignment with new card structure).
- `LineChart.tsx`: Multi-line SVG chart with tooltips.
- `GaugeChart.tsx`: Semi-circular SVG gauge.
- `DonutChart.tsx`: SVG ring chart.
- `FunnelChart.tsx`: Proportional horizontal funnel bars.
- `StackedBarChart.tsx`: Segmented horizontal bars.
- `HeatmapCalendar.tsx`: Month calendar grid with color intensity.
- `Timeline.tsx`: Vertical event history.
- `StatusBadge.tsx`: Visual status pills.

### Theme & Design Token Integration
- Themes: `saas`, `brutalist`, `neumorphic`, `soft-ui`, `custom` in `apps/web/src/themes/*.css`.
- Must strictly consume tokens: `--color-card-bg`, `--border-color`, `--shadow-card`, `--shadow-card-hover`, `--radius-xl`, `--radius-lg`, `--radius-md`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-field-bg`, `--color-brand-*`, `--color-success-*`, `--color-warning-*`, `--color-danger-*`.

## 4. Missing Components & Architectural Deficiencies

1. **Rebuilt `StatCard` / `MetricCard` Component**:
   - Equalized height guarantee (`h-full flex flex-col justify-between`).
   - Clean visual progress bar indicator (occupancy rate, collection progress, service health ratio).
   - Crisp Lucide delta indicators (`TrendingUp`, `TrendingDown`, `Minus`, `ArrowUpRight`) replacing crude unicode text (`↑`, `↓`, `→`).
   - Responsive sparkline support spanning full container width.
   - Distinct secondary metrics (e.g., "3 vacant beds available", "₹42,000 pending collection", "1 urgent open").
   - Clickable hover feedback across all themes with proper cursor and navigation intent.

2. **Action Queue / Operational Triage Strip (`AttentionRequiredBanner`)**:
   - Real-time notification strip surfacing high-priority action items:
     - Payments awaiting UTR verification (with count and direct link to verify queue).
     - Open complaints older than 3 days (with count and filtered link).
     - Services down or degraded (with floor location and link).
     - Uncontacted enquiries (with count and quick link).

3. **Dashboard Information Architecture & View Organization**:
   - Grouping the 10 stacked rows into clear, cohesive operational sections:
     - Section 1: Executive KPI Strip & Attention Required triage.
     - Section 2: Financial & Capacity Hub (Revenue Trend + Collection Funnel + Occupancy Trend).
     - Section 3: Facility Health & Maintenance (Service Health & Amenities + Complaint Analytics & Heatmap).
     - Section 4: Resident Experience & Activity Stream (Meal Feedback + Recent Complaints + Recent Enquiries + Live Event Feed).

4. **Interactive Controls & Manual Refresh**:
   - Header controls: "Refresh Data" button with spin animation and "Last updated" timestamp, complementing SSE auto-refresh.
   - Direct Quick Actions in header: "Record Payment", "New Complaint", "Add Tenant", "Manage Services".

5. **Updated `DashboardSkeleton`**:
   - Must mirror the exact geometry, cards, and section layout of the refreshed dashboard to prevent layout shift during loading.

## 5. Prioritized Implementation Plan

### P0 — Core Functionality & Broken Links
- Fix unclickable Collected Metric Card (add `onClick` navigating to `/payments`).
- Fix bare links on Active Complaints (`/complaints?status=open`) and New Enquiries (`/enquiries?status=new`).
- Add manual refresh capability with loading state and last-updated timestamp.

### P1 — Missing End-to-End Operational Components
- Build `AttentionRequiredBanner` (or `ActionQueueStrip`) surfacing pending UTR verifications, aging open complaints, and down services.
- Connect pending payment verification data into dashboard operational feed.

### P2 — Major UX/UI Rebuild (The "Cards" Rebuild)
- Rebuild `StatCard.tsx` (or build purpose-built `MetricCard.tsx`) with:
  - Standardized uniform height and flex baseline.
  - Micro-progress bars for occupancy fill and collection target.
  - Lucide vector trend pills (`TrendingUp`, `ArrowUpRight`, `Minus`).
  - Full-width responsive sparkline integration.
  - Theme-token compliance across all 5 themes (`saas`, `brutalist`, `neumorphic`, `soft-ui`, `custom`).
- Re-architect the 5-card grid with responsive breakpoints (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`).

### P3 — Dashboard Layout & Section Architecture
- Re-group 8 chart cards and activity lists into 3 coherent operational panels with clean section headers and quick-action toolbars.
- Enhance recent complaints list with inline status actions.
- Enhance activity timeline with financial events (payments recorded, invoices sent).

### P4 — Polish & Verification
- Update `DashboardSkeleton` in `Skeleton.tsx` to match new geometry without layout shift.
- Verify across light and dark modes in all 5 theme engines.
- Run `bun lint` and resolve any lint warnings.
- ASCII only, no emojis in code or documentation.

## 6. Completion Status

- Status: REBUILT & VERIFIED (Pass 1, Pass 2, & Pass 3 complete).
- Pass 1 Deliverables:
  - Metric cards rebuilt into Stripe & Mercury enterprise architecture: uniform 148px height, hairline tone accent, micro progress bars, vector delta pills, full-width responsive sparkline, deep-link navigation.
  - Operational triage banner (`AttentionRequiredBanner`) built and integrated, surfacing pending UTRs, aging open complaints, service outages, and new enquiries.
  - Broken click flow on Collected card resolved (routes to `/payments`).
  - Active Complaints and New Enquiries deep-links corrected with query parameters (`/complaints?status=open`, `/enquiries?status=new`).
  - Header controls enhanced with manual Refresh capability (spinning indicator + live timestamp) complementing real-time SSE updates.
  - Dashboard skeleton updated to prevent layout shift.
- Pass 2 Deliverables:
  - Modern Curved Area Charts (`LineChart.tsx`): Rebuilt with monotonic cubic Bézier splines, soft gradient glow area fills, interactive cursor crosshairs with live tracking indicator, and floating dynamic tooltips for both Revenue Trend and Occupancy Trend.
  - Linear/Datadog Telemetry Grid (`AmenityHealthGrid.tsx`): Replaced rigid stacked bar chart with responsive operational service cards featuring uptime percentage badges, status breakdown pips (operational, degraded, down), progress bars, and floor service links.
  - Building Rooms & Beds Occupancy Heatmap (`RoomBedHeatmap.tsx`): High-density interactive matrix displaying occupancy status per room and bed with floor filter tabs, summary KPIs (total rooms, occupied, vacant, occupancy rate), bed indicator pips with tenant assignment tooltips, and one-click navigation to room detail pages.
  - Backend API Enrichment (`apps/api/src/routes/dashboard.ts`): Augmented `GET /dashboard/stats` with `pendingVerifications` and `roomOccupancyMatrix` with populated floor and bed tenant details.
- Pass 3 Deliverables:
  - Linear Triage & SLA Incident Command Matrix (`ComplaintResolutionHub.tsx`): Replaced primitive semi-circular gauge and static 4-line progress bars with an actionable ticket pipeline (Open, In Progress, Resolved, Dismissed with 1-click status routing), SLA aging urgency matrix (<24h normal, 24-48h at-risk, >48h overdue with pulse), MTTR readout badge, and proportional priority distribution bar (Urgent, High, Med, Low).
  - Shared Types (`packages/types/src/dashboard.ts`): Added `IComplaintSlaMetrics` and updated `IDashboardStats` with barrel exports.
  - Backend SLA Aggregation (`apps/api/src/routes/dashboard.ts`): Computed SLA aging buckets (<24h, 24-48h, >48h), active priority counts, 30-day Mean Time to Resolution (`avgResolutionHours`), and SLA compliance rate (% resolved within 48h).
  - Zero lint errors or warnings (`bun run lint`).
  - TypeScript types 100% clean across all packages (`bun run typecheck`).
  - Strict adherence to portal boundaries (admin Next.js only, resident portal untouched) and ASCII-only rules.

