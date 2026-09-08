# Server-Sent Events (SSE) & Real-Time Sync -- Feature Audit

**Audit Pass:** 1  
**Timestamp:** 2026-09-08T04:05:00+05:30 (Asia/Kolkata)  
**Module:** Server-Sent Events (SSE) & Real-Time Sync (A-Z Phase 1: Module 29)  
**Audit Status:** Complete & Remediated (Pass 1)  
**Grade:** A+  
**Priority:** All P1 & P2 Remediations Closed

---

## 1. Executive Summary & Product Split

The Server-Sent Events (SSE) subsystem provides unidirectional, real-time push streaming from the Bun + Hono backend to administrative dashboard clients. It eliminates the need for polling by pushing immediate UI updates when domain state mutations occur (such as new enquiries, notifications, service status updates, and badge count changes).

| Surface          | Path / Package                                         | Platform / Framework          | Permitted Roles                 | Notes                                                                                                                                           |
| :--------------- | :----------------------------------------------------- | :---------------------------- | :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin Panel      | `apps/web/src/hooks/useSSE.ts` & `useSidebarBadges.ts` | Next.js (Browser)             | `admin` only                    | Connects to `/api/v1/sse/admin` via native browser `EventSource`, auto-reconnects with jittered exponential backoff, and updates sidebar badges |
| Resident Portal  | `mobile/`                                              | Flutter (Web + iOS + Android) | `tenant`, `guardian`            | Mobile clients interact via pull-to-refresh (`RefreshIndicator`) and direct REST calls; SSE endpoint is admin-exclusive                         |
| API Layer        | `apps/api/src/routes/sse.ts`                           | Bun + Hono (`hono/streaming`) | `admin` only                    | Streams events via HTTP chunks; gated by `sseAuthGuard` accepting `?token=` query param or `Bearer` header                                      |
| Event Bus        | `apps/api/src/lib/eventBus.ts`                         | Bun runtime memory            | Shared internal                 | In-memory pub/sub registry managing client sets, broadcast fan-out, and unsubscription cleanup                                                  |
| Shared Contracts | `packages/types/src/sse.ts`                            | TypeScript DTOs               | Shared (`apps/api`, `apps/web`) | Canonical `SSEEventType` union and `SSEMessage` interface                                                                                       |

---

## 2. Source Code Map

| Layer / Role        | Path                                        | Function & Scope                                                                                                            |
| :------------------ | :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------- |
| Route Handler       | `apps/api/src/routes/sse.ts`                | Endpoint `GET /api/v1/sse/admin`; handles dual authentication, connection lifecycle, 30s keep-alive ping, and abort cleanup |
| In-Memory Event Bus | `apps/api/src/lib/eventBus.ts`              | Pub/sub bus mapping `clientId -> Set<EventHandler>`, `subscribe`, `unsubscribeAll`, `broadcast`, `publishEvent`, `clearAll` |
| Badge Broadcaster   | `apps/api/src/lib/broadcast-badges.ts`      | Queries unread notifications, open complaints, and pending enquiries; broadcasts `badges-update` event                      |
| Shared TS Types     | `packages/types/src/sse.ts`                 | Type definitions for `SSEEventType` and `SSEMessage` payload wrapper                                                        |
| Generic Web Hook    | `apps/web/src/hooks/useSSE.ts`              | React hook establishing browser `EventSource`, event routing, and exponential backoff with jitter on disconnect             |
| Sidebar Badges Hook | `apps/web/src/hooks/useSidebarBadges.ts`    | Specialized hook fetching initial badge counts and keeping them synchronized via `badges-update` SSE events                 |
| UI Badge Consumer   | `apps/web/src/components/admin/Sidebar.tsx` | Renders counter badges on Notifications, Complaints, and Enquiries sidebar navigation links                                 |

---

## 3. Communication Flow & Architecture

```
[Domain Mutation]
  (e.g., Enquiry Create, Notification Send, Complaint Progression, Service Update)
       |
       v
  [broadcastBadgesUpdate() / broadcast(message)]
       |
       v
  [apps/api/src/lib/eventBus.ts: broadcast()]
       |
       +---> Client 1 (Admin Browser Tab A)
       |        ^
       |        | (HTTP Chunked Stream: EventSource)
       |        v
       |     [useSidebarBadges / useSSE: onmessage]
       |        |
       |        +---> Updates Sidebar Badges State
       |        +---> Triggers Real-Time UI Re-render / Notification
       |
       +---> Client 2 (Admin Browser Tab B)
```

### Protocol & Connection Lifecycle

1. **Connection Handshake:**
   - The browser opens an HTTP GET connection to `/api/v1/sse/admin?token=<accessToken>`.
   - The server validates the JWT and verifies `user.role === 'admin'`. Non-admin tokens receive 403 `FORBIDDEN`.
   - A unique `clientId` (`admin-<userId>-<UUID>`) is generated.
   - An initial event `connected` is immediately written.
2. **Keep-Alive Heartbeat:**
   - A 30-second interval timer writes periodic keep-alive pings (`event: ping`).
   - Prevents intermediate proxies and load balancers from terminating idle connections.
3. **Graceful Disconnect & Teardown:**
   - Both `stream.onAbort` and `c.req.raw.signal.addEventListener('abort')` are registered.
   - Clears interval timers and unsubscribes all client handlers from memory upon tab close or network drop.

---

## 4. Event Catalog

| Event Name                | Trigger Context                                              | Payload Structure                                                                   |
| :------------------------ | :----------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| `connected`               | Initial client connection handshake                          | `{ message: string, clientId: string }`                                             |
| `ping`                    | 30-second interval heartbeat                                 | `{ timestamp: string }`                                                             |
| `badges-update`           | Mutation in enquiries, notifications, complaints, or tenants | `{ unreadNotifications: number, openComplaints: number, pendingEnquiries: number }` |
| `new_complaint`           | Resident files a new complaint                               | `{ complaintId: string, title: string, category: string, severity: string }`        |
| `complaint_updated`       | Status progression on a complaint                            | `{ complaintId: string, status: string }`                                           |
| `payment_received`        | Tenant submits an offline payment / UTR                      | `{ paymentId: string, amount: number, tenantName: string }`                         |
| `payment_verified`        | Admin verifies and approves payment                          | `{ paymentId: string, status: string }`                                             |
| `new_enquiry`             | Public visitor submits enquiry form                          | `{ enquiryId: string, name: string, phone: string }`                                |
| `notification_created`    | System or broadcast notification dispatched                  | `{ notificationId: string, title: string, type: string }`                           |
| `tenant_checkin`          | Tenant checks into assigned room                             | `{ tenantId: string, roomNumber: string }`                                          |
| `tenant_checkout`         | Tenant finishes checkout process                             | `{ tenantId: string }`                                                              |
| `meal_feedback_submitted` | Tenant submits meal feedback                                 | `{ mealId: string, rating: number }`                                                |
| `emergency_alert`         | Security or facility emergency trigger                       | `{ alertType: string, message: string }`                                            |
| `service_update`          | Operational status update on floor service                   | `ServiceStatus` doc                                                                 |

---

## 5. Security & Authentication Architecture

### Dual-Mode Auth Guard (`sseAuthGuard`)

Standard browser `EventSource` does not permit setting arbitrary HTTP headers such as `Authorization: Bearer <token>`. To resolve this, `sseAuthGuard` implements dual-mode token extraction:

1. Checks query parameter `token`: `c.req.query('token')`.
2. Falls back to standard header: `c.req.header('Authorization')?.slice(7)`.
3. If neither is provided, returns HTTP 401 `UNAUTHORIZED`.
4. Validates JWT signature and expiration via `verifyAccessToken(token)`.
5. Enforces `user.role === 'admin'`. Non-admin accounts receive HTTP 403 `FORBIDDEN`.

---

## 6. Verification Checklist

- [x] Product split respected: SSE endpoint strictly restricted to `admin` role; non-admins receive 403 `FORBIDDEN`.
- [x] Dual-mode authentication: supports `?token=` query param for browser `EventSource` and `Bearer` header.
- [x] 30-second keep-alive ping prevents reverse-proxy and load-balancer timeouts.
- [x] Connection abort handling cleans up interval timers and deletes client subscriptions to prevent memory leaks.
- [x] Exponential backoff with random jitter on client reconnection prevents server overload.
- [x] Real-time sidebar badge synchronization without periodic polling.
- [x] Complaints module invokes `broadcastBadgesUpdate()` across create, status update, and resolve flows.
- [x] Services module emits `service_update` broadcast events on mutations.
- [x] Zero emojis in code, commits, or documentation.
- [x] `bun run typecheck` passed (0 errors across `@pg/types`, `@pg/web`, `@pg/api`).
- [x] `bun run lint` (oxlint) passed with 0 warnings and 0 errors across 324 files.
- [x] `cd mobile && flutter analyze` passed with 0 issues.
