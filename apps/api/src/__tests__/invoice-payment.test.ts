/**
 * Invoice + payment happy path (finance critical flow).
 *
 * Drives the real generateSingleInvoice service entry (creates invoice + pending
 * payment), then the production updateInvoicePaymentStatus helper after marking
 * the pending payment paid — same status derivation used by offline/verify routes.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { User } from '../models/user.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { generateSingleInvoice } from '../services/invoice.service.js';
import { updateInvoicePaymentStatus } from '../services/payment-status.service.js';
import { getPaymentsMonthSummary } from '../routes/payments.js';

type AnyDoc = Record<string, unknown>;

const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

async function seedActiveTenant(rent = 9000) {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const floor = await floorCreate({
    floorNumber: 40 + (Date.now() % 50),
    label: `Finance Floor ${n}`,
    totalRooms: 1,
  });
  const room = await roomCreate({
    roomNumber: `F${n.slice(-6)}`,
    floorId: floor._id,
    sharingType: 2,
    monthlyRent: rent,
    beds: Room.generateBeds(2),
  });
  const user = await userCreate({
    name: 'Finance Tenant',
    email: `fin-${n}@example.com`,
    phone: `+91988${String(Date.now()).slice(-7)}`,
    passwordHash: 'dummyhash',
    role: 'tenant',
    isActive: true,
  });
  const tenant = await tenantCreate({
    userId: user._id,
    roomId: room._id,
    bedId: 'A',
    moveInDate: new Date('2026-01-01'),
    monthlyRent: rent,
    isActive: true,
  });
  const fullRoom = await Room.findById(room._id as string);
  if (!fullRoom) throw new Error('room seed failed');
  const bed = fullRoom.beds.find((b) => b.bedId === 'A');
  if (bed) {
    bed.isOccupied = true;
    bed.tenantId = tenant._id as unknown as mongoose.Schema.Types.ObjectId;
  }
  fullRoom.occupancyCount = 1;
  await fullRoom.save();

  const fullTenant = await Tenant.findById(tenant._id as string);
  if (!fullTenant) throw new Error('tenant seed failed');
  return { tenant: fullTenant, rent };
}

describe('Invoice-Payment happy path', () => {
  it('generateSingleInvoice creates invoice+pending payment; full pay marks invoice paid', async () => {
    const { tenant, rent } = await seedActiveTenant(9500);
    const month = '2026-03';

    const invoice = await generateSingleInvoice({
      tenantId: String(tenant._id),
      month,
    });

    expect(invoice).toBeTruthy();
    expect(invoice.status).toBe('sent');
    expect(invoice.month).toBe(month);
    expect(invoice.rentAmount).toBe(rent);
    // pre-save recomputes total from rent + electricity + other
    const reloaded = await Invoice.findById(invoice._id);
    expect(reloaded).toBeTruthy();
    expect((reloaded!.totalAmount as number) >= rent).toBe(true);

    const pending = await Payment.findOne({
      invoiceId: String(invoice._id),
      status: 'pending',
    } as Record<string, unknown>);
    expect(pending).toBeTruthy();
    expect(pending!.tenantId.toString()).toBe(String(tenant._id));
    expect(pending!.amount).toBe(reloaded!.totalAmount);

    // Mirror offline/verify success: mark pending payment paid, recompute invoice
    pending!.status = 'paid';
    pending!.paidAt = new Date();
    pending!.method = 'cash';
    await pending!.save();

    await updateInvoicePaymentStatus(String(invoice._id));

    const paidInvoice = await Invoice.findById(invoice._id);
    expect(paidInvoice!.status).toBe('paid');

    const paidPayment = await Payment.findById(pending!._id);
    expect(paidPayment!.status).toBe('paid');
    expect(paidPayment!.paidAt).toBeTruthy();
  });

  it('partial payment leaves invoice partial', async () => {
    const { tenant, rent } = await seedActiveTenant(10000);
    const month = '2026-04';

    const invoice = await generateSingleInvoice({
      tenantId: String(tenant._id),
      month,
    });
    const reloaded = await Invoice.findById(invoice._id);
    const total = reloaded!.totalAmount as number;
    expect(total).toBe(rent);

    const pending = await Payment.findOne({
      invoiceId: String(invoice._id),
      status: 'pending',
    } as Record<string, unknown>);
    expect(pending).toBeTruthy();

    pending!.amount = Math.floor(total / 2);
    pending!.status = 'paid';
    pending!.paidAt = new Date();
    await pending!.save();

    await updateInvoicePaymentStatus(String(invoice._id));

    const partial = await Invoice.findById(invoice._id);
    expect(partial!.status).toBe('partial');
  });

  it('getPaymentsMonthSummary aggregates via bound Payment.aggregate (summary path)', async () => {
    const { tenant, rent } = await seedActiveTenant(8000);
    // Use current calendar month so summary $match hits the seeded rows
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const invoice = await generateSingleInvoice({
      tenantId: String(tenant._id),
      month,
    });
    const reloaded = await Invoice.findById(invoice._id);
    const total = reloaded!.totalAmount as number;
    expect(total).toBe(rent);

    // Before pay: expected includes pending, collected is 0
    const before = await getPaymentsMonthSummary(month);
    expect(before.month).toBe(month);
    expect(before.expected).toBeGreaterThanOrEqual(total);
    expect(before.collected).toBeGreaterThanOrEqual(0);

    const pending = await Payment.findOne({
      invoiceId: String(invoice._id),
      status: 'pending',
    } as Record<string, unknown>);
    expect(pending).toBeTruthy();
    pending!.status = 'paid';
    pending!.paidAt = new Date();
    await pending!.save();
    await updateInvoicePaymentStatus(String(invoice._id));

    const after = await getPaymentsMonthSummary(month);
    expect(after.collected).toBeGreaterThanOrEqual(total);
    expect(after.expected).toBeGreaterThanOrEqual(after.collected);
    expect(after.pending).toBe(after.expected - after.collected);
  });
});
