import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { AppError, ValidationError } from '../lib/errors.js';
import { isServiceAvailable } from '../lib/serviceAvailability.js';
import { env } from '../lib/env.js';
import { ElectricityBill } from '../models/electricityBill.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { generateSingleInvoice } from '../services/invoice.service.js';
import { createNotification } from '../services/notification.service.js';
import { writeAuditLog } from '../lib/write-audit-log.js';
import { logger } from '../lib/logger.js';

// ── Domain error helpers (real codes so FE errorParser can map them) ──
function billLockedError(): AppError {
  return new AppError(
    'Finalized and distributed bills cannot be edited',
    400,
    'BILL_LOCKED',
    undefined,
    'Finalized and distributed bills cannot be edited',
  );
}

function billNotFinalizedError(): AppError {
  return new AppError(
    'Bill must be finalized before distribution',
    400,
    'BILL_NOT_FINALIZED',
    undefined,
    'Bill must be finalized before distribution',
  );
}

function billAlreadyDistributedError(): AppError {
  return new AppError(
    'Cannot delete a distributed bill. Contact support if correction is needed.',
    400,
    'BILL_ALREADY_DISTRIBUTED',
    undefined,
    'Cannot delete a distributed bill. Contact support if correction is needed.',
  );
}

function invalidReadingError(): ValidationError {
  return new ValidationError('Current reading must be greater than or equal to previous reading');
}

function invalidBillStatusError(current: string): AppError {
  return new AppError(
    `Cannot finalize a bill with status "${current}". Only draft bills can be finalized.`,
    400,
    'INVALID_BILL_STATUS',
    undefined,
    `Cannot finalize a bill with status "${current}". Only draft bills can be finalized.`,
  );
}

// ELEC-P1-2: server-side reconcile gate. Room-sum vs bill-total drift beyond
// this threshold is rejected at the API layer so direct API callers cannot
// bypass the FE hard block.
const RECONCILE_BLOCK_THRESHOLD = 10000;

function assertReconcile(
  totalBillAmount: number,
  roomEntries: Array<{ previousReading: number; currentReading: number; ratePerUnit: number }>,
): void {
  const roomSum = roomEntries.reduce(
    (sum, e) =>
      sum + Math.max(0, (e.currentReading ?? 0) - (e.previousReading ?? 0)) * (e.ratePerUnit ?? 0),
    0,
  );
  const diff = Math.abs((totalBillAmount ?? 0) - roomSum);
  if (diff > RECONCILE_BLOCK_THRESHOLD) {
    throw new ValidationError(
      `Room amounts (Rs ${roomSum.toLocaleString('en-IN')}) and total bill (Rs ${(totalBillAmount ?? 0).toLocaleString('en-IN')}) differ by Rs ${diff.toLocaleString('en-IN')}. Fix the readings or total before saving.`,
    );
  }
}

// ── Cloudinary bill-image upload helpers ────────────────
async function deleteCloudinaryAsset(publicId?: string): Promise<void> {
  if (!isServiceAvailable('cloudinary') || !publicId) return;
  try {
    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const form = new FormData();
    form.append('public_id', publicId);
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: form,
      headers: {
        Authorization: `Basic ${btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`)}`,
      },
    });
  } catch (err) {
    logger.warn({ err, publicId }, 'Failed to delete Cloudinary asset');
  }
}

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
  varianceReason: z.string().trim().max(500).optional(),
  roomEntries: z.array(roomReadingSchema).min(1, 'At least one room entry is required'),
  notes: z.string().max(500).optional(),
});

const updateBillSchema = createBillSchema.partial();

// Bill image status payload (embedded in bill JSON)
interface BillImageInfo {
  billImageUrl?: string | null;
  billImagePublicId?: string | null;
}

function billImagePayload(bill: {
  billImageUrl?: string | null;
  billImagePublicId?: string | null;
}): BillImageInfo {
  return {
    billImageUrl: bill.billImageUrl ?? null,
    billImagePublicId: bill.billImagePublicId ?? null,
  };
}

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
      .populate({
        path: 'roomEntries.roomId',
        select: 'roomNumber sharingType floorId',
        populate: { path: 'floorId', select: 'label floorNumber' },
      })
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
// Returns room submeter readings and calculation for the authenticated
// tenant, or for a guardian's ward room (parity with invoices/payments).
electricity.get('/my', authGuard, async (c) => {
  const authUser = c.get('user');
  const month = c.req.query('month');

  let tenant: Record<string, unknown> | null = null;
  if (authUser.role === 'tenant') {
    tenant = (await Tenant.findOne(safeFilter({ userId: authUser.sub, isActive: true }))
      .populate('roomId', 'roomNumber sharingType')
      .lean()) as unknown as Record<string, unknown> | null;
  } else if (authUser.role === 'guardian') {
    const { Guardian } = await import('../models/guardian.js');
    const ward = await Guardian.findOne(
      safeFilter({ userId: authUser.sub, isActive: true }),
    ).lean();
    const wardTenantId = (ward as unknown as Record<string, unknown> | null)?.tenantId;
    if (wardTenantId) {
      tenant = (await Tenant.findById(wardTenantId)
        .populate('roomId', 'roomNumber sharingType')
        .lean()) as unknown as Record<string, unknown> | null;
    }
  } else {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only tenants or guardians can view readings.' },
      },
      403,
    );
  }

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
  const tenantRoom = tenant.roomId as { roomNumber?: unknown } | null | undefined;
  const roomNumber =
    typeof tenantRoom === 'object' && tenantRoom !== null && 'roomNumber' in tenantRoom
      ? String(tenantRoom.roomNumber ?? '')
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
        computedRoomTotal: bill.computedRoomTotal ?? null,
        variance: bill.variance ?? null,
        varianceReason: bill.varianceReason ?? null,
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
// Admins read any bill; tenants/guardians may read bills containing
// their own (or ward's) room entry.
electricity.get('/:id', authGuard, async (c) => {
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

  const authUser = c.get('user');
  if (authUser.role !== 'admin') {
    let ownRoomId = '';
    if (authUser.role === 'tenant') {
      const selfTenant = await Tenant.findOne(
        safeFilter({ userId: authUser.sub, isActive: true }),
      ).lean();
      ownRoomId = String((selfTenant as unknown as Record<string, unknown> | null)?.roomId ?? '');
    } else if (authUser.role === 'guardian') {
      const { Guardian } = await import('../models/guardian.js');
      const ward = await Guardian.findOne(
        safeFilter({ userId: authUser.sub, isActive: true }),
      ).lean();
      const wardTenantId = (ward as unknown as Record<string, unknown> | null)?.tenantId;
      if (wardTenantId) {
        const wardTenant = await Tenant.findById(wardTenantId).lean();
        ownRoomId = String((wardTenant as unknown as Record<string, unknown> | null)?.roomId ?? '');
      }
    }
    const bill = billRaw as unknown as {
      roomEntries?: Array<{ roomId?: { _id?: unknown } | unknown }>;
    };
    const coversRoom = (bill.roomEntries ?? []).some((e) => {
      const r = e.roomId as { _id?: unknown } | undefined;
      const entryRoomId =
        r && typeof r === 'object' && '_id' in r ? String(r._id) : String(r ?? '');
      return ownRoomId !== '' && entryRoomId === ownRoomId;
    });
    if (!coversRoom) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  }

  return c.json({ success: true, data: billRaw });
});

// ── POST /electricity ───────────────────────────────────
electricity.post('/', authGuard, adminOnly, zValidator('json', createBillSchema), async (c) => {
  const body = c.req.valid('json');

  for (const entry of body.roomEntries) {
    if (entry.currentReading < entry.previousReading) {
      throw invalidReadingError();
    }
  }

  // ELEC-P1-2: server-side reconcile hard block (mirrors FE threshold)
  assertReconcile(body.totalBillAmount, body.roomEntries);

  try {
    // Create via document + save so pre-save derives units/amount
    // and the variance snapshot (computedRoomTotal, variance).
    const doc = new ElectricityBill({
      month: body.month,
      totalBillAmount: body.totalBillAmount,
      billImageUrl: body.billImageUrl,
      varianceReason: body.varianceReason ?? '',
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

    const user = c.get('user');
    await writeAuditLog({
      userId: user.sub,
      action: 'create',
      resource: 'electricity',
      resourceId: String(doc._id),
      details: {
        month: body.month,
        totalBillAmount: body.totalBillAmount,
        computedRoomTotal: doc.computedRoomTotal,
        variance: doc.variance,
        roomCount: body.roomEntries.length,
      },
    });

    const populated = await ElectricityBill.findById(doc._id)
      .populate({
        path: 'roomEntries.roomId',
        select: 'roomNumber sharingType floorId',
        populate: { path: 'floorId', select: 'label floorNumber' },
      })
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
    throw billLockedError();
  }

  if (body.month !== undefined) bill.month = body.month;
  if (body.totalBillAmount !== undefined) bill.totalBillAmount = body.totalBillAmount;
  if (body.billImageUrl !== undefined) bill.billImageUrl = body.billImageUrl;
  if (body.varianceReason !== undefined) bill.varianceReason = body.varianceReason;
  if (body.notes !== undefined) bill.notes = body.notes;

  if (body.roomEntries !== undefined) {
    for (const entry of body.roomEntries) {
      if (entry.currentReading < entry.previousReading) {
        throw invalidReadingError();
      }
    }
    // ELEC-P1-2: reconcile gate for partial updates. Use the incoming entries
    // with the effective total (body or existing) so every persisted state passes.
    const effectiveTotal = body.totalBillAmount ?? bill.totalBillAmount;
    assertReconcile(effectiveTotal, body.roomEntries);
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
  } else if (body.totalBillAmount !== undefined) {
    // Total changed without new entries: re-validate against existing readings.
    assertReconcile(
      body.totalBillAmount,
      bill.roomEntries.map((e) => ({
        previousReading: e.previousReading,
        currentReading: e.currentReading,
        ratePerUnit: e.ratePerUnit,
      })),
    );
  }

  await bill.save();

  const user = c.get('user');
  await writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'electricity',
    resourceId: id,
    details: {
      month: bill.month,
      totalBillAmount: bill.totalBillAmount,
      computedRoomTotal: bill.computedRoomTotal,
      variance: bill.variance,
      roomCount: bill.roomEntries.length,
    },
  });

  const populated = await ElectricityBill.findById(id)
    .populate({
      path: 'roomEntries.roomId',
      select: 'roomNumber sharingType floorId',
      populate: { path: 'floorId', select: 'label floorNumber' },
    })
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
    throw invalidBillStatusError(currentStatus);
  }

  // Atomic finalize: the status guard lives in the update filter itself so two
  // concurrent finalize calls cannot both pass the read-then-act check.
  const billRaw = await (ElectricityBill.findOneAndUpdate(
    { _id: id, status: 'draft' },
    { status: 'finalized' },
    { returnDocument: 'after' },
  )
    .populate('roomEntries.roomId', 'roomNumber sharingType')
    .lean() as unknown);

  if (!billRaw) {
    // Lost the race or status changed between read and write
    throw invalidBillStatusError(currentStatus);
  }

  const user = c.get('user');
  await writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'electricity',
    resourceId: id,
    details: {
      status: 'finalized',
      month: String((existing as { month?: string }).month ?? ''),
      totalBillAmount: (existing as { totalBillAmount?: number }).totalBillAmount,
      computedRoomTotal: (existing as { computedRoomTotal?: number }).computedRoomTotal,
      variance: (existing as { variance?: number }).variance,
    },
  });

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
    throw billNotFinalizedError();
  }

  // Atomic distribute claim: flip finalized -> distributed upfront so a second
  // concurrent distribute cannot double-charge invoices. If any tenant path
  // errors, roll the status back to finalized so the retry loop stays available.
  const claim = await ElectricityBill.findOneAndUpdate(
    { _id: id, status: 'finalized' },
    { status: 'distributed' },
  ).lean();
  if (!claim) {
    throw billNotFinalizedError();
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

            // ELEC-P1-2: Dispatch mobile push notification to resident
            if (tenantDoc.userId) {
              createNotification({
                targetType: 'individual',
                targetIds: [String(tenantDoc.userId)],
                title: `Electricity Bill -- ${month}`,
                body: `Your electricity charge of INR ${sharePerTenant.toLocaleString('en-IN')} for ${month} has been added to your monthly invoice.`,
                type: 'electricity_bill',
                data: { month, billId: id, amount: String(sharePerTenant) },
              }).catch((notifErr) => {
                logger.error({ notifErr, tenantId, month }, 'Electricity notification failed');
              });
            }
          } else {
            await generateSingleInvoice({ tenantId, month });
            created++;
            distributed++;

            // ELEC-P1-2: Dispatch mobile push notification to resident
            if (tenantDoc.userId) {
              createNotification({
                targetType: 'individual',
                targetIds: [String(tenantDoc.userId)],
                title: `Electricity Bill -- ${month}`,
                body: `Your electricity charge of INR ${sharePerTenant.toLocaleString('en-IN')} for ${month} has been added to your monthly invoice.`,
                type: 'electricity_bill',
                data: { month, billId: id, amount: String(sharePerTenant) },
              }).catch((notifErr) => {
                logger.error({ notifErr, tenantId, month }, 'Electricity notification failed');
              });
            }
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

  // Roll the claim back when any tenant path failed so admins can retry.
  if (errors > 0) {
    await ElectricityBill.findByIdAndUpdate(id, { status: 'finalized' });
  }

  const user = c.get('user');
  await writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'electricity',
    resourceId: id,
    details: {
      status: errors === 0 ? 'distributed' : 'partially_distributed',
      month,
      distributed,
      created,
      updated,
      errors,
    },
  });

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

// ── POST /electricity/:id/image — multipart bill image upload ──
electricity.post('/:id/image', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  if (!isServiceAvailable('cloudinary')) {
    const { ServiceUnavailableError } = await import('../lib/errors.js');
    throw new ServiceUnavailableError(
      'Cloudinary',
      'Bill image uploads are not available because Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment variables.',
    );
  }

  const bill = await ElectricityBill.findById(id);
  if (!bill) return notFound(c, 'Electricity bill');

  try {
    const body = await c.req.parseBody();
    const file = body?.file as File | undefined;
    if (!file || !(file instanceof File)) {
      throw new ValidationError(
        'A file is required. Use multipart/form-data with field name "file".',
      );
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError('Invalid file type. Allowed: JPEG, PNG, WebP, PDF.');
    }
    if (file.size > MAX_SIZE) {
      throw new ValidationError('File size must be under 5MB.');
    }

    // Delete previous asset to prevent storage leaks
    if (bill.billImagePublicId) {
      await deleteCloudinaryAsset(bill.billImagePublicId);
    }

    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('public_id', `electricity/${id}/bill_${Date.now()}`);
    uploadForm.append('folder', 'tenet_pg/electricity');

    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: uploadForm,
      headers: {
        Authorization: `Basic ${btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`)}`,
      },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg =
        (errData as { error?: { message?: string } })?.error?.message ?? 'Upload failed';
      logger.error({ billId: id, cloudinaryError: errMsg }, 'Cloudinary bill image upload failed');
      throw new AppError(
        `Bill image upload failed: ${errMsg}`,
        502,
        'UPLOAD_FAILED',
        undefined,
        'The bill image upload could not be completed. Please try again.',
      );
    }

    const result = (await response.json()) as {
      secure_url: string;
      public_id: string;
    };

    bill.billImageUrl = result.secure_url;
    bill.billImagePublicId = result.public_id;
    await bill.save();

    const user = c.get('user');
    await writeAuditLog({
      userId: user.sub,
      action: 'update',
      resource: 'electricity',
      resourceId: id,
      details: { billImageUploaded: true, url: result.secure_url },
    });

    logger.info({ billId: id, url: result.secure_url }, 'Electricity bill image uploaded');

    return c.json({
      success: true,
      data: {
        url: result.secure_url,
        ...billImagePayload(bill),
        message: 'Bill image uploaded successfully.',
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      throw err;
    }
    if (err instanceof ValidationError) {
      throw err;
    }
    logger.error({ err, billId: id }, 'Bill image upload failed');
    throw new AppError(
      err instanceof Error ? err.message : 'Bill image upload failed',
      502,
      'UPLOAD_FAILED',
      undefined,
      'The bill image upload could not be completed. Please try again.',
    );
  }
});

// ── DELETE /electricity/:id/image — clear the bill image ──
electricity.delete('/:id/image', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const bill = await ElectricityBill.findById(id);
  if (!bill) return notFound(c, 'Electricity bill');

  if (bill.billImagePublicId) {
    await deleteCloudinaryAsset(bill.billImagePublicId);
  }

  bill.billImageUrl = undefined;
  bill.billImagePublicId = null;
  await bill.save();

  const user = c.get('user');
  await writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'electricity',
    resourceId: id,
    details: { billImageRemoved: true },
  });

  return c.json({ success: true, data: billImagePayload(bill) });
});

// ── DELETE /electricity/:id ─────────────────────────────
electricity.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid bill ID');

  const bill = await ElectricityBill.findById(id).lean();
  if (!bill) return notFound(c, 'Electricity bill');

  if (bill.status === 'distributed') {
    throw billAlreadyDistributedError();
  }

  await ElectricityBill.findByIdAndDelete(id);

  // Remove the uploaded bill image from Cloudinary when present
  const billDoc = bill as { billImagePublicId?: string | null };
  if (billDoc.billImagePublicId) {
    await deleteCloudinaryAsset(billDoc.billImagePublicId);
  }

  const user = c.get('user');
  await writeAuditLog({
    userId: user.sub,
    action: 'delete',
    resource: 'electricity',
    resourceId: id,
    details: {
      month: String((bill as { month?: string }).month ?? ''),
      totalBillAmount: (bill as { totalBillAmount?: number }).totalBillAmount,
    },
  });

  return c.json({ success: true, data: { message: 'Electricity bill deleted' } });
});

export default electricity;
