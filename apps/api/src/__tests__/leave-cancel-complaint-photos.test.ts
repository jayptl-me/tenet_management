/**
 * Leave cancel + complaint photos against shipped Hono routes.
 * Global setup afterEach wipes all collections, so fixtures seed per test.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { User } from '../models/user.js';
import { AppConfig } from '../models/appConfig.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { LeaveApplication } from '../models/leaveApplication.js';
import { Complaint } from '../models/complaint.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import leaveRoutes from '../routes/leaves.js';
import complaintRoutes from '../routes/complaints.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;
const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<{ _id: unknown }>;
const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<{ _id: unknown }>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<{ _id: unknown }>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (
  doc: AnyDoc,
) => Promise<{ _id: unknown }>;
const leaveCreate = LeaveApplication.create.bind(LeaveApplication) as unknown as (
  doc: AnyDoc,
) => Promise<{ _id: unknown; status: string }>;

let app: Hono;
let tenantToken: string;
let adminToken: string;
let tenantId: string;
let roomId: string;

async function jsonReq(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; body: Json }> {
  const res = await app.request(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: Json;
  try {
    parsed = text ? (JSON.parse(text) as Json) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: parsed };
}

async function seedFixtures(): Promise<void> {
  await AppConfig.findOneAndUpdate(
    {},
    {
      $set: {
        features: {
          attendanceEnabled: true,
          laundryEnabled: true,
          messFeedbackEnabled: true,
          visitorManagementEnabled: true,
          guardianPortalEnabled: true,
          noticeBoardEnabled: true,
          emergencyAlertsEnabled: true,
        },
      },
    },
    { upsert: true },
  );

  const stamp = Date.now();
  const adminUser = await userCreate({
    name: 'Admin LP',
    email: `admin-lp-${stamp}@test.local`,
    phone: `+9197${String(stamp).slice(-8)}`,
    role: 'admin',
    passwordHash: 'password12345',
    isActive: true,
  });
  const tenantUser = await userCreate({
    name: 'Tenant LP',
    email: `tenant-lp-${stamp}@test.local`,
    phone: `+9198${String(stamp).slice(-8)}`,
    role: 'tenant',
    passwordHash: 'password12345',
    isActive: true,
  });

  const floor = await floorCreate({
    floorNumber: 1 + (stamp % 90),
    label: `LP Floor ${stamp}`,
    totalRooms: 1,
  });
  const room = await roomCreate({
    roomNumber: `LP${String(stamp).slice(-5)}`,
    floorId: floor._id,
    sharingType: 2,
    monthlyRent: 8000,
    beds: Room.generateBeds(2),
    isActive: true,
  });
  roomId = String(room._id);

  const tenant = await tenantCreate({
    userId: tenantUser._id,
    roomId: room._id,
    bedId: 'A',
    moveInDate: new Date(),
    monthlyRent: 8000,
    depositPaid: 8000,
    isActive: true,
  });
  tenantId = String(tenant._id);

  adminToken = await signAccessToken({
    sub: String(adminUser._id),
    role: 'admin',
    email: `admin-lp-${stamp}@test.local`,
  });
  tenantToken = await signAccessToken({
    sub: String(tenantUser._id),
    role: 'tenant',
    email: `tenant-lp-${stamp}@test.local`,
    tenantId,
  });
}

describe('Leave cancel + complaint photos (shipped routes)', () => {
  beforeAll(() => {
    app = new Hono();
    app.onError(globalErrorHandler);
    const api = new Hono().basePath('/api/v1');
    api.route('/leaves', leaveRoutes);
    api.route('/complaints', complaintRoutes);
    app.route('/', api);
  });

  beforeEach(async () => {
    await seedFixtures();
  });

  it('tenant cancels own pending leave via POST /leaves/:id/cancel', async () => {
    const leave = await leaveCreate({
      tenantId,
      fromDate: '2026-08-01',
      toDate: '2026-08-03',
      reason: 'Family visit',
      status: 'pending',
    });

    const res = await jsonReq('POST', `/api/v1/leaves/${String(leave._id)}/cancel`, tenantToken, {});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as Json;
    expect(data.status).toBe('cancelled');

    const doc = await LeaveApplication.findById(leave._id).lean();
    expect(doc?.status).toBe('cancelled');
  });

  it('rejects cancel of non-pending leave with LEAVE_NOT_PENDING', async () => {
    const leave = await leaveCreate({
      tenantId,
      fromDate: '2026-08-10',
      toDate: '2026-08-12',
      reason: 'Already approved',
      status: 'approved',
    });

    const res = await jsonReq('POST', `/api/v1/leaves/${String(leave._id)}/cancel`, tenantToken, {});
    expect(res.status).toBe(400);
    expect((res.body.error as Json)?.code).toBe('LEAVE_NOT_PENDING');
  });

  it('creates complaint with photo URLs and appends more via POST /photos', async () => {
    const create = await jsonReq('POST', '/api/v1/complaints', tenantToken, {
      roomId,
      category: 'wifi',
      title: 'Router offline in room',
      description: 'No connectivity since morning hours today.',
      priority: 'high',
      photos: ['https://cdn.example.com/c1.jpg'],
    });
    expect(create.status).toBe(201);
    const created = create.body.data as Json;
    expect(Array.isArray(created.photos)).toBe(true);
    expect((created.photos as string[])[0]).toBe('https://cdn.example.com/c1.jpg');

    const id = String(created._id ?? created.id);
    const append = await jsonReq('POST', `/api/v1/complaints/${id}/photos`, tenantToken, {
      photos: ['https://cdn.example.com/c2.jpg'],
    });
    expect(append.status).toBe(200);
    const updated = append.body.data as Json;
    expect((updated.photos as string[]).length).toBe(2);
  });

  it('rejects invalid photo URL on create', async () => {
    const create = await jsonReq('POST', '/api/v1/complaints', tenantToken, {
      roomId,
      category: 'wifi',
      title: 'Bad photo url case',
      description: 'Should fail validation for photos field.',
      priority: 'low',
      photos: ['not-a-url'],
    });
    expect(create.status).toBe(400);
  });

  /**
   * Client path: admin kanban uses PUT /complaints/:id/status (complaints/page.tsx).
   * Resolve then reopen must clear resolvedAt (shared complaintStatusPatch).
   */
  it('kanban PUT /:id/status resolve then reopen clears resolvedAt', async () => {
    const create = await jsonReq('POST', '/api/v1/complaints', tenantToken, {
      roomId,
      category: 'water',
      title: 'Low water pressure test',
      description: 'Pressure dropped during morning hours for testing.',
      priority: 'medium',
    });
    expect(create.status).toBe(201);
    const id = String((create.body.data as Json)._id ?? (create.body.data as Json).id);

    const resolve = await jsonReq('PUT', `/api/v1/complaints/${id}/status`, adminToken, {
      status: 'resolved',
      adminNotes: 'Fixed valve',
    });
    expect(resolve.status).toBe(200);
    const resolved = resolve.body.data as Json;
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeTruthy();

    const reopen = await jsonReq('PUT', `/api/v1/complaints/${id}/status`, adminToken, {
      status: 'open',
    });
    expect(reopen.status).toBe(200);
    const reopened = reopen.body.data as Json;
    expect(reopened.status).toBe('open');
    expect(reopened.resolvedAt).toBeNull();

    const db = await Complaint.findById(id).lean();
    expect(db?.status).toBe('open');
    expect(db?.resolvedAt ?? null).toBeNull();
  });
});
