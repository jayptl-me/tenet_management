# Session lifecycle pass -- 2026-07-16 (Grok)

Independent multi-agent re-audit (code truth) found gaps that LIVE_GAP understated as "P2 only".
This file records what was verified and fixed in this pass.

## Method

1. Loaded `docs/audit/*`, AGENT_CONTEXT, feature MDs.
2. Parallel code-explorer agents: meals/menus, tenants/rooms, finance, Flutter portal, ops modules.
3. Implemented integrity + UX fixes in API, admin web, and Flutter.
4. Verified: `bun --filter '@pg/api' typecheck`, `bun --filter '@pg/web' typecheck`, `bun run lint`, `flutter analyze`.

## Fixed this session (proof paths)

### Money integrity (API)

| ID | Fix | Paths |
|----|-----|-------|
| FIN-DUES | Checkout dues use residual balance via `getInvoiceBalance`; select electricityAmount; `totalDue` = sum remaining | `apps/api/src/routes/tenants.ts` GET `/:id/dues` |
| FIN-CHECKOUT | Checkout blocks only invoices with remaining > 0 (not gross status alone) | `tenants.ts` POST checkout |
| PAY-UTR-UNSET | Reject verify uses `$unset` for utrNumber/screenshotUrl (was stripped undefined) | `apps/api/src/routes/payments.ts` verify-utr + :id/verify |
| PAY-UTR-DUE | submit-utr create path uses `resolveInvoiceDueDate` | `payments.ts` |

### Timezone / attendance / meals

| ID | Fix | Paths |
|----|-----|-------|
| MENU-TZ-FILTER | isActive list filter uses `todayInTZ()` not UTC ISO | `apps/api/src/routes/menus.ts` |
| ATT-HOUR-TZ | Check-in window uses `currentHourInTZ()` not `getHours()` | `apps/api/src/routes/attendance.ts` |
| MEAL-RESUBMIT | Tenant feedback upsert resets `status: 'submitted'` | `apps/api/src/routes/meals.ts` |
| MEAL-DUP | PUT mealType 11000 -> 409 `DUPLICATE_FEEDBACK` | `meals.ts` |

### Tenant lifecycle

| ID | Fix | Paths |
|----|-----|-------|
| T-REINSTATE-ALT | Reinstate accepts optional `{ roomId, bedId }` for alternate placement | `tenants.ts` |
| T-GUARDIAN-CO | Checkout deactivates guardian Users; reinstate reactivates | `tenants.ts` |
| T-CO-UI | Checkout Confirm disabled when dues/unresolved payments | `apps/web/.../tenants/[id]/page.tsx` |
| T-REINSTATE-UI | BED_OCCUPIED shows room+bed picker and retries with body | same |
| T-EDIT-INACTIVE | Inactive tenants cannot transfer; OccupancyBedPicker on edit | `tenants/[id]/edit/page.tsx` |

### Ops side-effects

| ID | Fix | Paths |
|----|-----|-------|
| LV-ATT | Leave approve upserts attendance `on_leave` per day | `apps/api/src/routes/leaves.ts` |
| LDY-MAP | Laundry PUT returns `mapLaundrySlot` | `apps/api/src/routes/laundry.ts` |
| SVC-POP | Services populate lastUpdatedBy | `apps/api/src/routes/services.ts` |
| ATT-QR-UI | Admin attendance new drops fictional `qr` method option | `attendance/new/page.tsx` |

### Admin hubs

| ID | Fix | Paths |
|----|-----|-------|
| INV-PAY-CTA | Invoice detail Record payment + payment row links | `invoices/[id]/page.tsx` |
| PAY-EDIT-LOCK | Paid payment edit form locked | `payments/[id]/edit/page.tsx` |
| MEAL-EDIT-CTA | Meals detail Edit action | `meals/[id]/page.tsx` |
| MENU-PAST | Menus list hides Edit for past dates | `menus/page.tsx` |

### Flutter portal

| ID | Fix | Paths |
|----|-----|-------|
| P1-AUTH-PW | Forgot password on login; change password on profile | auth_repository, login_screen, profile_screen |
| CMP-TID | complaints ensureTenantId before room bootstrap | complaints_screen.dart |
| INV-PAY-BRIDGE | Invoice detail Pay CTA -> payments?invoiceId= | invoice_detail, payments_screen, app_router |
| MEAL-UX | Capitalized meal labels; network errors not swallowed as empty menu | meals_screen, tenant_repository |

## Still open (next stages)

### P1 residual

_None material._ Closed in lifecycle goal pass (see Closed this goal pass below).

### Deferred / non-goals (honest product notes)

1. Attendance method `qr` -- admin form no longer offers QR; full scan flow is product backlog (P2).
2. Seed `attendanceEnabled: false` -- intentional ops default; enable in Settings (P2 product).

### P2 residual

1. Room photo upload UI
2. Guardian finance depth (product decision + API)
3. Laundry items/cancel tenant path
4. Domain event -> notification auto-wire
5. Types package lag residuals

## Closed this goal pass (P1 residuals)

| ID | Fix | Paths |
|----|-----|-------|
| FL-FLAGS | Prefetch `GET app-config` features; hide More/drawer/bottom Visitors when off | `mobile/lib/core/config/app_features.dart`, more_screen, tenant_shell |
| FL-UNREAD | Home AppBar badge via `GET notifications/unread-count` | home_screen, tenant_repository |
| LV-CANCEL | `POST /leaves/:id/cancel` pending only; status `cancelled`; Flutter Cancel CTA; `LeaveStatus` + admin filter | leaves.ts, packages/types attendance.ts, leaves/page.tsx, leaves_screen |
| CMP-PHOTOS | photos on create/update Zod + append `POST /:id/photos`; admin URL fields + detail/Flutter display | complaints routes, admin new/edit/detail, complaint_detail_screen |
| CMP-STATUS | Shared `complaintStatusPatch` for kanban `/status` + full PUT; reopen clears resolvedAt | `lib/complaint-status.ts`, complaints.ts, contract test |
| P1-AUTH-PW | (prior lifecycle) forgot/change password UX | login_screen, profile_screen, auth_repository |

Contract tests: `apps/api/src/__tests__/leave-cancel-complaint-photos.test.ts` (4 passed).

## Verification

- `bun run typecheck` -- pass
- `bun run lint` -- pass (0 errors)
- `cd mobile && flutter analyze` -- no issues
- leave-cancel-complaint-photos tests -- 4/4 pass

## Do not re-open closed historical P0s

Transfer atomicity, isActive free toggle, temp password, visitor filter enums, floor service seed, notice targeting remain closed.
This session added **new** integrity holes: dues residual math, UTR unset, attendance UTC hours, meal status resubmit, reinstate alternate bed.
