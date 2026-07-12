# Phase 0 -- State Detection Inventory

**Audited:** 2026-07-12  
**Root:** tenet_pg_management (Bun workspaces)

## Package integrity

| Package | Name | Link | Runtime notes |
|---------|------|------|---------------|
| root | `pg-management` | workspaces `apps/*`, `packages/*` | Bun >= 1.3.0 |
| API | `@pg/api` | `@pg/types: workspace:*` | Hono, Mongoose ^9, Zod |
| Web | `@pg/web` | `@pg/types: workspace:*` | Next 16.2.7, React 19.2.4, Tailwind 4 |
| Types | `@pg/types` | exports `./src/*.ts` | no React/Hono deps -- OK |

## Models (23)

`appConfig`, `asset`, `attendanceRecord`, `auditLog`, `complaint`, `counter`, `dailyMenu`, `electricityBill`, `enquiry`, `floor`, `guardian`, `invoice`, `laundrySlot`, `leaveApplication`, `mealFeedback`, `noticePost`, `notification`, `payment`, `room`, `serviceStatus`, `tenant`, `user`, `visitor` (+ `index.ts`)

## Routes (25)

`appConfig`, `assets`, `attendance`, `audit`, `auth`, `complaints`, `dashboard`, `electricity`, `enquiries`, `floors`, `guardians`, `invoices`, `jobs`, `laundry`, `leaves`, `meals`, `menus`, `notices`, `notifications`, `payments`, `rooms`, `services`, `sse`, `tenants`, `visitors`

Mounted under `/api/v1` in `apps/api/src/index.ts`.

## Admin frontend domains (App Router `(admin)/`)

Full CRUD shells present for: assets, attendance, complaints, electricity, enquiries, floors, guardians, invoices, laundry, leaves, meals, menus, notices, notifications, payments, rooms, services, tenants, visitors.

Special: `dashboard`, `settings`, `audit-logs` (list), `export`.

## Types package files (27)

`appConfig`, `asset`, `attendance`, `audit`, `common`, `complaint`, `dashboard`, `electricity`, `enquiry`, `export`, `floor`, `guardian`, `invoice`, `laundry`, `meal`, `menu`, `notice`, `notification`, `payment`, `room`, `service`, `sse`, `tenant`, `tokens`, `user`, `visitor`, `index`

## Feature flags (boolean)

```
attendanceEnabled: false
laundryEnabled: true
messFeedbackEnabled: true
visitorManagementEnabled: true
guardianPortalEnabled: true
noticeBoardEnabled: true
emergencyAlertsEnabled: true
```

**API enforcement (2026-07-12):** `requireFeature` on laundry, meals, visitors, guardians, notices, attendance. Menus not gated. See [interconnections/feature-flags.md](./interconnections/feature-flags.md).

## Flutter portal

`mobile/` present: auth, tenant shell, guardian shell, visitor desk. Gaps: profile depth, tenantId reliability, leaves/attendance/notifications. See [features/FLUTTER_PORTAL.md](./features/FLUTTER_PORTAL.md).

## Build gates (this session)

```
api typecheck: 0
web typecheck: 0
api lint: 0
web lint: 0
```

## UI component inventory (custom design system)

**Form/controls:** Button, Input, Select (native), Textarea, Checkbox, Switch, SearchableSelect (custom), ResourceSelect (native after fetch), FormPage, FormCard, FormSection, FormActions, DocumentUpload, DateRangePicker

**Data display:** DataTable, PageHeader, PageShell, TableActions, StatusBadge, DetailCard, EmptyState, ErrorBanner, ErrorState, Skeleton, Timeline, TenantActivityTimeline, StatCard, Surface, charts/*

**Admin chrome:** Sidebar, Breadcrumbs, CommandPalette, NotificationBell, AppearanceTab, AmenityTypesTab, QuickCreate, DarkModeToggle, EmergencyAlertButton, GlobalLoadingBar

## Entity FK map (high level)

| Parent | Children / refs |
|--------|-----------------|
| Floor | Room.floorId; ServiceStatus.floorId |
| Room | Tenant.roomId; Room.beds[].tenantId; Asset location free-text |
| User | Tenant.userId; Guardian.userId; auth |
| Tenant | Payment, Invoice, Complaint, Visitor, Guardian, LaundrySlot, MealFeedback, Attendance, Leave, Electricity distribute targets |
| DailyMenu | date unique; MealFeedback.date logical link only (no FK) |
| Invoice | Payment.invoiceId (verify in payment model) |

## Critical missing API surfaces (inventory)

| Expected by FE | Exists? |
|----------------|---------|
| GET assets/:id | NO |
| GET notices/:id | NO |
| GET notifications/:id | NO |
| PUT notifications/:id | NO |
| POST menus | NO |
| PUT attendance/:id | NO |
| PUT complaints/:id (full) | NO (only /:id/status) |
| PUT enquiries/:id (full) | NO (only /:id/status) |
| POST visitors as admin | NO (tenantOnly) |
