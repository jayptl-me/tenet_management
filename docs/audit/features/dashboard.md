# Dashboard Module - Feature Listing

Module: dashboard
Scope: admin web + API
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/dashboard_audit_pass1_20260908-181500.md

## Feature Listing

| Surface | Capability | Status |
| --- | --- | --- |
| KPI Metric Cards | Stripe & Mercury architecture: uniform 148px height, hairline tone accent, micro progress bars (occupancy, target), vector delta pills, full-width sparkline, deep-links | WORKING |
| Operational Triage | AttentionRequiredBanner: real-time triage of pending UTRs, aging complaints (>3d), service issues, new leads | WORKING |
| Manual Refresh | Header refresh control with spinning indicator + live timestamp complementing SSE | WORKING |
| Financial & Capacity Hub | Modern curved area Revenue Trend (LineChart) with Bézier splines & glow fill + Payment Collection Funnel + 6-month Occupancy Trend | WORKING |
| Rooms & Beds Heatmap | Live interactive building occupancy matrix with floor filters, bed status pills, tenant assignments, and room drill-down | WORKING |
| Facility & Living Hub | Service Health gauge + Amenity Health telemetry grid (AmenityHealthGrid) + Complaint Resolution & SLA Command Hub (ComplaintResolutionHub: interactive status pipeline, SLA aging telemetry, priority distribution) + Complaint Categories donut + Complaint Activity heatmap + 14-day Meal Feedback | WORKING |
| Operational Stream | Recent Complaints with age badges + Recent Enquiries + 14-day Service Health History timeline | WORKING |
| Real-Time SSE | 11 domain event subscriptions automatically refresh operational stats | WORKING |
