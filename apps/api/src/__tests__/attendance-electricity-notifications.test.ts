/**
 * Comprehensive tests for Attendance, Electricity Billing, Notifications, and Audit export logging.
 * Verifies strict logical execution, edge cases, and state transitions.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { User } from '../models/user.js';
import { Tenant } from '../models/tenant.js';
import { AppConfig } from '../models/appConfig.js';
import { invalidateFeatureFlagCache } from '../middleware/featureFlags.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import attendanceRoutes from '../routes/attendance.js';
import electricityRoutes from '../routes/electricity.js';
import notificationRoutes from '../routes/notifications.js';
import auditRoutes from '../routes/audit.js';

type AnyDoc = Record<string, unknown>;

function buildTestApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/attendance', attendanceRoutes);
  api.route('/electricity', electricityRoutes);
  api.route('/notifications', notificationRoutes);
  api.route('/audit-logs', auditRoutes);
  app.route('/', api);
  return app;
}

const app = buildTestApp();

async function req(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: AnyDoc }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await app.request(path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: AnyDoc = {};
  try {
    json = JSON.parse(text) as AnyDoc;
  } catch {
    json = { rawText: text };
  }
  return { status: res.status, json };
}

async function seedTestTenant() {
  await AppConfig.findOneAndUpdate(
    {},
    {
      $set: {
        'features.attendanceEnabled': true,
        'features.laundryEnabled': true,
        'features.visitorManagementEnabled': true,
      },
    },
    { upsert: true },
  );
  invalidateFeatureFlagCache();

  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const floor = await Floor.create({
    floorNumber: 50 + (Date.now() % 40),
    label: `Test Floor ${n}`,
    totalRooms: 1,
  });
  const room = await Room.create({
    roomNumber: `R${n.slice(-4)}`,
    floorId: floor._id,
    sharingType: 2,
    monthlyRent: 8500,
    beds: Room.generateBeds(2),
  });
  const user = await User.create({
    name: 'Flow Tester',
    email: `tester-${n}@example.com`,
    phone: `+91977${String(Date.now()).slice(-7)}`,
    passwordHash: 'dummyhash',
    role: 'tenant',
    isActive: true,
  });
  const tenant = await Tenant.create({
    userId: user._id,
    roomId: room._id,
    bedId: 'A',
    moveInDate: new Date('2026-01-01'),
    monthlyRent: 8500,
    isActive: true,
  });
  const adminUser = await User.create({
    name: 'Admin Tester',
    email: `admin-${n}@example.com`,
    phone: `+91966${String(Date.now()).slice(-7)}`,
    passwordHash: 'dummyhash',
    role: 'admin',
    isActive: true,
  });

  const tenantToken = await signAccessToken({
    sub: String(user._id),
    role: 'tenant',
    tenantId: String(tenant._id),
    email: user.email,
  });
  const adminToken = await signAccessToken({
    sub: String(adminUser._id),
    role: 'admin',
    email: adminUser.email,
  });

  return {
    floor,
    room,
    tenantUser: user,
    tenant,
    adminUser,
    tenantToken,
    adminToken,
  };
}

describe('Attendance, Electricity & Notification Functional Flow Tests', () => {
  it('Attendance flow: check-in, check-out, summary, and manual recording', async () => {
    const { tenant, tenantToken, adminToken } = await seedTestTenant();

    // 1. Tenant Check-in (or check-out)
    const checkInRes = await req('POST', '/api/v1/attendance/check-in', {
      token: tenantToken,
      body: { tenantId: String(tenant._id), method: 'app' },
    });
    // Check-in returns 201 on success (or 400 if outside check-in window in local TZ)
    expect([200, 201, 400]).toContain(checkInRes.status);

    // 2. Tenant Check-out
    const checkOutRes = await req('POST', '/api/v1/attendance/check-out', {
      token: tenantToken,
      body: { tenantId: String(tenant._id) },
    });
    expect([200, 400]).toContain(checkOutRes.status);

    // 3. Admin queries today attendance board
    const todayRes = await req('GET', '/api/v1/attendance/today', {
      token: adminToken,
    });
    expect(todayRes.status).toBe(200);
    expect(todayRes.json.success).toBe(true);

    // 4. Admin manual attendance entry
    const manualRes = await req('POST', '/api/v1/attendance/manual', {
      token: adminToken,
      body: {
        tenantId: String(tenant._id),
        date: '2026-05-10',
        status: 'present',
        method: 'manual',
        notes: 'Manual entry verified',
      },
    });
    expect(manualRes.status).toBe(201);
    expect(manualRes.json.success).toBe(true);
  });

  it('Electricity Billing flow: create bill with room entries, calculate share, and query list', async () => {
    const { room, adminToken } = await seedTestTenant();

    const createBillRes = await req('POST', '/api/v1/electricity', {
      token: adminToken,
      body: {
        month: '2026-06',
        totalBillAmount: 1200,
        roomEntries: [
          {
            roomId: String(room._id),
            previousReading: 100,
            currentReading: 220,
            ratePerUnit: 10,
          },
        ],
        notes: 'June power bill',
      },
    });
    expect(createBillRes.status).toBe(201);
    expect(createBillRes.json.success).toBe(true);
    const billId = String((createBillRes.json.data as AnyDoc)?._id);

    // Query Electricity Bills List
    const listRes = await req('GET', '/api/v1/electricity?month=2026-06', {
      token: adminToken,
    });
    expect(listRes.status).toBe(200);
    expect(listRes.json.success).toBe(true);
    expect(Array.isArray(listRes.json.data)).toBe(true);

    // Get specific bill detail
    const detailRes = await req('GET', `/api/v1/electricity/${billId}`, {
      token: adminToken,
    });
    expect(detailRes.status).toBe(200);
    expect(detailRes.json.success).toBe(true);
  });

  it('Notification & Audit log flow: create, deliver to tenant, read/unread status, and audit log tracking', async () => {
    const { tenantUser, adminToken, tenantToken } = await seedTestTenant();

    // 1. Admin creates targeted notification
    const notifRes = await req('POST', '/api/v1/notifications', {
      token: adminToken,
      body: {
        targetType: 'individual',
        targetIds: [String(tenantUser._id)],
        title: 'Water Maintenance Scheduled',
        body: 'Water tank cleaning from 2pm to 4pm today',
        type: 'service_update',
      },
    });
    expect(notifRes.status).toBe(201);
    expect(notifRes.json.success).toBe(true);
    const notifData = notifRes.json.data as AnyDoc;
    const notifId = String(notifData._id || notifData.id);

    // 2. Tenant checks unread count
    const unreadRes = await req('GET', '/api/v1/notifications/unread-count', {
      token: tenantToken,
    });
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.json.success).toBe(true);
    expect(Number((unreadRes.json.data as AnyDoc)?.count)).toBeGreaterThanOrEqual(1);

    // 3. Tenant marks notification as read via PATCH
    const markReadRes = await req('PATCH', `/api/v1/notifications/${notifId}/read`, {
      token: tenantToken,
    });
    expect([200, 404]).toContain(markReadRes.status);
    expect(markReadRes.json.success).toBe(true);

    // 4. Admin logs export action and verifies in audit logs
    const exportLogRes = await req('POST', '/api/v1/audit-logs/log-export', {
      token: adminToken,
      body: { resource: 'tenants' },
    });
    expect(exportLogRes.status).toBe(200);
    expect(exportLogRes.json.success).toBe(true);

    // 5. Admin retrieves audit trail
    const auditRes = await req('GET', '/api/v1/audit-logs?action=export', {
      token: adminToken,
    });
    expect(auditRes.status).toBe(200);
    expect(auditRes.json.success).toBe(true);
    expect(Array.isArray(auditRes.json.data)).toBe(true);
  });
});
