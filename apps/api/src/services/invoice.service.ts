import mongoose from 'mongoose';
import { Invoice, type IInvoiceDocument } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { Tenant } from '../models/tenant.js';
import { Room } from '../models/room.js';
import { ElectricityBill } from '../models/electricityBill.js';
import { nextInvoiceNumber } from '../models/counter.js';
import { logger } from '../lib/logger.js';
import { safeFilter } from '../lib/routeUtils.js';
import type { IInvoiceLineItemSubdoc } from '../models/invoice.js';

// ── Cast helpers (Mongoose 9 strict types) ─────────────
type FindOneFn = (filter: Record<string, unknown>) => Promise<unknown>;
type FindByIdFn = (id: string) => Promise<unknown>;
type FindLeanFn = (filter: Record<string, unknown>) => Promise<unknown[]>;
type CountFn = (filter: Record<string, unknown>) => Promise<number>;
type CreateFn = (doc: Record<string, unknown>) => Promise<IInvoiceDocument>;
type CreatePaymentFn = (doc: Record<string, unknown>) => Promise<unknown>;

const invoiceFindOne = Invoice.findOne.bind(Invoice) as unknown as FindOneFn;
const invoiceCreate = Invoice.create as unknown as CreateFn;
const tenantFind = Tenant.find as unknown as FindLeanFn;
const tenantFindById = Tenant.findById.bind(Tenant) as unknown as FindByIdFn;
const tenantCountDocs = Tenant.countDocuments.bind(Tenant) as unknown as CountFn;
const roomFindById = Room.findById.bind(Room) as unknown as FindByIdFn;
const billFindOne = ElectricityBill.findOne.bind(ElectricityBill) as unknown as FindOneFn;
const paymentCreate = Payment.create as unknown as CreatePaymentFn;

interface GenerateResult {
  generated: number;
  skipped: number;
  errors: number;
}

interface SingleInvoiceData {
  tenantId: string;
  month: string;
}

/**
 * Generates monthly invoices for all active tenants.
 * Skips tenants that already have an invoice for the given month.
 */
export async function generateMonthlyInvoices(month: string): Promise<GenerateResult> {
  const result: GenerateResult = { generated: 0, skipped: 0, errors: 0 };
  const activeTenants = await tenantFind(safeFilter({ isActive: true }));

  for (const tenantRaw of activeTenants) {
    const tenant = tenantRaw as Record<string, unknown>;
    const tenantId = String(tenant._id ?? '');
    try {
      const existing = await invoiceFindOne(
        safeFilter({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          month,
        }),
      );

      if (existing) {
        result.skipped++;
        continue;
      }

      await generateSingleInvoice({ tenantId, month });
      result.generated++;
    } catch (err) {
      logger.error({ err, tenantId, month }, 'Failed to generate invoice for tenant');
      result.errors++;
    }
  }

  logger.info({ month, ...result }, 'Bulk invoice generation complete');
  return result;
}

/**
 * Generates a single invoice for a specific tenant and month.
 */
export async function generateSingleInvoice(params: SingleInvoiceData): Promise<IInvoiceDocument> {
  const { tenantId, month } = params;

  const tenantRaw = await tenantFindById(tenantId);
  if (!tenantRaw) throw new Error(`Tenant ${tenantId} not found`);

  const tenant = tenantRaw as Record<string, unknown>;
  if (!tenant.isActive) throw new Error(`Tenant ${tenantId} is not active`);

  const roomRaw = await roomFindById(String(tenant.roomId ?? ''));
  if (!roomRaw) throw new Error(`Room not found for tenant ${tenantId}`);

  const room = roomRaw as Record<string, unknown>;

  const lineItems: IInvoiceLineItemSubdoc[] = [
    {
      description: `Room Rent — Room ${room.roomNumber} (${room.sharingType}-sharing)`,
      amount: (tenant.monthlyRent as number) ?? 0,
    },
  ];

  let electricityAmount = 0;

  // Add electricity charges if a finalized bill exists for the month
  try {
    const share = await calculateElectricityShare(tenantId, month);
    if (share > 0) {
      electricityAmount = share;
      lineItems.push({
        description: `Electricity Charges — ${month}`,
        amount: share,
      });
    }
  } catch {
    // No electricity bill for this month — skip
  }

  const invoiceNumber = await nextInvoiceNumber(month);

  // Determine due date: 5th of the month
  const [year, monthNum] = month.split('-').map(Number);
  const dueDate = new Date(year!, monthNum! - 1, 5);
  const now = new Date();
  if (dueDate < now) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }

  const invoice = await invoiceCreate({
    invoiceNumber,
    tenantId: new mongoose.Types.ObjectId(tenantId),
    month,
    lineItems,
    rentAmount: (tenant.monthlyRent as number) ?? 0,
    electricityAmount,
    otherCharges: 0,
    totalAmount: 0,
    status: 'sent',
    dueDate,
  });

  await paymentCreate({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    invoiceId: invoice._id,
    amount: invoice.totalAmount,
    type: 'rent',
    method: 'upi',
    status: 'pending',
    month,
    dueDate,
  });

  logger.info(
    { invoiceId: invoice._id, tenantId, month, amount: invoice.totalAmount },
    'Invoice generated',
  );

  return invoice;
}

/**
 * Calculates the electricity share for a tenant for a given month.
 */
export async function calculateElectricityShare(tenantId: string, month: string): Promise<number> {
  const tenantRaw = await tenantFindById(tenantId);
  if (!tenantRaw) return 0;

  const tenant = tenantRaw as Record<string, unknown>;
  const tenantRoomIdStr = String(tenant.roomId ?? '');

  const billRaw = await billFindOne(
    safeFilter({
      month,
      status: { $in: ['finalized', 'distributed'] },
    }),
  );

  const bill = billRaw as Record<string, unknown> | null;
  if (!bill) return 0;

  const roomEntries = (bill.roomEntries as Array<Record<string, unknown>>) ?? [];
  const roomEntry = roomEntries.find((entry) => String(entry.roomId ?? '') === tenantRoomIdStr);
  if (!roomEntry) return 0;

  // Count active tenants in this room for the given month
  const activeRoomTenants = await tenantCountDocs(
    safeFilter({
      roomId: new mongoose.Types.ObjectId(tenantRoomIdStr),
      isActive: true,
      moveInDate: { $lte: new Date(`${month}-28`) },
    }),
  );

  if (activeRoomTenants === 0) return 0;

  return Math.round(((roomEntry.amount as number) / activeRoomTenants) * 100) / 100;
}

/**
 * Returns the current month in YYYY-MM format.
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
