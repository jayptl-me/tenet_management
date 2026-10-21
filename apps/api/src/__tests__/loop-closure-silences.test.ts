/**
 * Loop closures: the silences.
 *
 * Three state changes used to happen without telling anybody. The resident
 * half of the product ended in silence: a payment record vanished, an
 * invoice was voided, and the cron marked invoices overdue without a word.
 *
 * This suite covers the two the route files own:
 *
 *   - DELETE /payments/:id removes a resident's payment record. A UTR
 *     number and its screenshot are the evidence that money moved, so the
 *     resident has to hear that the record is gone.
 *   - An invoice the office cancelled. The resident owes (or was owed) that
 *     money and must hear the invoice was voided.
 *
 * Each case asserts the notification exists, carries the right type, and went
 * to the resident's own user, never to the admin who acted.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { User } from '../models/user.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { Notification } from '../models/notification.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import paymentRoutes from '../routes/payments.js';
import invoiceRoutes from '../routes/invoices.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/payments', paymentRoutes);
  api.route('/invoices', invoiceRoutes);
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
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const invoiceCreate = Invoice.create.bind(Invoice) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const paymentCreate = Payment.create.bind(Payment) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

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

async function seedAdmin(): Promise<{ adminId: string; adminToken: string }> {
  const n = next();
  const admin = await userCreate({
    name: 'Silence Admin',
    email: `silence-admin-${n}@example.com`,
    phone: `+9196${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'admin',
    isActive: true,
  });
  const token = await signAccessToken({ sub: String(admin._id), role: 'admin' });
  return { adminId: String(admin._id), adminToken: token };
}

async function seedResident(label: string): Promise<{
  residentId: string;
  tenantId: string;
}> {
  const n = next();
  const user = await userCreate({
    name: `Silence Resident ${label}`,
    email: `silence-${label}-${n}@example.com`,
    phone: `+9196${String(20000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'tenant',
    isActive: true,
  });
  const tenant = await tenantCreate({
    userId: user._id,
    roomId: new mongoose.Types.ObjectId().toHexString(),
    bedId: 'A',
    moveInDate: new Date('2026-01-01'),
    monthlyRent: 9000,
    isActive: true,
  });
  return { residentId: String(user._id), tenantId: String(tenant._id) };
}

async function seedInvoice(
  tenantId: string,
  month: string,
  total: number,
  status: 'sent' | 'draft' = 'sent',
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
  status: 'pending' | 'pending_verification' | 'paid',
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

describe('Loop closures: the state changes that used to happen in silence', () => {
  it('deleting a payment record notifies the resident', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('payment-delete');
    const invoiceId = await seedInvoice(tenantId, '2026-01', 9000);
    const paymentId = await seedPayment(
      tenantId,
      invoiceId,
      9000,
      '2026-01',
      'pending_verification',
      'UTRDEL002',
    );

    const res = await req('DELETE', `/api/v1/payments/${paymentId}`, adminToken);
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('payment_reminder');
    expect(String(mine[0]!.title)).toContain('removed');
    expect(String(mine[0]!.body)).toContain('9000.00');
    expect(dataOf(mine[0]!).paymentId).toBe(paymentId);
    expect(dataOf(mine[0]!).invoiceId).toBe(invoiceId);

    // The admin who deleted it is not the recipient.
    expect(await notificationsFor(adminId)).toHaveLength(0);
  });

  it('cancelling an invoice notifies the tenant', async () => {
    const { adminId, adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('invoice-cancel');
    // A zero-total invoice carries no outstanding dues, so the office may
    // void it.
    const invoiceId = await seedInvoice(tenantId, '2026-02', 0);
    const invoice = (await Invoice.findById(invoiceId).lean()) as unknown as AnyDoc | null;
    const invoiceNumber = String(invoice?.invoiceNumber ?? '');

    const res = await req('PUT', `/api/v1/invoices/${invoiceId}`, adminToken, {
      status: 'cancelled',
    });
    expect(res.status).toBe(200);
    expect((res.json.data as Json).status).toBe('cancelled');

    const mine = await notificationsFor(residentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.type).toBe('payment_reminder');
    expect(mine[0]!.title).toBe('Invoice cancelled');
    expect(String(mine[0]!.body)).toContain(invoiceNumber);
    expect(String(mine[0]!.body)).toContain('2026-02');
    expect(dataOf(mine[0]!).invoiceId).toBe(invoiceId);

    // The admin who cancelled it is not the recipient.
    expect(await notificationsFor(adminId)).toHaveLength(0);
  });

  it('an edited payment tells the resident, because what they owe changed', async () => {
    const { adminToken } = await seedAdmin();
    const { residentId, tenantId } = await seedResident('edited-payment');
    const invoiceId = await seedInvoice(tenantId, '2026-03', 9000);
    const paymentId = await seedPayment(tenantId, invoiceId, 9000, '2026-03', 'pending');

    // An edit moves what the resident owes. This used to be silent: the office
    // could change the amount and the resident only found out on their next
    // visit. A state change a human is waiting on has to reach them.
    const res = await req('PUT', `/api/v1/payments/${paymentId}`, adminToken, {
      amount: 8000,
    });
    expect(res.status).toBe(200);

    const mine = await notificationsFor(residentId);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((n) => n.type === 'payment_reminder')).toBe(true);
  });
});
