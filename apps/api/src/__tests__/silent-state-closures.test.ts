/**
 * Silent state closures.
 *
 * Four state changes used to happen without telling anybody:
 *
 *   - a visitor arrived or left and the resident who registered the guest
 *     heard nothing;
 *   - a room was taken out of service, or a bed letter changed, and the
 *     resident who sleeps in that room heard nothing;
 *   - the electricity distribution left an invoice alone without telling the
 *     office which one or why, and left the resident believing they owed a
 *     share that was never added;
 *   - the cron-secret overdue routes moved invoices to overdue in silence.
 *
 * The server also let the office finalize an electricity bill whose readings
 * do not add up while the screen refused it. Now the server refuses it too,
 * with a code the client can show and the numbers that disagree.
 *
 * Each case asserts the notification exists, carries the right type, and went
 * to the resident the record points at, never to the admin who acted. The last
 * case is the negative control: a write that is not a decision stays silent.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { User } from '../models/user.js';
import { AppConfig } from '../models/appConfig.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Visitor } from '../models/visitor.js';
import { Notification } from '../models/notification.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import { invalidateFeatureFlagCache } from '../middleware/featureFlags.js';
import { env } from '../lib/env.js';
import visitorRoutes from '../routes/visitors.js';
import roomRoutes from '../routes/rooms.js';
import electricityRoutes from '../routes/electricity.js';
import jobRoutes from '../routes/jobs.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/visitors', visitorRoutes);
  api.route('/rooms', roomRoutes);
  api.route('/electricity', electricityRoutes);
  api.route('/jobs', jobRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();

async function req(
  method: string,
  path: string,
  token: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
  const res = await app.request(path, {
    method,
    headers,
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
const visitorCreate = Visitor.create.bind(Visitor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

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

/** The notifications addressed to one user. */
async function notificationsFor(userId: string): Promise<AnyDoc[]> {
  const docs = await Notification.find({ recipientUserIds: userId }).sort({ createdAt: -1 }).lean();
  return docs as unknown as AnyDoc[];
}

/** Every notification in the database, newest first. */
async function allNotifications(): Promise<AnyDoc[]> {
  const docs = await Notification.find({}).sort({ createdAt: -1 }).lean();
  return docs as unknown as AnyDoc[];
}

async function seedAdmin(): Promise<{ adminId: string; adminToken: string }> {
  const n = next();
  const admin = await userCreate({
    name: 'Silence Admin',
    email: `silent-admin-${n}@example.com`,
    phone: `+9198${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'admin',
    isActive: true,
  });
  const token = await signAccessToken({ sub: String(admin._id), role: 'admin' });
  return { adminId: String(admin._id), adminToken: token };
}

async function seedFloor(): Promise<{ floorId: string }> {
  const n = next();
  const floor = await floorCreate({
    floorNumber: 1 + (n % 400),
    label: `Silence Floor ${n}`,
    totalRooms: 1,
  });
  return { floorId: String(floor._id) };
}

async function seedRoom(
  floorId: string,
  sharingType: 2 | 3 | 4 = 2,
): Promise<{ roomId: string; roomNumber: string }> {
  const n = next();
  const room = await roomCreate({
    roomNumber: `SL${String(10000 + n)}`,
    floorId,
    sharingType,
    monthlyRent: 9000,
    beds: Room.generateBeds(sharingType),
  });
  return { roomId: String(room._id), roomNumber: String(room.roomNumber) };
}

/** A resident with an account, a tenant record and a bed in a room. */
async function seedResident(
  label: string,
  roomId: string,
  bedId: 'A' | 'B' | 'C' | 'D' = 'A',
): Promise<{ residentId: string; residentToken: string; tenantId: string }> {
  const n = next();
  const user = await userCreate({
    name: `Silence Resident ${label}`,
    email: `silent-${label}-${n}@example.com`,
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
  status: 'sent' | 'partial' | 'paid' | 'cancelled' = 'sent',
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

async function seedVisitor(
  tenantId: string,
  status: 'expected' | 'arrived' = 'expected',
): Promise<string> {
  const visitor = await visitorCreate({
    tenantId,
    visitorName: 'Reha Kumar',
    visitorPhone: '+919876543210',
    purpose: 'Family visit',
    expectedArrival: new Date('2030-01-01T10:00:00.000Z'),
    status,
  });
  return String(visitor._id);
}

/** Creates an electricity bill through the server, so the readings are real. */
async function createElectricityBill(
  adminToken: string,
  roomId: string,
  month: string,
  totalBillAmount: number,
): Promise<string> {
  const res = await req('POST', '/api/v1/electricity', adminToken, {
    month,
    totalBillAmount,
    roomEntries: [{ roomId, previousReading: 100, currentReading: 200, ratePerUnit: 5 }],
  });
  expect(res.status).toBe(201);
  const data = res.json.data as Json;
  return String(data._id ?? data.id ?? '');
}

beforeEach(async () => {
  // The visitor routes sit behind the visitor management feature flag.
  await AppConfig.findOneAndUpdate(
    {},
    { $set: { 'features.visitorManagementEnabled': true } },
    { upsert: true },
  );
  invalidateFeatureFlagCache();
});

describe('Silent state closures: the state changes that used to happen in silence', () => {
  it('a visitor who arrives tells the resident who registered the guest', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('visitor-arrive', roomId);
    const visitorId = await seedVisitor(tenantId, 'expected');

    const res = await req('POST', `/api/v1/visitors/${visitorId}/arrive`, adminToken);
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.title)).toContain('arrived');
    expect(String(mine[0]!.body)).toContain('Reha Kumar');
    expect(dataOf(mine[0]!).visitorId).toBe(visitorId);

    // The admin who marked the arrival is not the recipient.
    expect(await notificationsFor(adminId)).toHaveLength(0);
  });

  it('a visitor who leaves tells the resident who registered the guest', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('visitor-depart', roomId);
    const visitorId = await seedVisitor(tenantId, 'arrived');

    const res = await req('POST', `/api/v1/visitors/${visitorId}/depart`, adminToken);
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.title)).toContain('departed');
    expect(String(mine[0]!.body)).toContain('Reha Kumar');
    expect(dataOf(mine[0]!).visitorId).toBe(visitorId);

    expect(await notificationsFor(adminId)).toHaveLength(0);
  });

  it('a room taken out of service tells the residents living in it', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId, roomNumber } = await seedRoom(floorId);
    const { residentId } = await seedResident('room-retired', roomId);

    const res = await req('PUT', `/api/v1/rooms/${roomId}`, adminToken, { isActive: false });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain(roomNumber);
    expect(dataOf(mine[0]!).roomId).toBe(roomId);

    expect(await notificationsFor(adminId)).toHaveLength(0);
  });

  it('a bed that moved tells the resident whose bed letter changed', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    // A three-sharing room with the resident in bed C. Going down to two
    // packs the beds and moves that resident from C to A.
    const { roomId, roomNumber } = await seedRoom(floorId, 3);
    const { residentId, tenantId } = await seedResident('bed-move', roomId, 'C');

    const room = await Room.findById(roomId);
    const bed = room?.beds.find((b) => b.bedId === 'C');
    if (room && bed) {
      bed.isOccupied = true;
      bed.tenantId = tenantId as unknown as mongoose.Schema.Types.ObjectId;
      await room.save();
    }

    const res = await req('PUT', `/api/v1/rooms/${roomId}`, adminToken, { sharingType: 2 });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain(roomNumber);
    expect(String(mine[0]!.body)).toContain('bed C');
    expect(String(mine[0]!.body)).toContain('bed A');
    expect(dataOf(mine[0]!).fromBedId).toBe('C');
    expect(dataOf(mine[0]!).toBedId).toBe('A');

    expect(await notificationsFor(adminId)).toHaveLength(0);
  });

  it('a distribution that leaves an invoice alone tells the office which one and why', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId, roomNumber } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('elec-skip', roomId);

    // The office cancelled this month's invoice, so the electricity share has
    // nowhere to go. The distribution used to skip it in silence.
    const invoiceId = await seedInvoice(tenantId, '2026-10', 9000, 'cancelled');

    const billId = await createElectricityBill(adminToken, roomId, '2026-10', 500);
    const finalized = await req('POST', `/api/v1/electricity/${billId}/finalize`, adminToken);
    expect(finalized.status).toBe(200);

    const res = await req('POST', `/api/v1/electricity/${billId}/distribute`, adminToken);
    expect(res.status).toBe(200);

    // The office is told which invoice was left alone and why.
    const operator = await notificationsFor(adminId);
    expect(operator).toHaveLength(1);
    expect(operator[0]!.type).toBe('electricity_bill');
    expect(String(operator[0]!.body)).toContain('INV-202610');
    expect(String(operator[0]!.body)).toContain('cancelled');
    expect(String(operator[0]!.body)).toContain(roomNumber);
    expect(dataOf(operator[0]!).billId).toBe(billId);

    // The response carries the same per-item outcome.
    const data = res.json.data as Json;
    const skipped = data.skipped as Json[];
    expect(skipped).toHaveLength(1);
    expect(String(skipped[0]!.invoiceId)).toBe(invoiceId);
    expect(String(skipped[0]!.code)).toBe('INVOICE_CANCELLED');

    // The resident whose share was left out is told that nothing is owed.
    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('electricity_bill');
    expect(String(mine[0]!.body)).toContain('INV-202610');
    expect(String(mine[0]!.body)).toContain('do not owe');
    expect(String(mine[0]!.body)).toContain('2026-10');
  });

  it('a bill whose readings disagree is refused with the code and the numbers', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);

    // The utility total says 5000, the room readings add up to 500.
    const billId = await createElectricityBill(adminToken, roomId, '2026-11', 5000);

    const res = await req('POST', `/api/v1/electricity/${billId}/finalize`, adminToken);
    expect(res.status).toBe(400);

    const error = res.json.error as Json;
    expect(String(error.code)).toBe('BILL_VARIANCE_UNRESOLVED');
    // The message names the numbers that disagree.
    expect(String(error.message)).toContain('Rs 5,000');
    expect(String(error.message)).toContain('Rs 500');

    // The bill is refused, not altered.
    const stillDraft = await req('GET', `/api/v1/electricity/${billId}`, adminToken);
    expect((stillDraft.json.data as Json).status).toBe('draft');

    // The office writes the reason down, and then the same bill finalizes:
    // the server applies the rule the screen applies.
    const reason = await req('PUT', `/api/v1/electricity/${billId}`, adminToken, {
      varianceReason: 'The utility billed the common area as well',
    });
    expect(reason.status).toBe(200);

    const ok = await req('POST', `/api/v1/electricity/${billId}/finalize`, adminToken);
    expect(ok.status).toBe(200);
  });

  it('the cron route that moves invoices overdue tells every tenant it moved', async () => {
    const { adminId } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId, tenantId } = await seedResident('overdue-job', roomId);

    const invoiceId = await seedInvoice(tenantId, '2020-01', 9000, 'sent');

    const res = await req('POST', '/api/v1/jobs/overdue-check', '', undefined, {
      'x-cron-secret': env.CRON_SECRET,
    });
    expect(res.status).toBe(200);

    const invoice = (await Invoice.findById(invoiceId).lean()) as unknown as AnyDoc;
    expect(invoice.status).toBe('overdue');

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('payment_reminder');
    expect(String(mine[0]!.body)).toContain('INV-202001');
    expect(String(mine[0]!.body)).toContain('2020-01');
    expect(dataOf(mine[0]!).invoiceId).toBe(invoiceId);

    expect(await notificationsFor(adminId)).toHaveLength(0);
  });

  it('a write that is not a decision stays silent', async () => {
    const { adminToken } = await seedAdmin();
    const { floorId } = await seedFloor();
    const { roomId } = await seedRoom(floorId);
    const { residentId } = await seedResident('quiet', roomId);

    // Housekeeping: the office repaints the room. Nobody is waiting on that.
    const res = await req('PUT', `/api/v1/rooms/${roomId}`, adminToken, {
      description: 'repainted last week',
    });
    expect(res.status).toBe(200);

    expect(await notificationsFor(residentId)).toHaveLength(0);
    expect(await allNotifications()).toHaveLength(0);
  });
});
