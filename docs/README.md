# Documentation Index

ASCII only. No emojis. Code is truth; re-verify against the repository before implementing.

## Start here (agents)

| Document | Purpose |
|----------|---------|
| [../AGENTS.md](../AGENTS.md) | Root steering: commands, architecture, portal boundaries |
| [AGENT_CONTEXT.md](AGENT_CONTEXT.md) | Full future-agent context load (product split, paths, gates) |
| [PORTAL_CONNECTIVITY.md](PORTAL_CONNECTIVITY.md) | Admin vs Flutter Web/iOS/Android connectivity, CORS, auth, API map |
| [audit/README.md](audit/README.md) | Live gap matrix / remediation backlog |
| [../mobile/README.md](../mobile/README.md) | Flutter portal setup (Web + iOS + Android) |

## Specs (domain reference)

| Document | Covers |
|----------|--------|
| [specs/README.md](specs/README.md) | Spec index |
| [specs/01-core-architecture.md](specs/01-core-architecture.md) | Monorepo, auth, clients |
| [specs/02-tenant-lifecycle.md](specs/02-tenant-lifecycle.md) | Tenant lifecycle |
| [specs/03-room-floor-management.md](specs/03-room-floor-management.md) | Rooms, floors, beds |
| [specs/04-finance.md](specs/04-finance.md) | Payments, invoices, electricity |
| [specs/05-operations.md](specs/05-operations.md) | Complaints, services, assets |
| [specs/06-engagement.md](specs/06-engagement.md) | Notices, visitors, enquiries |
| [specs/07-facilities.md](specs/07-facilities.md) | Menus, meals, laundry |
| [specs/08-hr-ops.md](specs/08-hr-ops.md) | Attendance, leaves |
| [specs/09-system-admin.md](specs/09-system-admin.md) | AppConfig, audit, export |
| [specs/10-data-flow-diagrams.md](specs/10-data-flow-diagrams.md) | Data flows |

## Other

| Document | Purpose |
|----------|---------|
| [THEMING_ARCHITECTURE.md](THEMING_ARCHITECTURE.md) | Admin theme tokens (Next.js) |
| [TENANT_LIFECYCLE_UX_DESIGN.md](TENANT_LIFECYCLE_UX_DESIGN.md) | UX design notes (may predate Flutter portal) |
| [CREDENTIALS.md](CREDENTIALS.md) | Local seed credentials (if present) |

## Workflow engines

`.sixthrules/workflows/` (and `.claude/rules/` mirrors):

- master.md
- codebase-index.md
- monorepo-boundaries.md
- automation-loop.md
- deployment-verification.md
- database-schema-protocol.md

## Product split reminder

- **Next.js (`apps/web`)**: admin only
- **Flutter (`mobile/`)**: tenant, guardian, visitor desk -- **Flutter Web + iOS + Android**
