/**
 * Notification gaps.
 *
 * Six module contracts declare that a state change owes the resident a
 * notification the server never sent: a re-approved visitor, an amenity that
 * went down, an asset taken out of service, a service reported as down, meal
 * feedback acknowledged and a laundry slot confirmed. Two more the file level
 * rule cannot see: an edited invoice and a cancelled leave. The tenth is the
 * bulk overdue write, which marked invoices overdue in silence.
 *
 * Each case asserts three things: the notification exists, it carries the
 * right type, and it went to the resident the record points at, never to the
 * admin who acted. The negative controls are the writes that are NOT
 * decisions: a housekeeping edit has to stay silent.
 *
 * The last case is the money guard: an offline collection may never rewrite
 * the amount a resident declared on their own transfer row.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { User } from '../models/user.js';
import { AppConfig } from '../models/appConfig.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { Visitor } from '../models/visitor.js';
import { Asset } from '../models/asset.js';
import { ServiceStatus } from '../models/serviceStatus.js';
import { MealFeedback } from '../models/mealFeedback.js';
import { LaundrySlot } from '../models/laundrySlot.js';
import { LeaveApplication } from '../models/leaveApplication.js';
import { Notification } from '../models/notification.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import { invalidateFeatureFlagCache } from '../middleware/featureFlags.js';
import visitorRoutes from '../routes/visitors.js';
import roomRoutes from '../routes/rooms.js';
import assetRoutes from '../routes/assets.js';
import serviceRoutes from '../routes/services.js';
import mealRoutes from '../routes/meals.js';
import laundryRoutes from '../routes/laundry.js';
import invoiceRoutes from '../routes/invoices.js';
import leaveRoutes from '../routes/leaves.js';
import paymentRoutes from '../routes/payments.js';
import { runDailyOverdueCheck } from '../jobs/scheduler.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/visitors', visitorRoutes);
  api.route('/rooms', roomRoutes);
  api.route('/assets', assetRoutes);
  api.route('/services', serviceRoutes);
  api.route('/meals', mealRoutes);
  api.route('/laundry-slots', laundryRoutes);
  api.route('/invoices', invoiceRoutes);
  api.route('/leaves', leaveRoutes);
  api.route('/payments', paymentRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();

async function req(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: Json }> {
  const res = await app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: Json;
  try {
    json = (await res.json()) as Json;
  } catch {
    json = { parseError: true };
  }
  return { status: res.status, json };
}

const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const invoiceCreate = Invoice.create.bind(Invoice) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const paymentCreate = Payment.create.bind(Payment) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const visitorCreate = Visitor.create.bind(Visitor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const assetCreate = Asset.create.bind(Asset) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const serviceCreate = ServiceStatus.create.bind(ServiceStatus) as unknown as (
  doc: AnyDoc,
) => Promise<AnyDoc>;
const mealCreate = MealFeedback.create.bind(MealFeedback) as unknown as (
  doc: AnyDoc,
) => Promise<AnyDoc>;
const laundryCreate = LaundrySlot.create.bind(LaundrySlot) as unknown as (
  doc: AnyDoc,
) => Promise<AnyDoc>;
const leaveCreate = LeaveApplication.create.bind(LeaveApplication) as unknown as (
  doc: AnyDoc,
) => Promise<AnyDoc>;

let counter = 0;
function next(): number {
  counter += 1;
  return counter;
}

/** Reads the data map of a notification, whatever shape the driver returns. */
function dataOf(doc: AnyDoc): Record<string, string> {
  const raw = doc.data;
  if (raw instanceof Map) {
    return Object.fromEntries(raw.entries()) as Record<string, string>;
  }
  if (raw && typeof raw === 'object') return raw as Record<string, string>;
  return {};
}

/** Every notification in the database, newest first. */
async function allNotifications(): Promise<AnyDoc[]> {
  const docs = await Notification.find({}).sort({ createdAt: -1 }).lean();
  return docs as unknown as AnyDoc[];
}

/** The notifications addressed to one user. */
async function notificationsFor(userId: string): Promise<AnyDoc[]> {
  const docs = await Notification.find({ recipientUserIds: userId }).sort({ createdAt: -1 }).lean();
  return docs as unknown as AnyDoc[];
}

async function seedAdmin(): Promise<{ adminId: string; adminToken: string }> {
  const n = next();
  const admin = await userCreate({
    name: 'Gap Admin',
    email: `gap-admin-${n}@example.com`,
    phone: `+9198${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'admin',
    isActive: true,
  });
  const token = await signAccessToken({ sub: String(admin._id), role: 'admin' });
  return { adminId: String(admin._id), adminToken: token };
}

async function seedFloor(): Promise<{ floorId: string; floorLabel: string }> {
  const n = next();
  const floor = await floorCreate({
    floorNumber: 1 + (n % 400),
    label: `Gap Floor ${n}`,
    totalRooms: 1,
  });
  return { floorId: String(floor._id), floorLabel: String(floor.label) };
}

async function seedRoom(floorId: string): Promise<{ roomId: string; roomNumber: string }> {
  const n = next();
  const room = await roomCreate({
    roomNumber: `GP${String(10000 + n)}`,
    floorId,
    sharingType: 2,
    monthlyRent: 9000,
    beds: Room.generateBeds(2),
  });
  return { roomId: String(room._id), roomNumber: String(room.roomNumber) };
}

/** A resident with an account, a tenant record and a bed in a room. */
async function seedResident(
  label: string,
  roomId: string,
  bedId = 'A',
): Promise<{ residentId: string; residentToken: string; tenantId: string }> {
  const n = next();
  const user = await userCreate({
    name: `Gap Resident ${label}`,
    email: `gap-${label}-${n}@example.com`,
    phone: `+9197${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'tenant',
    isActive: true,
  });
  const tenant = await tenantCreate({
    userId: user._id,
    roomId,
    bedId,
    moveInDate: new Date('2026-01-01'),
    monthlyRent: 9000,
    depositPaid: 9000,
    isActive: true,
  });
  const token = await signAccessToken({ sub: String(user._id), role: 'tenant' });
  return { residentId: String(user._id), residentToken: token, tenantId: String(tenant._id) };
}

async function seedInvoice(
  tenantId: string,
  month: string,
  total: number,
  status: 'sent' | 'partial' | 'paid' = 'sent',
): Promise<string> {
  const invoice = await invoiceCreate({
    invoiceNumber: `INV-${month.replace('-', '')}-${String(next()).padStart(3, '0')}`,
    tenantId,
    month,
    lineItems: [{ description: 'Room Rent', amount: total }],
    rentAmount: total,
    electricityAmount: 0,
    otherCharges: 0,
    totalAmount: total,
    status,
    dueDate: new Date(`${month}-05T00:00:00.000Z`),
  });
  return String(invoice._id);
}

beforeEach(async () => {
  // The leave routes sit behind the attendance feature flag.
  await AppConfig.findOneAndUpdate(
    {},
    { $set: { 'features.attendanceEnabled': true } },
    { upsert: true },
  );
  invalidateFeatureFlagCache();
});

describe('Notification gaps: a state change a resident waits on notifies them', () => {
  it('a re-approved visitor notifies the resident who registered it', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('visitor', roomId);

    const visitor = await visitorCreate({
      tenantId,
      visitorName: 'Ramesh Kumar',
      visitorPhone: '+919876543210',
      purpose: 'Family visit',
      expectedArrival: new Date('2030-01-01T10:00:00.000Z'),
      status: 'cancelled',
    });

    const res = await req('POST', `/api/v1/visitors/${String(visitor._id)}/approve`, adminToken);
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain('Ramesh Kumar');
    expect(dataOf(mine[0]!).visitorId).toBe(String(visitor._id));

    // The admin who approved it is not the recipient.
    expect(await notificationsFor(adminId)).toHaveLength(0);
  });

  it('an amenity that goes down notifies the residents of that room', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId, roomNumber } = await seedRoom(floorId);
    const { residentId } = await seedResident('amenity', roomId);

    const res = await req('PUT', `/api/v1/rooms/${roomId}`, adminToken, {
      roomAmenities: [{ amenityKey: 'geyser', status: 'down' }],
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain('geyser');
    expect(String(mine[0]!.body)).toContain(roomNumber);
    expect(dataOf(mine[0]!).roomId).toBe(roomId);
  });

  it('an asset taken out of service notifies the residents of its room', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId } = await seedResident('asset', roomId);

    const asset = await assetCreate({
      name: 'Geyser',
      category: 'appliance',
      location: 'Store room',
      quantity: 1,
      status: 'available',
      roomId,
    });

    const res = await req('PUT', `/api/v1/assets/${String(asset._id)}`, adminToken, {
      status: 'under_maintenance',
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain('Geyser');
    expect(dataOf(mine[0]!).assetId).toBe(String(asset._id));
  });

  it('a service reported down notifies the residents of that floor', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { floorId, floorLabel } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId } = await seedResident('service', roomId);

    const service = await serviceCreate({
      floorId,
      serviceType: 'wifi',
      status: 'operational',
      lastUpdatedBy: adminId,
      lastUpdatedAt: new Date(),
    });

    const res = await req('PUT', `/api/v1/services/${String(service._id)}`, adminToken, {
      status: 'down',
      note: 'Router is dead',
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain('wifi');
    expect(String(mine[0]!.body)).toContain(floorLabel);
    expect(dataOf(mine[0]!).serviceId).toBe(String(service._id));
  });

  it('acknowledged meal feedback notifies the resident who left it', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('meal', roomId);

    const feedback = await mealCreate({
      tenantId,
      date: '2026-10-01',
      mealType: 'lunch',
      rating: 2,
      categories: ['taste'],
      comment: 'Too salty',
      status: 'submitted',
    });

    const res = await req('PUT', `/api/v1/meals/${String(feedback._id)}`, adminToken, {
      status: 'acknowledged',
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('meal_feedback');
    expect(String(mine[0]!.body)).toContain('lunch');
    expect(dataOf(mine[0]!).feedbackId).toBe(String(feedback._id));
  });

  it('a confirmed laundry slot notifies the resident who booked it', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('laundry', roomId);

    const slot = await laundryCreate({
      tenantId,
      slotDate: '2030-01-15',
      slotTime: '10:00',
      items: 2,
      status: 'booked',
    });

    const res = await req('PUT', `/api/v1/laundry-slots/${String(slot._id)}`, adminToken, {
      status: 'confirmed',
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain('2030-01-15');
    expect(dataOf(mine[0]!).slotId).toBe(String(slot._id));
  });

  it('an edited invoice notifies the resident when the amount moved', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('invoice', roomId);

    const invoiceId = await seedInvoice(tenantId, '2026-09', 9000);

    const res = await req('PUT', `/api/v1/invoices/${invoiceId}`, adminToken, {
      rentAmount: 9500,
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('payment_reminder');
    expect(String(mine[0]!.body)).toContain('9500.00');
    expect(String(mine[0]!.body)).toContain('2026-09');
    expect(dataOf(mine[0]!).invoiceId).toBe(invoiceId);
  });

  it('an invoice edit that moves no amount stays silent', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('invoice-quiet', roomId);

    const invoiceId = await seedInvoice(tenantId, '2026-09', 9000);

    // Housekeeping edit: the due date moved, the amount did not.
    const res = await req('PUT', `/api/v1/invoices/${invoiceId}`, adminToken, {
      dueDate: '2026-09-12',
    });
    expect(res.status).toBe(200);

    expect(await notificationsFor(residentId)).toHaveLength(0);
    expect(await allNotifications()).toHaveLength(0);
  });

  it('a cancelled leave notifies the resident who asked for it', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('leave', roomId);

    const leave = await leaveCreate({
      tenantId,
      fromDate: '2030-08-01',
      toDate: '2030-08-03',
      reason: 'Family visit',
      status: 'pending',
    });

    const res = await req('POST', `/api/v1/leaves/${String(leave._id)}/cancel`, adminToken);
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain('cancelled');
    expect(dataOf(mine[0]!).leaveId).toBe(String(leave._id));
  });

  it('an invoice that goes overdue notifies the tenant with the invoice number', async () => {
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('overdue', roomId);

    const invoiceId = await seedInvoice(tenantId, '2020-01', 9000);

    await runDailyOverdueCheck();

    const invoice = (await Invoice.findById(invoiceId).lean()) as unknown as AnyDoc;
    expect(invoice.status).toBe('overdue');

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('payment_reminder');
    expect(String(mine[0]!.body)).toContain('INV-202001');
    expect(String(mine[0]!.body)).toContain('2020-01');
    expect(dataOf(mine[0]!).invoiceId).toBe(invoiceId);
  });

  it('a housekeeping edit is not a decision and stays silent', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('quiet', roomId);

    const asset = await assetCreate({
      name: 'Washing Machine',
      category: 'appliance',
      location: 'Laundry room',
      quantity: 1,
      status: 'available',
      roomId,
    });

    const feedback = await mealCreate({
      tenantId,
      date: '2026-10-02',
      mealType: 'dinner',
      rating: 4,
      categories: ['taste'],
      comment: 'Nice food',
      status: 'submitted',
    });

    // Three housekeeping writes: a description, a stock count and a note.
    const room = await req('PUT', `/api/v1/rooms/${roomId}`, adminToken, {
      description: 'repainted last week',
    });
    expect(room.status).toBe(200);

    const stock = await req('PUT', `/api/v1/assets/${String(asset._id)}`, adminToken, {
      quantity: 3,
    });
    expect(stock.status).toBe(200);

    const note = await req('PUT', `/api/v1/meals/${String(feedback._id)}`, adminToken, {
      comment: 'checked with the cook',
    });
    expect(note.status).toBe(200);

    expect(await notificationsFor(residentId)).toHaveLength(0);
    expect(await allNotifications()).toHaveLength(0);
  });

  it('an offline collection never rewrites the amount a resident declared', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { tenantId } = await seedResident('transfer', roomId);

    const invoiceId = await seedInvoice(tenantId, '2026-10', 9000);

    // The resident declared a transfer of the full amount and waits for the
    // verification. The office collects part of it at the desk.
    const declared = await paymentCreate({
      tenantId,
      invoiceId,
      amount: 9000,
      type: 'rent',
      method: 'upi',
      status: 'pending_verification',
      month: '2026-10',
      dueDate: new Date('2026-10-05T00:00:00.000Z'),
      utrNumber: 'UTRRES001',
    });

    const res = await req('POST', '/api/v1/payments/offline', adminToken, {
      tenantId,
      invoiceId,
      amount: 5000,
      method: 'cash',
      paidAt: new Date('2026-10-10T10:00:00.000Z').toISOString(),
    });
    expect(res.status).toBe(201);

    const row = (await Payment.findById(String(declared._id)).lean()) as unknown as AnyDoc;
    expect(Number(row.amount)).toBe(9000);
    expect(row.status).toBe('pending_verification');

    // The cash the office collected is on the ledger, on a row of its own.
    const paid = (await Payment.find({
      invoiceId,
      status: 'paid',
    }).lean()) as unknown as AnyDoc[];
    expect(paid).toHaveLength(1);
    expect(Number(paid[0]!.amount)).toBe(5000);
  });
});
