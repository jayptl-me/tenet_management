/**
 * Invoice edit integrity.
 *
 * Editing an invoice is a money write: the amounts change, so the status,
 * the open obligation and the evidence of what a resident paid must follow.
 *
 * Four things must hold, and each one used to be broken:
 *
 *   1. The status is recomputed after the edit. A status that says
 *      "partial" while the balance is zero, or "sent" on a settled invoice,
 *      is a lie the resident and the office both read.
 *   2. A pending_verification row is a resident's money transfer. Its amount
 *      is the resident's declaration and an invoice edit must never rewrite
 *      it, not even to void it.
 *   3. An invoice that still carries a payment record cannot be deleted: the
 *      payment row is the evidence that money moved, and deleting the invoice
 *      wiped the resident's UTR number and its screenshot.
 *   4. The aging report and the invoice row report the same numbers.
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
import invoiceRoutes from '../routes/invoices.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
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

async function seedAdmin(): Promise<string> {
  const n = next();
  const admin = await userCreate({
    name: 'Edit Integrity Admin',
    email: `edit-admin-${n}@example.com`,
    phone: `+9197${String(10000000 + n).slice(-8)}`,
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
    name: `Edit Integrity Resident ${label}`,
    email: `edit-${label}-${n}@example.com`,
    phone: `+9197${String(20000000 + n).slice(-8)}`,
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

type SeedInvoiceOptions = {
  total?: number;
  status?: 'draft' | 'sent' | 'partial' | 'overdue' | 'paid' | 'cancelled';
  /** Days past the due date. 0 means due today. */
  daysPastDue?: number;
};

async function seedInvoice(
  tenantId: string,
  month: string,
  options: SeedInvoiceOptions = {},
): Promise<string> {
  const total = options.total ?? TOTAL;
  const daysPastDue = options.daysPastDue ?? 0;
  const invoice = await invoiceCreate({
    invoiceNumber: `INV-${month.replace('-', '')}-${String(next()).padStart(3, '0')}`,
    tenantId,
    month,
    lineItems: [{ description: 'Room Rent', amount: total }],
    rentAmount: total,
    electricityAmount: 0,
    otherCharges: 0,
    totalAmount: total,
    status: options.status ?? 'sent',
    dueDate: new Date(Date.now() - daysPastDue * 24 * 60 * 60 * 1000),
  });
  return String(invoice._id);
}

type PaymentStatus = 'pending' | 'pending_verification' | 'paid' | 'cancelled';

async function seedPayment(
  tenantId: string,
  invoiceId: string,
  amount: number,
  month: string,
  status: PaymentStatus,
  utrNumber?: string,
): Promise<string> {
  const doc: AnyDoc = {
    tenantId,
    invoiceId,
    amount,
    type: 'rent',
    method: status === 'pending_verification' ? 'upi' : 'cash',
    status,
    month,
    dueDate: new Date(Date.now()),
    paidAt: status === 'paid' ? new Date('2026-06-01') : null,
  };
  if (utrNumber !== undefined) doc.utrNumber = utrNumber;
  const payment = await paymentCreate(doc);
  return String(payment._id);
}

async function paymentById(id: string): Promise<AnyDoc | null> {
  const doc = await Payment.findById(id).lean();
  return doc as unknown as AnyDoc | null;
}

async function seedScenario() {
  const adminToken = await seedAdmin();
  const { tenantId } = await seedTenant('edit');
  return { adminToken, tenantId };
}

describe('Invoice edit recomputes the status from the money', () => {
  it('a settled invoice stops saying "sent" after an edit', async () => {
    const s = await seedScenario();
    const invoiceId = await seedInvoice(s.tenantId, '2026-01');
    // The invoice is fully paid but its status never caught up.
    await seedPayment(s.tenantId, invoiceId, TOTAL, '2026-01', 'paid');

    const before = await req('GET', `/api/v1/invoices/${invoiceId}`, s.adminToken);
    expect(before.status).toBe(200);
    expect((before.json.data as Json).status).toBe('sent');
    expect((before.json.data as Json).balance).toBe(0);

    const edit = await req('PUT', `/api/v1/invoices/${invoiceId}`, s.adminToken, {
      rentAmount: TOTAL,
    });
    expect(edit.status).toBe(200);

    // The status follows the money, not the stale row.
    expect((edit.json.data as Json).status).toBe('paid');

    const after = await req('GET', `/api/v1/invoices/${invoiceId}`, s.adminToken);
    expect((after.json.data as Json).status).toBe('paid');
    expect((after.json.data as Json).balance).toBe(0);
  });

  it('a partly paid invoice becomes "partial" after an edit', async () => {
    const s = await seedScenario();
    const invoiceId = await seedInvoice(s.tenantId, '2026-02');
    await seedPayment(s.tenantId, invoiceId, 4000, '2026-02', 'paid');

    const edit = await req('PUT', `/api/v1/invoices/${invoiceId}`, s.adminToken, {
      rentAmount: TOTAL,
    });
    expect(edit.status).toBe(200);
    expect((edit.json.data as Json).status).toBe('partial');

    const after = await req('GET', `/api/v1/invoices/${invoiceId}`, s.adminToken);
    const data = after.json.data as Json;
    expect(data.status).toBe('partial');
    expect(data.paidAmount).toBe(4000);
    expect(data.balance).toBe(TOTAL - 4000);
  });
});

describe('An invoice edit never touches a resident transfer', () => {
  it('a pending_verification row keeps its original amount and its UTR', async () => {
    const s = await seedScenario();
    const invoiceId = await seedInvoice(s.tenantId, '2026-03');
    // The resident declared this transfer and is waiting for the verdict.
    const paymentId = await seedPayment(
      s.tenantId,
      invoiceId,
      TOTAL,
      '2026-03',
      'pending_verification',
      'UTREDIT01',
    );

    const edit = await req('PUT', `/api/v1/invoices/${invoiceId}`, s.adminToken, {
      rentAmount: 10000,
    });
    expect(edit.status).toBe(200);

    const row = await paymentById(paymentId);
    expect(row).toBeTruthy();
    // The resident's declared amount is never rewritten by an invoice edit.
    expect(Number(row!.amount)).toBe(TOTAL);
    // And the row is not voided either: the verification step resolves the
    // mismatch between the declared amount and the new total.
    expect(row!.status).toBe('pending_verification');
    expect(row!.utrNumber).toBe('UTREDIT01');
  });

  it('the system obligation row is the only one an edit may adjust', async () => {
    const s = await seedScenario();
    const invoiceId = await seedInvoice(s.tenantId, '2026-04');
    const pendingId = await seedPayment(s.tenantId, invoiceId, TOTAL, '2026-04', 'pending');

    const edit = await req('PUT', `/api/v1/invoices/${invoiceId}`, s.adminToken, {
      rentAmount: 10000,
    });
    expect(edit.status).toBe(200);

    const row = await paymentById(pendingId);
    expect(row).toBeTruthy();
    // The system row follows the new balance.
    expect(Number(row!.amount)).toBe(10000);
    expect(row!.status).toBe('pending');
  });
});

describe('An invoice with payment records cannot be deleted', () => {
  it('a resident transfer blocks the delete and the error names the reason', async () => {
    const s = await seedScenario();
    const invoiceId = await seedInvoice(s.tenantId, '2026-05');
    const paymentId = await seedPayment(
      s.tenantId,
      invoiceId,
      TOTAL,
      '2026-05',
      'pending_verification',
      'UTRDEL001',
    );

    const res = await req('DELETE', `/api/v1/invoices/${invoiceId}`, s.adminToken);
    expect(res.status).toBe(409);
    expect(res.json.success).toBe(false);

    const error = res.json.error as Json;
    expect(error.code).toBe('INVOICE_HAS_PAYMENTS');
    // The error says why, in words an operator can act on.
    expect(String(error.message)).toContain('payment record');
    expect(String(error.message)).toContain('1 payment record(s)');

    // The invoice is still there and so is the evidence of the transfer.
    const invoice = await req('GET', `/api/v1/invoices/${invoiceId}`, s.adminToken);
    expect(invoice.status).toBe(200);
    const row = await paymentById(paymentId);
    expect(row).toBeTruthy();
    expect(row!.utrNumber).toBe('UTRDEL001');
  });

  it('an open obligation row blocks the delete too', async () => {
    const s = await seedScenario();
    const invoiceId = await seedInvoice(s.tenantId, '2026-06');
    await seedPayment(s.tenantId, invoiceId, TOTAL, '2026-06', 'pending');

    const res = await req('DELETE', `/api/v1/invoices/${invoiceId}`, s.adminToken);
    expect(res.status).toBe(409);
    expect((res.json.error as Json).code).toBe('INVOICE_HAS_PAYMENTS');
  });

  it('an invoice with no payment record can still be deleted', async () => {
    const s = await seedScenario();
    const invoiceId = await seedInvoice(s.tenantId, '2026-07');

    const res = await req('DELETE', `/api/v1/invoices/${invoiceId}`, s.adminToken);
    expect(res.status).toBe(200);

    const gone = await req('GET', `/api/v1/invoices/${invoiceId}`, s.adminToken);
    expect(gone.status).toBe(404);
  });
});

describe('The aging report and the invoice row report the same numbers', () => {
  it('the outstanding total of the aging report is the balance of the invoice', async () => {
    const s = await seedScenario();
    // Due five days ago, so the invoice lands in the 1-30 day bucket.
    const invoiceId = await seedInvoice(s.tenantId, '2026-08', { daysPastDue: 5 });
    await seedPayment(s.tenantId, invoiceId, 4000, '2026-08', 'paid');

    const detail = await req('GET', `/api/v1/invoices/${invoiceId}`, s.adminToken);
    expect(detail.status).toBe(200);
    const data = detail.json.data as Json;
    expect(data.balance).toBe(TOTAL - 4000);
    expect(data.paidAmount).toBe(4000);

    const aging = await req('GET', '/api/v1/invoices/aging', s.adminToken);
    expect(aging.status).toBe(200);
    const agingData = aging.json.data as Json;
    const buckets = agingData.buckets as Json;
    const days1_30 = buckets.days1_30 as Json;

    // The report and the row can never disagree.
    expect(Number(days1_30.amount)).toBe(TOTAL - 4000);
    expect(days1_30.count).toBe(1);
    expect(Number(agingData.totalOutstanding)).toBe(TOTAL - 4000);
  });

  it('a settled invoice is not counted as outstanding', async () => {
    const s = await seedScenario();
    const invoiceId = await seedInvoice(s.tenantId, '2026-09', { daysPastDue: 3 });
    await seedPayment(s.tenantId, invoiceId, TOTAL, '2026-09', 'paid');

    const aging = await req('GET', '/api/v1/invoices/aging', s.adminToken);
    expect(aging.status).toBe(200);
    const agingData = aging.json.data as Json;
    expect(Number(agingData.totalOutstanding)).toBe(0);
  });
});
