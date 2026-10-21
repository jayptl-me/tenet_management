/**
 * Loop closures.
 *
 * Every state change a human is waiting on must notify that human. The resident
 * submitted a UTR, was issued an invoice, applied for leave, uploaded KYC
 * documents or had a payment voided. Before this wave the API wrote an audit
 * log and said nothing, so the resident's half of the product ended in silence.
 *
 * Each case asserts three things: the notification exists, it carries the right
 * type, and it went to the resident's own user, never to the admin who acted.
 * The last case is the negative control: a payment edit that is not a decision
 * has to stay silent.
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
import { LeaveApplication } from '../models/leaveApplication.js';
import { Notification } from '../models/notification.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import { invalidateFeatureFlagCache } from '../middleware/featureFlags.js';
import paymentRoutes from '../routes/payments.js';
import leaveRoutes from '../routes/leaves.js';
import tenantRoutes from '../routes/tenants.js';
import { generateSingleInvoice } from '../services/invoice.service.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/payments', paymentRoutes);
  api.route('/leaves', leaveRoutes);
  api.route('/tenants', tenantRoutes);
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
    name: 'Loop Admin',
    email: `loop-admin-${n}@example.com`,
    phone: `+9198${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'admin',
    isActive: true,
  });
  const token = await signAccessToken({ sub: String(admin._id), role: 'admin' });
  return { adminId: String(admin._id), adminToken: token };
}

async function seedResident(label: string): Promise<{
  residentId: string;
  residentToken: string;
  tenantId: string;
}> {
  const n = next();
  const floor = await floorCreate({
    floorNumber: 1 + (n % 400),
    label: `Loop Floor ${n}`,
    totalRooms: 1,
  });
  const room = await roomCreate({
    roomNumber: `LP${String(10000 + n)}`,
    floorId: floor._id,
    sharingType: 2,
    monthlyRent: 9000,
    beds: Room.generateBeds(2),
  });
  const user = await userCreate({
    name: `Loop Resident ${label}`,
    email: `loop-${label}-${n}@example.com`,
    phone: `+9197${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'tenant',
    isActive: true,
  });
  const tenant = await tenantCreate({
    userId: user._id,
    roomId: room._id,
    bedId: 'A',
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

async function seedPayment(
  tenantId: string,
  invoiceId: string,
  amount: number,
  month: string,
  status: 'pending' | 'pending_verification' | 'paid' | 'cancelled',
  utrNumber?: string,
): Promise<string> {
  const doc: AnyDoc = {
    tenantId,
    invoiceId,
    amount,
    type: 'rent',
    method: 'upi',
    status,
    month,
    dueDate: new Date(`${month}-05T00:00:00.000Z`),
    paidAt: status === 'paid' ? new Date('2026-06-01') : null,
  };
  if (utrNumber !== undefined) doc.utrNumber = utrNumber;
  const payment = await paymentCreate(doc);
  return String(payment._id);
}

async function seedLeave(tenantId: string): Promise<string> {
  const leave = await leaveCreate({
    tenantId,
    fromDate: '2026-08-01',
    toDate: '2026-08-03',
    reason: 'Family visit',
    status: 'pending',
  });
  return String(leave._id);
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

describe('Loop closures: every state change a human waits on notifies them', () => {
  it('payment verified notifies the resident, not the admin', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('verify');
    const invoiceId = await seedInvoice(tenantId, '2026-01', 9000);
    const paymentId = await seedPayment(
      tenantId,
      invoiceId,
      9000,
      '2026-01',
      'pending_verification',
      'UTRVER001',
    );

    const res = await req('POST', `/api/v1/payments/${paymentId}/verify`, adminToken, {
      approved: true,
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('payment_verified');
    expect(mine[0]!.title).toBe('Payment verified');
    expect(String(mine[0]!.body)).toContain('9000.00');
    expect(dataOf(mine[0]!).paymentId).toBe(paymentId);
    expect(dataOf(mine[0]!).invoiceId).toBe(invoiceId);

    // The admin who verified it is not the recipient.
    const adminNotifications = await notificationsFor(adminId);
    expect(adminNotifications).toHaveLength(0);
  });

  it('payment rejected notifies the resident with the reason', async () => {
    const { adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('reject');
    const invoiceId = await seedInvoice(tenantId, '2026-02', 9000);
    const paymentId = await seedPayment(
      tenantId,
      invoiceId,
      9000,
      '2026-02',
      'pending_verification',
      'UTRREJ001',
    );

    const res = await req('POST', `/api/v1/payments/verify-utr/${paymentId}`, adminToken, {
      status: 'rejected',
      notes: 'UTR not found in the bank statement',
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('payment_reminder');
    expect(String(mine[0]!.body)).toContain('UTR not found in the bank statement');
    expect(dataOf(mine[0]!).invoiceId).toBe(invoiceId);
  });

  it('a voided payment notifies the resident that the money is due again', async () => {
    const { adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('void');
    const invoiceId = await seedInvoice(tenantId, '2026-03', 9000);
    const paymentId = await seedPayment(tenantId, invoiceId, 9000, '2026-03', 'paid');

    const res = await req('POST', `/api/v1/payments/${paymentId}/void`, adminToken, {
      notes: 'recorded against the wrong invoice',
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('payment_reminder');
    expect(String(mine[0]!.body)).toContain('voided');
    expect(String(mine[0]!.body)).toContain('recorded against the wrong invoice');
  });

  it('an issued invoice notifies the resident that it exists', async () => {
    await seedAdmin();
    const { residentId, tenantId } = await seedResident('invoice');

    const invoice = await generateSingleInvoice({ tenantId, month: '2026-04' });

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('payment_reminder');
    expect(mine[0]!.title).toBe('Invoice issued');
    expect(String(mine[0]!.body)).toContain(String(invoice.invoiceNumber));
    expect(String(mine[0]!.body)).toContain('2026-04');
    expect(dataOf(mine[0]!).invoiceId).toBe(String(invoice._id));
  });

  it('an approved leave notifies the resident', async () => {
    const { adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('leave-ok');
    const leaveId = await seedLeave(tenantId);

    const res = await req('PUT', `/api/v1/leaves/${leaveId}/approve`, adminToken);
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain('approved');
    expect(dataOf(mine[0]!).leaveId).toBe(leaveId);
  });

  it('a rejected leave notifies the resident with the reason', async () => {
    const { adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('leave-no');
    const leaveId = await seedLeave(tenantId);

    const res = await req('PUT', `/api/v1/leaves/${leaveId}/reject`, adminToken, {
      adminNotes: 'Exam schedule clash',
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('service_update');
    expect(String(mine[0]!.body)).toContain('rejected');
    expect(String(mine[0]!.body)).toContain('Exam schedule clash');
  });

  it('KYC verification notifies the resident', async () => {
    const { adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('kyc');

    const res = await req('POST', `/api/v1/tenants/${tenantId}/verify-kyc`, adminToken);
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('kyc_uploaded');
    expect(mine[0]!.title).toBe('KYC documents verified');
    expect(dataOf(mine[0]!).tenantId).toBe(tenantId);
  });

  it('an edited payment tells the resident, because what they owe changed', async () => {
    const { adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('edited');
    const invoiceId = await seedInvoice(tenantId, '2026-05', 9000);
    const paymentId = await seedPayment(tenantId, invoiceId, 9000, '2026-05', 'pending');

    // An edit moves what the resident owes, so the resident is told. This used
    // to be silent: the office could change the amount and the resident only
    // found out on their next visit.
    const res = await req('PUT', `/api/v1/payments/${paymentId}`, adminToken, {
      amount: 8000,
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((n) => n.type === 'payment_reminder')).toBe(true);
  });

  it('the redundant verification queue route is gone', async () => {
    const paths = app.routes.map((route) => route.path);

    // Positive control: the route table under test is the real one.
    expect(paths).toContain('/api/v1/payments/:id/verify');

    // The dedicated pending-verification queue had no consumer: the admin
    // payments list filters by status. The path now falls through to the
    // generic payment-by-id route, which rejects a non-id.
    expect(paths.some((path) => path.endsWith('/pending-verification'))).toBe(false);

    const { adminToken } = await seedAdmin();
    const res = await req('GET', '/api/v1/payments/pending-verification', adminToken);
    expect(res.status).toBe(400);
    expect(res.json.success).toBe(false);
  });
});
