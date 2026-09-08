# Health & Diagnostics Infrastructure -- Feature Audit

**Audit Pass:** 1  
**Audit Timestamp:** 2026-09-08T03:02:00+05:30 (Asia/Kolkata)  
**Module:** Health & Diagnostics (A-Z Phase 1: Module 13)  
**Audit Status:** Complete & Remediated (Pass 1)  
**Grade:** A+  
**Priority:** All P1 & P2 Remediations Closed

---

## 1. Executive Summary & Product Split

The Health & Diagnostics module provides system liveness probes, database connectivity verification, runtime resource tracking, and client-side cold-start handling across the Tenet PG Management platform.

The system operates across 4 core operational dimensions:

1. **Liveness Probe**: An unauthenticated HTTP endpoint (`GET /api/v1/health`) exposing real-time service health, MongoDB connection state, process uptime, Bun runtime version, and memory allocation counters (`rss`, `heapTotal`, `heapUsed`, `external`). Responds with HTTP `200` when database is healthy, and HTTP `503` with `status: 'degraded'` when database connection drops.
2. **Platform Keepalive (Self-Ping)**: A background timer inside `apps/api/src/index.ts` executing every 4 minutes in production environments to mitigate cloud platform spin-downs.
3. **Admin Web Cold-Start Recovery**: A client-side Zustand store (`useApiLoadingStore` in `apps/web/src/store/apiLoading.ts`) and presentation overlay (`ServerWakeupOverlay.tsx`) that monitors API request latency. If any network request takes longer than 3 seconds, it asynchronously probes `/api/v1/health` with typed `IHealthResponse` contracts to distinguish between network latency and a sleeping server, displaying a 30-60 second spin-up dialog with automatic polling until recovery.
4. **Mobile Portal Network Resilience**: Mobile client connectivity managed via `ApiClient` with 20-second connection timeouts and 30-second receive timeouts, communicating directly with `/api/v1`.

### Product Split & Access Boundary Matrix

| Surface                      | Allowed Roles                   | Platform                 | Route / Path            | Role Enforcement Mechanism                                      |
| ---------------------------- | ------------------------------- | ------------------------ | ----------------------- | --------------------------------------------------------------- |
| Core API Health Probe        | Public (Unauthenticated)        | Bun + Hono (`apps/api`)  | `GET /api/v1/health`    | Public route mounted before authentication middleware           |
| Self-Ping Background Loop    | System internal                 | Bun runtime (`apps/api`) | Internal fetch timer    | `env.NODE_ENV === 'production'` conditional trigger             |
| Admin Web Cold-Start Overlay | `admin` only (and login)        | Next.js (`apps/web`)     | Global layout component | Triggered by `useApiLoadingStore` on prolonged pending requests |
| Admin Global Loading Bar     | `admin` only (and login)        | Next.js (`apps/web`)     | `GlobalLoadingBar.tsx`  | Visual feedback on subtle slow requests                         |
| Resident Mobile Portal       | `tenant`, `guardian`, `visitor` | Flutter (`mobile/`)      | N/A                     | Dio request timeouts handle network boundaries                  |

---

## 2. Source Code Map

| Layer                  | File Path                                                                                                                                                        | Responsibilities & Coverage                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Health Route           | [index.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/index.ts)                                                 | Hono route returning HTTP 200 (ok) or 503 (degraded) with `status`, `timestamp`, `mongodb`, `uptime`, `bunVersion`, and `memory` |
| Database Connection    | [db.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/lib/db.ts)                                                   | Shared Mongoose connection manager; exposes `isDatabaseConnected()`                                                              |
| Self-Ping Scheduler    | [index.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/index.ts)                                                 | `setupSelfPing()` runs 4-minute `setInterval` calling health endpoint in production                                              |
| Shared Types           | [health.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/health.ts)                                         | TypeScript contracts: `IHealthResponse`, `HealthDbStatus`, `HealthOverallStatus`                                                 |
| Web API Loading Store  | [apiLoading.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/store/apiLoading.ts)                                 | Zustand store tracking `activeRequests`, `isSlowLoading`, and `isServerWaking`; typed health checks                              |
| Web Cold-Start Overlay | [ServerWakeupOverlay.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/shared/ServerWakeupOverlay.tsx) | Modal dialog informing admin user of server spin-up with spinner and status indicator                                            |
| Web Loading Bar        | [GlobalLoadingBar.tsx](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/components/admin/GlobalLoadingBar.tsx)        | Top-of-screen animated shimmer bar activated during slow queries                                                                 |
| Web API Interceptor    | [api.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/web/src/lib/api.ts)                                                 | Ky HTTP client interceptors calling `incrementRequests()` and `decrementRequests()`                                              |
| Deployment Spec        | [render.yaml](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/render.yaml)                                                        | Render blueprint for `pg-api` with `healthCheckPath: /api/v1/health` and `pg-web`                                                |

---

## 3. Data Model & Payload Audit

There is no persisted MongoDB collection for health checks. The response payload is generated dynamically from process metrics and Mongoose connection state.

### Response Contract: `GET /api/v1/health`

```typescript
export interface IHealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string; // ISO 8601 UTC
  mongodb: 'connected' | 'disconnected';
  uptime: number; // Seconds since process spawn
  bunVersion: string; // e.g. "1.2.4"
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}
```

---

## 4. API Surface & Endpoints Status

| Method | Endpoint         | Query / Body Params | Status  | Description & Logic                                                                                      |
| ------ | ---------------- | ------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/health` | None                | WORKING | Returns 200 OK when DB connected, 503 Service Unavailable with `status: 'degraded'` when DB disconnected |

---

## 5. Closed Remediations (Pass 1)

1. **HL-GAP-1: Accurate HTTP Status Code on Database Failure**:
   - `apps/api/src/index.ts` returns HTTP `503 Service Unavailable` with `status: 'degraded'` when `!isDatabaseConnected()`, enabling cloud load balancers to detect unhealthy nodes.
2. **HL-GAP-2: Shared TypeScript Contract**:
   - Created `packages/types/src/health.ts` exporting `IHealthResponse`, `HealthDbStatus`, and `HealthOverallStatus`, re-exported via `packages/types/src/index.ts`.
3. **HL-GAP-3: Type-Safe Cold-Start Polling**:
   - Wired `IHealthResponse` into `apps/web/src/store/apiLoading.ts`, verifying both `mongodb === 'connected'` and `status === 'ok'`.
4. **HL-GAP-4: Deployment Spec Health Check Configuration**:
   - Added `healthCheckPath: /api/v1/health` under `pg-api` in `render.yaml`.

---

## 6. Acceptance Checklist (Audit Pass 1)

- [x] Unauthenticated health probe accessible to container orchestrators.
- [x] HTTP 200 returned when database is connected.
- [x] HTTP 503 returned when database is disconnected (HL-GAP-1).
- [x] Shared TypeScript contracts defined in `@pg/types` (HL-GAP-2).
- [x] Type-safe health checks in Admin Web cold-start store (HL-GAP-3).
- [x] Render deployment blueprint configured with health check path (HL-GAP-4).
- [x] `bun run typecheck` passes with zero errors.
- [x] `bun run lint` (oxlint) passes with zero warnings and zero errors.
- [x] `flutter analyze` passes with zero issues.
