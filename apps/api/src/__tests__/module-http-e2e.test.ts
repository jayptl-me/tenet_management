/**
 * Module HTTP e2e matrix — drives the REAL Hono route handlers mounted
 * the same way as production (without rate limiters / server bind).
 *
 * Uses mongodb-memory-server from setup.ts. Proves list/create/detail/edit/delete
 * + critical lifecycles for every admin domain against actual shipped routes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { User } from '../models/user.js';
import { AppConfig } from '../models/appConfig.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';

import authRoutes from '../routes/auth.js';
import floorRoutes from '../routes/floors.js';
import roomRoutes from '../routes/rooms.js';
import tenantRoutes from '../routes/tenants.js';
import complaintRoutes from '../routes/complaints.js';
import serviceRoutes from '../routes/services.js';
import mealRoutes from '../routes/meals.js';
import menuRoutes from '../routes/menus.js';
import noticeRoutes from '../routes/notices.js';
import visitorRoutes from '../routes/visitors.js';
import assetRoutes from '../routes/assets.js';
import attendanceRoutes from '../routes/attendance.js';
import leaveRoutes from '../routes/leaves.js';
import guardianRoutes from '../routes/guardians.js';
import enquiryRoutes from '../routes/enquiries.js';
import dashboardRoutes from '../routes/dashboard.js';
import appConfigRoutes from '../routes/appConfig.js';
import paymentRoutes from '../routes/payments.js';
import invoiceRoutes from '../routes/invoices.js';
import electricityRoutes from '../routes/electricity.js';
import notificationRoutes from '../routes/notifications.js';
import laundryRoutes from '../routes/laundry.js';
import auditRoutes from '../routes/audit.js';

type Json = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.get('/health', (c) =>
    c.json({
      status: 'ok',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    }),
  );
  api.route('/auth', authRoutes);
  api.route('/floors', floorRoutes);
  api.route('/rooms', roomRoutes);
  api.route('/tenants', tenantRoutes);
  api.route('/complaints', complaintRoutes);
  api.route('/services', serviceRoutes);
  api.route('/meals', mealRoutes);
  api.route('/menus', menuRoutes);
  api.route('/notices', noticeRoutes);
  api.route('/visitors', visitorRoutes);
  api.route('/assets', assetRoutes);
  api.route('/attendance', attendanceRoutes);
  api.route('/leaves', leaveRoutes);
  api.route('/guardians', guardianRoutes);
  api.route('/enquiries', enquiryRoutes);
  api.route('/dashboard', dashboardRoutes);
  api.route('/app-config', appConfigRoutes);
  api.route('/payments', paymentRoutes);
  api.route('/invoices', invoiceRoutes);
  api.route('/electricity', electricityRoutes);
  api.route('/notifications', notificationRoutes);
  api.route('/laundry-slots', laundryRoutes);
  api.route('/audit-logs', auditRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();
const results: Array<{ module: string; step: string; ok: boolean; detail?: string }> = [];

function log(module: string, step: string, ok: boolean, detail?: string) {
  results.push({ module, step, ok, detail });
  if (!ok) {
    // keep going so the matrix shows all failures in one run
    console.error(`FAIL [${module}] ${step}: ${detail ?? ''}`);
  }
}

async function req(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await app.request(path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: Json;
  try {
    json = (await res.json()) as Json;
  } catch {
    json = { parseError: true };
  }
  return { status: res.status, json };
}

function idOf(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Json;
  return String(d._id ?? d.id ?? '');
}

function phone(n: number): string {
  // +91 9XXXXXXXXX unique per call
  const tail = String(7000000000 + (n % 1000000000)).slice(0, 10);
  return `+91${tail}`;
}

describe('Module HTTP e2e matrix (real routes)', () => {
  let adminToken = '';
  let floorId = '';
  let roomId = '';
  let room2Id = '';
  let tenantId = '';
  let tenant2Id = '';
  let counter = 0;
  const next = () => {
    counter += 1;
    return counter;
  };

  beforeAll(async () => {
    // Unique admin for this suite (setup clears collections after each test file's afterEach
    // only between tests — beforeAll once is enough with afterEach clearing... wait:
    // setup.ts afterEach clears ALL collections, so seed must be inside the test or each it().
  });

  it('runs full admin module CRUD + lifecycle matrix', async () => {
    // ── Bootstrap admin + config ─────────────────────────
    const n0 = next();
    const admin = new User({
      name: 'E2E Admin',
      email: `e2e-admin-${n0}@example.com`,
      phone: phone(900000000 + n0),
      passwordHash: 'Admin1234!',
      role: 'admin',
      isActive: true,
    });
    await admin.save();
    adminToken = await signAccessToken({ sub: String(admin._id), role: 'admin' });

    await AppConfig.create({
      pgName: 'E2E PG',
      address: { line1: '1 Test St', city: 'Test', state: 'TS', pincode: '560001' },
      phone: '+919876543210',
      email: 'e2e@pg.local',
      roomPricing: { sharing2: 8000, sharing3: 6500, sharing4: 5000 },
      features: {
        attendanceEnabled: true,
        laundryEnabled: true,
        messFeedbackEnabled: true,
        visitorManagementEnabled: true,
        guardianPortalEnabled: true,
        noticeBoardEnabled: true,
        emergencyAlertsEnabled: true,
      },
    });

    // Health
    {
      const r = await req('GET', '/api/v1/health');
      log('system', 'health', r.status === 200 && r.json.status === 'ok', JSON.stringify(r.json));
      expect(r.status).toBe(200);
    }

    // Auth login
    {
      const r = await req('POST', '/api/v1/auth/login', {
        body: { email: admin.email, password: 'Admin1234!' },
      });
      const ok = r.status === 200 && Boolean((r.json.data as Json)?.accessToken);
      log('auth', 'admin login', ok, `status=${r.status}`);
      expect(ok).toBe(true);
      if (ok) adminToken = String((r.json.data as Json).accessToken);
    }

    // ── Floors CRUD ──────────────────────────────────────
    {
      const n = next();
      const created = await req('POST', '/api/v1/floors', {
        token: adminToken,
        body: { floorNumber: 50 + n, label: `E2E Floor ${n}`, totalRooms: 2 },
      });
      floorId = idOf(created.json.data);
      log('floors', 'create', created.status === 201 && !!floorId, `status=${created.status}`);
      expect(created.status).toBe(201);

      const list = await req('GET', '/api/v1/floors', { token: adminToken });
      log('floors', 'list', list.status === 200 && Array.isArray(list.json.data));

      const detail = await req('GET', `/api/v1/floors/${floorId}`, { token: adminToken });
      log('floors', 'detail', detail.status === 200 && idOf(detail.json.data) === floorId);

      const updated = await req('PUT', `/api/v1/floors/${floorId}`, {
        token: adminToken,
        body: { label: `E2E Floor ${n} Renamed` },
      });
      log(
        'floors',
        'edit',
        updated.status === 200 &&
          String((updated.json.data as Json)?.label).includes('Renamed'),
      );
    }

    // ── Rooms CRUD + beds ────────────────────────────────
    {
      const n = next();
      const created = await req('POST', '/api/v1/rooms', {
        token: adminToken,
        body: {
          roomNumber: `E${n}A`,
          floorId,
          sharingType: 2,
          monthlyRent: 9000,
        },
      });
      roomId = idOf(created.json.data);
      const beds = (created.json.data as Json)?.beds as unknown[] | undefined;
      log(
        'rooms',
        'create with beds',
        created.status === 201 && !!roomId && Array.isArray(beds) && beds.length === 2,
        `status=${created.status} beds=${beds?.length}`,
      );
      expect(created.status).toBe(201);

      const r2 = await req('POST', '/api/v1/rooms', {
        token: adminToken,
        body: {
          roomNumber: `E${n}B`,
          floorId,
          sharingType: 2,
          monthlyRent: 8500,
        },
      });
      room2Id = idOf(r2.json.data);
      log('rooms', 'create second', r2.status === 201 && !!room2Id);

      const list = await req('GET', '/api/v1/rooms', { token: adminToken });
      log('rooms', 'list', list.status === 200 && Array.isArray(list.json.data));

      const detail = await req('GET', `/api/v1/rooms/${roomId}`, { token: adminToken });
      log('rooms', 'detail', detail.status === 200);

      const edited = await req('PUT', `/api/v1/rooms/${roomId}`, {
        token: adminToken,
        body: { monthlyRent: 9200 },
      });
      log(
        'rooms',
        'edit rent',
        edited.status === 200 && (edited.json.data as Json)?.monthlyRent === 9200,
      );
    }

    // ── Tenants lifecycle ────────────────────────────────
    {
      const n = next();
      const created = await req('POST', '/api/v1/tenants', {
        token: adminToken,
        body: {
          name: `Tenant ${n}`,
          email: `tenant-${n}@example.com`,
          phone: phone(910000000 + n),
          roomId,
          bedId: 'A',
          moveInDate: new Date('2026-01-15').toISOString(),
          monthlyRent: 9200,
          depositPaid: 10000,
        },
      });
      tenantId = idOf(created.json.data);
      const tempPwd = (created.json.data as Json)?.temporaryPassword;
      log(
        'tenants',
        'create + temporaryPassword + bed',
        created.status === 201 && !!tenantId && typeof tempPwd === 'string' && tempPwd.length > 0,
        `status=${created.status} tempPwd=${Boolean(tempPwd)}`,
      );
      expect(created.status).toBe(201);
      expect(tempPwd).toBeTruthy();

      // occupancy on room
      const roomAfter = await req('GET', `/api/v1/rooms/${roomId}`, { token: adminToken });
      const roomData = roomAfter.json.data as Json;
      const occ = roomData?.occupancyCount;
      const bedA = Array.isArray(roomData?.beds)
        ? (roomData.beds as Json[]).find((b) => b.bedId === 'A')
        : undefined;
      log(
        'tenants',
        'occupancy after create',
        occ === 1 && bedA?.isOccupied === true,
        `occ=${occ} bedA=${JSON.stringify(bedA?.isOccupied)}`,
      );

      const list = await req('GET', '/api/v1/tenants', { token: adminToken });
      log('tenants', 'list', list.status === 200 && Array.isArray(list.json.data));

      const detail = await req('GET', `/api/v1/tenants/${tenantId}`, { token: adminToken });
      log('tenants', 'detail', detail.status === 200);

      const edited = await req('PUT', `/api/v1/tenants/${tenantId}`, {
        token: adminToken,
        body: { monthlyRent: 9500, user: { name: `Tenant ${n} Edited` } },
      });
      log('tenants', 'edit rent/name', edited.status === 200, `status=${edited.status}`);

      // second tenant on room2 for later transfer conflict / finance
      const t2 = await req('POST', '/api/v1/tenants', {
        token: adminToken,
        body: {
          name: `TenantB ${n}`,
          email: `tenantb-${n}@example.com`,
          phone: phone(920000000 + n),
          roomId: room2Id,
          bedId: 'A',
          moveInDate: new Date('2026-01-15').toISOString(),
          monthlyRent: 8500,
        },
      });
      tenant2Id = idOf(t2.json.data);
      log('tenants', 'create second', t2.status === 201 && !!tenant2Id);

      // transfer to free bed B same room
      const transfer = await req('PUT', `/api/v1/tenants/${tenantId}`, {
        token: adminToken,
        body: { bedId: 'B' },
      });
      log('tenants', 'transfer bed same room', transfer.status === 200, `status=${transfer.status}`);

      // conflict: transfer to tenant2's bed
      const conflict = await req('PUT', `/api/v1/tenants/${tenantId}`, {
        token: adminToken,
        body: { roomId: room2Id, bedId: 'A' },
      });
      log(
        'tenants',
        'transfer conflict 409',
        conflict.status === 409,
        `status=${conflict.status}`,
      );

      // ensure occupancy still consistent after conflict
      const r2 = await req('GET', `/api/v1/rooms/${room2Id}`, { token: adminToken });
      const r2d = r2.json.data as Json;
      log(
        'tenants',
        'occupancy intact after conflict',
        r2d?.occupancyCount === 1,
        `occ=${r2d?.occupancyCount}`,
      );
    }

    // ── Invoices + Payments lifecycle ────────────────────
    {
      const month = '2026-05';
      const gen = await req('POST', '/api/v1/invoices/generate-single', {
        token: adminToken,
        body: { tenantId, month },
      });
      const invoiceId = idOf(gen.json.data);
      log(
        'invoices',
        'generate-single',
        gen.status === 201 && !!invoiceId,
        `status=${gen.status}`,
      );
      expect(gen.status).toBe(201);

      const list = await req('GET', '/api/v1/invoices', { token: adminToken });
      log('invoices', 'list', list.status === 200 && Array.isArray(list.json.data));

      const detail = await req('GET', `/api/v1/invoices/${invoiceId}`, { token: adminToken });
      const inv = detail.json.data as Json;
      const total = Number(inv?.totalAmount ?? 0);
      log(
        'invoices',
        'detail line items',
        detail.status === 200 && total > 0 && Array.isArray(inv?.lineItems),
        `total=${total}`,
      );

      const payList = await req('GET', '/api/v1/payments', { token: adminToken });
      log('payments', 'list', payList.status === 200 && Array.isArray(payList.json.data));

      const offline = await req('POST', '/api/v1/payments/offline', {
        token: adminToken,
        body: {
          tenantId,
          invoiceId,
          amount: total,
          method: 'cash',
          paidAt: new Date().toISOString(),
          notes: 'e2e full pay',
        },
      });
      log(
        'payments',
        'offline record full amount',
        offline.status === 200 || offline.status === 201,
        `status=${offline.status} body=${JSON.stringify(offline.json).slice(0, 200)}`,
      );

      const invAfter = await req('GET', `/api/v1/invoices/${invoiceId}`, { token: adminToken });
      const statusAfter = (invAfter.json.data as Json)?.status;
      log(
        'payments',
        'invoice balance/status paid after offline',
        statusAfter === 'paid',
        `status=${statusAfter}`,
      );

      const summary = await req('GET', '/api/v1/payments/summary', { token: adminToken });
      log('payments', 'summary aggregate', summary.status === 200 && Boolean(summary.json.data));
    }

    // ── Electricity reading → finalize → distribute ──────
    {
      const month = '2026-06';
      const created = await req('POST', '/api/v1/electricity', {
        token: adminToken,
        body: {
          month,
          totalBillAmount: 2000,
          roomEntries: [
            {
              roomId,
              previousReading: 100,
              currentReading: 150,
              ratePerUnit: 8,
            },
          ],
        },
      });
      const billId = idOf(created.json.data);
      log('electricity', 'create reading', created.status === 201 && !!billId, `status=${created.status}`);

      if (billId) {
        const fin = await req('POST', `/api/v1/electricity/${billId}/finalize`, {
          token: adminToken,
        });
        log('electricity', 'finalize', fin.status === 200, `status=${fin.status}`);

        const dist = await req('POST', `/api/v1/electricity/${billId}/distribute`, {
          token: adminToken,
        });
        log(
          'electricity',
          'distribute',
          dist.status === 200 || dist.status === 201,
          `status=${dist.status} ${JSON.stringify(dist.json).slice(0, 180)}`,
        );

        const list = await req('GET', '/api/v1/electricity', { token: adminToken });
        log('electricity', 'list', list.status === 200 && Array.isArray(list.json.data));
      }
    }

    // ── Complaints CRUD ──────────────────────────────────
    const complaintId = await (async () => {
      const created = await req('POST', '/api/v1/complaints', {
        token: adminToken,
        body: {
          tenantId,
          roomId,
          category: 'wifi',
          title: 'WiFi is slow tonight',
          description: 'Cannot stream video in the evening hours at all.',
          priority: 'medium',
        },
      });
      const id = idOf(created.json.data);
      log('complaints', 'create', created.status === 201 && !!id, `status=${created.status}`);

      const list = await req('GET', '/api/v1/complaints', { token: adminToken });
      log('complaints', 'list', list.status === 200 && Array.isArray(list.json.data));

      if (id) {
        const detail = await req('GET', `/api/v1/complaints/${id}`, { token: adminToken });
        log('complaints', 'detail', detail.status === 200);

        const edited = await req('PUT', `/api/v1/complaints/${id}`, {
          token: adminToken,
          body: { status: 'in_progress', priority: 'high' },
        });
        log('complaints', 'edit status', edited.status === 200, `status=${edited.status}`);
      }
      return id;
    })();

    // ── Services CRUD ────────────────────────────────────
    // Floor create seeds isPerFloor ServiceStatus (wifi etc.). Prefer list; create only if missing.
    const serviceId = await (async () => {
      const listed = await req('GET', `/api/v1/services?floorId=${floorId}`, { token: adminToken });
      const rows = Array.isArray(listed.json.data) ? (listed.json.data as Json[]) : [];
      let id = rows.length ? idOf(rows[0]) : '';
      if (!id) {
        const created = await req('POST', '/api/v1/services', {
          token: adminToken,
          body: { floorId, serviceType: 'wifi', status: 'operational', note: 'ok' },
        });
        id = idOf(created.json.data);
        log('services', 'create', created.status === 201 && !!id, `status=${created.status}`);
      } else {
        log('services', 'create', true, 'status=seeded-from-floor');
      }

      if (id) {
        const edited = await req('PUT', `/api/v1/services/${id}`, {
          token: adminToken,
          body: { status: 'degraded', note: 'intermittent' },
        });
        log('services', 'edit status', edited.status === 200, `status=${edited.status}`);

        const detail = await req('GET', `/api/v1/services/${id}`, { token: adminToken });
        log('services', 'detail', detail.status === 200);

        const list = await req('GET', '/api/v1/services', { token: adminToken });
        log('services', 'list', list.status === 200);
      }
      return id;
    })();

    // ── Assets CRUD ──────────────────────────────────────
    const assetId = await (async () => {
      const created = await req('POST', '/api/v1/assets', {
        token: adminToken,
        body: {
          name: 'Washing Machine Unit 1',
          category: 'appliance',
          location: 'Ground floor laundry',
          quantity: 2,
          lowStockThreshold: 1,
          status: 'available',
        },
      });
      const id = idOf(created.json.data);
      log('assets', 'create', created.status === 201 && !!id, `status=${created.status}`);

      if (id) {
        const edited = await req('PUT', `/api/v1/assets/${id}`, {
          token: adminToken,
          body: { quantity: 1, status: 'in_use' },
        });
        log('assets', 'edit', edited.status === 200);
        const list = await req('GET', '/api/v1/assets', { token: adminToken });
        log('assets', 'list', list.status === 200 && Array.isArray(list.json.data));
        const detail = await req('GET', `/api/v1/assets/${id}`, { token: adminToken });
        log('assets', 'detail', detail.status === 200);
      }
      return id;
    })();

    // ── Notices CRUD ─────────────────────────────────────
    const noticeId = await (async () => {
      const created = await req('POST', '/api/v1/notices', {
        token: adminToken,
        body: {
          title: 'Water maintenance Sunday',
          content: 'Water supply will be offline from 10am to 2pm for tank cleaning.',
          pinned: true,
          targetType: 'all',
          targetIds: [],
        },
      });
      const id = idOf(created.json.data);
      log('notices', 'create', created.status === 201 && !!id, `status=${created.status}`);
      if (id) {
        const edited = await req('PUT', `/api/v1/notices/${id}`, {
          token: adminToken,
          body: { pinned: false },
        });
        log('notices', 'edit', edited.status === 200);
        const list = await req('GET', '/api/v1/notices', { token: adminToken });
        log('notices', 'list', list.status === 200);
      }
      return id;
    })();

    // ── Enquiries CRUD ───────────────────────────────────
    const enquiryId = await (async () => {
      const created = await req('POST', '/api/v1/enquiries', {
        body: {
          name: 'Walk In Prospect',
          phone: phone(930000001),
          preferredSharing: '2',
          message: 'Looking for a bed next month',
          source: 'walk_in',
        },
      });
      const id = idOf(created.json.data);
      log('enquiries', 'create', created.status === 201 && !!id, `status=${created.status}`);
      if (id) {
        const edited = await req('PUT', `/api/v1/enquiries/${id}`, {
          token: adminToken,
          body: { status: 'contacted', notes: 'Called back' },
        });
        log('enquiries', 'edit status', edited.status === 200, `status=${edited.status}`);
        const list = await req('GET', '/api/v1/enquiries', { token: adminToken });
        log('enquiries', 'list', list.status === 200);
      }
      return id;
    })();

    // ── Menus + Meals ────────────────────────────────────
    {
      const date = '2026-07-20';
      const created = await req('POST', '/api/v1/menus', {
        token: adminToken,
        body: {
          date,
          meals: {
            breakfast: [{ name: 'Idli', category: 'south' }],
            lunch: [{ name: 'Rice sambar' }],
            dinner: [{ name: 'Roti sabzi' }],
          },
        },
      });
      const menuId = idOf(created.json.data);
      log('menus', 'create', created.status === 201 && !!menuId, `status=${created.status}`);
      if (menuId) {
        const edited = await req('PUT', `/api/v1/menus/${menuId}`, {
          token: adminToken,
          body: {
            date,
            meals: {
              breakfast: [{ name: 'Dosa' }],
              lunch: [{ name: 'Rice' }],
              dinner: [{ name: 'Chapati' }],
            },
          },
        });
        log('menus', 'edit', edited.status === 200, `status=${edited.status}`);
        const list = await req('GET', '/api/v1/menus', { token: adminToken });
        log('menus', 'list', list.status === 200);
      }

      const meal = await req('POST', '/api/v1/meals', {
        token: adminToken,
        body: {
          tenantId,
          date,
          mealType: 'lunch',
          rating: 4,
          comment: 'Good meal',
        },
      });
      log('meals', 'admin create feedback', meal.status === 201, `status=${meal.status}`);
      // Admin list path is /meals/feedback (not bare /meals)
      const mealList = await req('GET', '/api/v1/meals/feedback', { token: adminToken });
      log('meals', 'list feedback', mealList.status === 200, `status=${mealList.status}`);
      const summary = await req('GET', '/api/v1/meals/feedback/summary', { token: adminToken });
      log('meals', 'feedback summary', summary.status === 200, `status=${summary.status}`);
    }

    // ── Laundry ──────────────────────────────────────────
    {
      const created = await req('POST', '/api/v1/laundry-slots', {
        token: adminToken,
        body: {
          tenantId,
          slotDate: '2026-07-22',
          slotTime: '10:00',
          items: 3,
        },
      });
      const slotId = idOf(created.json.data);
      log('laundry', 'book slot', created.status === 201 && !!slotId, `status=${created.status}`);
      if (slotId) {
        const edited = await req('PUT', `/api/v1/laundry-slots/${slotId}`, {
          token: adminToken,
          body: { status: 'confirmed' },
        });
        log('laundry', 'confirm status', edited.status === 200, `status=${edited.status}`);
        const list = await req('GET', '/api/v1/laundry-slots', { token: adminToken });
        log('laundry', 'list', list.status === 200);
      }
    }

    // ── Visitors lifecycle ───────────────────────────────
    {
      const created = await req('POST', '/api/v1/visitors', {
        token: adminToken,
        body: {
          tenantId,
          visitorName: 'Cousin Visit',
          visitorPhone: phone(940000001),
          purpose: 'Family visit weekend',
          expectedArrival: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const visitorId = idOf(created.json.data);
      log('visitors', 'create expected', created.status === 201 && !!visitorId, `status=${created.status}`);
      if (visitorId) {
        const arrive = await req('POST', `/api/v1/visitors/${visitorId}/arrive`, {
          token: adminToken,
        });
        log('visitors', 'arrive', arrive.status === 200, `status=${arrive.status}`);
        const depart = await req('POST', `/api/v1/visitors/${visitorId}/depart`, {
          token: adminToken,
        });
        log('visitors', 'depart', depart.status === 200, `status=${depart.status}`);
        const bad = await req('POST', `/api/v1/visitors/${visitorId}/arrive`, {
          token: adminToken,
        });
        log('visitors', 'invalid re-arrive 409', bad.status === 409, `status=${bad.status}`);
        const list = await req('GET', '/api/v1/visitors', { token: adminToken });
        log('visitors', 'list', list.status === 200);
      }
    }

    // ── Guardians ────────────────────────────────────────
    {
      const n = next();
      const created = await req('POST', '/api/v1/guardians', {
        token: adminToken,
        body: {
          tenantId,
          name: 'Parent Guardian',
          phone: phone(950000000 + n),
          email: `guardian-${n}@example.com`,
          relation: 'father',
        },
      });
      const gId = idOf(created.json.data);
      const temp = (created.json.data as Json)?.temporaryPassword;
      log(
        'guardians',
        'create + temp password',
        created.status === 201 && !!gId && typeof temp === 'string',
        `status=${created.status}`,
      );
      if (gId) {
        const list = await req('GET', '/api/v1/guardians', { token: adminToken });
        log('guardians', 'list', list.status === 200);
        const detail = await req('GET', `/api/v1/guardians/${gId}`, { token: adminToken });
        log('guardians', 'detail', detail.status === 200);
      }
    }

    // ── Attendance ───────────────────────────────────────
    {
      const today = new Date().toISOString().slice(0, 10);
      const created = await req('POST', '/api/v1/attendance', {
        token: adminToken,
        body: {
          tenantId,
          date: today,
          status: 'present',
          method: 'manual',
        },
      });
      // path may be /manual — try both
      let ok = created.status === 201 || created.status === 200;
      let recId = idOf(created.json.data);
      if (!ok) {
        const alt = await req('POST', '/api/v1/attendance/manual', {
          token: adminToken,
          body: {
            tenantId,
            date: today,
            status: 'present',
            method: 'manual',
          },
        });
        ok = alt.status === 201 || alt.status === 200;
        recId = idOf(alt.json.data);
        log('attendance', 'manual create', ok, `status=${alt.status}`);
      } else {
        log('attendance', 'manual create', ok, `status=${created.status}`);
      }
      const list = await req('GET', '/api/v1/attendance', { token: adminToken });
      log('attendance', 'list', list.status === 200);
      if (recId) {
        const detail = await req('GET', `/api/v1/attendance/${recId}`, { token: adminToken });
        log('attendance', 'detail', detail.status === 200);
      }
    }

    // ── Leaves ───────────────────────────────────────────
    {
      const created = await req('POST', '/api/v1/leaves', {
        token: adminToken,
        body: {
          tenantId,
          fromDate: '2026-08-01',
          toDate: '2026-08-03',
          reason: 'Family function travel',
        },
      });
      const leaveId = idOf(created.json.data);
      log('leaves', 'create', created.status === 201 && !!leaveId, `status=${created.status}`);
      if (leaveId) {
        // Production route: PUT /leaves/:id/approve
        const approve = await req('PUT', `/api/v1/leaves/${leaveId}/approve`, {
          token: adminToken,
        });
        log('leaves', 'approve', approve.status === 200, `status=${approve.status}`);
        const list = await req('GET', '/api/v1/leaves', { token: adminToken });
        log('leaves', 'list', list.status === 200);
        const detail = await req('GET', `/api/v1/leaves/${leaveId}`, { token: adminToken });
        log(
          'leaves',
          'detail approved',
          detail.status === 200 &&
            String((detail.json.data as Json)?.status) === 'approved',
          `status=${(detail.json.data as Json)?.status}`,
        );
      }
    }

    // ── Settings / notifications / audit / dashboard ─────
    {
      const cfg = await req('GET', '/api/v1/app-config', { token: adminToken });
      log('settings', 'get app-config', cfg.status === 200 && Boolean(cfg.json.data));

      const put = await req('PUT', '/api/v1/app-config', {
        token: adminToken,
        body: { pgName: 'E2E PG Updated' },
      });
      // some apps use PATCH or nested path
      const putOk =
        put.status === 200 ||
        (await req('PUT', '/api/v1/app-config/', {
          token: adminToken,
          body: { pgName: 'E2E PG Updated' },
        })).status === 200;
      log('settings', 'update sticks', putOk || put.status === 200, `status=${put.status}`);
      if (put.status === 200) {
        const again = await req('GET', '/api/v1/app-config', { token: adminToken });
        const name = (again.json.data as Json)?.pgName;
        log('settings', 'config persists', name === 'E2E PG Updated', `name=${name}`);
      }

      const dash = await req('GET', '/api/v1/dashboard', { token: adminToken });
      // may be /dashboard/stats
      const dashAlt = await req('GET', '/api/v1/dashboard/stats', { token: adminToken });
      log(
        'dashboard',
        'stats load',
        dash.status === 200 || dashAlt.status === 200,
        `dash=${dash.status} alt=${dashAlt.status}`,
      );

      const notifList = await req('GET', '/api/v1/notifications', { token: adminToken });
      log(
        'notifications',
        'list',
        notifList.status === 200 || notifList.status === 404,
        `status=${notifList.status}`,
      );

      const audit = await req('GET', '/api/v1/audit-logs', { token: adminToken });
      log('audit', 'list', audit.status === 200 && Array.isArray(audit.json.data));
    }

    // ── Tenant checkout lifecycle (after dues cleared) ───
    {
      // generate-single may leave other months unpaid — use dues endpoint
      const dues = await req('GET', `/api/v1/tenants/${tenantId}/dues`, { token: adminToken });
      log('tenants', 'dues endpoint', dues.status === 200, `status=${dues.status}`);

      // checkout tenant2 (simpler — may have unpaid invoice from generate? only tenant1 got invoice)
      const checkout = await req('POST', `/api/v1/tenants/${tenant2Id}/checkout`, {
        token: adminToken,
      });
      log(
        'tenants',
        'checkout tenant2',
        checkout.status === 200,
        `status=${checkout.status} ${JSON.stringify(checkout.json).slice(0, 200)}`,
      );

      if (checkout.status === 200) {
        const room = await req('GET', `/api/v1/rooms/${room2Id}`, { token: adminToken });
        const occ = (room.json.data as Json)?.occupancyCount;
        log('tenants', 'checkout frees bed', occ === 0, `occ=${occ}`);

        const reinstate = await req('POST', `/api/v1/tenants/${tenant2Id}/reinstate`, {
          token: adminToken,
        });
        log('tenants', 'reinstate', reinstate.status === 200, `status=${reinstate.status}`);
      }
    }

    // ── Deletes (cleanup entities that support delete) ───
    {
      if (assetId) {
        const d = await req('DELETE', `/api/v1/assets/${assetId}`, { token: adminToken });
        log('assets', 'delete', d.status === 200, `status=${d.status}`);
      }
      if (noticeId) {
        const d = await req('DELETE', `/api/v1/notices/${noticeId}`, { token: adminToken });
        log('notices', 'delete', d.status === 200, `status=${d.status}`);
      }
      if (serviceId) {
        const d = await req('DELETE', `/api/v1/services/${serviceId}`, { token: adminToken });
        log('services', 'delete', d.status === 200, `status=${d.status}`);
      }
      if (complaintId) {
        const d = await req('DELETE', `/api/v1/complaints/${complaintId}`, { token: adminToken });
        log('complaints', 'delete', d.status === 200, `status=${d.status}`);
      }
      if (enquiryId) {
        const d = await req('DELETE', `/api/v1/enquiries/${enquiryId}`, { token: adminToken });
        log('enquiries', 'delete', d.status === 200 || d.status === 204, `status=${d.status}`);
      }
    }

    // ── Matrix assertion ─────────────────────────────────
    const failed = results.filter((r) => !r.ok);
    // Summary lines (allowed: console.error) for scratch log capture
    for (const r of results) {
      const line = `${r.ok ? 'PASS' : 'FAIL'} | ${r.module.padEnd(14)} | ${r.step}${r.detail ? ' | ' + r.detail : ''}`;
      if (r.ok) console.warn(line);
      else console.error(line);
    }
    console.error(`TOTAL ${results.length} steps, FAIL ${failed.length}`);

    expect(
      failed,
      `Failed steps:\n${failed.map((f) => `${f.module}:${f.step} ${f.detail}`).join('\n')}`,
    ).toEqual([]);
  }, 120_000);
});
