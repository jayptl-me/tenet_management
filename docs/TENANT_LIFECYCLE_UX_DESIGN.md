# Tenant Lifecycle & Service UX Design

## Core Data Relationships

```
Floor
  ├── amenities: { washingMachines: Number, fridges: Number }
  ├── services[] → ServiceStatus (per floor: wifi, washing_machine_1, washing_machine_2, fridge, water_supply, electricity)
  │     └── status: operational | degraded | down
  │     └── complaintCount (derived from complaints with matching category & room's floor)
  │
  └── Rooms[]
        └── services (extended): wifi, electricity, geyser, water_supply
              (ServiceStatus is PER FLOOR, not per room — rooms inherit floor's services)
        └── Complaints[] (tenantId, roomId, category matches serviceType)
              └── category: wifi | water | electricity | food_quality | cleaning_room | cleaning_washroom | washing_machine | fridge | lights | noise | other
```

## Tenant Lifecycle Flow

### 1. ONBOARDING

```
Enquiry → Convert → Create User → Assign Room/Bed → Move In → Tenant Active
  ↓
  Documents uploaded (Aadhaar, Photo)
  Emergency contact stored
  Deposit recorded
  Monthly rent set
  Welcome notification sent
```

### 2. ACTIVE STAY — Daily Operations

```
Tenant Dashboard:
  ├── Room info (room number, floor, bed)
  ├── Payment status (due/paid, amount, next due date)
  ├── Service status (WiFi/Power/Water — green/yellow/red per floor)
  ├── Active complaints (view status, add follow-up)
  ├── Leave status (if attendance enabled)
  ├── Recent activities (payment, complaint update, notice)
  └── Quick actions (file complaint, contact admin via WhatsApp)
```

### 3. SERVICE HEALTH → COMPLAINT FLOW

```
ServiceStatus per floor (wifi, electricity, water_supply, etc.)
  │
  ├── If status = "operational" → GREEN indicator
  │     └── No action needed
  │
  ├── If status = "degraded" → YELLOW indicator
  │     └── Tenants can report via complaint (pre-filled category)
  │
  └── If status = "down" → RED indicator
        └── Tenants file complaint with category auto-linked
        └── Admin gets notification
        └── Complaint count increments for that service/floor
```

### 4. COMPLAINT RESOLUTION

```
Tenant submits → Admin sees in kanban → Admin updates status → Notification sent
  ↓                         ↓                         ↓
  Category auto-linked    Status change:            Tenant notified
  to service type         open → in_progress         via in-app + ntfy
                          → resolved → dismissed     Service re-checked
```

### 5. PAYMENT LIFE

```
Invoice Generated (monthly)
  ├── Tenant pays (UPI/cash)
  ├── UTR submitted → Admin verifies → Payment confirmed
  ├── Partial payment tracked
  └── Reminder sent if overdue
```

### 6. LEAVE (if attendance enabled)

```
Tenant requests leave → Admin approves → Attendance auto-set to on_leave
  ↓
  Guardian notified (if guardian portal enabled)
```

### 7. CHECKOUT

```
Tenant requests checkout → Admin processes:
  ├── Pending dues calculated
  ├── Deposit refund (manual)
  ├── Room bed freed
  └── Tenant marked inactive
```

## Activity Log (per tenant — displayed on tenant detail page)

```
Timeline of ALL events:
  ├── Move in (date)
  ├── Payments made (amount, date, method)
  ├── Complaints filed (title, status, date)
  ├── Complaints resolved (title, date)
  ├── Leaves taken (from → to, status)
  ├── Service status changes on their floor (wifi down → restored)
  ├── Notices received
  ├── Document updates
  └── Checkout (if applicable)
```

## UI Components Needed

### 1. FloorServiceGrid — Shows ALL services for a floor with status

```
[Floor: Ground Floor]
  ┌────────────────────────────────────────────────────┐
  │  WiFi ● Green  │  Electricity ● Green             │
  │  Water Supply ● Red (3 complaints) │ Geyser ● Green│
  │  Washing Machine 1 ● Green │ Washing Machine 2 ●  │
  │  Fridge ● Degraded (1 complaint)                   │
  │                                                    │
  │  [Report Issue → opens complaint form pre-filled]  │
  └────────────────────────────────────────────────────┘
```

### 2. TenantActivityTimeline — Full event history on tenant detail

```
  ● Moved in — 15 Jan 2026
  ● Rent paid ₹12,000 — 01 Feb 2026 (UPI)
  ● Filed complaint: "WiFi not working" — 05 Feb 2026
  ● Service status: WiFi restored — 06 Feb 2026
  ● Complaint resolved — 06 Feb 2026
  ● Leave approved (15-17 Feb) — 14 Feb 2026
  ● Rent paid ₹12,000 — 28 Feb 2026 (UPI)
```

### 3. ServiceHealthWidget — Room-level quick-view status dots

```
Room 201:     [🟢 WiFi] [🔴 Power] [🟢 Water] [🟢 Geyser]
Room 202:     [🟢 WiFi] [🟢 Power] [🟢 Water] [🟢 Geyser]
```

### 4. ComplaintQuickCreate — One-click complaint from service status

- Click red/yellow service → opens complaint form with category + room pre-filled
- Tenant just adds title + description

## Implementation Plan

### Batch A: Enhance ServiceStatus Model

- Add `complaintCount` virtual/derived field
- Add more service types: geyser, bedsheet, pillow, bed
- Group services into categories (essential vs amenity)

### Batch B: FloorServiceGrid Component

- Fetch all ServiceStatus for a floor
- Show colored status dots + labels
- Complaint count badge per service
- "Report Issue" button → links to complaint creation

### Batch C: TenantActivityTimeline Component

- Aggregate all events for a tenant
- Display as vertical timeline
- Color-code by event type

### Batch D: ServiceHealthWidget

- Per-room quick view of floor services
- Used on rooms list page and room detail
- Compact green/red dots

### Batch E: Update Tenant Detail Page

- Add activity timeline section
- Add service health widget (from floor)
- Add complaint count summary

### Batch F: Custom Dashboard Charts

- Revenue bar chart (custom SVG)
- Occupancy donut chart
- Complaint category breakdown
- Service health summary
