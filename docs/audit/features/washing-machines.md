# Washing Machines -- Feature Audit

**Last verified:** 2026-09-06 (source-code truth audit)  
**Admin grade:** A-  
**Priority:** P2 residuals  
**Theme:** SaaS list + Form stack

## Source map

| Layer    | Path                                                                   |
| -------- | ---------------------------------------------------------------------- |
| Model    | `apps/api/src/models/washingMachine.ts`                                |
| Routes   | `apps/api/src/routes/washingMachines.ts`                               |
| Types    | `packages/types/src/index.ts`                                          |
| Admin FE | `apps/web/src/app/(admin)/washing-machines/**`                         |
| Flutter  | `mobile/lib/features/tenant/presentation/washing_machines_screen.dart` |

## Endpoints

| Method   | Path                               | Role             | Description                                                           |
| -------- | ---------------------------------- | ---------------- | --------------------------------------------------------------------- |
| `GET`    | `/washing-machines`                | JWT              | List machines with floor/status filters (tenant auto-scoped to floor) |
| `GET`    | `/washing-machines/floor/:floorId` | JWT              | Floor machines with tenant floor ownership guard                      |
| `GET`    | `/washing-machines/:id`            | JWT              | Machine detail                                                        |
| `POST`   | `/washing-machines`                | `admin`          | Create machine (unique floorId + machineNumber compound index)        |
| `PUT`    | `/washing-machines/:id`            | `admin`          | Update machine details                                                |
| `POST`   | `/washing-machines/:id/claim`      | `tenant`         | Tenant claims machine (atomic findOneAndUpdate, 1 active claim limit) |
| `POST`   | `/washing-machines/:id/release`    | `tenant`/`admin` | Release in-use claim                                                  |
| `DELETE` | `/washing-machines/:id`            | `admin`          | Delete machine doc                                                    |

## Open gaps

### P0

None.

### P1

_None open._

### P2

- [ ] WM-P2-1: Live countdown synchronization across clients via SSE / polling
- [ ] WM-P2-2: Maintenance reporting workflow directly from tenant mobile screen

## Closed

- [x] laundryEnabled feature flag enforced on all routes and navigation
- [x] Unique compound index (floorId + machineNumber) with 409 DUPLICATE_MACHINE
- [x] Atomic claim transition to prevent race conditions (status must be 'available')
- [x] Tenant auto-scoped to their own floor via room lookup
- [x] One active claim limit per tenant
- [x] Manual release by tenant or admin
- [x] Full Admin CRUD pages: list, new, [id], [id]/edit
- [x] Flutter tenant washing machines screen with timer and claim/release

## Acceptance checklist

- [x] Admin creates washing machine on floor with number and label
- [x] Duplicate machine number on same floor returns 409
- [x] Tenant on floor 2 views only floor 2 machines
- [x] Tenant claims available machine; status transitions to in_use with timer
- [x] Second tenant cannot double-claim already running machine
- [x] Tenant releases own machine when cycle completes
