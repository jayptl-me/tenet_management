/**
 * Invoice money fields - GET /invoices, GET /invoices/my, GET /invoices/:id and
 * GET /tenants/:id/invoices must all return the SAME server-computed
 * `paidAmount` and `balance`.
 *
 * Covers the three money states (fully unpaid, partly paid, fully paid) and
 * proves the numbers come from paid payments only: a pending, a
 * pending_verification (the resident UTR row) or a cancelled row never
 * reduces the balance, so a client never has to compute it.
 *
 * The settled sum is the REAL sum of the paid rows, never a number capped at
 * the invoice total: an over-collected invoice reports the overpayment, so
 * the invoice view can never under-report what the payments ledger shows.
 *
 * The single read and the batch read of the payment-status service must
 * return the same numbers for the same invoice, including for a legacy row
 * that stored its invoice id as a string.
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
import tenantRoutes from '../routes/tenants.js';
import { getInvoiceSettlement, getInvoiceSettlements } from '../services/payment-status.service.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/invoices', invoiceRoutes);
  api.route('/tenants', tenantRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();

async function req(
  method: string,
  path: string,
  token: string,
): Promise<{ status: number; json: Json }> {
  const res = await app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

async function seedUser(role: 'admin' | 'tenant', label: string) {
  const n = next();
  const user = await userCreate({
    name: `Balance ${label}`,
    email: `balance-${label}-${n}@example.com`,
    phone: `+9198${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role,
    isActive: true,
  });
  const token = await signAccessToken({ sub: String(user._id), role });
  return { userId: String(user._id), token };
}

async function seedTenant(label: string) {
  const { userId, token } = await seedUser('tenant', label);
  const tenant = await tenantCreate({
    userId,
    roomId: new mongoose.Types.ObjectId().toHexString(),
    bedId: 'A',
    moveInDate: new Date('2026-01-01'),
    monthlyRent: 9000,
    isActive: true,
  });
  return { tenantId: String(tenant._id), token };
}

async function seedInvoice(tenantId: string, month: string, total: number): Promise<string> {
  const invoice = await invoiceCreate({
    // The invoice number carries a unique index, so it must differ per seed.
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

type PaymentStatus = 'pending' | 'pending_verification' | 'paid' | 'cancelled';

async function seedPayment(
  invoiceId: string,
  tenantId: string,
  amount: number,
  month: string,
  status: PaymentStatus,
): Promise<void> {
  await paymentCreate({
    tenantId,
    invoiceId,
    amount,
    type: 'rent',
    method: 'cash',
    status,
    month,
    dueDate: new Date(`${month}-05T00:00:00.000Z`),
    paidAt: status === 'paid' ? new Date('2026-06-01') : null,
  });
}

const TOTAL = 12000;
const PARTIAL_PAID = 4000;

async function seedScenario() {
  const { token: adminToken } = await seedUser('admin', 'admin');
  const { tenantId, token: tenantToken } = await seedTenant('resident');
  const { tenantId: otherTenantId, token: otherToken } = await seedTenant('other');

  const unpaidId = await seedInvoice(tenantId, '2026-01', TOTAL);
  const partialId = await seedInvoice(tenantId, '2026-02', TOTAL);
  const fullId = await seedInvoice(tenantId, '2026-03', TOTAL);
  const utrId = await seedInvoice(tenantId, '2026-04', TOTAL);
  const overpaidId = await seedInvoice(tenantId, '2026-05', TOTAL);
  const zeroId = await seedInvoice(tenantId, '2026-06', 0);
  const zeroPaidId = await seedInvoice(tenantId, '2026-07', 0);
  const otherInvoiceId = await seedInvoice(otherTenantId, '2026-01', 5000);

  // Negative control, on the PARTLY paid invoice: a pending row and a
  // cancelled row must not reduce the balance, so what is left is exactly
  // what the paid rows left outstanding.
  await seedPayment(partialId, tenantId, 2000, '2026-02', 'pending');
  await seedPayment(partialId, tenantId, 1000, '2026-02', 'cancelled');
  await seedPayment(partialId, tenantId, PARTIAL_PAID, '2026-02', 'paid');

  await seedPayment(fullId, tenantId, TOTAL, '2026-03', 'paid');

  // A resident UTR row is not money yet: it must not reduce the balance.
  await seedPayment(utrId, tenantId, TOTAL, '2026-04', 'pending_verification');

  // Over-collected: two paid rows of the full total on a one-total invoice.
  await seedPayment(overpaidId, tenantId, TOTAL, '2026-05', 'paid');
  await seedPayment(overpaidId, tenantId, TOTAL, '2026-05', 'paid');

  // A zero-total invoice with a paid row: the balance clamps at 0, the
  // settled sum is still reported.
  await seedPayment(zeroPaidId, tenantId, 500, '2026-07', 'paid');

  // Another tenant's paid row on another tenant's invoice: it must never
  // touch this tenant's money.
  await seedPayment(otherInvoiceId, otherTenantId, 5000, '2026-01', 'paid');

  return {
    adminToken,
    tenantToken,
    otherToken,
    tenantId,
    otherTenantId,
    unpaidId,
    partialId,
    fullId,
    utrId,
    overpaidId,
    zeroId,
    zeroPaidId,
    otherInvoiceId,
  };
}

/**
 * The settled sum the API reports for an invoice.
 *
 * The API must report the REAL settled sum (every paid payment row, not
 * capped at the invoice total). When this fails, the route still derives
 * `paidAmount` from `total - balance` instead of using the settled sum the
 * payment-status service returns.
 */
function expectSettled(data: Json, expected: number): void {
  expect(
    data.paidAmount,
    `The API reported paidAmount=${String(data.paidAmount)} but the settled sum of the paid payment rows is ${expected}. The invoice route must use the settled sum from getInvoiceSettlement(), not (totalAmount - balance).`,
  ).toBe(expected);
}

describe('Invoice money fields (paidAmount / balance)', () => {
  it('admin list returns the server-computed paidAmount and balance', async () => {
    const s = await seedScenario();

    const res = await req('GET', '/api/v1/invoices?limit=50', s.adminToken);
    expect(res.status).toBe(200);
    const rows = res.json.data as Json[];
    const rowOf = (id: string) => rows.find((r) => String(r._id) === id);

    const unpaid = rowOf(s.unpaidId);
    expect(unpaid).toBeTruthy();
    expect(unpaid!.paidAmount).toBe(0);
    expect(unpaid!.balance).toBe(TOTAL);

    const partial = rowOf(s.partialId);
    expect(partial).toBeTruthy();
    expect(partial!.paidAmount).toBe(PARTIAL_PAID);
    expect(partial!.balance).toBe(TOTAL - PARTIAL_PAID);

    const full = rowOf(s.fullId);
    expect(full).toBeTruthy();
    expect(full!.paidAmount).toBe(TOTAL);
    expect(full!.balance).toBe(0);

    // Existing fields are untouched by the additive money fields.
    expect(unpaid!.totalAmount).toBe(TOTAL);
    expect(unpaid!.month).toBe('2026-01');
    expect(String(unpaid!.invoiceNumber)).toMatch(/^INV-202601-\d{3}$/);
  });

  it('resident list returns the same money fields and only the caller own invoices', async () => {
    const s = await seedScenario();

    const res = await req('GET', '/api/v1/invoices/my', s.tenantToken);
    expect(res.status).toBe(200);
    const rows = res.json.data as Json[];

    for (const row of rows) {
      const tenantRef = row.tenantId as Json;
      expect(String(tenantRef._id)).toBe(s.tenantId);
    }

    const unpaid = rows.find((r) => String(r._id) === s.unpaidId);
    expect(unpaid).toBeTruthy();
    expect(unpaid!.paidAmount).toBe(0);
    expect(unpaid!.balance).toBe(TOTAL);

    const partial = rows.find((r) => String(r._id) === s.partialId);
    expect(partial).toBeTruthy();
    expect(partial!.paidAmount).toBe(PARTIAL_PAID);
    expect(partial!.balance).toBe(TOTAL - PARTIAL_PAID);

    const full = rows.find((r) => String(r._id) === s.fullId);
    expect(full).toBeTruthy();
    expect(full!.paidAmount).toBe(TOTAL);
    expect(full!.balance).toBe(0);

    // Admin-safety: another tenant invoice never appears in the resident list.
    expect(rows.find((r) => String(r._id) === s.otherInvoiceId)).toBeUndefined();
  });

  it('invoice detail agrees with the lists and stays owner-scoped', async () => {
    const s = await seedScenario();

    const cases: Array<{ id: string; paidAmount: number; balance: number }> = [
      { id: s.unpaidId, paidAmount: 0, balance: TOTAL },
      { id: s.partialId, paidAmount: PARTIAL_PAID, balance: TOTAL - PARTIAL_PAID },
      { id: s.fullId, paidAmount: TOTAL, balance: 0 },
    ];

    for (const c of cases) {
      const res = await req('GET', `/api/v1/invoices/${c.id}`, s.adminToken);
      expect(res.status).toBe(200);
      const data = res.json.data as Json;
      expect(data.paidAmount).toBe(c.paidAmount);
      expect(data.balance).toBe(c.balance);
    }

    // The resident reads their own invoice and sees the same numbers.
    const own = await req('GET', `/api/v1/invoices/${s.partialId}`, s.tenantToken);
    expect(own.status).toBe(200);
    const ownData = own.json.data as Json;
    expect(ownData.paidAmount).toBe(PARTIAL_PAID);
    expect(ownData.balance).toBe(TOTAL - PARTIAL_PAID);

    // Another tenant cannot read it.
    const foreign = await req('GET', `/api/v1/invoices/${s.partialId}`, s.otherToken);
    expect(foreign.status).toBe(403);
  });

  it('a pending_verification UTR row never reduces the balance', async () => {
    const s = await seedScenario();

    const list = await req('GET', '/api/v1/invoices?limit=50', s.adminToken);
    const row = (list.json.data as Json[]).find((r) => String(r._id) === s.utrId);
    expect(row).toBeTruthy();
    expect(row!.paidAmount).toBe(0);
    expect(row!.balance).toBe(TOTAL);

    const detail = await req('GET', `/api/v1/invoices/${s.utrId}`, s.adminToken);
    expect(detail.status).toBe(200);
    const data = detail.json.data as Json;
    expect(data.paidAmount).toBe(0);
    expect(data.balance).toBe(TOTAL);

    // The service agrees: an unverified UTR is not settled money.
    const settlement = await getInvoiceSettlement(s.utrId, TOTAL);
    expect(settlement.paidAmount).toBe(0);
    expect(settlement.balance).toBe(TOTAL);
  });

  it('a pending and a cancelled row never reduce the balance of a partly paid invoice', async () => {
    const s = await seedScenario();

    // The partial invoice carries a paid row of 4000, a pending row of 2000
    // and a cancelled row of 1000. Only the paid row counts.
    const detail = await req('GET', `/api/v1/invoices/${s.partialId}`, s.adminToken);
    expect(detail.status).toBe(200);
    const data = detail.json.data as Json;
    expect(data.paidAmount).toBe(PARTIAL_PAID);
    expect(data.balance).toBe(TOTAL - PARTIAL_PAID);

    const settlement = await getInvoiceSettlement(s.partialId, TOTAL);
    expect(settlement.paidAmount).toBe(PARTIAL_PAID);
    expect(settlement.balance).toBe(TOTAL - PARTIAL_PAID);
  });

  it('an over-collected invoice reports the real settled sum and a zero balance', async () => {
    const s = await seedScenario();

    const detail = await req('GET', `/api/v1/invoices/${s.overpaidId}`, s.adminToken);
    expect(detail.status).toBe(200);
    const data = detail.json.data as Json;

    // The settled sum is the money actually collected, not the capped total.
    expectSettled(data, 2 * TOTAL);
    // The balance never goes negative.
    expect(data.balance).toBe(0);

    const list = await req('GET', '/api/v1/invoices?limit=50', s.adminToken);
    const row = (list.json.data as Json[]).find((r) => String(r._id) === s.overpaidId);
    expect(row).toBeTruthy();
    expectSettled(row!, 2 * TOTAL);
    expect(row!.balance).toBe(0);
  });

  it('a zero-total invoice reports zero money and never a negative balance', async () => {
    const s = await seedScenario();

    const empty = await req('GET', `/api/v1/invoices/${s.zeroId}`, s.adminToken);
    expect(empty.status).toBe(200);
    const emptyData = empty.json.data as Json;
    expect(emptyData.totalAmount).toBe(0);
    expect(emptyData.paidAmount).toBe(0);
    expect(emptyData.balance).toBe(0);

    // A payment on a zero-total invoice: the balance still clamps at 0 and
    // the settled sum is still reported.
    const withPayment = await req('GET', `/api/v1/invoices/${s.zeroPaidId}`, s.adminToken);
    expect(withPayment.status).toBe(200);
    const paidData = withPayment.json.data as Json;
    expect(paidData.totalAmount).toBe(0);
    expectSettled(paidData, 500);
    expect(paidData.balance).toBe(0);
  });

  it("another tenant's payment row never changes this tenant's invoice", async () => {
    const s = await seedScenario();

    const detail = await req('GET', `/api/v1/invoices/${s.partialId}`, s.adminToken);
    expect(detail.status).toBe(200);
    const data = detail.json.data as Json;
    expect(data.paidAmount).toBe(PARTIAL_PAID);
    expect(data.balance).toBe(TOTAL - PARTIAL_PAID);

    // The other tenant's invoice carries its own money, and only its own.
    const other = await req('GET', `/api/v1/invoices/${s.otherInvoiceId}`, s.adminToken);
    expect(other.status).toBe(200);
    const otherData = other.json.data as Json;
    expect(otherData.paidAmount).toBe(5000);
    expect(otherData.balance).toBe(0);
  });

  it('GET /tenants/:id/invoices returns the same money fields as the invoice list', async () => {
    const s = await seedScenario();

    const res = await req('GET', `/api/v1/tenants/${s.tenantId}/invoices`, s.adminToken);
    expect(res.status).toBe(200);
    const rows = res.json.data as Json[];
    const rowOf = (id: string) => rows.find((r) => String(r._id) === id);

    const unpaid = rowOf(s.unpaidId);
    expect(unpaid).toBeTruthy();
    expect(unpaid!.paidAmount).toBe(0);
    expect(unpaid!.balance).toBe(TOTAL);

    const partial = rowOf(s.partialId);
    expect(partial).toBeTruthy();
    expect(partial!.paidAmount).toBe(PARTIAL_PAID);
    expect(partial!.balance).toBe(TOTAL - PARTIAL_PAID);

    const overpaid = rowOf(s.overpaidId);
    expect(overpaid).toBeTruthy();
    expectSettled(overpaid!, 2 * TOTAL);
    expect(overpaid!.balance).toBe(0);

    // Another tenant's invoice is never in this tenant's list.
    expect(rowOf(s.otherInvoiceId)).toBeUndefined();
  });

  it('the settled sum and the balance never hide an overpayment', async () => {
    const s = await seedScenario();

    // The payments ledger is the source of truth for what was collected.
    const ledgerRows = (await Payment.find({
      invoiceId: new mongoose.Types.ObjectId(s.overpaidId),
      status: 'paid',
    }).lean()) as unknown as Array<{ amount: number }>;
    const ledgerSum = ledgerRows.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    expect(ledgerSum).toBe(2 * TOTAL);

    const detail = await req('GET', `/api/v1/invoices/${s.overpaidId}`, s.adminToken);
    const data = detail.json.data as Json;
    const settled = Number(data.paidAmount);
    const balance = Number(data.balance);

    // The invoice view reports exactly what the ledger shows.
    expect(settled).toBe(ledgerSum);
    // The balance is the clamped remainder, never a negative number.
    expect(balance).toBe(0);
    expect(balance).toBe(Math.max(0, TOTAL - settled));
    // The excess is visible: settled + balance is bigger than the invoice.
    expect(settled).toBeGreaterThan(TOTAL);
    expect(settled + balance).toBeGreaterThan(TOTAL);
  });
});

describe('Invoice settlement service (single read and batch read agree)', () => {
  it('the single read and the batch read return the same numbers', async () => {
    const s = await seedScenario();

    const ids = [s.unpaidId, s.partialId, s.fullId, s.overpaidId];
    const totals: Record<string, number> = {};
    for (const id of ids) totals[id] = TOTAL;

    const batch = await getInvoiceSettlements(ids, totals);
    for (const id of ids) {
      const single = await getInvoiceSettlement(id, TOTAL);
      expect(batch.get(id)).toEqual(single);
    }

    expect(batch.get(s.unpaidId)).toEqual({
      totalAmount: TOTAL,
      paidAmount: 0,
      balance: TOTAL,
    });
    expect(batch.get(s.partialId)).toEqual({
      totalAmount: TOTAL,
      paidAmount: PARTIAL_PAID,
      balance: TOTAL - PARTIAL_PAID,
    });
    // Over-collected: the settled sum is above the total, the balance is 0.
    expect(batch.get(s.overpaidId)).toEqual({
      totalAmount: TOTAL,
      paidAmount: 2 * TOTAL,
      balance: 0,
    });
  });

  it('an invoice with no known total is outstanding, never settled', async () => {
    const s = await seedScenario();

    const unknown = await getInvoiceSettlement(s.partialId, undefined);
    // The invoice exists, so its own total is read back from the database.
    expect(unknown.totalAmount).toBe(TOTAL);
    expect(unknown.balance).toBe(TOTAL - PARTIAL_PAID);

    // A total that is not known means the amount is still outstanding: the
    // balance is null, never 0, so no caller can read it as settled.
    const noTotal = await getInvoiceSettlements([s.partialId], {});
    expect(noTotal.get(s.partialId)).toEqual({
      totalAmount: null,
      paidAmount: PARTIAL_PAID,
      balance: null,
    });
  });

  it('a legacy row that stored the invoice id as a string counts in both paths', async () => {
    const s = await seedScenario();

    const legacyInvoiceId = await seedInvoice(s.tenantId, '2026-08', 5000);
    // A payment row written before the id was cast to an ObjectId: the raw
    // driver stores the invoice id as a plain hex string.
    const rawPayments = Payment.collection as unknown as {
      insertOne(doc: Record<string, unknown>): Promise<unknown>;
    };
    await rawPayments.insertOne({
      tenantId: new mongoose.Types.ObjectId(s.tenantId),
      invoiceId: legacyInvoiceId,
      amount: 5000,
      type: 'rent',
      method: 'cash',
      status: 'paid',
      month: '2026-08',
      dueDate: new Date('2026-08-05T00:00:00.000Z'),
      paidAt: new Date('2026-06-01'),
      createdAt: new Date('2026-06-01'),
      updatedAt: new Date('2026-06-01'),
    });

    const single = await getInvoiceSettlement(legacyInvoiceId, 5000);
    expect(single).toEqual({ totalAmount: 5000, paidAmount: 5000, balance: 0 });

    const batch = await getInvoiceSettlements([legacyInvoiceId], { [legacyInvoiceId]: 5000 });
    expect(batch.get(legacyInvoiceId)).toEqual(single);
  });
});
