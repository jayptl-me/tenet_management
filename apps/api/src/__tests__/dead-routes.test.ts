/**
 * Negative control for the dead-endpoint deletion.
 *
 * Two purpose-built endpoints had zero consumers in `apps/web/src` and
 * `mobile/lib` and were removed:
 *
 *   - GET /invoices/:id/payment-status  (apps/api/src/routes/invoices.ts)
 *   - GET /rooms/available              (apps/api/src/routes/rooms.ts)
 *
 * The invoice detail read (GET /invoices/:id) already carries the same
 * server-computed money fields (paidAmount, balance) and the room list already
 * carries occupancy, so the dedicated endpoints were promises the product did
 * not keep.
 *
 * This suite proves three things:
 *   1. The removed paths are no longer in the route table.
 *   2. A request to the removed paths no longer answers with the old payload.
 *   3. The routes that replaced them still answer.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { User } from '../models/user.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Room } from '../models/room.js';
import { Floor } from '../models/floor.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import invoiceRoutes from '../routes/invoices.js';
import roomRoutes from '../routes/rooms.js';

type Json = Record<string, unknown>;
type AnyDoc = Record<string, unknown>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/invoices', invoiceRoutes);
  api.route('/rooms', roomRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();

async function req(
  method: string,
  path: string,
  token: string,
): Promise<{ status: number; json: Json; text: string }> {
  const res = await app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let json: Json;
  try {
    json = JSON.parse(text) as Json;
  } catch {
    json = { parseError: true };
  }
  return { status: res.status, json, text };
}

const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const invoiceCreate = Invoice.create.bind(Invoice) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

let counter = 0;
function next(): number {
  counter += 1;
  return counter;
}

async function seedAdmin(): Promise<{ token: string }> {
  const n = next();
  const user = await userCreate({
    name: 'Dead Route Admin',
    email: `dead-route-admin-${n}@example.com`,
    phone: `+9198${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'admin',
    isActive: true,
  });
  const token = await signAccessToken({ sub: String(user._id), role: 'admin' });
  return { token };
}

const TOTAL = 9000;

async function seedInvoice(): Promise<string> {
  const n = next();
  const user = await userCreate({
    name: 'Dead Route Tenant',
    email: `dead-route-tenant-${n}@example.com`,
    phone: `+9197${String(10000000 + n).slice(-8)}`,
    passwordHash: 'dummyhash',
    role: 'tenant',
    isActive: true,
  });
  const tenant = await tenantCreate({
    userId: String(user._id),
    roomId: new mongoose.Types.ObjectId().toHexString(),
    bedId: 'A',
    moveInDate: new Date('2026-01-01'),
    monthlyRent: TOTAL,
    isActive: true,
  });
  const invoice = await invoiceCreate({
    invoiceNumber: `INV-202601-${String(n).padStart(3, '0')}`,
    tenantId: String(tenant._id),
    month: '2026-01',
    lineItems: [{ description: 'Room Rent', amount: TOTAL }],
    rentAmount: TOTAL,
    electricityAmount: 0,
    otherCharges: 0,
    totalAmount: TOTAL,
    status: 'sent',
    dueDate: new Date('2026-01-05T00:00:00.000Z'),
  });
  return String(invoice._id);
}

async function seedRoom(): Promise<string> {
  const n = next();
  const floor = await floorCreate({
    floorNumber: n,
    label: `Dead Route Floor ${n}`,
    totalRooms: 0,
  });
  const room = await roomCreate({
    roomNumber: `DR-${n}`,
    floorId: String(floor._id),
    sharingType: 2,
    monthlyRent: 8000,
    beds: Room.generateBeds(2),
  });
  return String(room._id);
}

describe('Dead endpoints are gone', () => {
  it('the route table carries neither removed endpoint', () => {
    const paths = app.routes.map((r) => r.path);
    const methods = app.routes.map((r) => r.method);

    // Positive control: the table under test is the real one — the routes that
    // must survive are in it. Without this, the negative assertions below
    // could pass on an empty table.
    expect(paths).toContain('/api/v1/invoices/:id');
    expect(paths).toContain('/api/v1/rooms');
    expect(methods).toContain('GET');

    // Negative: no route ends with the removed segments any more.
    expect(paths.some((p) => p.endsWith('/payment-status'))).toBe(false);
    expect(paths.some((p) => p.endsWith('/available'))).toBe(false);
  });

  it('GET /invoices/:id/payment-status returns 404 — the endpoint is gone', async () => {
    const { token } = await seedAdmin();
    const invoiceId = await seedInvoice();

    const res = await req('GET', `/api/v1/invoices/${invoiceId}/payment-status`, token);

    // Nothing matches the path any more: no handler, so Hono answers 404.
    expect(res.status).toBe(404);
    // The old payload (totalPaid / remaining / payments) is not served.
    expect(res.json.data).toBeUndefined();
  });

  it('GET /rooms/available no longer serves vacant rooms', async () => {
    const { token } = await seedAdmin();
    await seedRoom();

    const res = await req('GET', '/api/v1/rooms/available', token);

    // The dedicated endpoint is gone. The path is now matched by the generic
    // GET /rooms/:id route, which rejects "available" as a room id (400), so a
    // literal 404 is impossible while GET /rooms/:id exists — "available" is
    // syntactically a room id. The removal itself is proven by the route table
    // assertion above.
    expect(res.status).toBe(400);
    expect(res.json.success).toBe(false);
    // It is the generic room-by-id route that answers, not the old endpoint.
    const error = res.json.error as Json;
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid room ID');
    // The old payload (a list of rooms with vacant beds) is not served.
    expect(Array.isArray(res.json.data)).toBe(false);
  });

  it('GET /invoices/:id still answers with the money fields', async () => {
    const { token } = await seedAdmin();
    const invoiceId = await seedInvoice();

    const res = await req('GET', `/api/v1/invoices/${invoiceId}`, token);

    expect(res.status).toBe(200);
    const data = res.json.data as Json;
    expect(data.totalAmount).toBe(TOTAL);
    expect(data.paidAmount).toBe(0);
    expect(data.balance).toBe(TOTAL);
  });

  it('GET /rooms still answers with occupancy', async () => {
    const { token } = await seedAdmin();
    const roomId = await seedRoom();

    const res = await req('GET', '/api/v1/rooms', token);

    expect(res.status).toBe(200);
    const rows = res.json.data as Json[];
    const row = rows.find((r) => String(r._id) === roomId);
    expect(row).toBeTruthy();

    const beds = row!.beds as Json[];
    expect(beds).toHaveLength(2);
    expect(beds.every((b) => b.isOccupied === false)).toBe(true);

    const meta = res.json.meta as Json;
    const stats = meta.stats as Json;
    expect(stats.totalRooms).toBe(1);
    expect(stats.totalBeds).toBe(2);
    expect(stats.occupiedBeds).toBe(0);
    expect(stats.vacantBeds).toBe(2);
  });
});
