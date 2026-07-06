import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { ElectricityBill } from '../models/electricityBill.js';
import { Tenant } from '../models/tenant.js';
import { generateSingleInvoice } from '../services/invoice.service.js';
import { logger } from '../lib/logger.js';

// ── Cast helpers ────────────────────────────────────────
type CreateFn = (doc: Record<string, unknown>) => Promise<unknown>;
type FindFn = (filter: Record<string, unknown>) => Promise<unknown[]>;
type FindOneFn = (filter: Record<string, unknown>) => Promise<unknown>;
type CountFn = (filter: Record<string, unknown>) => Promise<number>;
const billFind = ElectricityBill.find as unknown as FindFn;
const billFindOne = ElectricityBill.findOne.bind(ElectricityBill) as unknown as FindOneFn;
const billCreate = ElectricityBill.create as unknown as CreateFn;
const billCountDocs = ElectricityBill.countDocuments.bind(ElectricityBill) as unknown as CountFn;

const electricity = new Hono();

// ── Schemas ─────────────────────────────────────────────

const roomReadingSchema = z.strictObject({
  roomId: z.string().min(1, 'Room ID is required'),
  previousReading: z.number().min(0, 'Previous reading cannot be negative'),
  currentReading: z.number().min(0, 'Current reading cannot be negative'),
  ratePerUnit: z.number().min(0, 'Rate per unit cannot be negative'),
});

const createBillSchema = z.strictObject({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'),
  totalBillAmount: z.number().min(0, 'Total bill amount cannot be negative'),
  billImageUrl: z.string().url().optional(),
  roomEntries: z.array(roomReadingSchema).min(1, 'At least one room entry is required'),
  notes: z.string().max(500).optional(),
});

const updateBillSchema = createBillSchema.partial();

// ── GET /electricity ────────────────────────────────────
electricity.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, sort, order, skip } = parsePagination(c);
  const month = c.req.query('month');
  const status = c.req.query('status');

  const filter: Record<string, unknown> = {};
  if (month) filter.month = month;
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    ElectricityBill.find(safeFilter(filter))
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate('roomEntries.roomId', 'roomNumber sharingType')
      .lean() as unknown,
    billCountDocs(safeFilter(filter)),
  ]);

  return c.json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /electricity/:id ────────────────────────────────
electricity.get('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const billRaw = await (ElectricityBill.findById(id)
    .populate('roomEntries.roomId', 'roomNumber sharingType floor')
    .lean() as unknown);

  if (!billRaw) return notFound(c, 'Electricity bill');

  return c.json({ success: true, data: billRaw });
});

// ── POST /electricity ───────────────────────────────────
electricity.post('/', authGuard, adminOnly, zValidator('json', createBillSchema), async (c) => {
  const body = c.req.valid('json');

  try {
    const bill = await billCreate(body);
    return c.json({ success: true, data: bill }, 201);
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      return c.json(
        {
          success: false,
          error: { code: 'DUPLICATE_BILL', message: 'A bill for this month already exists.' },
        },
        409,
      );
    }
    throw err;
  }
});

// ── PUT /electricity/:id ────────────────────────────────
electricity.put('/:id', authGuard, adminOnly, zValidator('json', updateBillSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const body = c.req.valid('json');

  const billRaw = await (ElectricityBill.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  })
    .populate('roomEntries.roomId', 'roomNumber sharingType')
    .lean() as unknown);

  if (!billRaw) return notFound(c, 'Electricity bill');

  return c.json({ success: true, data: billRaw });
});

// ── POST /electricity/:id/finalize ──────────────────────
electricity.post('/:id/finalize', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const billRaw = await (ElectricityBill.findByIdAndUpdate(
    id,
    { status: 'finalized' },
    { new: true },
  )
    .populate('roomEntries.roomId', 'roomNumber sharingType')
    .lean() as unknown);

  if (!billRaw) return notFound(c, 'Electricity bill');

  logger.info({ billId: id }, 'Electricity bill finalized');

  return c.json({ success: true, data: billRaw });
});

// ── POST /electricity/:id/distribute ────────────────────
electricity.post('/:id/distribute', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const billRaw = await (ElectricityBill.findById(id).lean() as unknown);
  if (!billRaw) return notFound(c, 'Electricity bill');

  const bill = billRaw as Record<string, unknown>;
  if (bill.status !== 'finalized') {
    return badRequest(c, 'Bill must be finalized before distribution', 'BILL_NOT_FINALIZED');
  }

  const roomEntries = (bill.roomEntries as Array<Record<string, unknown>>) ?? [];
  const month = bill.month as string;
  let distributed = 0;
  let errors = 0;

  for (const entry of roomEntries) {
    try {
      // Find active tenants in this room for the given month
      const tenants = await Tenant.find(
        safeFilter({
          roomId: entry.roomId,
          isActive: true,
        }),
      ).lean();

      if (tenants.length === 0) continue;

      const sharePerTenant = ((entry.amount as number) ?? 0) / tenants.length;

      for (const tenant of tenants) {
        const tenantDoc = tenant as unknown as Record<string, unknown>;
        try {
          await generateSingleInvoice({
            tenantId: String(tenantDoc._id),
            month,
          });
          distributed++;
        } catch {
          errors++;
        }
      }
    } catch {
      errors++;
    }
  }

  // Mark bill as distributed
  await ElectricityBill.findByIdAndUpdate(id, { status: 'distributed' });

  logger.info({ billId: id, month, distributed, errors }, 'Electricity bill distributed');

  return c.json({
    success: true,
    data: {
      message: `Distribution complete. ${distributed} invoices updated, ${errors} errors.`,
      distributed,
      errors,
      month,
    },
  });
});

// ── DELETE /electricity/:id ─────────────────────────────
electricity.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const bill = await ElectricityBill.findById(id).lean();
  if (!bill) return notFound(c, 'Electricity bill');

  if (bill.status === 'distributed') {
    return badRequest(
      c,
      'Cannot delete a distributed bill. Contact support if correction is needed.',
      'BILL_ALREADY_DISTRIBUTED',
    );
  }

  await ElectricityBill.findByIdAndDelete(id);

  return c.json({ success: true, data: { message: 'Electricity bill deleted' } });
});

export default electricity;
