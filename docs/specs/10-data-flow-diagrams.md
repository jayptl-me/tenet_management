# 10 — Data Flow Diagrams

## Complete Entity Relationship Map (Text ERD)

```
┌──────────┐    1:1    ┌──────────┐    N:1    ┌──────────┐    N:1    ┌──────────┐
│   User   │───────────│  Tenant  │───────────│   Room   │───────────│  Floor   │
│          │  userId   │          │  roomId   │          │  floorId  │          │
│ _id      │           │ _id      │           │ _id      │           │ _id      │
│ name     │           │ userId   │           │ roomNum  │           │ label    │
│ email    │           │ roomId   │           │ floorId  │           │ floorNum │
│ phone    │           │ bedId    │           │ sharing  │           │ totalRms │
│ role     │           │ rent     │           │ beds[]   │           │ amenCt[] │
│ isActive │           │ deposit  │           │ amenities│           │          │
│ passwd   │           │ isActive │           │ isActive │           │          │
│ ntfyTpc  │           │ moveIn   │           │ occupant │           │          │
│ tenantId │           │ moveOut  │           │          │           │          │
│ guardId  │           │ docs     │           │          │           │          │
└────┬─────┘           │ emerCtc  │           └────┬─────┘           └────┬─────┘
     │                 └────┬─────┘                │                      │
     │                      │                      │                      │
     │         ┌────────────┼──────────┐           │         ┌────────────┤
     │         │            │          │           │         │            │
     ▼         ▼            ▼          ▼           ▼         ▼            ▼
┌─────────┐ ┌───────┐ ┌────────┐ ┌────────┐  ┌─────────┐ ┌──────────────┐
│AuditLog │ │Payment│ │Invoice │ │Complnt│  │Electrcty│ │ServiceStatus │
│         │ │       │ │        │ │       │  │Bill     │ │(floorId+type │
│ userId  │ │tentId │ │tentId  │ │tentId │  │         │ │ unique)      │
│ action  │ │invId  │ │month   │ │roomId │  │month    │ │floorId       │
│ resource│ │amount │ │rentAmt │ │title  │  │totalAmt │ │serviceType   │
│ resId   │ │method │ │elecAmt │ │cat    │  │entries[]│ │status        │
│ details │ │status │ │total   │ │priority│ │→roomId  │ │lastUpdatedBy │
│ ip      │ │type   │ │status  │ │status │  │reading  │ │lastUpdatedAt │
│ time    │ │month  │ │dueDate │ │       │  │units    │ │note          │
└─────────┘ └───────┘ └────────┘ └───────┘  └─────────┘ └──────────────┘

Standalone entities (no FK to core hierarchy):
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Guardian │ │ Notice   │ │Notifctn  │ │ Enquiry  │ │ Visitor  │ │  Asset   │
│          │ │ Post     │ │          │ │          │ │          │ │          │
│ userId   │ │ authorId │ │targetType│ │ name     │ │ tenantId │ │ name     │
│ tenantId │ │ title    │ │targetIds │ │ phone    │ │visitorNm │ │ category │
│ name     │ │ content  │ │ title    │ │ email    │ │visitorPh │ │ location │
│ phone    │ │ pinned   │ │ body     │ │ sharing  │ │ purpose  │ │ qty      │
│ relation │ │targetTyp │ │ type     │ │ message  │ │expArrival│ │ status   │
│ isActive │ │targetIds │ │ unreadBy │ │ status   │ │actArrival│ │ dates    │
└──────────┘ └──────────┘ └──────────┘ │ source   │ │actDepart │ └──────────┘
                                        └──────────┘ │ status   │
                                                     │approvedBy│
                                                     └──────────┘

Facility entities:
┌──────────┐ ┌─────────────┐ ┌─────────────┐
│ DailyMenu│ │ MealFeedback│ │ LaundrySlot │
│          │ │             │ │             │
│ date     │ │ tenantId    │ │ tenantId    │
│ meals{}  │ │ date        │ │ slotDate    │
│→bfast[]  │ │ mealType    │ │ slotTime    │
│→lunch[]  │ │ rating 1-5  │ │ items       │
│→dinner[] │ │ status      │ │ status      │
└──────────┘ │ comment     │ │ notes       │
             │ categories  │ └─────────────┘
             └─────────────┘

HR entities:
┌───────────────┐ ┌───────────────┐
│AttendRecord   │ │LeaveApplictn  │
│               │ │               │
│ tenantId      │ │ tenantId      │
│ date          │ │ fromDate      │
│ checkIn/Out   │ │ toDate        │
│ status        │ │ reason        │
│ method        │ │ status        │
│ recordedBy    │ │ approvedBy    │
│ notes         │ │ adminNotes    │
└───────────────┘ └───────────────┘

Singleton:
┌──────────────┐
│ AppConfig    │
│              │
│ pgName       │
│ address{}    │
│ roomPricing{}│
│ amenityDefs[]│
│ features{}   │
│ theme{}      │
│ testimonials │
│ gst/pan      │
└──────────────┘
```

## Key Data Flows

### 1. Tenant Creation

```
Frontend: /tenants/new
  ├─ Form: name, email, phone, roomId (ResourceSelect), bedId (Select → filtered by room.sharingType), moveInDate, deposit, rent
  └─ onSubmit → POST /tenants
      ├─ Zod validates body
      ├─ Mongoose session starts
      ├─ Room.findById(roomId) → validate exists + isActive
      ├─ Room.beds.find(b.bedId === bedId) → validate not occupied
      ├─ User.create({ name, email, phone, passwordHash: random, role: 'tenant' })
      ├─ Tenant.create({ userId, roomId, bedId, moveInDate, monthlyRent, depositPaid })
      ├─ Room.bed.isOccupied = true, bed.tenantId = tenant._id → room.save()
      ├─ Room.occupancyCount = beds.filter(isOccupied).length
      ├─ User.findByIdAndUpdate(userId, { tenantId })
      ├─ Commit → 201 Created
      └─ router.push('/tenants')
```

### 2. Tenant Room Transfer (Edit)

```
Frontend: /tenants/:id/edit
  └─ PUT /tenants/:id
      ├─ body.roomId !== tenant.roomId → room transfer
      │   ├─ OldRoom.findById(tenant.roomId) → free old bed
      │   │   ├─ oldBed.isOccupied = false, oldBed.tenantId = null
      │   │   ├─ oldRoom.occupancyCount = beds.filter(isOccupied).length
      │   │   └─ oldRoom.save()
      │   ├─ NewRoom.findById(body.roomId) → validate exists + isActive
      │   ├─ NewBed = newRoom.beds.find(b.bedId === newBedId)
      │   │   ├─ Validate not occupied by other tenant
      │   │   ├─ newBed.isOccupied = true, newBed.tenantId = tenant._id
      │   │   └─ newRoom.save()
      │   └─ tenant.roomId = newRoomId, tenant.bedId = newBedId
      ├─ tenant.save()
      └─ Return populated tenant
```

### 3. Tenant Checkout

```
Frontend: /tenants/:id → "Check Out" button
  ├─ GET /tenants/:id/dues → show modal with summary
  │   ├─ Unpaid invoices (sent/partial/overdue)
  │   ├─ Pending payments
  │   ├─ Electricity dues from invoice line items
  │   ├─ Deposit held (= tenant.depositPaid)
  │   └─ totalDue = max(invoiceTotal, paymentDue)
  └─ Confirm → POST /tenants/:id/checkout
      ├─ Session + transaction
      ├─ tenant.moveOutDate = new Date(), tenant.isActive = false
      ├─ Room: free bed, recalculate occupancyCount
      ├─ User: isActive = false
      └─ Commit
```

### 4. Room SharingType Change (CRITICAL FIX)

```
Frontend: /rooms/:id/edit
  └─ PUT /rooms/:id (body.sharingType = new value)
      ├─ Load existing room
      ├─ oldSharingType !== newSharingType
      │   ├─ rebuildBedsForSharingType(existingBeds, newSharingType)
      │   │   ├─ Collect occupied beds
      │   │   ├─ Generate slots: BED_IDS.slice(0, newSharingType)
      │   │   ├─ Map occupied beds to slots
      │   │   ├─ Fill remaining with empty beds
      │   │   ├─ If occupied > newSharingType → throw 409
      │   │   └─ Return beds.slice(0, newSharingType)
      │   ├─ existingRoom.beds = rebuiltBeds
      │   ├─ existingRoom.sharingType = newSharingType
      │   ├─ Apply other body fields
      │   └─ existingRoom.save() → validators pass
      └─ Return populated room
```

### 5. Electricity Bill Distribution

```
POST /electricity/:id/distribute
  ├─ Load bill with roomEntries
  ├─ For each room entry:
  │   ├─ Find active tenant in that room
  │   ├─ Find/create invoice for (tenantId, bill.month)
  │   ├─ Set invoice.electricityAmount = entry.amount
  │   ├─ Invoice.status = 'sent'
  │   └─ invoice.save()
  └─ bill.status = 'distributed', bill.save()
```

### 6. Enquiry → Tenant Conversion

```
Frontend: /enquiries/:id → "Convert to Tenant" button
  ├─ router.push(`/tenants/new?name=${name}&phone=${phone}&email=${email}&source=enquiry&enquiryId=${id}`)
  └─ /tenants/new page reads query params → pre-fills form
      └─ After tenant creation → PUT /enquiries/:id/status { status: 'converted' }
```

### 7. Complaint Kanban Drag

```
Frontend: /complaints (kanban view)
  └─ onDragEnd (dnd-kit)
      ├─ Extract: complaintId (from active.id), newStatus (from over.id)
      ├─ Validate: newStatus in KANBAN_STATUSES
      ├─ Optimistic update: setComplaints(prev → map to new status)
      ├─ PUT /complaints/:id/status { status: newStatus }
      └─ On failure: revert (setComplaints back to original)
```

## Validation Contracts

### Cross-Field Validation

| Rule                                                                | Model           | Enforced                                   |
| ------------------------------------------------------------------- | --------------- | ------------------------------------------ |
| Room.beds.length === sharingType                                    | Room            | Mongoose custom validator                  |
| beds array regenerated on sharingType change                        | Room            | rebuildBedsForSharingType() in PUT handler |
| Tenant checkout: free bed → occupancyCount update                   | Tenant          | PUT /tenants/:id/checkout                  |
| Invoice totalAmount = rentAmount + electricityAmount + otherCharges | Invoice         | Pre-save hook                              |
| Payment amount ≤ invoice balance                                    | Payment         | Manual check in POST /payments/offline     |
| Electricity unitsConsumed = currentReading - previousReading        | ElectricityBill | Pre-save hook                              |
| Electricity amount = unitsConsumed × ratePerUnit                    | ElectricityBill | Pre-save hook                              |

### Unique Compound Indexes

| Index                              | Model            | Purpose                          |
| ---------------------------------- | ---------------- | -------------------------------- |
| `{ tenantId, month }`              | Invoice          | One invoice per tenant per month |
| `{ tenantId, slotDate, slotTime }` | LaundrySlot      | No double-booking                |
| `{ tenantId, date }`               | AttendanceRecord | One record per tenant per day    |
| `{ tenantId, date, mealType }`     | MealFeedback     | One rating per meal per day      |
| `{ floorId, serviceType }`         | ServiceStatus    | One status per service per floor |
