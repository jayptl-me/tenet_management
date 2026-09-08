# Notifications Module - Audit Pass 1

Module: notifications (compose + history/inbox)
Scope: admin web + API + DB + Flutter tenant portal (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

notifications (broadcast compose, history, unread inbox, emergency alerts).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page                 | Route                                                             | Status  |
| -------------------- | ----------------------------------------------------------------- | ------- |
| Compose + History    | apps/web/src/app/(admin)/notifications/page.tsx -> /notifications | WORKING |
| Detail               | apps/web/src/app/(admin)/notifications/[id]/page.tsx              | WORKING |
| Edit (metadata only) | apps/web/src/app/(admin)/notifications/[id]/edit/page.tsx         | WORKING |

### 2.2 End-User Tenant (mobile, role tenant only)

| Screen                         | Route                     | API Used                        | Status  |
| ------------------------------ | ------------------------- | ------------------------------- | ------- |
| Inbox + mark read + deep links | notifications_screen.dart | GET notifications, unread-count | WORKING |

### 2.3 Not Accessible

| Actor            | Blocked Surface       | Enforcement                |
| ---------------- | --------------------- | -------------------------- |
| tenant, guardian | Next routes + compose | role guards, 403           |
| tenant           | others notifications  | recipient/IDOR guards, 403 |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List (compose + history tabs)

| Feature                                | Element               | Status                           |
| -------------------------------------- | --------------------- | -------------------------------- |
| Compose with audience pickers          | ResourceSelect + form | WORKING                          |
| History table + type + status filters  | DataTable + Select    | WORKING (status added)           |
| Recipient counts (true broadcast size) | CSV + table           | WORKING (fixed targetIds.length) |
| Delete with toast parser               | ConfirmModal          | WORKING                          |
| Custom SVG                             | none                  | NO CUSTOM SVG                    |

### 3.2 Detail

| Feature                            | Element     | Status          |
| ---------------------------------- | ----------- | --------------- |
| Recipients/unread counts + resend? | DetailCard  | WORKING         |
| parseApiError on delete            | errorParser | WORKING (added) |
| Custom SVG                         | none        | NO CUSTOM SVG   |

### 3.3 Edit

| Feature                                 | Element     | Status                          |
| --------------------------------------- | ----------- | ------------------------------- |
| Metadata-only with no-repush banner     | FormSection | WORKING                         |
| Back to history tab (redirect + cancel) | router      | WORKING (fixed compose default) |
| Custom SVG                              | none        | NO CUSTOM SVG                   |

## 4. Shared Components

| Component                                                                                                                                           | Path | Status  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea | ui/* | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/notifications.ts)

| Endpoint                                             | Auth      | Status  |
| ---------------------------------------------------- | --------- | ------- |
| GET / (type/unreadOnly/status)                       | authGuard | WORKING |
| GET /unread-count                                    | authGuard | WORKING |
| POST / (emergency gated by flag)                     | adminOnly | WORKING |
| PUT /:id (metadata only), DELETE /:id                | adminOnly | WORKING |
| History via recipientUserIds; tenants-only all; IDOR | service   | WORKING |

### 5.2 Database Models

| Model        | Relation                                      | Status  |
| ------------ | --------------------------------------------- | ------- |
| Notification | recipientUserIds/unreadBy; senderId; data map | WORKING |

## 6. Missing Custom Components

| Component | Need                              | Status |
| --------- | --------------------------------- | ------ |
| none      | Tabs + tables cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                  | Status  |
| -------- | ------------------------ | ------- |
| History  | Export, View/Edit/Delete | WORKING |
| Compose  | Send                     | WORKING |
| Edit     | Save/Cancel              | WORKING |

## 8. SVG Inventory

| Location               | SVG         | Status        |
| ---------------------- | ----------- | ------------- |
| All notification pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                 | Location               | Status  |
| ---------------------- | ---------------------- | ------- |
| Compose + history tabs | notifications/page.tsx | WORKING |
| CSV export (6 cols)    | notifications/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. History status filter + true recipient CSV counts. 2. Edit history-tab redirects. 3. Emergency flag gate on compose.

## 11. Out of Scope for This Pass

1. Flutter inbox filters (portal-appropriate minimalism; documented).
2. Whole-router emergency gating (would block non-emergency types; per-type gate chosen).

## 12. Pass 1 Fixes Applied

| Fix                                          | Files                                                     | Status  |
| -------------------------------------------- | --------------------------------------------------------- | ------- |
| History status filter + recipient CSV counts | apps/web/src/app/(admin)/notifications/page.tsx           | WORKING |
| Edit redirects to history tab                | apps/web/src/app/(admin)/notifications/[id]/edit/page.tsx | WORKING |
| Emergency compose flag gate                  | apps/api/src/routes/notifications.ts                      | WORKING |
| Delete toast parser                          | apps/web/src/app/(admin)/notifications/[id]/page.tsx      | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; no tests executed; no emojis; portal boundaries respected.
