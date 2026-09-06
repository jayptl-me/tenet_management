import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { ElectricityBill } from '../models/electricityBill.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { generateSingleInvoice } from '../services/invoice.service.js';
import { logger } from '../lib/logger.js';

// ── Cast helpers ────────────────────────────────────────
type CountFn = (filter: Record<string, unknown>) => Promise<number>;
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

// -- GET /electricity/my ----------------------------------
// Returns room submeter readings and calculation for the authenticated tenant.
electricity.get('/my', authGuard, tenantOnly, async (c) => {
  const userId = c.get('user').sub;
  const month = c.req.query('month');

  const tenant = await Tenant.findOne(safeFilter({ userId, isActive: true }))
    .populate('roomId', 'roomNumber sharingType')
    .lean();

  if (!tenant) {
    return notFound(c, 'Tenant profile');
  }

  const roomId = tenant.roomId
    ? typeof tenant.roomId === 'object' && '_id' in tenant.roomId
      ? String(tenant.roomId._id)
      : String(tenant.roomId)
    : null;

  if (!roomId) {
    return c.json({
      success: true,
      data: {
        roomNumber: null,
        readings: [],
      },
    });
  }

  const billFilter: Record<string, unknown> = {
    status: { $in: ['finalized', 'distributed'] },
  };
  if (month) billFilter.month = month;

  const bills = await ElectricityBill.find(safeFilter(billFilter))
    .sort({ month: -1 })
    .limit(month ? 1 : 12)
    .lean();

  const roomObjId = new mongoose.Types.ObjectId(roomId);
  const roomNumber =
    typeof tenant.roomId === 'object' && 'roomNumber' in tenant.roomId
      ? String((tenant.roomId as { roomNumber?: unknown }).roomNumber ?? '')
      : '';

  const readings = [];
  for (const bill of bills) {
    const entry = bill.roomEntries.find((e) => String(e.roomId) === roomId);
    if (entry) {
      const [year, monthNum] = String(bill.month).split('-').map(Number);
      const lastDayOfMonth = new Date(year!, monthNum!, 0).getDate();
      const monthEnd = new Date(`${bill.month}-${String(lastDayOfMonth).padStart(2, '0')}`);
      const monthStart = new Date(`${bill.month}-01`);

      const occupants = await Tenant.countDocuments(
        safeFilter({
          roomId: roomObjId,
          isActive: true,
          moveInDate: { $lte: monthEnd },
          $or: [{ moveOutDate: { $gte: monthStart } }, { moveOutDate: null }],
        }),
      );

      const occupantCount = occupants > 0 ? occupants : 1;
      const tenantShare = Math.round(((entry.amount ?? 0) / occupantCount) * 100) / 100;

      readings.push({
        month: bill.month,
        status: bill.status,
        previousReading: entry.previousReading,
        currentReading: entry.currentReading,
        unitsConsumed: entry.unitsConsumed,
        ratePerUnit: entry.ratePerUnit,
        roomTotalAmount: entry.amount,
        occupantCount,
        tenantShare,
        billImageUrl: bill.billImageUrl ?? null,
      });
    }
  }

  return c.json({
    success: true,
    data: {
      roomNumber,
      readings,
    },
  });
});

// ── GET /electricity/:id ────────────────────────────────
electricity.get('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const billRaw = await (ElectricityBill.findById(id)
    .populate({
      path: 'roomEntries.roomId',
      select: 'roomNumber sharingType floorId',
      populate: { path: 'floorId', select: 'label floorNumber' },
    })
    .lean() as unknown);

  if (!billRaw) return notFound(c, 'Electricity bill');

  return c.json({ success: true, data: billRaw });
});

// ── POST /electricity ───────────────────────────────────
electricity.post('/', authGuard, adminOnly, zValidator('json', createBillSchema), async (c) => {
  const body = c.req.valid('json');

  for (const entry of body.roomEntries) {
    if (entry.currentReading < entry.previousReading) {
      return badRequest(
        c,
        'Current reading must be greater than or equal to previous reading',
        'INVALID_READING',
      );
    }
  }

  try {
    // Create via document + save so pre-save derives units/amount
    const doc = new ElectricityBill({
      month: body.month,
      totalBillAmount: body.totalBillAmount,
      billImageUrl: body.billImageUrl,
      notes: body.notes ?? '',
      status: 'draft',
      roomEntries: body.roomEntries.map((e) => ({
        roomId: new mongoose.Types.ObjectId(e.roomId),
        previousReading: e.previousReading,
        currentReading: e.currentReading,
        ratePerUnit: e.ratePerUnit,
        unitsConsumed: 0,
        amount: 0,
      })),
    });
    await doc.save();
    const populated = await ElectricityBill.findById(doc._id)
      .populate('roomEntries.roomId', 'roomNumber sharingType floorId')
      .lean();
    return c.json({ success: true, data: populated }, 201);
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
// Must use document.save() so pre-save derives unitsConsumed/amount
electricity.put('/:id', authGuard, adminOnly, zValidator('json', updateBillSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const body = c.req.valid('json');
  const bill = await ElectricityBill.findById(id);
  if (!bill) return notFound(c, 'Electricity bill');

  if (bill.status === 'distributed' || bill.status === 'finalized') {
    return badRequest(c, 'Finalized and distributed bills cannot be edited', 'BILL_LOCKED');
  }

  if (body.month !== undefined) bill.month = body.month;
  if (body.totalBillAmount !== undefined) bill.totalBillAmount = body.totalBillAmount;
  if (body.billImageUrl !== undefined) bill.billImageUrl = body.billImageUrl;
  if (body.notes !== undefined) bill.notes = body.notes;

  if (body.roomEntries !== undefined) {
    for (const entry of body.roomEntries) {
      if (entry.currentReading < entry.previousReading) {
        return badRequest(
          c,
          'Current reading must be greater than or equal to previous reading',
          'INVALID_READING',
        );
      }
    }
    bill.roomEntries = body.roomEntries.map((e) => ({
      roomId: new mongoose.Types.ObjectId(
        e.roomId,
      ) as unknown as (typeof bill.roomEntries)[0]['roomId'],
      previousReading: e.previousReading,
      currentReading: e.currentReading,
      ratePerUnit: e.ratePerUnit,
      unitsConsumed: 0,
      amount: 0,
    }));
    bill.markModified('roomEntries');
  }

  await bill.save();

  const populated = await ElectricityBill.findById(id)
    .populate('roomEntries.roomId', 'roomNumber sharingType floorId')
    .lean();

  return c.json({ success: true, data: populated });
});

// ── POST /electricity/:id/finalize ──────────────────────
electricity.post('/:id/finalize', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const existing = await ElectricityBill.findById(id).lean();
  if (!existing) return notFound(c, 'Electricity bill');

  const currentStatus = String((existing as { status?: string }).status ?? 'draft');
  if (currentStatus !== 'draft') {
    return badRequest(
      c,
      `Cannot finalize a bill with status "${currentStatus}". Only draft bills can be finalized.`,
      'INVALID_BILL_STATUS',
    );
  }

  const billRaw = await (ElectricityBill.findByIdAndUpdate(
    id,
    { status: 'finalized' },
    { returnDocument: 'after' },
  )
    .populate('roomEntries.roomId', 'roomNumber sharingType')
    .lean() as unknown);

  if (!billRaw) return notFound(c, 'Electricity bill');

  logger.info({ billId: id }, 'Electricity bill finalized');

  return c.json({ success: true, data: billRaw });
});

// ── POST /electricity/:id/distribute ────────────────────
// Attaches per-tenant electricity share to existing monthly invoices when present;
// otherwise generates a new invoice. Also re-syncs open pending payments.
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
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const entry of roomEntries) {
    try {
      const roomIdRaw = entry.roomId;
      const roomId =
        typeof roomIdRaw === 'object' && roomIdRaw !== null && '_id' in (roomIdRaw as object)
          ? String((roomIdRaw as { _id: unknown })._id)
          : String(roomIdRaw ?? '');

      if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
        errors++;
        continue;
      }

      // ELEC-P1-1: use same date-windowed room occupants as calculateElectricityShare
      // (not merely isActive today) so distribute and invoice generate stay aligned.
      const [year, monthNum] = String(month).split('-').map(Number);
      const lastDayOfMonth = new Date(year!, monthNum!, 0).getDate();
      const monthEnd = new Date(`${month}-${String(lastDayOfMonth).padStart(2, '0')}`);
      const monthStart = new Date(`${month}-01`);

      const tenants = await Tenant.find(
        safeFilter({
          roomId: new mongoose.Types.ObjectId(roomId),
          isActive: true,
          moveInDate: { $lte: monthEnd },
          $or: [{ moveOutDate: { $gte: monthStart } }, { moveOutDate: null }],
        }),
      ).lean();

      if (tenants.length === 0) continue;

      const sharePerTenant =
        Math.round((((entry.amount as number) ?? 0) / tenants.length) * 100) / 100;
      const elecLabel = `Electricity Charges — ${month}`;

      for (const tenant of tenants) {
        const tenantDoc = tenant as unknown as Record<string, unknown>;
        const tenantId = String(tenantDoc._id ?? '');
        try {
          const existing = await Invoice.findOne(
            safeFilter({
              tenantId: new mongoose.Types.ObjectId(tenantId),
              month,
            }),
          );

          if (existing) {
            // Never rewrite cancelled invoices; skip paid invoices that already include
            // electricity (avoid reopening settled money). Still allow adding electricity
            // only when residual can be expressed as a new pending row on open statuses.
            if (existing.status === 'cancelled') {
              continue;
            }

            const alreadyHasElec =
              ((existing.electricityAmount as number) ?? 0) > 0 ||
              (existing.lineItems ?? []).some((li) =>
                String(li.description).toLowerCase().startsWith('electricity'),
              );

            if (existing.status === 'paid' && alreadyHasElec) {
              // Settled and already charged — do not mutate.
              continue;
            }

            // Update electricity on existing invoice (amounts are source of truth)
            existing.electricityAmount = sharePerTenant;
            const items = (existing.lineItems ?? []).filter(
              (li) => !String(li.description).toLowerCase().startsWith('electricity'),
            );
            if (sharePerTenant > 0) {
              items.push({ description: elecLabel, amount: sharePerTenant });
            }
            existing.lineItems = items;
            // pre-save recomputes totalAmount
            await existing.save();

            // Re-sync open pending obligation to remaining balance
            const paidAgg = await Payment.aggregate([
              {
                $match: {
                  invoiceId: existing._id,
                  status: 'paid',
                },
              },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]);
            const alreadyPaid = (paidAgg[0]?.total as number) ?? 0;
            const residual = Math.max(0, existing.totalAmount - alreadyPaid);

            const openPending = await Payment.findOne(
              safeFilter({
                invoiceId: existing._id,
                status: { $in: ['pending', 'pending_verification'] },
              }),
            );
            if (openPending) {
              openPending.amount = residual;
              await openPending.save();
            } else if (residual > 0.01) {
              // Open residual pending for unpaid/partial, or when paid invoice total grew
              // after electricity was added (status will flip to partial below).
              type CreateFn = (doc: Record<string, unknown>) => Promise<unknown>;
              const paymentCreate = Payment.create.bind(Payment) as unknown as CreateFn;
              await paymentCreate({
                tenantId: existing.tenantId,
                invoiceId: existing._id,
                amount: residual,
                type: 'rent',
                method: 'upi',
                status: 'pending',
                month,
                dueDate: existing.dueDate ?? new Date(),
              });
            }

            // Refresh invoice status from payments
            if (alreadyPaid >= existing.totalAmount && existing.totalAmount > 0) {
              existing.status = 'paid';
            } else if (alreadyPaid > 0) {
              existing.status = 'partial';
            } else if (existing.status === 'paid' || existing.status === 'partial') {
              existing.status = 'sent';
            }
            await existing.save();

            updated++;
            distributed++;
          } else {
            await generateSingleInvoice({ tenantId, month });
            created++;
            distributed++;
          }
        } catch (err) {
          logger.error({ err, tenantId, month }, 'Electricity distribute tenant failed');
          errors++;
        }
      }
    } catch (err) {
      logger.error({ err }, 'Electricity distribute room failed');
      errors++;
    }
  }

  // Only mark fully distributed when every tenant path succeeded.
  if (errors === 0) {
    await ElectricityBill.findByIdAndUpdate(id, { status: 'distributed' });
  }

  logger.info(
    { billId: id, month, distributed, created, updated, errors },
    'Electricity bill distributed',
  );

  return c.json({
    success: true,
    data: {
      message:
        errors > 0
          ? `Distribution partial. ${distributed} tenant(s): ${updated} invoices updated, ${created} generated, ${errors} errors. Bill left as finalized.`
          : `Distribution complete. ${distributed} tenant(s): ${updated} invoices updated, ${created} generated.`,
      distributed,
      created,
      updated,
      errors,
      month,
      fullyDistributed: errors === 0,
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
