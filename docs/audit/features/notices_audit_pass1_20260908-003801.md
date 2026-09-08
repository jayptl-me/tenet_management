# Notices Module - Audit Pass 1

Module: notices (notice board)
Scope: admin web + API + DB + Flutter tenant/guardian portals (read-only mapping)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes

## 1. Selected Module

notices (targeted posts: all/floor/room/individual + pinned + portal feed).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Page   | Route                                                                     | Status  |
| ------ | ------------------------------------------------------------------------- | ------- |
| List   | apps/web/src/app/(admin)/notices/page.tsx -> /notices                     | WORKING |
| Create | apps/web/src/app/(admin)/notices/new/page.tsx -> /notices/new             | WORKING |
| Detail | apps/web/src/app/(admin)/notices/[id]/page.tsx -> /notices/[id]           | WORKING |
| Edit   | apps/web/src/app/(admin)/notices/[id]/edit/page.tsx -> /notices/[id]/edit | WORKING |

### 2.2 End-User (mobile)

| Screen                      | Route                        | API Used                    | Status  |
| --------------------------- | ---------------------------- | --------------------------- | ------- |
| Tenant notices + pin chip   | notices_screen.dart          | GET notices (paginated)     | WORKING |
| Guardian notices + pin chip | guardian_notices_screen.dart | GET notices (ward-resolved) | WORKING |

### 2.3 Not Accessible

| Actor           | Blocked Surface                      | Enforcement         |
| --------------- | ------------------------------------ | ------------------- |
| tenant/guardian | all /notices Next routes + mutations | role guards, 403    |
| tenant/guardian | out-of-audience notices              | audience guard, 404 |

## 3. Admin Page-by-Page Feature Listing

### 3.1 List

| Feature                             | Element     | Status                |
| ----------------------------------- | ----------- | --------------------- |
| Table + search + target-type filter | DataTable   | WORKING               |
| Audience badge + target count       | StatusBadge | WORKING (count added) |
| Pinned badge (published mapping)    | StatusBadge | WORKING (map fixed)   |
| CSV export with Targets             | Button      | WORKING (added)       |
| parseApiError on load/delete        | errorParser | WORKING (added)       |
| Custom SVG                          | none        | NO CUSTOM SVG         |

### 3.2 Create

| Feature                                          | Element        | Status          |
| ------------------------------------------------ | -------------- | --------------- |
| Audience pickers (floor/room/tenant) with labels | ResourceSelect | WORKING         |
| parseApiError                                    | errorParser    | WORKING (added) |
| Custom SVG                                       | none           | NO CUSTOM SVG   |

### 3.3 Detail

| Feature                                          | Element     | Status                 |
| ------------------------------------------------ | ----------- | ---------------------- |
| Content + author + pinned/audience badges        | DetailCard  | WORKING                |
| Targets resolved to names (floors/rooms/tenants) | DetailRow   | WORKING (IDs replaced) |
| WhatsApp share + copy + Edit                     | Buttons     | WORKING                |
| parseApiError on load                            | errorParser | WORKING (added)        |
| Custom SVG                                       | none        | NO CUSTOM SVG          |

### 3.4 Edit

| Feature                    | Element     | Status          |
| -------------------------- | ----------- | --------------- |
| Audience + content editing | FormSection | WORKING         |
| parseApiError              | errorParser | WORKING (added) |
| Custom SVG                 | none        | NO CUSTOM SVG   |

## 4. Shared Components

| Component                                                                                                                                           | Path                    | Status  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| floorLabel/roomLabel/tenantLabel                                                                                                                    | resource-select-presets | WORKING |
| DataTable/TableActions/StatusBadge/PageHeader/ErrorBanner/EmptyState/FormPage/FormCard/FormSection/FormActions/Input/ResourceSelect/Select/Textarea | ui/*                    | WORKING |

## 5. Cross-Cutting Dependencies

### 5.1 API Routes (apps/api/src/routes/notices.ts)

| Endpoint                                         | Auth      | Status  |
| ------------------------------------------------ | --------- | ------- |
| GET / admin (filters + pagination)               | adminOnly | WORKING |
| GET / portal (DB-resolved audience + pagination) | authGuard | WORKING |
| GET /:id (audience guard)                        | authGuard | WORKING |
| POST / (fan-out notifications)                   | adminOnly | WORKING |
| PUT /:id, DELETE /:id                            | adminOnly | WORKING |

### 5.2 Database Models

| Model      | Relation                                                                 | Status  |
| ---------- | ------------------------------------------------------------------------ | ------- |
| NoticePost | authorId -> User; targetType + targetIds; title/content min 5/10 aligned | WORKING |

## 6. Missing Custom Components

| Component | Need                               | Status |
| --------- | ---------------------------------- | ------ |
| none      | Badges + cards cover visualisation | NO GAP |

## 7. Buttons Inventory

| Location | Buttons                       | Status  |
| -------- | ----------------------------- | ------- |
| List     | New, Export, View/Edit/Delete | WORKING |
| Detail   | Edit, WhatsApp, Copy          | WORKING |
| New/Edit | Save/Cancel                   | WORKING |

## 8. SVG Inventory

| Location         | SVG         | Status        |
| ---------------- | ----------- | ------------- |
| All notice pages | lucide only | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory

| Layout                    | Location         | Status  |
| ------------------------- | ---------------- | ------- |
| List table + mobile cards | notices/page.tsx | WORKING |
| CSV export (6 cols)       | notices/page.tsx | WORKING |

## 10. Implementation Tasks (ready for execution, no ambiguity)

1. Detail target-name resolution. 2. List count + targets CSV + parsers + published map. 3. Portal pagination. 4. Model minlength align. 5. Flutter pin chips.

## 11. Out of Scope for This Pass

1. Server-side target-name populate (FE resolution suffices; avoids heavy joins).
2. Push fan-out beyond createNotification (existing behavior kept).

## 12. Pass 1 Fixes Applied

| Fix                                              | Files                                             | Status  |
| ------------------------------------------------ | ------------------------------------------------- | ------- |
| Detail target names (floor/room/tenant) + parser | apps/web/src/app/(admin)/notices/[id]/page.tsx    | WORKING |
| List count + targets CSV + parsers               | apps/web/src/app/(admin)/notices/page.tsx         | WORKING |
| published mapping                                | packages/types/src/tokens.ts                      | WORKING |
| Portal feed pagination                           | apps/api/src/routes/notices.ts                    | WORKING |
| Model title/content minlength 5/10               | apps/api/src/models/noticePost.ts                 | WORKING |
| New/edit parsers                                 | notices/new, notices/[id]/edit                    | WORKING |
| Flutter pin chips (tenant + guardian)            | notices_screen.dart, guardian_notices_screen.dart | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; flutter analyze clean; no tests executed; no emojis; portal boundaries respected.
