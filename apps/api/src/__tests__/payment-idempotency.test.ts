/**
 * Payment idempotency.
 *
 * POST /payments/offline records cash an admin collected at the desk. The
 * handler reads the paid rows, computes the balance and then writes. Two
 * requests that interleave both read "nothing paid yet" and both write, so
 * the same cash lands on the ledger twice.
 *
 * The `Idempotency-Key` header closes that hole: the key is looked up FIRST
 * and a second request carrying the same key replays the payment the first
 * one created instead of creating a second payment. The response says which
 * of the two happened (`idempotent`).
 *
 * Each case states what must never happen: a double record of the same cash,
 * an amount that changed under a replay, and a broken write for a client that
 * sends no key at all.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { User } from '../models/user.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import paymentRoutes from '../routes/payments.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
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
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Json }> {
  const res = await app.request(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...headers,
    },
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

async function seedAdmin(): Promise<string> {
  const n = next();
  const admin = await userCreate({
    name: 'Idempotency Admin',
    email: `idem-admin-${n}@example.com`,
    phone: `+9198${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'admin',
    isActive: true,
  });
  return signAccessToken({ sub: String(admin._id), role: 'admin' });
}

const TOTAL = 12000;

async function seedTenant(label: string): Promise<{ tenantId: string }> {
  const n = next();
  const user = await userCreate({
    name: `Idempotency Resident ${label}`,
    email: `idem-${label}-${n}@example.com`,
    phone: `+9198${String(20000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'tenant',
    isActive: true,
  });
  const tenant = await tenantCreate({
    userId: user._id,
    roomId: new mongoose.Types.ObjectId().toHexString(),
    bedId: 'A',
    moveInDate: new Date('2026-01-01'),
    monthlyRent: TOTAL,
    isActive: true,
  });
  return { tenantId: String(tenant._id) };
}

async function seedInvoice(tenantId: string, month: string, total: number): Promise<string> {
  const invoice = await invoiceCreate({
    invoiceNumber: `INV-${month.replace('-', '')}-${String(next()).padStart(3, '0')}`,
    tenantId,
    month,
    lineItems: [{ description: 'Room Rent', amount: total }],
    rentAmount: total,
    electricityAmount: 0,
    otherCharges: 0,
    totalAmount: total,
    status: 'sent',
    dueDate: new Date(`${month}-05T00:00:00.000Z`),
  });
  return String(invoice._id);
}

/**
 * The open obligation row the office created with the invoice. The offline
 * write reconciles this row instead of adding a second one, so the "expected"
 * total is never double counted.
 */
async function seedPendingObligation(
  tenantId: string,
  invoiceId: string,
  amount: number,
  month: string,
): Promise<void> {
  await paymentCreate({
    tenantId,
    invoiceId,
    amount,
    type: 'rent',
    method: 'upi',
    status: 'pending',
    month,
    dueDate: new Date(`${month}-05T00:00:00.000Z`),
    paidAt: null,
  });
}

/** Every paid payment row on an invoice. */
async function paidRows(invoiceId: string): Promise<AnyDoc[]> {
  const rows = await Payment.find({
    invoiceId: new mongoose.Types.ObjectId(invoiceId),
    status: 'paid',
  }).lean();
  return rows as unknown as AnyDoc[];
}

function offlineBody(tenantId: string, invoiceId: string, amount: number): Json {
  return {
    tenantId,
    invoiceId,
    amount,
    method: 'cash',
    paidAt: new Date('2026-06-01T10:00:00.000Z').toISOString(),
  };
}

async function postOffline(
  token: string,
  body: Json,
  idempotencyKey?: string,
): Promise<{ status: number; json: Json }> {
  return req(
    'POST',
    '/api/v1/payments/offline',
    token,
    body,
    idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  );
}

async function seedScenario() {
  const adminToken = await seedAdmin();
  const { tenantId } = await seedTenant('idem');
  const invoiceId = await seedInvoice(tenantId, '2026-01', TOTAL);
  await seedPendingObligation(tenantId, invoiceId, TOTAL, '2026-01');
  return { adminToken, tenantId, invoiceId };
}

describe('Offline payment idempotency (Idempotency-Key)', () => {
  it('the same key twice creates ONE payment and the second call replays it', async () => {
    const s = await seedScenario();
    const body = offlineBody(s.tenantId, s.invoiceId, 5000);

    const first = await postOffline(s.adminToken, body, 'key-alpha');
    expect(first.status).toBe(201);
    expect(first.json.success).toBe(true);
    // The response says the cash was recorded, not replayed.
    expect(first.json.idempotent).toBe(false);
    const firstId = String((first.json.data as Json).id);
    expect(firstId.length).toBeGreaterThan(0);

    const second = await postOffline(s.adminToken, body, 'key-alpha');
    expect(second.status).toBe(200);
    expect(second.json.success).toBe(true);
    // The response says this was a replay of the first write.
    expect(second.json.idempotent).toBe(true);
    // The replay hands back the payment the first request created.
    expect(String((second.json.data as Json).id)).toBe(firstId);

    // The ledger holds the cash exactly once.
    const paid = await paidRows(s.invoiceId);
    expect(paid).toHaveLength(1);
    expect(paid[0]!.idempotencyKey).toBe('key-alpha');
  });

  it('a replay never changes the amount the first request recorded', async () => {
    const s = await seedScenario();
    const body = offlineBody(s.tenantId, s.invoiceId, 5000);

    const first = await postOffline(s.adminToken, body, 'key-amount');
    expect(first.status).toBe(201);
    const firstId = String((first.json.data as Json).id);
    expect(Number((first.json.data as Json).amount)).toBe(5000);

    // The same key with a different amount is still the same payment: the
    // key is looked up before the amount is ever checked.
    const second = await postOffline(s.adminToken, { ...body, amount: 9999 }, 'key-amount');
    expect(second.status).toBe(200);
    expect(second.json.idempotent).toBe(true);
    expect(String((second.json.data as Json).id)).toBe(firstId);
    expect(Number((second.json.data as Json).amount)).toBe(5000);

    const paid = await paidRows(s.invoiceId);
    expect(paid).toHaveLength(1);
    expect(Number(paid[0]!.amount)).toBe(5000);
  });

  it('two different keys create two different payments', async () => {
    const s = await seedScenario();
    const body = offlineBody(s.tenantId, s.invoiceId, 5000);

    const first = await postOffline(s.adminToken, body, 'key-one');
    expect(first.status).toBe(201);
    expect(first.json.idempotent).toBe(false);

    const second = await postOffline(s.adminToken, body, 'key-two');
    expect(second.status).toBe(201);
    expect(second.json.idempotent).toBe(false);

    const firstId = String((first.json.data as Json).id);
    const secondId = String((second.json.data as Json).id);
    expect(secondId).not.toBe(firstId);

    // Two keys, two payments: the guard deduplicates a key, not the money.
    const paid = await paidRows(s.invoiceId);
    expect(paid).toHaveLength(2);
    const keys = paid.map((row) => String(row.idempotencyKey)).sort();
    expect(keys).toEqual(['key-one', 'key-two']);
  });

  it('a write without a key still works exactly as before', async () => {
    const s = await seedScenario();
    const body = offlineBody(s.tenantId, s.invoiceId, 5000);

    const res = await postOffline(s.adminToken, body);
    expect(res.status).toBe(201);
    expect(res.json.success).toBe(true);
    expect(res.json.idempotent).toBe(false);
    expect(Number((res.json.data as Json).amount)).toBe(5000);

    const paid = await paidRows(s.invoiceId);
    expect(paid).toHaveLength(1);
    // Nothing is stored under a key the client never sent.
    expect(paid[0]!.idempotencyKey).toBeUndefined();
  });

  it('a key longer than the model allows is refused instead of truncated', async () => {
    const s = await seedScenario();
    const body = offlineBody(s.tenantId, s.invoiceId, 5000);

    const res = await postOffline(s.adminToken, body, 'x'.repeat(101));
    expect(res.status).toBe(400);
    expect(res.json.success).toBe(false);

    // The refused write left nothing behind.
    const paid = await paidRows(s.invoiceId);
    expect(paid).toHaveLength(0);
  });
});
