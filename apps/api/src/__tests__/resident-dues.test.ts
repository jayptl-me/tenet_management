/**
 * Resident dues.
 *
 * GET /tenants/me/dues is the resident view of what they owe. It must return
 * the same numbers as the admin view (GET /tenants/:id/dues), because both read
 * the same helper over the same paid payments, and it must never expose another
 * tenant's dues: the tenant is resolved from the signed-in user, never from
 * the URL.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { User } from '../models/user.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import tenantRoutes from '../routes/tenants.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
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
const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
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
    name: 'Dues Admin',
    email: `dues-admin-${n}@example.com`,
    phone: `+9198${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'admin',
    isActive: true,
  });
  return signAccessToken({ sub: String(admin._id), role: 'admin' });
}

async function seedTenant(label: string): Promise<{ tenantId: string; token: string }> {
  const n = next();
  const floor = await floorCreate({
    floorNumber: 1 + (n % 400),
    label: `Dues Floor ${n}`,
    totalRooms: 1,
  });
  const room = await roomCreate({
    roomNumber: `DU${String(10000 + n)}`,
    floorId: floor._id,
    sharingType: 2,
    monthlyRent: 12000,
    beds: Room.generateBeds(2),
  });
  const user = await userCreate({
    name: `Dues Resident ${label}`,
    email: `dues-${label}-${n}@example.com`,
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
    monthlyRent: 12000,
    depositPaid: 12000,
    isActive: true,
  });
  const token = await signAccessToken({ sub: String(user._id), role: 'tenant' });
  return { tenantId: String(tenant._id), token };
}

async function seedInvoice(
  tenantId: string,
  month: string,
  total: number,
  status: 'sent' | 'partial' | 'paid',
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

async function seedPaidPayment(
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
    status: 'paid',
    month,
    dueDate: new Date(`${month}-05T00:00:00.000Z`),
    paidAt: new Date('2026-06-01'),
  });
}

const TOTAL = 12000;
const PARTIAL_PAID = 4000;
const OTHER_TOTAL = 5000;

/**
 * One resident with three invoices (unpaid, partly paid, settled) and a second
 * resident with one unpaid invoice.
 */
async function seedScenario() {
  const adminToken = await seedAdmin();
  const first = await seedTenant('first');
  const second = await seedTenant('second');

  const unpaidId = await seedInvoice(first.tenantId, '2026-01', TOTAL, 'sent');
  const partialId = await seedInvoice(first.tenantId, '2026-02', TOTAL, 'partial');
  await seedInvoice(first.tenantId, '2026-03', TOTAL, 'paid');
  await seedPaidPayment(first.tenantId, partialId, PARTIAL_PAID, '2026-02');

  const otherInvoiceId = await seedInvoice(second.tenantId, '2026-01', OTHER_TOTAL, 'sent');

  return { adminToken, first, second, unpaidId, partialId, otherInvoiceId };
}

describe('Resident dues (GET /tenants/me/dues)', () => {
  it('returns the same totalDue as the admin view of the same tenant', async () => {
    const s = await seedScenario();

    const resident = await req('GET', '/api/v1/tenants/me/dues', s.first.token);
    expect(resident.status).toBe(200);
    const admin = await req('GET', `/api/v1/tenants/${s.first.tenantId}/dues`, s.adminToken);
    expect(admin.status).toBe(200);

    const residentData = resident.json.data as Json;
    const adminData = admin.json.data as Json;

    // 12000 unpaid + (12000 - 4000) partly paid. The settled invoice is not due.
    expect(residentData.totalDue).toBe(TOTAL + (TOTAL - PARTIAL_PAID));
    expect(residentData.totalDue).toBe(adminData.totalDue);
    expect(residentData.depositHeld).toBe(adminData.depositHeld);
    expect(residentData.checkedOut).toBe(false);
  });

  it('returns the per-invoice truth: totals, what was paid, what is left', async () => {
    const s = await seedScenario();

    const res = await req('GET', '/api/v1/tenants/me/dues', s.first.token);
    expect(res.status).toBe(200);
    const data = res.json.data as Json;
    const rows = data.unpaidInvoices as Json[];
    expect(rows).toHaveLength(2);

    const unpaid = rows.find((row) => String(row._id) === s.unpaidId);
    expect(unpaid).toBeTruthy();
    expect(unpaid!.month).toBe('2026-01');
    expect(String(unpaid!.invoiceNumber)).toMatch(/^INV-202601-/);
    expect(unpaid!.totalAmount).toBe(TOTAL);
    expect(unpaid!.paidAmount).toBe(0);
    expect(unpaid!.remaining).toBe(TOTAL);
    expect(unpaid!.status).toBe('sent');
    expect(unpaid!.dueDate).toBeTruthy();

    const partial = rows.find((row) => String(row._id) === s.partialId);
    expect(partial).toBeTruthy();
    expect(partial!.totalAmount).toBe(TOTAL);
    expect(partial!.paidAmount).toBe(PARTIAL_PAID);
    expect(partial!.remaining).toBe(TOTAL - PARTIAL_PAID);
    expect(partial!.status).toBe('partial');
  });

  it('never shows another tenant their dues, and never shows a resident another tenant dues', async () => {
    const s = await seedScenario();

    // The resident sees only their own invoices.
    const mine = await req('GET', '/api/v1/tenants/me/dues', s.first.token);
    expect(mine.status).toBe(200);
    const myRows = (mine.json.data as Json).unpaidInvoices as Json[];
    expect(myRows.map((row) => String(row._id))).not.toContain(s.otherInvoiceId);
    expect((mine.json.data as Json).totalDue).toBe(TOTAL + (TOTAL - PARTIAL_PAID));

    // The second resident sees their own dues and nothing of the first resident.
    const other = await req('GET', '/api/v1/tenants/me/dues', s.second.token);
    expect(other.status).toBe(200);
    const otherData = other.json.data as Json;
    expect(otherData.totalDue).toBe(OTHER_TOTAL);
    const otherRows = otherData.unpaidInvoices as Json[];
    expect(otherRows).toHaveLength(1);
    expect(String(otherRows[0]!._id)).toBe(s.otherInvoiceId);

    // The admin route stays admin-only: a resident cannot read another tenant.
    const forbidden = await req('GET', `/api/v1/tenants/${s.second.tenantId}/dues`, s.first.token);
    expect(forbidden.status).toBe(403);
  });

  it('is tenant-only: an admin has no resident dues of their own', async () => {
    const s = await seedScenario();

    const res = await req('GET', '/api/v1/tenants/me/dues', s.adminToken);
    expect(res.status).toBe(403);
  });
});
