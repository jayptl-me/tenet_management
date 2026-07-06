# Phase 3: Core API Routes (CRUD + Business Logic)

**Status:** ✅ COMPLETE (07/06/2026)
**Goal:** All REST endpoints functional for floors, rooms, tenants, complaints, services, meals, enquiries, dashboard, and app-config. Zod validation, proper error handling, pagination, role-based access.
**Estimated:** 4-5 days
**Depends On:** Phase 2 (all models)
**Package Manager:** bun

---

## Architecture Decisions

| Decision           | Choice                                                                                 | Rationale                                                     |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Validation         | `@hono/zod-validator` middleware with `zValidator('json', schema)`                     | Declarative, auto-400 on failure, typed `c.req.valid('json')` |
| Pagination         | Query params `page`, `limit`, `sort`, `order` → Mongoose `.skip()/.limit()/.sort()`    | Standard REST pattern                                         |
| File uploads       | Multipart via Hono `c.req.parseBody()` + Cloudinary SDK                                | No extra middleware needed with bun's native FormData         |
| Route organization | One file per resource, `Hono()` instance exported                                      | Each file self-contained, composed in index.ts                |
| Error responses    | Consistent `{ success: false, error: { code, message, details? } }`                    | Frontend can rely on error shape for toast messages           |
| Transactions       | Mongoose `session.withTransaction()` for multi-document operations (tenant onboarding) | Atomicity for bed assignment + user creation                  |

---

## Step 3.0: Shared Route Utilities

### File: `apps/api/src/lib/routeUtils.ts`

```typescript
import type { Context } from 'hono';
import { z } from 'zod';

// ── Pagination Parser ───────────────────────────────────
export function parsePagination(c: Context) {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
  const sort = c.req.query('sort') || 'createdAt';
  const order = c.req.query('order') === 'asc' ? 'asc' : 'desc';

  return { page, limit, sort, order, skip: (page - 1) * limit };
}

// ── Paginated Response Builder ──────────────────────────
export async function paginatedResponse<T>(
  model: any,
  filter: Record<string, unknown>,
  { page, limit, sort, order, skip }: ReturnType<typeof parsePagination>,
  populate?: string | string[],
) {
  const [data, total] = await Promise.all([
    model
      .find(filter)
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .populate(populate || [])
      .lean(),
    model.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Safe ObjectId Parser ────────────────────────────────
export function parseId(id: string): string | null {
  return /^[a-f\d]{24}$/i.test(id) ? id : null;
}

// ── Error Helpers ───────────────────────────────────────
export function notFound(c: Context, resource: string) {
  return c.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: `${resource} not found` },
    },
    404,
  );
}

export function badRequest(c: Context, message: string, code = 'BAD_REQUEST') {
  return c.json(
    {
      success: false,
      error: { code, message },
    },
    400,
  );
}

export function conflict(c: Context, message: string, code = 'CONFLICT') {
  return c.json(
    {
      success: false,
      error: { code, message },
    },
    409,
  );
}
```

---

## Step 3.1: Floor Routes

### File: `apps/api/src/routes/floors.ts`

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard, adminOnly } from '../middleware/auth.js';
import { Floor } from '../models/floor.js';
import { parsePagination, paginatedResponse, notFound, parseId } from '../lib/routeUtils.js';

const floors = new Hono();

// ── Schemas ─────────────────────────────────────────────
const createFloorSchema = z.object({
  floorNumber: z.number().int().min(0),
  label: z.string().min(1).max(50),
  totalRooms: z.number().int().min(1).max(50),
  amenities: z
    .object({
      washingMachines: z.number().int().min(0).max(5).optional(),
      fridges: z.number().int().min(0).max(5).optional(),
    })
    .optional(),
});

const updateFloorSchema = createFloorSchema.partial();

// ── GET /floors ─────────────────────────────────────────
floors.get('/', authGuard, async (c) => {
  const pagination = parsePagination(c);
  const floors = await Floor.find().sort({ floorNumber: 1 }).lean();

  return c.json({ success: true, data: floors });
});

// ── GET /floors/:id ─────────────────────────────────────
floors.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid floor ID');

  const floor = await Floor.findById(id).lean();
  if (!floor) return notFound(c, 'Floor');

  return c.json({ success: true, data: floor });
});

// ── POST /floors ────────────────────────────────────────
floors.post('/', authGuard, adminOnly, zValidator('json', createFloorSchema), async (c) => {
  const body = c.req.valid('json');

  try {
    const floor = await Floor.create(body);
    return c.json({ success: true, data: floor }, 201);
  } catch (err: any) {
    if (err.code === 11000) {
      return conflict(c, `Floor number ${body.floorNumber} already exists`, 'DUPLICATE_FLOOR');
    }
    throw err;
  }
});

// ── PUT /floors/:id ─────────────────────────────────────
floors.put('/:id', authGuard, adminOnly, zValidator('json', updateFloorSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid floor ID');

  const body = c.req.valid('json');

  try {
    const floor = await Floor.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!floor) return notFound(c, 'Floor');
    return c.json({ success: true, data: floor });
  } catch (err: any) {
    if (err.code === 11000) {
      return conflict(c, 'Floor number already taken', 'DUPLICATE_FLOOR');
    }
    throw err;
  }
});

// ── DELETE /floors/:id ──────────────────────────────────
floors.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid floor ID');

  // Check for rooms on this floor
  const { Room } = await import('../models/room.js');
  const roomCount = await Room.countDocuments({ floorId: id });
  if (roomCount > 0) {
    return conflict(c, `Cannot delete floor with ${roomCount} rooms. Remove rooms first.`);
  }

  const floor = await Floor.findByIdAndDelete(id);
  if (!floor) return notFound(c, 'Floor');
  return c.json({ success: true, data: { message: 'Floor deleted' } });
});

export { floors as floorRoutes };
```

---

## Step 3.2: Room Routes

### File: `apps/api/src/routes/rooms.ts`

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard, adminOnly } from '../middleware/auth.js';
import { Room } from '../models/room.js';
import { Floor } from '../models/floor.js';
import {
  parsePagination,
  paginatedResponse,
  notFound,
  badRequest,
  conflict,
  parseId,
} from '../lib/routeUtils.js';

const rooms = new Hono();

const createRoomSchema = z.object({
  roomNumber: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase()),
  floorId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid floor ID'),
  sharingType: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  monthlyRent: z.number().int().min(1000).max(50000),
  description: z.string().max(500).optional(),
  photos: z.array(z.string().url()).optional(),
});

const updateRoomSchema = createRoomSchema.partial();

// ── GET /rooms ──────────────────────────────────────────
rooms.get('/', authGuard, async (c) => {
  const pagination = parsePagination(c);
  const filter: Record<string, unknown> = {};

  if (c.req.query('floorId')) filter.floorId = c.req.query('floorId');
  if (c.req.query('sharingType')) filter.sharingType = Number(c.req.query('sharingType'));
  if (c.req.query('isActive') !== undefined) filter.isActive = c.req.query('isActive') === 'true';

  const result = await paginatedResponse(Room, filter, pagination, 'floor');
  return c.json({ success: true, ...result });
});

// ── GET /rooms/available ────────────────────────────────
rooms.get('/available', authGuard, async (c) => {
  const rooms = await Room.find({
    isActive: true,
    'beds.isOccupied': false,
  })
    .populate('floor')
    .lean();

  return c.json({ success: true, data: rooms });
});

// ── GET /rooms/:id ──────────────────────────────────────
rooms.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid room ID');

  const room = await Room.findById(id).populate('floor').lean();
  if (!room) return notFound(c, 'Room');

  // Populate tenant names on beds
  const { Tenant } = await import('../models/tenant.js');
  const tenantIds = room.beds.filter((b) => b.tenantId).map((b) => b.tenantId);
  if (tenantIds.length > 0) {
    const tenants = await Tenant.find({ _id: { $in: tenantIds } })
      .populate('user', 'name phone profilePhoto')
      .lean();
    const tenantMap = new Map(tenants.map((t) => [t._id.toString(), t]));
    for (const bed of room.beds) {
      if (bed.tenantId) {
        const tenant = tenantMap.get(bed.tenantId.toString());
        if (tenant) bed.tenantName = (tenant.user as any)?.name || 'Unknown';
      }
    }
  }

  return c.json({ success: true, data: room });
});

// ── POST /rooms ─────────────────────────────────────────
rooms.post('/', authGuard, adminOnly, zValidator('json', createRoomSchema), async (c) => {
  const body = c.req.valid('json');

  // Verify floor exists
  const floor = await Floor.findById(body.floorId);
  if (!floor) return notFound(c, 'Floor');

  // Auto-generate beds
  const beds = (Room as any).generateBeds(body.sharingType);

  try {
    const room = await Room.create({ ...body, beds });
    return c.json({ success: true, data: room }, 201);
  } catch (err: any) {
    if (err.code === 11000) {
      return conflict(c, `Room ${body.roomNumber} already exists`, 'DUPLICATE_ROOM');
    }
    throw err;
  }
});

// ── PUT /rooms/:id ──────────────────────────────────────
rooms.put('/:id', authGuard, adminOnly, zValidator('json', updateRoomSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid room ID');

  const body = c.req.valid('json');
  const room = await Room.findByIdAndUpdate(id, body, { new: true, runValidators: true }).lean();
  if (!room) return notFound(c, 'Room');
  return c.json({ success: true, data: room });
});

// ── DELETE /rooms/:id ───────────────────────────────────
rooms.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid room ID');

  const { Tenant } = await import('../models/tenant.js');
  const activeTenants = await Tenant.countDocuments({ roomId: id, isActive: true });
  if (activeTenants > 0) {
    return conflict(c, `Cannot delete room with ${activeTenants} active tenants`);
  }

  const room = await Room.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!room) return notFound(c, 'Room');
  return c.json({ success: true, data: { message: 'Room deactivated' } });
});

export { rooms as roomRoutes };
```

---

## Step 3.3: Tenant Routes (Multi-Step Onboarding)

### File: `apps/api/src/routes/tenants.ts`

Key route: `POST /tenants` — multi-step onboarding in a single transaction:

1. Validate all inputs (Zod)
2. Check room exists, bed is vacant
3. Start Mongoose session
4. Create User document (password = random, send welcome email)
5. Create Tenant document
6. Update Room bed (isOccupied=true, tenantId)
7. Increment Room occupancyCount
8. Commit transaction

On any failure → rollback entire transaction.

```typescript
// ── POST /tenants (onboarding) ──────────────────────────
tenants.post('/', authGuard, adminOnly, zValidator('json', createTenantSchema), async (c) => {
  const body = c.req.valid('json');
  const session = await mongoose.startSession();

  try {
    let result: any;

    await session.withTransaction(async () => {
      // 1. Find room & check bed
      const room = await Room.findById(body.roomId).session(session);
      if (!room) throw new AppError('Room not found', 404);
      if (!room.isActive) throw new AppError('Room is inactive', 400);

      const bed = room.beds.find((b) => b.bedId === body.bedId);
      if (!bed) throw new AppError(`Bed ${body.bedId} not found in room`, 400);
      if (bed.isOccupied) throw new AppError(`Bed ${body.bedId} is already occupied`, 409);

      // 2. Create user
      const tempPassword = crypto.randomBytes(8).toString('hex');
      const [user] = await User.create(
        [
          {
            name: body.name,
            email: body.email,
            phone: body.phone,
            passwordHash: tempPassword,
            role: 'tenant',
          },
        ],
        { session },
      );

      // 3. Create tenant
      const [tenant] = await Tenant.create(
        [
          {
            userId: user._id,
            roomId: body.roomId,
            bedId: body.bedId,
            moveInDate: body.moveInDate,
            monthlyRent: body.monthlyRent,
            depositPaid: body.depositPaid || 0,
            emergencyContact: body.emergencyContact,
            documents: {
              aadhaarUrl: body.aadhaarUrl,
              photoUrl: body.photoUrl,
            },
          },
        ],
        { session },
      );

      // 4. Update bed
      bed.isOccupied = true;
      bed.tenantId = tenant._id;
      bed.tenantName = body.name;
      room.occupancyCount = room.beds.filter((b) => b.isOccupied).length;
      await room.save({ session });

      // 5. Send welcome email (async, outside transaction)
      result = { tenant, user, tempPassword };
    });

    // Send welcome email (don't block response)
    sendWelcomeEmail(body.email, body.name, result!.tempPassword).catch((err) =>
      logger.error({ err }, 'Welcome email failed'),
    );

    return c.json(
      {
        success: true,
        data: {
          tenant: result!.tenant,
          message: 'Tenant onboarded. Welcome email sent with temporary password.',
        },
      },
      201,
    );
  } catch (err) {
    if (err instanceof AppError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status,
      );
    }
    throw err;
  } finally {
    session.endSession();
  }
});
```

### Other Tenant Endpoints

| Method | Path                      | Auth       | Description                                               |
| ------ | ------------------------- | ---------- | --------------------------------------------------------- |
| GET    | `/tenants`                | admin      | Paginated, filterable (isActive, roomId, floorId, search) |
| GET    | `/tenants/:id`            | admin/self | Full detail with populated user + room                    |
| PUT    | `/tenants/:id`            | admin      | Update rent, deposit, emergency contact                   |
| POST   | `/tenants/:id/checkout`   | admin      | Set moveOutDate, free bed, deactivate user                |
| POST   | `/tenants/:id/documents`  | admin/self | Upload KYC docs to Cloudinary                             |
| GET    | `/tenants/:id/payments`   | admin/self | Payment history                                           |
| GET    | `/tenants/:id/complaints` | admin/self | Complaint history                                         |
| GET    | `/tenants/:id/invoices`   | admin/self | Invoice history                                           |

---

## Step 3.4-3.12: Remaining Route Files

### Complaint Routes (`/complaints`)

- POST (tenant) — multipart with Cloudinary upload, priority validation, SSE emit
- GET (admin) — paginated, filterable by status/category/priority/room/date range
- GET `/my` (tenant) — own complaints
- GET `/:id` — detail with photos + activity timeline
- PUT `/:id/status` (admin) — status update + adminNotes, SSE emit, notification

### Service Status Routes (`/services`)

- GET (all auth) — filter by floorId, populate floor
- PUT `/:id` (tenant can set degraded/down, admin can set any) — SSE emit on change
- GET `/summary` — counts by status

### Meal Feedback Routes (`/meals`)

- POST `/feedback` (tenant) — upsert per tenant+date+mealType
- GET `/feedback` (admin) — paginated, filter by date/mealType
- GET `/feedback/my` (tenant) — own recent feedback
- GET `/feedback/summary` (admin) — aggregated ratings by meal+date

### Daily Menu Routes (`/menus`)

- GET `/today` (all auth) — today's menu
- GET (admin/all auth) — date range query for menu history
- PUT `/:date` (admin) — upsert breakfast/lunch/dinner items for a date
- DELETE `/:date` (admin) — clear menu for a date

### Notice Board Routes (`/notices`)

- POST (admin) — create notice with targetType and optional targetIds
- GET (all auth) — visible notices for current user, pinned first
- GET `/admin` (admin) — paginated full notice list
- PUT `/:id` (admin) — edit title/body/pinned/targeting
- DELETE `/:id` (admin) — archive or remove notice

### Visitor Routes (`/visitors`)

- POST (tenant) — pre-register visitor
- GET (admin) — paginated gate register
- GET `/my` (tenant) — own visitor requests
- POST `/:id/approve` (admin) — approve visitor
- POST `/:id/arrive` (admin/gate) — mark arrived
- POST `/:id/depart` (admin/gate) — mark departed

### Asset Routes (`/assets`)

- GET (admin) — paginated/filterable inventory
- POST (admin) — create asset
- PUT `/:id` (admin) — update quantity/status/location/service dates
- GET `/low-stock` (admin) — assets where quantity is less than or equal to threshold
- DELETE `/:id` (admin) — retire asset, do not hard delete

### Attendance Routes (`/attendance`) - gated by `features.attendanceEnabled`

- GET `/today` (admin) — present/absent/on-leave/not-returned snapshot
- GET (admin) — filter by tenant/date/status
- POST `/check-in` (tenant/admin) — manual/app/QR check-in
- POST `/check-out` (tenant/admin) — manual/app/QR check-out
- POST `/manual` (admin) — create or update a record for a tenant/date
- GET `/my` (tenant) — own attendance history
- When disabled, all routes return `FEATURE_DISABLED` and no navigation points to them

### Leave Routes (`/leaves`) - gated by `features.attendanceEnabled`

- POST (tenant) — create leave request
- GET (admin) — filter by status/date/tenant
- GET `/my` (tenant) — own leave history
- PUT `/:id/approve` (admin) — approve and mark attendance as on_leave for date range
- PUT `/:id/reject` (admin) — reject with optional adminNotes

### Guardian Routes (`/guardians`)

- POST (admin) — create guardian user and link to tenant
- GET (admin) — paginated list, filter by tenantId/isActive/search
- GET `/me/ward` (guardian) — read-only ward profile, room, invoices, notices, payments
- GET `/me/ward/attendance` (guardian) — attendance history only when attendanceEnabled is true
- PUT `/:id` (admin) — update guardian details
- DELETE `/:id` (admin) — deactivate guardian access

### Enquiry Routes (`/enquiries`)

- POST (public, no auth, rate limited 3/hr/IP) — SSE emit to admin
- GET (admin) — paginated, filterable
- PUT `/:id/status` (admin) — update status + notes

### Dashboard Stats Route

- GET `/dashboard/stats` (admin) — MongoDB aggregation pipeline for:
  - Occupancy (total/occupied/vacant/rate, by floor, by sharing)
  - Revenue (current month collection, last 6 months trend)
  - Complaints (open/inProgress/urgent counts)
  - Services (operational/degraded/down counts)
  - Enquiries (new today, total pending)
  - Optional attendance summary when attendanceEnabled is true
  - Asset low-stock/service reminders

### AppConfig Routes (`/app-config`)

- GET (public) — returns public config (excludes GST/PAN)
- PUT (admin) — upsert singleton, invalidate cache

---

## Step 3.10: Wire Routes in Index

### Update `apps/api/src/index.ts`

```typescript
import { authRoutes } from './routes/auth.js';
import { floorRoutes } from './routes/floors.js';
import { roomRoutes } from './routes/rooms.js';
import { tenantRoutes } from './routes/tenants.js';
import { complaintRoutes } from './routes/complaints.js';
import { serviceRoutes } from './routes/services.js';
import { mealRoutes } from './routes/meals.js';
import { enquiryRoutes } from './routes/enquiries.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { appConfigRoutes } from './routes/appConfig.js';
import { menuRoutes } from './routes/menus.js';
import { noticeRoutes } from './routes/notices.js';
import { visitorRoutes } from './routes/visitors.js';
import { assetRoutes } from './routes/assets.js';
import { attendanceRoutes } from './routes/attendance.js';
import { leaveRoutes } from './routes/leaves.js';
import { guardianRoutes } from './routes/guardians.js';

// Inside the api Hono instance:
api.route('/auth', authRoutes);
api.route('/floors', floorRoutes);
api.route('/rooms', roomRoutes);
api.route('/tenants', tenantRoutes);
api.route('/complaints', complaintRoutes);
api.route('/services', serviceRoutes);
api.route('/meals', mealRoutes);
api.route('/enquiries', enquiryRoutes);
api.route('/dashboard', dashboardRoutes);
api.route('/app-config', appConfigRoutes);
api.route('/menus', menuRoutes);
api.route('/notices', noticeRoutes);
api.route('/visitors', visitorRoutes);
api.route('/assets', assetRoutes);
api.route('/attendance', attendanceRoutes);
api.route('/leaves', leaveRoutes);
api.route('/guardians', guardianRoutes);
```

---

## Verification Checklist

### Floors

- [ ] `GET /floors` → returns array sorted by floorNumber
- [ ] `POST /floors` with valid body → 201
- [ ] `POST /floors` with duplicate floorNumber → 409
- [ ] `PUT /floors/:id` with valid data → 200
- [ ] `DELETE /floors/:id` with no rooms → 200
- [ ] `DELETE /floors/:id` with existing rooms → 409

### Rooms

- [ ] `GET /rooms` → paginated, populated floor
- [ ] `GET /rooms/available` → only rooms with vacant beds
- [ ] `POST /rooms` → auto-generates beds, 201
- [ ] `GET /rooms/:id` → populated tenant names on beds
- [ ] `DELETE /rooms/:id` with active tenants → 409

### Tenants

- [ ] `POST /tenants` → creates User + Tenant + updates bed atomically
- [ ] `POST /tenants` with occupied bed → 409
- [ ] `POST /tenants/checkout` → frees bed, deactivates user
- [ ] Transaction rollback on User create failure → bed not marked occupied

### Complaints

- [ ] `POST /complaints` with photo → uploads to Cloudinary, saves URL
- [ ] `PUT /complaints/:id/status` → emits SSE event, sends notification

### Dashboard

- [ ] `GET /dashboard/stats` → all KPIs returned in single response
- [ ] Empty database → all zeros, no errors

### General

- [ ] All routes return `{ success: true, data: ... }` on success
- [ ] All routes return `{ success: false, error: { code, message } }` on failure
- [ ] Pagination: `page`, `limit`, `totalPages` in paginated responses
- [ ] Unauthenticated requests → 401
- [ ] Tenant accessing admin routes → 403
- [ ] Invalid ObjectId in params → 400
- [ ] Zod validation failures → 400 with field-level details

---

## Edge Cases Summary

| Scenario                                              | Handling                                      |
| ----------------------------------------------------- | --------------------------------------------- |
| Pagination beyond data                                | Returns empty array, correct total/totalPages |
| Sort by non-existent field                            | Mongoose ignores, defaults to natural order   |
| Filter with no results                                | Empty array, not 404                          |
| Concurrent bed assignment                             | Mongoose transaction + session prevents race  |
| Room deleted after tenant query but before assignment | Transaction catches, rolls back               |
| Upload >5MB file                                      | Cloudinary rejects, error returned to client  |
| Invalid Cloudinary credentials                        | Returns 500 with requestId for debugging      |
| Dashboard on fresh install                            | All zeros, no division-by-zero errors         |
| AppConfig GET without config document                 | Returns defaults from env vars                |
| Enquiry spam                                          | Rate limited 3/hr/IP, returns 429             |
