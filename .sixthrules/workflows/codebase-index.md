# codebase-index.md

> Living codebase map for the paying guest management project.

## Directory Structure

```
+-- .github/
|   +-- workflows/
|       +-- ci.yml
+-- apps/
|   +-- api/
|   |   +-- src/
|   |   |   +-- __tests__/
|   |   |   +-- jobs/
|   |   |   +-- lib/          # env, cors-origins, db, jwt, ...
|   |   |   +-- middleware/
|   |   |   +-- models/
|   |   |   +-- routes/
|   |   |   +-- scripts/
|   |   |   +-- services/
|   |   |   +-- templates/
|   |   |   +-- index.ts
|   +-- web/                 # ADMIN ONLY Next.js app
|       +-- src/app/(admin)/
|       +-- src/components/
|       +-- src/hooks/
|       +-- src/lib/
|       +-- src/store/
+-- mobile/                  # Flutter portals (tenant/guardian/visitor)
|   +-- lib/
|   |   +-- core/            # config, network, router, theme, storage
|   |   +-- features/
|   |   |   +-- auth/
|   |   |   +-- tenant/
|   |   |   +-- guardian/
|   |   |   +-- visitor/
|   |   |   +-- shared/
|   |   +-- main.dart
|   +-- android/ ios/ web/
|   +-- pubspec.yaml
|   +-- README.md
+-- packages/
|   +-- types/
+-- docs/
|   +-- PORTAL_CONNECTIVITY.md
|   +-- audit/
|   +-- specs/
+-- package.json
+-- render.yaml
```

## Tech Stack Overview

| Project     | Runtime    | Framework / Library  | Database / ORM           | Type Sharing / Build   |
| ----------- | ---------- | -------------------- | ------------------------ | ---------------------- |
| `@pg/api`   | Bun        | Hono                 | MongoDB + Mongoose       | Workspace Type Link    |
| `@pg/web`   | Node/Bun   | Next.js (admin only) | None (REST + SSE Client) | Workspace Type Link    |
| `mobile`    | Flutter    | Riverpod + go_router | None (Dio REST client)   | HTTP only              |
| `@pg/types` | TypeScript | Node/Bun             | None                     | Workspace Shared Types |

## Sub-Project Paths and Purposes

### apps/api (Hono Backend)

| Path                                                                                                                                                      | Purpose                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [apps/api/src/index.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/index.ts)                             | Server entrypoint, CORS, global middleware stack, route mounting                    |
| [apps/api/src/lib/cors-origins.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/lib/cors-origins.ts)       | CORS allowlist for admin web + Flutter portal origins                               |
| [apps/api/src/lib/env.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/lib/env.ts)                         | Env validation including FRONTEND_URL, PORTAL_URL, CORS_EXTRA_ORIGINS               |
| [apps/api/src/routes/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/routes/)                               | Hono API route handlers (REST endpoints + SSE stream endpoint)                      |
| [apps/api/src/models/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/models/)                               | Mongoose schemas and models definitions                                             |
| [apps/api/src/services/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/services/)                           | Business logic, authentication, Cloudinary uploads, PDF generation, email templates |
| [apps/api/src/lib/write-audit-log.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/lib/write-audit-log.ts) | Shared AuditLog writer using closed action enum                                     |
| [docs/audit/README.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/docs/audit/README.md)                             | Authoritative edit-page / FE-API gap matrix for agents                              |
| [apps/api/src/middleware/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/middleware/)                       | Request logging, auth validation, error handling, security headers                  |
| [apps/api/src/jobs/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/jobs/)                                   | Node-cron schedulers for daily updates and notifications                            |
| [apps/api/src/scripts/seed.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/scripts/seed.ts)               | Database seeding script (accepts option --with-sample-data)                         |
| [apps/api/src/**tests**/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/__tests__/)                         | Unit and integration test suites using Vitest                                       |

### apps/web (Next.js Admin Frontend -- admin role only)

| Path                                                                                                                                                                    | Purpose                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [apps/web/src/app/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/app/)                                                   | Admin App Router only (no tenant/guardian portal routes)                               |
| [apps/web/src/components/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/)                                     | Reusable Radix UI & styled Tailwind React components                                   |
| [apps/web/src/components/ui/FormPage.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/ui/FormPage.tsx)       | Shared shell for create/edit admin pages (header, loading, error)                      |
| [apps/web/src/components/ui/FormCard.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/ui/FormCard.tsx)       | Elevated form surface with optional footer actions                                     |
| [apps/web/src/components/ui/FormSection.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/ui/FormSection.tsx) | Multi-block form sections + FormGrid                                                   |
| [apps/web/src/components/ui/FormActions.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/ui/FormActions.tsx) | Standard Cancel/Save form footer                                                       |
| [apps/web/src/components/ui/Surface.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/ui/Surface.tsx)         | Token-driven elevated surfaces (card/nested/glass)                                     |
| [apps/web/src/components/ui/Checkbox.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/ui/Checkbox.tsx)       | Token-driven labeled checkbox control                                                  |
| [apps/web/src/lib/field-styles.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/lib/field-styles.ts)                     | Shared field/control class fragments (theme-agnostic)                                  |
| [apps/web/src/hooks/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/hooks/)                                               | Custom React hooks for global queries and mutations                                    |
| [apps/web/src/lib/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/lib/)                                                   | Ky HTTP client instances and API endpoint configurations                               |
| [apps/web/src/store/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/store/)                                               | Zustand state stores (authentication, configurations, UI states)                       |
| [apps/web/src/themes/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/themes/)                                             | Multi-preset design systems (saas, brutalist, neumorphic, soft-ui) + light/dark tokens |

### mobile (Flutter portals -- tenant / guardian / visitor)

| Path | Purpose |
| ---- | ------- |
| [mobile/lib/main.dart](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/main.dart) | Flutter entry |
| [mobile/lib/core/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/core/) | Env, Dio client, CORS-facing base URL, router, theme, token storage |
| [mobile/lib/features/auth/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/features/auth/) | Login, session restore (rejects admin) |
| [mobile/lib/features/tenant/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/features/tenant/) | Tenant shell: invoices, payments, complaints, laundry, meals, notices |
| [mobile/lib/features/guardian/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/features/guardian/) | Guardian shell: ward + attendance |
| [mobile/lib/features/visitor/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/features/visitor/) | Visitor desk (tenant-authenticated) |
| [mobile/README.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/README.md) | Flutter setup and routes |
| [docs/PORTAL_CONNECTIVITY.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/docs/PORTAL_CONNECTIVITY.md) | Multi-client connectivity + CORS |

### packages/types (Shared Typings Workspace)

| Path                                                                                                                                      | Purpose                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [packages/types/src/index.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/index.ts) | Shared exports entrypoint mapping all entities                          |
| [packages/types/src/\*.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/)            | 26 separate type definition files (e.g. user, tenant, payment, invoice) |

## Key Cross-Cutting Concerns

| Concern           | Implementation Strategy                 | Locations                                                                                                                                                                                                                                                                                                    |
| ----------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication    | JWT (Jose library) + Bcrypt credentials | [apps/api/src/routes/auth.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/routes/auth.ts), [apps/api/src/middleware/auth.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/middleware/auth.ts); Flutter: [mobile/lib/features/auth/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/mobile/lib/features/auth/) |
| CORS / multi-client | FRONTEND_URL + PORTAL_URL + dev localhost | [apps/api/src/lib/cors-origins.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/lib/cors-origins.ts), [docs/PORTAL_CONNECTIVITY.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/docs/PORTAL_CONNECTIVITY.md) |
| Validation        | Zod schemas validator                   | [packages/types/src/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/), [apps/api/src/routes/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/routes/) (with `@hono/zod-validator`)                          |
| Real-time Updates | Server-Sent Events (SSE) streams        | [apps/api/src/routes/sse.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/routes/sse.ts), [apps/web/src/hooks/useSSE.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/hooks/useSSE.ts)                         |
| Background Jobs   | Cron schedulers                         | [apps/api/src/jobs/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/jobs/)                                                                                                                                                                                      |
| Notifications     | Emails (Resend) and in-app updates      | [apps/api/src/services/email.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/services/email.ts), [apps/api/src/routes/notifications.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/routes/notifications.ts) |
| File Storage      | Cloudinary integrations                 | [apps/api/src/services/cloudinary.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/services/cloudinary.ts)                                                                                                                                                    |

## Database Collections (MongoDB via Mongoose)

- `users`: Credentials, system roles (admin, manager, staff)
- `tenants`: PG tenant personal info, room allocations, active state
- `rooms`: Rooms configuration, capacity, current count, floor mapping
- `floors`: Floors list, names
- `payments`: Rental income history, payment methods, receipts
- `invoices`: Monthly bills generated automatically (rent, extras)
- `electricityBills`: Sub-meter reading trackers per room
- `complaints`: Maintenance issues raised, statuses, assignments
- `dailyMenus`: Food/meal schedules per day (breakfast, lunch, dinner)
- `mealFeedbacks`: Guest feedback scores on meals
- `laundrySlots`: Booking slots for washing machine usage
- `attendanceRecords`: Staff/tenant entry-exit logs
- `leaveApplications`: Absences reported by staff or tenants
- `visitors`: Daily visitor log entries
- `assets`: Inventories in rooms or common areas (TV, AC, Bed)
- `noticePosts`: Bulletins published by management
- `auditLogs`: Administrative operation trackers

## Update Protocol

This index must be updated immediately under any of the following circumstances:

- A file is created, deleted, renamed, or relocated.
- A new directory level is introduced inside `apps/` or `packages/`.
- Dependency libraries or build scripts are added to any `package.json`.
- A new Mongoose model/collection is introduced or deprecated.
- Update by following the rules in [codebase-index-update-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index-update-protocol.md).
