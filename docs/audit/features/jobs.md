# Jobs & Background Scheduler Management -- Feature Audit

**Audit Pass:** 1  
**Audit Timestamp:** 2026-09-08T03:07:00+05:30 (Asia/Kolkata)  
**Module:** Jobs & Background Scheduler (A-Z Phase 1: Module 13)  
**Audit Status:** Complete & Remediated (Pass 1)  
**Grade:** A+  
**Priority:** All P1 & P2 Remediations Closed

---

## 1. Executive Summary & Product Split

The Jobs & Background Scheduler module governs automated recurring operational tasks for the Tenet PG Management platform. It automates financial billing cycles, arrears status transitions, reminder notices, mess feedback prompts, and shared resource release (washing machine timer expiry).

The system operates across two operational execution modes:

1. **In-Process Cron Scheduler (`apps/api/src/jobs/scheduler.ts`)**: Built using `node-cron`, initialized once upon server start after MongoDB connection readiness (`startScheduler()` in `apps/api/src/index.ts`), and cleanly terminated during graceful shutdown (`stopScheduler()`).
2. **HTTP Job Triggers (`apps/api/src/routes/jobs.ts`)**: Secret-guarded REST endpoints mounted at `/api/v1/jobs/*`, designed for external webhook invocation (e.g. CronJob.org, AWS EventBridge, GitHub Actions, Google Cloud Scheduler) or manual administrative dispatch.

### Product Split & Access Boundary Matrix

| Surface                | Allowed Roles                   | Platform                | Route / URL                         | Role Enforcement Mechanism                                                                      | Status  |
| ---------------------- | ------------------------------- | ----------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| In-Process Scheduler   | System Internal                 | Bun (`apps/api`)        | Process memory (`node-cron`)        | Server boot lifecycle; no network listener                                                      | WORKING |
| HTTP Job Triggers      | Secret Holder (`x-cron-secret`) | Bun + Hono (`apps/api`) | `POST /api/v1/jobs/*`               | Header check `c.req.header('x-cron-secret') === env.CRON_SECRET`; fails with `401 UNAUTHORIZED` | WORKING |
| Admin Web UI           | `admin` only                    | Next.js (`apps/web`)    | `/invoices` (Bulk generator banner) | Bulk generator banner directly triggers monthly invoicing lifecycle                             | WORKING |
| Resident Mobile Portal | N/A                             | Flutter (`mobile/`)     | None                                | Residents do not interact with scheduler endpoints directly; receive dispatched notifications   | WORKING |

---

## 2. Source Code Map

| Layer                 | File Path                                                                                                                                               | Responsibilities & Coverage                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job Router            | [jobs.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/routes/jobs.ts)                                   | Hono router mounted at `/api/v1/jobs`: enforces `x-cron-secret` header; exposes `/generate-invoices`, `/overdue-check`, `/send-reminders`, `/meal-prompts`, `/release-washing-machines` |
| Scheduler Engine      | [scheduler.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/jobs/scheduler.ts)                           | Registers 5 `node-cron` schedules on boot; manages `startScheduler()` and `stopScheduler()`                                                                                             |
| Notification Service  | [notification.service.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/services/notification.service.ts) | `createNotification` handles document persistence, recipient resolution, ntfy push dispatch, and SSE event broadcast                                                                    |
| Invoice Service       | [invoice.service.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/services/invoice.service.ts)           | `generateMonthlyInvoices(month)` iterating active tenants, skipping existing, creating invoice + pending rent payment                                                                   |
| Server Lifecycle      | [index.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/index.ts)                                        | Boots scheduler on startup (`startScheduler()`); stops cron tasks during graceful shutdown (`stopScheduler()`)                                                                          |
| Configuration         | [env.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/lib/env.ts)                                        | Zod environment schema defining `CRON_SECRET` with minimum 16 chars and fallback default                                                                                                |
| Deployment Blueprint  | [render.yaml](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/render.yaml)                                               | Cloud deploy definition configuring `CRON_SECRET` with auto-generation                                                                                                                  |
| Notification Model    | [notification.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/models/notification.ts)                   | Supports `payment_reminder` and `meal_feedback` notification types                                                                                                                      |
| Washing Machine Model | [washingMachine.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/models/washingMachine.ts)               | Tracks `status`, `timerEndsAt`, `currentUserId` for automated expiry cleanup                                                                                                            |

---

## 3. Job Catalog & Execution Specifications

| Job Name                         | In-Process Cron Schedule                         | HTTP Endpoint                         | Scope & Target Models                             | Operations Performed                                                                                                                                   | Status  |
| -------------------------------- | ------------------------------------------------ | ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **Monthly Invoices**             | `0 9 1 * *` (1st of month, 9:00 AM)              | `POST /jobs/generate-invoices`        | `Tenant`, `Invoice`, `Payment`, `ElectricityBill` | Iterates active tenants; generates rent + electricity invoice and pending payment. Skips existing invoices.                                            | WORKING |
| **Daily Overdue Check**          | `0 8 * * *` (Daily, 8:00 AM)                     | `POST /jobs/overdue-check`            | `Payment`, `Invoice`                              | Sets `Payment` where `dueDate < now` to `overdue`. Sets `Invoice` where `dueDate < now && status === 'sent'` to `overdue`. Preserves `partial` status. | WORKING |
| **Payment Reminders**            | `0 10 5,10,15 * *` (5th, 10th, 15th at 10:00 AM) | `POST /jobs/send-reminders`           | `Payment`, `Invoice`, `Tenant`, `Notification`    | Finds unpaid payments for current month, updates overdue statuses, and dispatches real `payment_reminder` notifications via `createNotification`.      | WORKING |
| **Meal Feedback Prompts**        | `0 12,19 * * *` (Daily, 12:00 PM & 7:00 PM)      | `POST /jobs/meal-prompts`             | `Tenant`, `Notification`                          | Queries active tenants and broadcasts real `meal_feedback` notifications via `createNotification`.                                                     | WORKING |
| **Washing Machine Timer Expiry** | `* * * * *` (Every minute)                       | `POST /jobs/release-washing-machines` | `WashingMachine`                                  | Resets machines where `status: 'in_use'` and `timerEndsAt <= now` back to `status: 'available'`. Accessible via both cron and HTTP trigger.            | WORKING |

---

## 4. Closed Remediations & Hardening

| Gap ID        | Severity | Area                 | Issue Description                                                                     | Remediation Implemented                                                                                                                                              | Status |
| ------------- | -------- | -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **JOB-GAP-1** | P1       | Accounting Integrity | `POST /jobs/overdue-check` clobbered `partial` invoices to `overdue`                  | Aligned `routes/jobs.ts` with `scheduler.ts` to only update `{ status: 'sent', dueDate: { $lt: now } }`, preserving partial payment records                          | CLOSED |
| **JOB-GAP-2** | P1       | Feature Completeness | `send-reminders` and `meal-prompts` only logged counts without creating notifications | Wired `createNotification` in both `routes/jobs.ts` and `jobs/scheduler.ts` to dispatch persisted `payment_reminder` and `meal_feedback` notifications with push/SSE | CLOSED |
| **JOB-GAP-3** | P1       | Security / Config    | `CRON_SECRET` was missing in `render.yaml`, leaving deployments with default fallback | Added `CRON_SECRET` with `generateValue: true` under `pg-api` in `render.yaml`                                                                                       | CLOSED |
| **JOB-GAP-5** | P2       | Operational Parity   | Washing machine timer release was only available in cron, not HTTP                    | Added `POST /api/v1/jobs/release-washing-machines` protected by `x-cron-secret`                                                                                      | CLOSED |
| **JOB-GAP-6** | P2       | Server Lifecycle     | `stopScheduler()` was never called during server shutdown                             | Imported and invoked `stopScheduler()` in `apps/api/src/index.ts` `shutdown()` prior to database disconnection                                                       | CLOSED |

---

## 5. Acceptance Checklist (Audit Pass 1)

- [x] Cron secret authentication verified on all `/api/v1/jobs/*` routes (`x-cron-secret`).
- [x] Monthly invoice generation verified (`POST /jobs/generate-invoices` and 1st of month cron).
- [x] Overdue status transition verified preserving `partial` status (JOB-GAP-1).
- [x] Real notification persistence and dispatch implemented for payment reminders (JOB-GAP-2).
- [x] Real notification persistence and dispatch implemented for meal prompts (JOB-GAP-2).
- [x] External HTTP route implemented for washing machine release (JOB-GAP-5).
- [x] Production environment secret configured in `render.yaml` (JOB-GAP-3).
- [x] Graceful shutdown lifecycle wired with `stopScheduler()` (JOB-GAP-6).
