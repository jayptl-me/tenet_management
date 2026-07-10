# 09 — System Administration (AppConfig, Audit Logs, SSE, Export, Dashboard, Cron)

## AppConfig (`apps/api/src/models/appConfig.ts`)

Singleton configuration document. Only one document exists in the collection.

### Key Sections

**Brand & Contact**: `pgName`, `tagline`, `logoUrl`, `heroImageUrl`, `address` (line1/line2/city/state/pincode), `phone` (+91XXXXXXXXXX), `email`, `socialLinks` (facebook/instagram/whatsapp), `googleMapsEmbedUrl`

**Payment**: `upiId`, `upiPayeeName`

**Pricing**: `roomPricing.sharing2`, `sharing3`, `sharing4` (default monthly rents)

**Landing Page**: `landingHeroHeadline`, `landingHeroSubline`, `amenities[]` (text list), `testimonials[]` (name/occupation/rating 1-5/quote), `primaryColor` (#hex)

**Legal**: `gstNumber`, `panNumber`, `termsAndConditions`

**Amenity Definitions** (10 defaults):

```json
[
  {
    "key": "wifi",
    "label": "WiFi",
    "icon": "wifi",
    "category": "essential",
    "isPerFloor": true,
    "applicableComplaintCategories": ["wifi"]
  },
  {
    "key": "electricity",
    "label": "Electricity",
    "icon": "zap",
    "category": "essential",
    "isPerFloor": true
  },
  {
    "key": "water_supply",
    "label": "Water Supply",
    "icon": "droplets",
    "category": "essential",
    "isPerFloor": true
  },
  {
    "key": "geyser",
    "label": "Geyser",
    "icon": "thermometer",
    "category": "essential",
    "isPerFloor": true
  },
  {
    "key": "washing_machine",
    "label": "Washing Machine",
    "icon": "shirt",
    "category": "appliance",
    "isPerFloor": true,
    "maxPerFloor": 3
  },
  {
    "key": "fridge",
    "label": "Fridge",
    "icon": "sparkles",
    "category": "appliance",
    "isPerFloor": true,
    "maxPerFloor": 2
  },
  { "key": "fan", "label": "Fan", "icon": "fan", "category": "furnishing", "isPerFloor": false },
  {
    "key": "bed",
    "label": "Bed",
    "icon": "bed-single",
    "category": "furnishing",
    "isPerFloor": false
  },
  {
    "key": "bedsheet",
    "label": "Bedsheet",
    "icon": "scroll-text",
    "category": "furnishing",
    "isPerFloor": false
  },
  {
    "key": "pillow",
    "label": "Pillow",
    "icon": "moon-star",
    "category": "furnishing",
    "isPerFloor": false
  }
]
```

**Feature Flags**: `attendanceEnabled`, `laundryEnabled`, `messFeedbackEnabled`, `visitorManagementEnabled`, `guardianPortalEnabled`, `noticeBoardEnabled`, `emergencyAlertsEnabled`

**Theme**: `{ preset: "saas"|"brutalist"|"neumorphic"|"soft-ui"|"custom", mode: "light"|"dark", brandColor?, customTokens?, fonts? }`

### API Routes

| Method | Path               | Description                      |
| ------ | ------------------ | -------------------------------- |
| GET    | /app-config        | Full config (admin only)         |
| GET    | /app-config/public | Public-safe fields (no secrets)  |
| PUT    | /app-config        | Update (triggers theme re-fetch) |

### Frontend: /settings

9-tab settings page:

1. **General** — Brand name, tagline, logo URL, hero image URL, phone, email, address (5 fields), Google Maps embed URL, social links (4 fields), primary colors (with preview swatches), landing hero text
2. **Pricing** — Default rents for 2/3/4 sharing
3. **Payment** — UPI ID, UPI payee name
4. **Landing Amenities** — Text list with add/remove
5. **Amenity Types** — Full CRUD for `amenityDefinitions[]` (key, label, icon picker, category, per-floor toggle, maxPerFloor, complaint categories)
6. **Testimonials** — Name, occupation, 5-star rating, quote; add/remove
7. **Features** — Boolean toggles for 7 feature flags
8. **Appearance** — Theme preset picker (4 options + custom), mode (light/dark)
9. **Advanced** — GST number, PAN number, terms & conditions textarea

Tab state persisted in URL hash (`#general`, `#pricing`, etc.)

## AuditLog (`apps/api/src/models/auditLog.ts`)

| Field      | Type            | Constraints                                                                                                                                                             |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| userId     | ObjectId → User | Required                                                                                                                                                                |
| action     | String          | enum: create/update/delete/login/logout/payment_verify/complaint_status_change/tenant_checkout/tenant_transfer/settings_change/notification_send/visitor_approve/export |
| resource   | String          | Entity type affected                                                                                                                                                    |
| resourceId | String          | Affected entity ID                                                                                                                                                      |
| details    | Mixed           | Additional context                                                                                                                                                      |
| ip         | String          | Request IP                                                                                                                                                              |
| userAgent  | String          | Request user-agent                                                                                                                                                      |
| timestamp  | Date            | Auto-set to createdAt                                                                                                                                                   |

**TTL Index**: `{timestamp: 1, expireAfterSeconds: 90 * 24 * 60 * 60}` — auto-deletes logs after 90 days

### API Routes

- `GET /audit-logs` — filters: action, resource; paginated; read-only

### Frontend: /audit-logs

- Filters: Action, Resource dropdowns
- Columns: Action (colored StatusBadge), Resource (with truncated resourceId), User (name + email), Role, Timestamp, IP
- Mobile card: action badge + timestamp, resource + user + IP
- Read-only (no edit/delete)

## SSE (`apps/api/src/routes/sse.ts`)

- `GET /sse/admin?token=<jwt>` — persistent SSE connection for real-time events
- Events (JSON formatted):
  - `payment_verified` — `{ paymentId, tenantId, invoiceId, amount }`
  - `complaint_updated` — `{ complaintId, newStatus, previousStatus }`
  - `notification_received` — `{ notificationId, title, type }`
  - `service_status_changed` — `{ serviceId, serviceType, newStatus, floorId }`
  - `tenant_checked_out` — `{ tenantId, roomId, bedId }`
- Frontend hook: `useSSE` (`apps/web/src/hooks/useSSE.ts`) — subscribes to event stream, auto-reconnects on disconnect

## Export (`apps/api/src/routes/export.ts`)

- `GET /export` — generates CSV/Excel for tenants, payments, complaints
- Frontend: `/export` — basic page, selector for export type and date range

## Dashboard (`apps/api/src/routes/dashboard.ts`)

### GET /dashboard/stats

Returns aggregated dashboard data:

```json
{
  "occupancy": { "totalRooms", "occupiedBeds", "vacancyRate" },
  "revenue": { "collected", "expected", "month" },
  "complaints": { "open", "inProgress", "resolved", "dismissed" },
  "services": { "operational", "degraded", "down" },
  "enquiries": { "pending" },
  "recent": { "complaints[]", "enquiries[]" },
  "revenueHistory": [{ "month", "collected", "expected" }],      // 6 months
  "occupancyHistory": [{ "month", "occupied", "total" }],         // 6 months
  "mealFeedbackTrend": [{ "date", "breakfast", "lunch", "dinner" }], // 14 days
  "complaintsByCategory": [{ "_id": "category", "count" }],
  "paymentFunnel": { "draft": {count,totalAmount}, "sent":..., "partial":..., "paid":..., "overdue":... },
  "amenityHealth": { "wifi": {operational,degraded,down,total}, ... },
  "complaintHeatmap": { "YYYY-MM-DD": count },                    // current month
  "serviceHistory": [{ "id","date","title","description","status" }] // 14 days
}
```

### Dashboard Frontend (`apps/web/src/app/(admin)/dashboard/page.tsx`)

- 5 KPI cards with sparklines/deltas
- Revenue line chart (collected vs expected, 6 months, MoM delta)
- Service health gauge + breakdown pills
- Occupancy trend line chart
- Service health history timeline
- Complaint resolution gauge + breakdown bars
- Payment collection funnel
- Complaint categories donut
- Meal feedback trend + star rating cards (3 meals)
- Amenity health stacked bars
- Complaint activity heatmap
- Recent complaints + enquiries lists
- Activity timeline
- Quick links row (Tenants, Payments, Rooms, Notices)

## Cron Jobs (`apps/api/src/jobs/scheduler.ts`)

- Invoice generation: auto-generates monthly invoices for all active tenants
- Payment overdue detection: marks unpaid invoices as overdue past due date
- Runs on configurable schedule

## Admin Shell Components

### CommandPalette

- `Cmd+K` toggle, modal overlay
- Search pages (filters sidebar nav items)
- Navigation: select page → router.push
- Actions: Toggle theme, Logout

### QuickCreate

- Floating action button (FAB) in bottom-right
- `Cmd+N` keyboard shortcut
- Modal with quick-create links: New Tenant, New Room, New Complaint, New Payment, New Invoice
- Each link routes to the corresponding `/new` page

### Breadcrumbs

- Auto-generated from URL pathname
- Shows: Dashboard > Module > Detail
- Uses `usePathname()` + path segment parsing
