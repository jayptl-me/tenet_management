# Current Gap Analysis (2026-07-12)

Supersedes older contradictory claims in this file. Authoritative ranked backlog: [audit/LIVE_GAP_INVENTORY.md](./audit/LIVE_GAP_INVENTORY.md). Executive: [audit/README.md](./audit/README.md).

## Product split

| Surface | Path | Roles |
|---------|------|-------|
| Admin | `apps/web` | admin only |
| Portal | `mobile/` Flutter Web+iOS+Android | tenant, guardian, visitor desk |
| API | `apps/api` | JWT all roles |

## Already fixed (do not re-open)

- Missing GET/PUT routes for assets, notices, notifications, attendance, menus POST, full complaint/enquiry PUT
- Guardian static routes before `/:id`; guardian create temporaryPassword
- Radix Select + ResourceSelect -> SearchableSelect
- Multi-feature `requireFeature` (not laundry-only)
- Tenant phone normalize + ISO moveIn on create; detail hubs + reinstate
- Visitors admin create; mapVisitor; phone normalize; lifecycle buttons on detail
- Meals PUT accepts mealType
- Complaints priority (not severity); services edit path; enquiries enums; laundry status; assets dates

## Open P0

1. **Tenant transfer non-atomic** -- free bed before validate (`routes/tenants.ts`)
2. **Tenant isActive on PUT/edit** -- bypasses checkout
3. **Tenant create no temporaryPassword** -- portal login path broken for real creates
4. **Visitors list filter `pending`** -- invalid enum
5. **Flutter `user.tenantId` missing** -- seed/register gate

## Open P1 (selected)

- Nested tenant GETs IDOR; visitor arrive/depart authz
- Meals summary unused; menus/meals flag pairing
- Payments mobile cards; notifications DataTable
- Flutter: profile, invoice detail, leaves, attendance, notifications, meal categories
- Types drift (tenant create, meal summary)

## Module grades (admin)

Most CRUD modules **A- / A**. Outliers: **Tenants B** (integrity), **Visitors B-** (filter), **Notifications B-**, **Payments B**, **Export B-**.

## Design priority

- Theme preset **`saas`**
- Shared components backlog: TempCredentialsDialog, OccupancyBedPicker, VisitorLifecycleActions, StatusFilterSelect, FeedbackSummaryStrip, StarRating, WeekMenuPlanner
- See [audit/01-design-system-and-components.md](./audit/01-design-system-and-components.md)

## Agent next steps

Follow [audit/AGENT_PLAYBOOK.md](./audit/AGENT_PLAYBOOK.md) Batch A then B. After each fix, update feature md checkboxes and LIVE_GAP_INVENTORY status.
