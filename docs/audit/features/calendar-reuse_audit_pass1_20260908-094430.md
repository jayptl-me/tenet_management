# Calendar Reuse - Audit Pass 1

Module: calendar-reuse (shared calendars wired across admin surfaces)
Scope: admin web only (no API changes, no prop changes, real data only)
Source verified: 2026-09-08 UTC

## 1. Component Usage Map

| Component              | Before                          | After                                                | Status  |
| ---------------------- | ------------------------------- | ---------------------------------------------------- | ------- |
| DateRangePicker        | DEAD (zero usages)              | enquiries list + complaints list (range)             | WORKING |
| TenantStayCalendar     | tenants/[id] only               | + leaves/[id] Leave Window                           | WORKING |
| HeatmapCalendar        | dashboard only                  | + complaints list density strip                      | WORKING |
| AttendanceMonthCalendar| attendance list + detail        | unchanged (correct scope)                            | WORKING |
| AttendanceRangeFilter  | attendance list                 | unchanged (correct scope)                            | WORKING |
| TodayAttendanceBoard   | attendance list                 | unchanged (correct scope)                            | WORKING |
| WeekMenuPlanner        | menus list                      | unchanged (correct scope)                            | WORKING |

## 2. Wirings Applied

| Surface              | Calendar         | Data source (real)                              | Status  |
| -------------------- | ---------------- | ----------------------------------------------- | ------- |
| Enquiries list       | DateRangePicker  | fromDate/toDate API filters (were unexposed)    | WORKING |
| Complaints list      | DateRangePicker  | fromDate/toDate API filters (upgraded single)   | WORKING |
| Complaints list      | HeatmapCalendar  | loaded rows grouped by createdAt; day-click filters | WORKING |
| Leaves detail        | TenantStayCalendar | LeaveDetail startDate/endDate as window       | WORKING |
| Guardian detail      | TenantStayCalendar | SKIPPED (no stay dates on GuardianDetail payload) | SKIPPED |

## 3. Preserved Behaviors

| Behavior                                              | Status  |
| ----------------------------------------------------- | ------- |
| Complaints ?date= / ?fromDate= deep-links             | WORKING |
| Complaints heatmap focus follows range, day-click narrows | WORKING |
| Enquiries reset + empty-state cover date range        | WORKING |
| CSV export untouched                                  | WORKING |

## 4. Out of Scope

1. Guardian Tenancy Calendar (needs ward stay dates on payload or approved tenant fetch).
2. Payments/invoices/electricity ranges (month-scoped APIs; day ranges would be fake).
3. Export date bounds.

## 5. Pass 1 Fixes Applied

| Fix                                                              | Files                                          | Status  |
| ---------------------------------------------------------------- | ---------------------------------------------- | ------- |
| Date range filters                                               | enquiries/page.tsx, complaints/page.tsx        | WORKING |
| Leave Window calendar                                            | leaves/[id]/page.tsx                           | WORKING |
| Complaint density heatmap                                        | complaints/page.tsx                            | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; no tests executed; no emojis; portal boundaries respected.
