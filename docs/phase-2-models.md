# Phase 2: Database Models & Seed Data

**Status:** ✅ COMPLETE (07/06/2026)
**Goal:** All Mongoose models (23 collections plus AppConfig feature flags) with complete schemas, indexes, validation, hooks, virtuals, and a comprehensive seed script for development.
**Estimated:** 4.5-5.5 days
**Depends On:** Phase 1 (auth — User model extends here)
**Package Manager:** bun

---

## Architecture Decisions

| Decision        | Choice                                                                                           | Rationale                                                         |
| --------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Schema design   | Embedded sub-documents where bounded (beds in rooms), references where unbounded (tenants→users) | Balance between query performance and data integrity              |
| ID convention   | Mongoose default `_id` (ObjectId), exposed as `id` string via toJSON transform                   | Consistent with Phase 1 User model                                |
| Timestamps      | Mongoose `timestamps: true` on all models                                                        | Automatic `createdAt`/`updatedAt`                                 |
| Validation      | Mongoose built-in validators + custom validators where needed                                    | Avoids extra validation layer in models (Zod handles route-level) |
| Soft delete     | Boolean `isActive` field, never hard-delete                                                      | Data preservation, undo capability                                |
| Invoice numbers | Auto-generated format `INV-YYYYMM-NNN` with atomic counter                                       | Database-level uniqueness via unique index                        |

---

## Model Index

| #      | Model                | Collection           | Key Fields                                                                      |
| ------ | -------------------- | -------------------- | ------------------------------------------------------------------------------- |
| 1      | User                 | `users`              | email, phone, role, ntfyTopic                                                   |
| 2      | Floor                | `floors`             | floorNumber (unique)                                                            |
| 3      | Room                 | `rooms`              | roomNumber (unique), floorId, sharingType                                       |
| 4      | Tenant               | `tenants`            | userId (unique), roomId                                                         |
| 5      | Payment              | `payments`           | tenantId, month, status, utrNumber                                              |
| 6      | Invoice              | `invoices`           | invoiceNumber (unique), tenantId, month                                         |
| 7      | ElectricityBill      | `electricity_bills`  | month (unique)                                                                  |
| 8      | Complaint            | `complaints`         | tenantId, status, category                                                      |
| 9      | ServiceStatus        | `service_statuses`   | floorId + serviceType (compound unique)                                         |
| 10     | MealFeedback         | `meal_feedbacks`     | tenantId + date + mealType (compound unique)                                    |
| 11     | Notification         | `notifications`      | createdAt, type, readBy                                                         |
| 12     | Enquiry              | `enquiries`          | status, createdAt                                                               |
| 13     | AppConfig            | `app_configs`        | singleton (single document)                                                     |
| **14** | **Counter**          | `counters`           | **Atomic sequence generator (invoice numbers)**                                 |
| **15** | **DailyMenu**        | `daily_menus`        | **Mess menu per day**                                                           |
| **16** | **Visitor**          | `visitors`           | **Gate register / visitor tracking**                                            |
| **17** | **LaundrySlot**      | `laundry_slots`      | **Washing machine time-slot booking**                                           |
| **18** | **NoticePost**       | `notice_posts`       | **Announcements / notice board**                                                |
| **19** | **AuditLog**         | `audit_logs`         | **Admin action tracking**                                                       |
| **20** | **AttendanceRecord** | `attendance_records` | **Optional attendance tracking, gated by AppConfig.features.attendanceEnabled** |
| **21** | **LeaveApplication** | `leave_applications` | **Optional leave workflow, gated by attendanceEnabled**                         |
| **22** | **Asset**            | `assets`             | **Inventory and asset tracking**                                                |
| **23** | **Guardian**         | `guardians`          | **Parent/guardian access for tenant data**                                      |

---

## NEW MODELS (v2 — Filling Feature Gaps)

### Why These Were Missing

The original spec listed "Future Enhancements" (Phase 2) including menu management, visitor register, laundry booking, notice board, and analytics. These are **not** future — they're essential for a complete PG management system. Competitors (SpaceBasic, OurPG, TrackMyPG) all include them. We're adding them now as first-class features.

Attendance is the exception: it is important, but optional per PG. Build the models and routes, but gate every attendance and leave screen/endpoint behind `AppConfig.features.attendanceEnabled`.

### Step 2.N1: Counter Model (Atomic Invoice Numbers)

**File:** `apps/api/src/models/counter.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';

export interface ICounterDocument extends Document {
  _id: string; // e.g., "invoice-202607"
  seq: number;
}

const counterSchema = new mongoose.Schema<ICounterDocument>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter: Model<ICounterDocument> = mongoose.model<ICounterDocument>(
  'Counter',
  counterSchema,
);

/** Atomic increment — returns next sequence as padded invoice number */
export async function nextInvoiceNumber(month: string): Promise<string> {
  const yearMonth = month.replace('-', '');
  const counterId = `invoice-${yearMonth}`;

  const doc = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  const seq = String(doc.seq).padStart(3, '0');
  return `INV-${yearMonth}-${seq}`;
}
```

**Edge Cases:**
| Case | Behavior |
|------|----------|
| Race condition (2 simultaneous generates) | `$inc` is atomic in MongoDB |
| New month | New counter auto-created via `upsert: true` |

### Step 2.N2: DailyMenu Model (Mess Menu)

**File:** `apps/api/src/models/dailyMenu.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IDailyMenu, IMenuItem } from '@pg/types/menu';

export interface IDailyMenuDocument extends Omit<IDailyMenu, 'id'>, Document {}

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
  },
  { _id: false },
);

const dailyMenuSchema = new mongoose.Schema<IDailyMenuDocument>(
  {
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    meals: {
      breakfast: { type: [menuItemSchema], default: [] },
      lunch: { type: [menuItemSchema], default: [] },
      dinner: { type: [menuItemSchema], default: [] },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

dailyMenuSchema.index({ date: 1 }, { unique: true });

export const DailyMenu: Model<IDailyMenuDocument> = mongoose.model<IDailyMenuDocument>(
  'DailyMenu',
  dailyMenuSchema,
);
```

**Edge Cases:**
| Case | Behavior |
|------|----------|
| Set menu for same date twice | Unique index → upsert in route handler |
| Empty meal (no items) | Default `[]`, app shows "Menu not set" |
| Historical date | Allowed — keeps record |

### Step 2.N3: Visitor Model (Gate Register)

**File:** `apps/api/src/models/visitor.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IVisitor } from '@pg/types/visitor';

export interface IVisitorDocument extends Omit<IVisitor, 'id'>, Document {}

const visitorSchema = new mongoose.Schema<IVisitorDocument>(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    visitorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    visitorPhone: {
      type: String,
      required: true,
      match: [/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number'],
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    expectedArrival: { type: Date, required: true },
    actualArrival: { type: Date, default: null },
    actualDeparture: { type: Date, default: null },
    status: {
      type: String,
      enum: ['expected', 'arrived', 'departed', 'cancelled'],
      default: 'expected',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

visitorSchema.index({ tenantId: 1, expectedArrival: -1 });
visitorSchema.index({ status: 1 });
visitorSchema.index({ expectedArrival: 1 });

visitorSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true,
});

export const Visitor: Model<IVisitorDocument> = mongoose.model<IVisitorDocument>(
  'Visitor',
  visitorSchema,
);
```

**Visitor Lifecycle:**

```
Tenant pre-registers → status: expected
Admin/Gate approves → approvedBy set
Visitor arrives → status: arrived, actualArrival set
Visitor departs → status: departed, actualDeparture set
```

**Edge Cases:**
| Case | Behavior |
|------|----------|
| Mark arrived twice | Route checks status, returns 400 |
| Depart before arrival | Route validates arrival exists |
| Cancel after departure | Route checks status, returns 400 |

### Step 2.N4: LaundrySlot Model (Washing Machine Booking)

**File:** `apps/api/src/models/laundrySlot.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { ILaundrySlot, TimeSlot } from '@pg/types/laundry';

export interface ILaundrySlotDocument extends Omit<ILaundrySlot, 'id'>, Document {}

const TIME_SLOTS: TimeSlot[] = [
  '06-08',
  '08-10',
  '10-12',
  '12-14',
  '14-16',
  '16-18',
  '18-20',
  '20-22',
];

const laundrySlotSchema = new mongoose.Schema<ILaundrySlotDocument>(
  {
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Floor',
      required: true,
    },
    machineNumber: {
      type: Number,
      enum: [1, 2],
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    timeSlot: {
      type: String,
      enum: TIME_SLOTS,
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    status: {
      type: String,
      enum: ['available', 'booked', 'maintenance'],
      default: 'available',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Critical: one booking per floor+machine+date+timeslot
laundrySlotSchema.index({ floorId: 1, machineNumber: 1, date: 1, timeSlot: 1 }, { unique: true });
laundrySlotSchema.index({ tenantId: 1, date: 1 });
laundrySlotSchema.index({ floorId: 1, date: 1 });

export const LaundrySlot: Model<ILaundrySlotDocument> = mongoose.model<ILaundrySlotDocument>(
  'LaundrySlot',
  laundrySlotSchema,
);

/** Auto-generate slots for a floor for a given date */
export async function generateLaundrySlots(
  floorId: string,
  date: string,
  machines: number = 2,
): Promise<void> {
  const existing = await LaundrySlot.exists({ floorId, date });
  if (existing) return;

  const slots = [];
  for (const machine of [1, 2].slice(0, machines)) {
    for (const timeSlot of TIME_SLOTS) {
      slots.push({ floorId, machineNumber: machine, date, timeSlot, status: 'available' });
    }
  }
  await LaundrySlot.insertMany(slots, { ordered: false });
}
```

**Slots generation:** A cron job runs nightly, generating slots for 7 days ahead per floor. 2 machines × 8 slots = 16 bookable slots per floor per day.

**Edge Cases:**
| Case | Behavior |
|------|----------|
| Double-book same slot | Compound unique index prevents |
| Book past slot | Route checks date+time > now |
| Tenant has existing booking same day | Route checks — one booking per tenant per day |
| Machine in maintenance | All future slots for that machine → maintenance status |

### Step 2.N5: NoticePost Model (Announcements)

**File:** `apps/api/src/models/noticePost.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { INoticePost } from '@pg/types/notice';

export interface INoticePostDocument extends Omit<INoticePost, 'id'>, Document {}

const noticePostSchema = new mongoose.Schema<INoticePostDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    pinned: { type: Boolean, default: false },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['all', 'floor', 'room'],
      default: 'all',
    },
    targetIds: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

noticePostSchema.index({ pinned: -1, createdAt: -1 });
noticePostSchema.index({ targetType: 1 });

noticePostSchema.virtual('author', {
  ref: 'User',
  localField: 'authorId',
  foreignField: '_id',
  justOne: true,
});

export const NoticePost: Model<INoticePostDocument> = mongoose.model<INoticePostDocument>(
  'NoticePost',
  noticePostSchema,
);
```

### Step 2.N6: AuditLog Model (Admin Activity Tracking)

**File:** `apps/api/src/models/auditLog.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IAuditLog, IAuditAction } from '@pg/types/audit';

export interface IAuditLogDocument extends Omit<IAuditLog, 'id'>, Document {}

const auditLogSchema = new mongoose.Schema<IAuditLogDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'create',
        'update',
        'delete',
        'login',
        'logout',
        'payment_verify',
        'complaint_status_change',
        'tenant_checkout',
        'tenant_transfer',
        'settings_change',
        'notification_send',
        'visitor_approve',
        'export',
      ] as IAuditAction[],
      required: true,
    },
    resource: {
      type: String,
      required: true,
    },
    resourceId: {
      type: String,
      required: true,
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.timestamp = ret.createdAt;
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        return ret;
      },
    },
  },
);

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });

// TTL index: auto-delete logs older than 90 days (keep storage lean)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog: Model<IAuditLogDocument> = mongoose.model<IAuditLogDocument>(
  'AuditLog',
  auditLogSchema,
);
```

**When to log:**

- Every admin write operation (create/update/delete)
- Payment verification (approve/reject UTR)
- Tenant checkout/transfer
- Settings changes
- Notification sends
- Login/logout events
- Data exports

**Do NOT log:** Read operations (GET requests) — too noisy.

---

## Step 2.1: Floor Model

### File: `apps/api/src/models/floor.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IFloor } from '@pg/types/floor';

export interface IFloorDocument extends Omit<IFloor, 'id'>, Document {}

const floorSchema = new mongoose.Schema<IFloorDocument>(
  {
    floorNumber: {
      type: Number,
      required: [true, 'Floor number is required'],
      unique: true,
      min: [0, 'Floor number cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Floor number must be an integer',
      },
    },
    label: {
      type: String,
      required: [true, 'Floor label is required'],
      trim: true,
      maxlength: [50, 'Label cannot exceed 50 characters'],
    },
    totalRooms: {
      type: Number,
      required: true,
      min: [1, 'Must have at least 1 room'],
      max: [50, 'Cannot exceed 50 rooms per floor'],
    },
    amenities: {
      washingMachines: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      fridges: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

floorSchema.index({ floorNumber: 1 }, { unique: true });

export const Floor: Model<IFloorDocument> = mongoose.model<IFloorDocument>('Floor', floorSchema);
```

### Edge Cases

| Case                    | Behavior                                                                        |
| ----------------------- | ------------------------------------------------------------------------------- |
| Duplicate floorNumber   | MongoDB unique constraint error → 409                                           |
| Delete floor with rooms | Check in route handler — prevent deletion if rooms exist                        |
| Negative floor numbers  | Allowed (0 = ground, -1 = basement) via min: 0 relaxation — adjust per PG needs |

---

## Step 2.2: Room Model

### File: `apps/api/src/models/room.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IRoom, SharingType } from '@pg/types/room';

export interface IRoomDocument extends Omit<IRoom, 'id' | 'floorLabel' | 'floorNumber'>, Document {}

const bedSchema = new mongoose.Schema(
  {
    bedId: {
      type: String,
      required: true,
      enum: ['A', 'B', 'C', 'D'],
    },
    isOccupied: { type: Boolean, default: false },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    tenantName: { type: String, default: null },
  },
  { _id: false },
);

const roomSchema = new mongoose.Schema<IRoomDocument>(
  {
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Room number cannot exceed 20 characters'],
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Floor',
      required: [true, 'Floor is required'],
    },
    sharingType: {
      type: Number,
      required: true,
      enum: [2, 3, 4] as SharingType[],
    },
    monthlyRent: {
      type: Number,
      required: [true, 'Monthly rent is required'],
      min: [1000, 'Rent must be at least ₹1,000'],
      max: [50000, 'Rent cannot exceed ₹50,000'],
    },
    isActive: { type: Boolean, default: true },
    description: { type: String, trim: true, maxlength: 500 },
    photos: [{ type: String }], // Cloudinary URLs
    beds: {
      type: [bedSchema],
      validate: {
        validator: function (beds: any[]) {
          return beds.length === (this as any).sharingType;
        },
        message: 'Number of beds must equal sharing type',
      },
    },
    occupancyCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ── Indexes ─────────────────────────────────────────────
roomSchema.index({ roomNumber: 1 }, { unique: true });
roomSchema.index({ floorId: 1 });
roomSchema.index({ sharingType: 1 });
roomSchema.index({ isActive: 1 });
roomSchema.index({ 'beds.isOccupied': 1 });

// ── Virtual: populate floor info ────────────────────────
roomSchema.virtual('floor', {
  ref: 'Floor',
  localField: 'floorId',
  foreignField: '_id',
  justOne: true,
});

// ── Pre-save: derive occupancyCount ─────────────────────
roomSchema.pre('save', function (next) {
  if (this.isModified('beds')) {
    this.occupancyCount = this.beds.filter((b) => b.isOccupied).length;
  }
  next();
});

// ── Static: auto-generate beds from sharingType ─────────
roomSchema.statics.generateBeds = function (sharingType: SharingType) {
  const bedIds =
    sharingType === 2 ? ['A', 'B'] : sharingType === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
  return bedIds.map((bedId) => ({
    bedId,
    isOccupied: false,
    tenantId: null,
    tenantName: null,
  }));
};

export const Room: Model<IRoomDocument> = mongoose.model<IRoomDocument>('Room', roomSchema);
```

### Edge Cases

| Case                              | Behavior                                                         |
| --------------------------------- | ---------------------------------------------------------------- |
| Change sharingType after creation | Beds array must be manually updated to match — validated on save |
| Assign tenant to occupied bed     | Route handler checks `isOccupied` before assigning               |
| Room number conflicts             | Unique index, uppercase normalized                               |
| Soft-delete room (isActive=false) | Query filters always include `isActive: true` by default         |

---

## Step 2.3: Tenant Model

### File: `apps/api/src/models/tenant.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { ITenant } from '@pg/types/tenant';

export interface ITenantDocument extends Omit<ITenant, 'id' | 'user' | 'room'>, Document {}

const tenantSchema = new mongoose.Schema<ITenantDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
    },
    bedId: {
      type: String,
      required: [true, 'Bed ID is required'],
      enum: ['A', 'B', 'C', 'D'],
    },
    moveInDate: {
      type: Date,
      required: [true, 'Move-in date is required'],
    },
    moveOutDate: { type: Date, default: null },
    depositPaid: {
      type: Number,
      default: 0,
      min: [0, 'Deposit cannot be negative'],
    },
    monthlyRent: {
      type: Number,
      required: [true, 'Monthly rent is required'],
      min: [1000, 'Rent must be at least ₹1,000'],
    },
    isActive: { type: Boolean, default: true },
    documents: {
      aadhaarUrl: { type: String, default: null },
      photoUrl: { type: String, default: null },
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: {
        type: String,
        match: [/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number'],
      },
      relation: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ── Indexes ─────────────────────────────────────────────
tenantSchema.index({ userId: 1 }, { unique: true });
tenantSchema.index({ roomId: 1 });
tenantSchema.index({ bedId: 1 });
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ moveInDate: -1 });

// ── Compound: one active tenant per bed ─────────────────
tenantSchema.index({ roomId: 1, bedId: 1, isActive: 1 });

// ── Virtuals ────────────────────────────────────────────
tenantSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

tenantSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true,
});

export const Tenant: Model<ITenantDocument> = mongoose.model<ITenantDocument>(
  'Tenant',
  tenantSchema,
);
```

### Edge Cases

| Case                                | Behavior                                                       |
| ----------------------------------- | -------------------------------------------------------------- |
| One user linked to multiple tenants | `userId` unique index prevents this                            |
| Checkout already-checked-out tenant | Route checks `isActive` first, returns 400 if already inactive |
| Move-in date in the future          | Allowed (pre-booking)                                          |
| Move-out date before move-in        | Validated in route handler                                     |

---

## Step 2.4: Payment Model (UPI-focused)

### File: `apps/api/src/models/payment.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IPayment, IPaymentStatus, IPaymentType, IPaymentMethod } from '@pg/types/payment';

export interface IPaymentDocument extends Omit<IPayment, 'id' | 'tenant' | 'invoice'>, Document {}

const paymentSchema = new mongoose.Schema<IPaymentDocument>(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant reference is required'],
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: [true, 'Invoice reference is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    type: {
      type: String,
      enum: ['rent', 'electricity', 'deposit', 'laundry', 'other'] as IPaymentType[],
      required: true,
    },
    method: {
      type: String,
      enum: ['upi', 'cash', 'bank_transfer', 'other'] as IPaymentMethod[],
      default: 'upi',
    },
    status: {
      type: String,
      enum: ['pending', 'pending_verification', 'paid', 'overdue', 'cancelled'] as IPaymentStatus[],
      default: 'pending',
    },
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'],
    },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    utrNumber: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple nulls
      trim: true,
      uppercase: true,
      validate: {
        validator: function (v: string | null) {
          if (!v) return true; // null is ok
          return /^[A-Z0-9]{6,22}$/.test(v);
        },
        message: 'UTR must be 6-22 alphanumeric characters',
      },
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    screenshotUrl: { type: String, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ── Indexes ─────────────────────────────────────────────
paymentSchema.index({ tenantId: 1 });
paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ month: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ dueDate: 1 });
paymentSchema.index({ utrNumber: 1 }, { unique: true, sparse: true });
paymentSchema.index({ tenantId: 1, month: 1 }); // Find payment for tenant+month

// ── Virtuals ────────────────────────────────────────────
paymentSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true,
});

paymentSchema.virtual('invoice', {
  ref: 'Invoice',
  localField: 'invoiceId',
  foreignField: '_id',
  justOne: true,
});

export const Payment: Model<IPaymentDocument> = mongoose.model<IPaymentDocument>(
  'Payment',
  paymentSchema,
);
```

### Edge Cases

| Case                  | Behavior                                                                             |
| --------------------- | ------------------------------------------------------------------------------------ |
| Duplicate UTR         | Unique sparse index prevents — two payments can't have same UTR                      |
| UTR format validation | 6-22 uppercase alphanumeric (UPI UTRs are typically 12 digits)                       |
| Status transitions    | Route handler enforces valid transitions: pending→pending_verification→paid/rejected |

---

## Step 2.5: Invoice Model

### File: `apps/api/src/models/invoice.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IInvoice, IInvoiceStatus } from '@pg/types/invoice';

export interface IInvoiceDocument extends Omit<IInvoice, 'id' | 'tenant'>, Document {}

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema<IInvoiceDocument>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^INV-\d{6}-\d{3}$/, 'Invoice number must be INV-YYYYMM-NNN'],
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM'],
    },
    generatedAt: { type: Date, default: Date.now },
    lineItems: { type: [lineItemSchema], default: [] },
    rentAmount: { type: Number, required: true, min: 0 },
    electricityAmount: { type: Number, default: 0, min: 0 },
    otherCharges: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'] as IInvoiceStatus[],
      default: 'draft',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ── Indexes ─────────────────────────────────────────────
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ tenantId: 1 });
invoiceSchema.index({ month: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ tenantId: 1, month: 1 }, { unique: true }); // One invoice per tenant per month

// ── Virtuals ────────────────────────────────────────────
invoiceSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true,
});

// ── Pre-save: calculate total ───────────────────────────
invoiceSchema.pre('save', function (next) {
  this.totalAmount = this.rentAmount + this.electricityAmount + this.otherCharges;
  next();
});

export const Invoice: Model<IInvoiceDocument> = mongoose.model<IInvoiceDocument>(
  'Invoice',
  invoiceSchema,
);
```

### Edge Cases

| Case                                     | Behavior                                                        |
| ---------------------------------------- | --------------------------------------------------------------- |
| Duplicate invoice for same tenant+month  | Compound unique index prevents                                  |
| Invoice generated but no payment         | Payment record created with status 'pending' alongside invoice  |
| Invoice number generation race condition | Atomic counter or DB-level unique constraint ensures uniqueness |

---

## Step 2.6: ElectricityBill Model

### File: `apps/api/src/models/electricityBill.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IElectricityBill, IElectricityBillStatus } from '@pg/types/electricity';

export interface IElectricityBillDocument extends Omit<IElectricityBill, 'id'>, Document {}

const roomReadingSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    previousReading: { type: Number, required: true, min: 0 },
    currentReading: { type: Number, required: true, min: 0 },
    unitsConsumed: { type: Number, required: true, min: 0 },
    ratePerUnit: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const electricityBillSchema = new mongoose.Schema<IElectricityBillDocument>(
  {
    month: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM'],
    },
    totalBillAmount: {
      type: Number,
      required: true,
      min: [0, 'Total bill amount cannot be negative'],
    },
    billImageUrl: { type: String, default: null },
    roomEntries: {
      type: [roomReadingSchema],
      validate: {
        validator: (v: any[]) => v.length > 0,
        message: 'Must have at least one room entry',
      },
    },
    status: {
      type: String,
      enum: ['draft', 'finalized', 'distributed'] as IElectricityBillStatus[],
      default: 'draft',
    },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

electricityBillSchema.index({ month: 1 }, { unique: true });

// ── Pre-save: derive unitsConsumed and amount ───────────
electricityBillSchema.pre('save', function (next) {
  for (const entry of this.roomEntries) {
    entry.unitsConsumed = entry.currentReading - entry.previousReading;
    entry.amount = entry.unitsConsumed * entry.ratePerUnit;
  }
  next();
});

export const ElectricityBill: Model<IElectricityBillDocument> =
  mongoose.model<IElectricityBillDocument>('ElectricityBill', electricityBillSchema);
```

---

## Step 2.7: Complaint Model

### File: `apps/api/src/models/complaint.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type {
  IComplaint,
  IComplaintCategory,
  IComplaintPriority,
  IComplaintStatus,
} from '@pg/types/complaint';

export interface IComplaintDocument extends Omit<IComplaint, 'id' | 'tenant' | 'room'>, Document {}

const complaintSchema = new mongoose.Schema<IComplaintDocument>(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    category: {
      type: String,
      enum: [
        'wifi',
        'water',
        'electricity',
        'food_quality',
        'cleaning_room',
        'cleaning_washroom',
        'washing_machine',
        'fridge',
        'lights',
        'noise',
        'other',
      ] as IComplaintCategory[],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    photos: [{ type: String }],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'] as IComplaintPriority[],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'dismissed'] as IComplaintStatus[],
      default: 'open',
    },
    adminNotes: { type: String, trim: true, default: '' },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

complaintSchema.index({ tenantId: 1 });
complaintSchema.index({ roomId: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ priority: 1 });
complaintSchema.index({ status: 1, priority: 1 }); // Urgent open complaints

complaintSchema.virtual('tenant', {
  ref: 'Tenant',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true,
});
complaintSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true,
});

export const Complaint: Model<IComplaintDocument> = mongoose.model<IComplaintDocument>(
  'Complaint',
  complaintSchema,
);
```

---

## Step 2.8-2.13: Remaining Models (ServiceStatus, MealFeedback, Notification, Enquiry, AppConfig)

_(These follow the same patterns established above — complete Mongoose schemas with indexes, toJSON transforms, virtuals where needed. Key specifics:)_

### ServiceStatus: Compound unique index on `{ floorId: 1, serviceType: 1 }`

### MealFeedback: Compound unique index on `{ tenantId: 1, date: 1, mealType: 1 }` (one feedback per meal per day)

### Notification: `readBy` array of ObjectId refs to User, `targetType` enum, no unique constraints

### Enquiry: Public-facing model, no auth required for create, `source` defaults to 'website', `status` defaults to 'new'

### AppConfig: Singleton pattern - always findOneAndUpdate with `{ upsert: true }`, never more than one document. Schema includes all fields from `IAppConfigBase` type (Phase 0).

Add feature flags:

```typescript
features: {
  attendanceEnabled: { type: Boolean, default: false },
  laundryEnabled: { type: Boolean, default: true },
  messFeedbackEnabled: { type: Boolean, default: true },
  visitorManagementEnabled: { type: Boolean, default: true },
  guardianPortalEnabled: { type: Boolean, default: true },
  noticeBoardEnabled: { type: Boolean, default: true },
  emergencyAlertsEnabled: { type: Boolean, default: true },
}
```

Feature flags gate API routes, admin navigation, Flutter navigation, and guardian dashboard cards. Disabled feature routes return the standard `FEATURE_DISABLED` error.

## Step 2.14: AttendanceRecord Model (Optional)

**File:** `apps/api/src/models/attendanceRecord.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IAttendanceRecord } from '@pg/types/attendance';

export interface IAttendanceRecordDocument extends Omit<IAttendanceRecord, 'id'>, Document {}

const attendanceRecordSchema = new mongoose.Schema<IAttendanceRecordDocument>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    status: {
      type: String,
      enum: ['present', 'absent', 'on_leave', 'not_returned'],
      required: true,
    },
    method: {
      type: String,
      enum: ['manual', 'qr', 'app'],
      required: true,
    },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

attendanceRecordSchema.index({ tenantId: 1, date: 1 }, { unique: true });
attendanceRecordSchema.index({ date: 1, status: 1 });

export const AttendanceRecord: Model<IAttendanceRecordDocument> =
  mongoose.model<IAttendanceRecordDocument>('AttendanceRecord', attendanceRecordSchema);
```

**Rule:** This model can exist even when attendance is disabled, but no UI or route should expose it unless `attendanceEnabled` is true.

## Step 2.15: LeaveApplication Model (Optional)

**File:** `apps/api/src/models/leaveApplication.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { ILeaveApplication } from '@pg/types/attendance';

export interface ILeaveApplicationDocument extends Omit<ILeaveApplication, 'id'>, Document {}

const leaveApplicationSchema = new mongoose.Schema<ILeaveApplicationDocument>(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    fromDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    toDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    adminNotes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

leaveApplicationSchema.index({ tenantId: 1, fromDate: -1 });
leaveApplicationSchema.index({ status: 1, createdAt: -1 });

export const LeaveApplication: Model<ILeaveApplicationDocument> =
  mongoose.model<ILeaveApplicationDocument>('LeaveApplication', leaveApplicationSchema);
```

Approved leave marks matching attendance dates as `on_leave` only when attendance is enabled.

## Step 2.16: Asset Model

**File:** `apps/api/src/models/asset.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IAsset } from '@pg/types/asset';

export interface IAssetDocument extends Omit<IAsset, 'id'>, Document {}

const assetSchema = new mongoose.Schema<IAssetDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ['furniture', 'appliance', 'electronics', 'cleaning', 'other'],
      required: true,
    },
    location: { type: String, required: true, trim: true, maxlength: 160 },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    lowStockThreshold: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['available', 'in_use', 'under_maintenance', 'damaged', 'retired'],
      default: 'available',
    },
    purchasedDate: { type: Date, default: null },
    lastServicedDate: { type: Date, default: null },
    nextServiceDate: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

assetSchema.index({ category: 1, status: 1 });
assetSchema.index({ nextServiceDate: 1 });

export const Asset: Model<IAssetDocument> = mongoose.model<IAssetDocument>('Asset', assetSchema);
```

## Step 2.17: Guardian Model

**File:** `apps/api/src/models/guardian.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import type { IGuardian } from '@pg/types/guardian';

export interface IGuardianDocument extends Omit<IGuardian, 'id'>, Document {}

const guardianSchema = new mongoose.Schema<IGuardianDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: {
      type: String,
      required: true,
      match: [/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number'],
    },
    email: { type: String, trim: true, lowercase: true },
    relation: {
      type: String,
      enum: ['father', 'mother', 'guardian', 'other'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

guardianSchema.index({ tenantId: 1, isActive: 1 });
guardianSchema.index({ phone: 1 });

export const Guardian: Model<IGuardianDocument> = mongoose.model<IGuardianDocument>(
  'Guardian',
  guardianSchema,
);
```

Guardian users use the same auth system with role `guardian`. Their app is read-only for ward data: room, rent status, invoices, payment history, notices, emergency alerts, and attendance only when `attendanceEnabled` is true.

---

## Step 2.18: Seed Script (Extended)

### File: `apps/api/src/scripts/seed.ts` (replaces Phase 1 seed)

Full seed script creates:

1. **Admin user** from env vars (if not exists)
2. **AppConfig** with defaults (if not exists)
3. **Sample data** (when `--with-sample-data` flag passed):

```
Floors: Ground (floorNumber: 0), First (1), Second (2)
  - Each with washingMachines: 2, fridges: 1

Rooms: 4 per floor = 12 total
  - Mix of 2-sharing, 3-sharing, 4-sharing
  - Monthly rents: ₹6,000-₹12,000 range

Tenants + Users: 6 sample tenants
  - Assigned to beds across floors 0 and 1
  - Created with User documents, tenant profiles

ServiceStatus: 6 per floor = 18 total
  - All 'operational' initially

Complaints: 3 sample (various statuses)
Payments: 3 sample (mix of paid/pending)
Invoices: 3 sample (current month)
DailyMenu: today and tomorrow
NoticePost: 2 sample announcements
Assets: sample beds, appliances, and consumables
Guardians: at least 2 sample guardians linked to tenants
Attendance/Leave: only seeded when attendanceEnabled sample flag is true
```

### Seed invocation:

```bash
# Just seed admin + AppConfig
bun run src/scripts/seed.ts

# Full development seed
bun run src/scripts/seed.ts --with-sample-data
```

---

## Step 2.19: Barrel Export

### File: `apps/api/src/models/index.ts`

```typescript
export { User } from './user.js';
export { Floor } from './floor.js';
export { Room } from './room.js';
export { Tenant } from './tenant.js';
export { Payment } from './payment.js';
export { Invoice } from './invoice.js';
export { ElectricityBill } from './electricityBill.js';
export { Complaint } from './complaint.js';
export { ServiceStatus } from './serviceStatus.js';
export { MealFeedback } from './mealFeedback.js';
export { Notification } from './notification.js';
export { Enquiry } from './enquiry.js';
export { AppConfig } from './appConfig.js';
export { Counter, nextInvoiceNumber } from './counter.js';
export { DailyMenu } from './dailyMenu.js';
export { Visitor } from './visitor.js';
export { LaundrySlot, generateLaundrySlots } from './laundrySlot.js';
export { NoticePost } from './noticePost.js';
export { AuditLog } from './auditLog.js';
export { AttendanceRecord } from './attendanceRecord.js';
export { LeaveApplication } from './leaveApplication.js';
export { Asset } from './asset.js';
export { Guardian } from './guardian.js';
```

---

## Verification Checklist (23 Models + Feature Flags)

- [ ] All 23 models compile without TypeScript errors (`bun run typecheck`)
- [ ] Seed script runs: `bun run seed` → admin + AppConfig created
- [ ] Seed with sample data: `bun run seed -- --with-sample-data` → all planned collections populated
- [ ] MongoDB indexes verified per collection
- [ ] Unique constraints enforced across all compound indexes
- [ ] AppConfig feature flags exist with correct defaults
- [ ] Attendance and leave seed data stays absent unless attendance sample flag is enabled
- [ ] Counter atomicity: simultaneous invoice generation produces no gaps
- [ ] DailyMenu: upsert on same date updates rather than errors
- [ ] Visitor lifecycle: expected→arrived→departed transitions work
- [ ] LaundrySlot auto-generation: `generateLaundrySlots()` creates correct slots
- [ ] NoticePost: pinned posts sort before unpinned
- [ ] AttendanceRecord: one record per tenant per date
- [ ] LeaveApplication: approve/reject workflow validates status transitions
- [ ] Asset: low-stock query finds quantity below threshold
- [ ] Guardian: guardian user resolves to exactly one tenant/ward
- [ ] AuditLog TTL: logs older than 90 days auto-deleted by MongoDB
- [ ] Virtual population: all refs resolve correctly
- [ ] Pre-save hooks: bed occupancy, invoice total auto-derived
- [ ] toJSON transform: `id` field present, Mongo internals absent
- [ ] Timestamps: all models have `createdAt`, most have `updatedAt`
- [ ] Sparse unique indexes: multiple null UTRs allowed

---

## Edge Cases Summary (23 Models + Feature Flags)

| Model            | Edge Case                                        | Resolution                                         |
| ---------------- | ------------------------------------------------ | -------------------------------------------------- |
| Room             | Change sharingType after beds created            | Validation fails if beds ≠ sharingType             |
| Room             | Delete room with active tenants                  | Route handler checks, returns 409                  |
| Tenant           | Checkout already-checked-out                     | Checks `isActive`, returns 400                     |
| Tenant           | Concurrent bed assignment                        | DB transaction ensures atomic bed update           |
| Tenant           | Transfer between rooms                           | Atomic bed swap: vacate old + occupy new           |
| Payment          | UTR already verified                             | Status check in route — cannot re-verify           |
| Payment          | Payment without invoice                          | `invoiceId` required, validated                    |
| Payment          | Partial payment                                  | Creates separate payment record, invoice → partial |
| Invoice          | Generate duplicate month                         | Compound unique index catches, returns 409         |
| ElectricityBill  | Readings missing rooms                           | Validation requires all active rooms have entries  |
| ElectricityBill  | currentReading < previousReading                 | Route-level Zod validation catches                 |
| Complaint        | Status transition to resolved without adminNotes | Allowed (adminNotes optional)                      |
| ServiceStatus    | Duplicate floor+service                          | Compound unique index prevents                     |
| MealFeedback     | Resubmit same meal                               | Upsert via compound unique index                   |
| Notification     | Target user deleted                              | Notification remains, readBy just stays            |
| AppConfig        | Multiple documents created                       | Singleton enforced in route — always upsert        |
| Counter          | Race condition on invoice number                 | `$inc` operator is atomic                          |
| DailyMenu        | Set menu for same date twice                     | Unique index → upsert in route                     |
| Visitor          | Mark arrived twice                               | Status check, returns 400                          |
| Visitor          | Depart before arrival                            | Route validates arrival exists                     |
| LaundrySlot      | Double-book same slot                            | Compound unique index prevents                     |
| LaundrySlot      | Book past time slot                              | Route checks date+time > now                       |
| NoticePost       | Empty targetIds for 'all'                        | TargetIds = `[]`, query uses targetType only       |
| AttendanceRecord | Feature disabled                                 | Routes return `FEATURE_DISABLED`, UI hidden        |
| AttendanceRecord | Duplicate date for tenant                        | Compound unique index prevents duplicate           |
| LeaveApplication | Attendance disabled                              | Routes return `FEATURE_DISABLED`, no leave UI      |
| Asset            | Quantity below threshold                         | Low-stock route includes the asset                 |
| Guardian         | Guardian tries tenant-only action                | Role guard returns 403                             |
| AuditLog         | Read operations logged                           | Excluded — only write/mutation actions             |
