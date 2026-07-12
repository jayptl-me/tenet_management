# Domain Specifications

> Purpose: Domain reference for entities, flows, and architecture.
> Last Updated: 2026-07-12
> Code is truth. Specs can lag; re-verify against source before implementing.
> Active gaps: [docs/audit/README.md](../audit/README.md)
> Full agent context: [docs/AGENT_CONTEXT.md](../AGENT_CONTEXT.md)
> No emojis in agent-authored content.

---

## Clients (UI ownership)

| Client | Path | Platforms | Roles |
|--------|------|-----------|-------|
| Admin | `apps/web` | Browser (Next.js) | admin only |
| Resident portal | `mobile/` | Flutter Web + iOS + Android | tenant, guardian, visitor desk |

Do not place tenant/guardian/visitor App Router pages under `apps/web`.

---

## Document Index

| # | Document | Covers |
|---|----------|--------|
| 01 | [Core Architecture](01-core-architecture.md) | Monorepo, auth, clients, API, CORS |
| 02 | [Tenant Lifecycle](02-tenant-lifecycle.md) | User, Tenant, Guardian, create/transfer/checkout/delete |
| 03 | [Room & Floor Management](03-room-floor-management.md) | Floors, rooms, beds, sharingType rebuild |
| 04 | [Finance](04-finance.md) | Payments, invoices, electricity |
| 05 | [Operations](05-operations.md) | Complaints, services, assets |
| 06 | [Engagement](06-engagement.md) | Notices, notifications, enquiries, visitors |
| 07 | [Facilities](07-facilities.md) | Menus, meal feedback, laundry |
| 08 | [HR & Ops](08-hr-ops.md) | Attendance, leaves |
| 09 | [System Administration](09-system-admin.md) | AppConfig, audit logs, SSE, export, dashboard |
| 10 | [Data Flow Diagrams](10-data-flow-diagrams.md) | Relationships and edit data flows |

**Gaps:** use **[docs/audit/](../audit/README.md)** only (not stale health scores).

---

## Quick Entity Map

```
User --1:1-- Tenant --N:1-- Room --N:1-- Floor
  |                |
  |                +-- Payment --N:1-- Invoice
  |                +-- Complaint, Attendance, Leave, Laundry, MealFeedback, Visitor
  +---- Guardian --N:1-- Tenant

ServiceStatus (per floor) | ElectricityBill | DailyMenu | Asset | Enquiry | Notice | Notification | AuditLog | AppConfig
```

## Related docs

| Path | Role |
|------|------|
| [docs/AGENT_CONTEXT.md](../AGENT_CONTEXT.md) | Future-agent permanent context |
| [docs/PORTAL_CONNECTIVITY.md](../PORTAL_CONNECTIVITY.md) | Admin vs Flutter Web/iOS connectivity |
| [docs/audit/](../audit/README.md) | Gap matrix |
| [docs/THEMING_ARCHITECTURE.md](../THEMING_ARCHITECTURE.md) | Admin theme tokens |
| [PRODUCT.md](../../PRODUCT.md) | Product principles |
| [AGENTS.md](../../AGENTS.md) | Build commands and conventions |
