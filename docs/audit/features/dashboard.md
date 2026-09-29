# Dashboard Module - Feature Listing

Module: dashboard
Scope: admin web + API
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/dashboard_audit_pass1_20260908-204500.md

## Feature Listing

| Surface                     | Capability                                                                                                                                                                                                   | Status  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| KPI Metric Cards            | Stripe & Mercury architecture: uniform 148px height, hairline tone accent, micro progress bars (occupancy, target), vector delta pills, full-width sparkline, deep-links                                     | WORKING |
| Operational Triage          | AttentionRequiredBanner: real-time triage of pending UTRs, aging complaints (>3d), service issues, new leads                                                                                                 | WORKING |
| Manual Refresh              | Header refresh control with spinning indicator + live timestamp complementing SSE                                                                                                                            | WORKING |
| Financial & Capacity Hub    | Modern curved area Revenue Trend (LineChart) with Bézier splines & glow fill + Payment Collection Funnel + 6-month Occupancy Trend                                                                           | WORKING |
| Rooms & Beds Heatmap        | Live interactive building occupancy matrix with floor filters, bed status pills, tenant assignments, and room drill-down                                                                                     | WORKING |
| Complaint Command Console   | Linear-style Continuous Operational Command (ComplaintResolutionHub): zero nested cards, seamless lifecycle pipeline strip, SLA aging horizon rail (<24h, 24-48h, >48h), MTTR ticker, priority hairline bar  | WORKING |
| Complaint Categories Matrix | Datadog APM / Sentry Ranked Impact Matrix (ComplaintCategoryMatrix): high-density ranked breakdown, multi-tone severity bars, percentage share, SLA breach alerts, 1-click filter navigation                 | WORKING |
| Resident Meal Feedback      | Toast POS / OpenTable Meal Quality Console (MealFeedbackLedger): 14-day smoothed satisfaction index sparkline with 4.0 benchmark, meal comparison ledger, aspect sentiment tags (#Taste, #Portion, #Hygiene) | WORKING |
| Complaint Activity Heatmap  | Calendar heatmap for current month with deep-links to filtered complaints                                                                                                                                    | WORKING |
| Facility & Living Hub       | Service Health gauge + Amenity Health telemetry grid (AmenityHealthGrid) + 14-day Service Health History timeline                                                                                            | WORKING |
| Operational Stream          | Recent Complaints with age badges + Recent Enquiries                                                                                                                                                         | WORKING |
| Real-Time SSE               | 11 domain event subscriptions automatically refresh operational stats                                                                                                                                        | WORKING |
| Telemetry Seeding           | Dynamic live-anchored seed script (bun run seed:dashboard) generating rich data across complaints, menus, 14-day meal feedback, 6-month revenue, and room occupancy                                          | WORKING |
