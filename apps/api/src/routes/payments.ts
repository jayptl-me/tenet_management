import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { Payment } from '../models/payment.js';
import { Invoice } from '../models/invoice.js';
import { Tenant } from '../models/tenant.js';
import { Guardian } from '../models/guardian.js';
import { User } from '../models/user.js';
import { Room } from '../models/room.js';
import { AppConfig } from '../models/appConfig.js';
import { generateUpiQr, generateTransactionRef, getPgUpiConfig } from '../lib/upi.js';
import { buildWhatsAppUrl, formatInvoiceShareText } from '../lib/whatsapp.js';
import { logger } from '../lib/logger.js';
import { writeAuditLog } from '../lib/write-audit-log.js';
import {
  updateInvoicePaymentStatus,
  getInvoiceBalance,
  getInvoiceSettlement,
  roundMoney,
} from '../services/payment-status.service.js';
import { createNotification } from '../services/notification.service.js';
import type { INotificationType } from '@pg/types';

/** Default due date: 5th of the invoice billing month. */
function dueDateForMonth(month: string): Date {
  const [year, monthNum] = month.split('-').map(Number);
  return new Date(year!, monthNum! - 1, 5);
}

function resolveInvoiceDueDate(invoice: Record<string, unknown>): Date {
  if (invoice.dueDate) {
    const d = new Date(invoice.dueDate as string | Date);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return dueDateForMonth(String(invoice.month ?? ''));
}

// ── Cast helpers (Mongoose 9) ───────────────────────────
type CreateFn = (doc: Record<string, unknown>) => Promise<unknown>;
type FindOneFn = (filter: Record<string, unknown>) => Promise<unknown>;
type CountFn = (filter: Record<string, unknown>) => Promise<number>;
type AggregateFn = (pipeline: unknown[]) => Promise<unknown[]>;

const paymentFindOne = Payment.findOne.bind(Payment) as unknown as FindOneFn;
const paymentCreate = Payment.create.bind(Payment) as unknown as CreateFn;
const paymentAggregate = Payment.aggregate.bind(Payment) as unknown as AggregateFn;
const paymentCountDocs = Payment.countDocuments.bind(Payment) as unknown as CountFn;
const invoiceFindOne = Invoice.findOne.bind(Invoice) as unknown as FindOneFn;
const tenantFindOne = Tenant.findOne.bind(Tenant) as unknown as FindOneFn;

/** Longest idempotency key the payment model accepts. */
const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

/**
 * True when a write was refused because a unique index already holds the
 * value.
 *
 * Two requests carrying the same idempotency key can race: both look the key
 * up before either one writes. The unique index refuses the second write, and
 * that refusal is the race being closed, not a failure.
 */
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

// ── Resident notifications ────────────────────────────────
// The resident waits on their own money: a UTR they submitted, an invoice they
// owe, a payment the office voided. Every money decision is pushed to the
// tenant's own user, resolved from the tenant record, never to an admin.
// A notification failure never blocks the money write.

/**
 * Sends one notification to the user who owns a tenant record.
 *
 * The recipient is resolved from the tenant, so a payment can never notify the
 * wrong person. Failures are logged, never thrown: the money write already
 * happened and must not be undone by a push that did not go out.
 */
async function notifyTenantOfPayment(
  tenantId: unknown,
  notification: {
    title: string;
    body: string;
    type: INotificationType;
    data?: Record<string, string>;
  },
): Promise<void> {
  const tenantIdStr = String(tenantId ?? '');
  try {
    if (!parseId(tenantIdStr)) {
      logger.warn({ tenantId: tenantIdStr }, 'Payment notification skipped: invalid tenant id');
      return;
    }
    const tenantRaw = await tenantFindOne(
      safeFilter({ _id: new mongoose.Types.ObjectId(tenantIdStr) }),
    );
    const tenant = tenantRaw as Record<string, unknown> | null;
    const userId = tenant?.userId;
    if (!tenant || !userId) {
      logger.warn({ tenantId: tenantIdStr }, 'Payment notification skipped: tenant has no user');
      return;
    }
    await createNotification({
      targetType: 'individual',
      targetIds: [String(userId)],
      title: notification.title,
      body: notification.body,
      type: notification.type,
      data: notification.data ?? {},
      sendPush: true,
    });
  } catch (err) {
    logger.error({ err, tenantId: tenantIdStr }, 'Failed to notify tenant about a payment');
  }
}

const payments = new Hono();

/**
 * Payment month summary (collected / expected / pending).
 * Exported so tests drive the same `paymentAggregate` binding as GET /payments/summary.
 */
export async function getPaymentsMonthSummary(currentMonth: string): Promise<{
  month: string;
  collected: number;
  expected: number;
  pending: number;
}> {
  const [paidAgg, expectedAgg] = await Promise.all([
    paymentAggregate([
      { $match: { status: 'paid', month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    paymentAggregate([
      { $match: { month: currentMonth, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const collected = ((paidAgg as Array<Record<string, unknown>>)[0]?.total as number) ?? 0;
  const expected = ((expectedAgg as Array<Record<string, unknown>>)[0]?.total as number) ?? 0;

  return {
    month: currentMonth,
    collected,
    expected,
    pending: expected - collected,
  };
}

// ── Schemas ─────────────────────────────────────────────

const offlinePaymentSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  method: z.enum(['cash', 'bank_transfer', 'other', 'upi']),
  type: z.enum(['rent', 'electricity', 'deposit', 'laundry', 'other']).optional(),
  paidAt: z.string().datetime('Must be ISO 8601 date string'),
  notes: z.string().max(500).optional(),
  /**
   * Optional client-supplied key that makes the write idempotent. The
   * `Idempotency-Key` header wins; this field is the fallback for a client
   * that cannot set a header. Without one, the write behaves exactly as it
   * always did.
   */
  idempotencyKey: z.string().trim().max(100).optional(),
});

const utrSubmitSchema = z.strictObject({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  utrNumber: z
    .string()
    .min(6, 'UTR must be at least 6 characters')
    .max(22, 'UTR cannot exceed 22 characters')
    .toUpperCase()
    .trim(),
  screenshotUrl: z.string().url().optional(),
});

const verifyUtrSchema = z.strictObject({
  status: z.enum(['paid', 'rejected']),
  notes: z.string().max(500).optional(),
});

const updatePaymentSchema = z.strictObject({
  amount: z.number().min(0.01, 'Amount must be greater than 0').optional(),
  method: z.enum(['upi', 'cash', 'bank_transfer', 'other']).optional(),
  type: z.enum(['rent', 'electricity', 'deposit', 'laundry', 'other']).optional(),
  // NOTE: 'paid' is intentionally absent — marking paid must go through the
  // verify flow (/:id/verify or UTR verify) so verifiedBy/paidAt stay truthful.
  status: z.enum(['pending', 'pending_verification', 'overdue', 'cancelled']).optional(),
  notes: z.string().max(500).optional(),
});

const verifyPaymentSchema = z.strictObject({
  approved: z.boolean(),
  notes: z.string().max(500).optional(),
});

// ── GET /payments ───────────────────────────────────────
payments.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, sort, order, skip } = parsePagination(c);
  const status = c.req.query('status');
  const month = c.req.query('month');
  const tenantId = c.req.query('tenantId');
  const roomId = c.req.query('roomId');
  const method = c.req.query('method');
  const type = c.req.query('type');
  const search = c.req.query('search')?.trim();
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (month) filter.month = month;
  if (method) filter.method = method;
  if (type) filter.type = type;
  if (tenantId) {
    const parsed = parseId(tenantId);
    if (!parsed) return badRequest(c, 'Invalid tenantId');
    filter.tenantId = new mongoose.Types.ObjectId(parsed);
  }
  if (roomId) {
    const parsed = parseId(roomId);
    if (!parsed) return badRequest(c, 'Invalid roomId');
    const roomTenants = await Tenant.find(safeFilter({ roomId: parsed, isActive: true })).lean();
    const tenantIds = (roomTenants as unknown as Record<string, unknown>[]).map((t) => t._id);
    filter.tenantId = { $in: tenantIds };
  }

  if (fromDate || toDate) {
    const dateFilter: Record<string, unknown> = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    filter.createdAt = dateFilter;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [matchingUsers, matchingRooms, matchingInvoices] = await Promise.all([
      User.find({
        $or: [
          { name: { $regex: escaped, $options: 'i' } },
          { phone: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
        ],
      })
        .select('_id')
        .lean(),
      Room.find({ roomNumber: { $regex: escaped, $options: 'i' } })
        .select('_id')
        .lean(),
      Invoice.find({ invoiceNumber: { $regex: escaped, $options: 'i' } })
        .select('_id')
        .lean(),
    ]);

    const userIds = matchingUsers.map((u) => u._id);
    const roomIds = matchingRooms.map((r) => r._id);
    const invoiceIds = matchingInvoices.map((inv) => inv._id);

    const matchingTenants = (await Tenant.find({
      $or: [{ userId: { $in: userIds } }, { roomId: { $in: roomIds } }],
    } as Record<string, unknown>)
      .select('_id')
      .lean()) as unknown as Array<Record<string, unknown>>;

    const tenantIds = matchingTenants.map((t) => t._id);

    filter.$or = [
      { utrNumber: { $regex: escaped, $options: 'i' } },
      ...(tenantIds.length > 0 ? [{ tenantId: { $in: tenantIds } }] : []),
      ...(invoiceIds.length > 0 ? [{ invoiceId: { $in: invoiceIds } }] : []),
    ];
  }

  const [data, total] = await Promise.all([
    Payment.find(filter as Record<string, unknown>)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'tenantId',
        populate: [
          { path: 'userId', select: 'name email phone' },
          {
            path: 'roomId',
            select: 'roomNumber floor',
            populate: { path: 'floor', select: 'label floorNumber' },
          },
        ],
      })
      .populate('invoiceId')
      .lean() as unknown,
    paymentCountDocs(filter as Record<string, unknown>),
  ]);

  return c.json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /payments/status-counts ─────────────────────────
// Aggregated count of payments per status (all, pending_verification, paid, pending, overdue, cancelled)
payments.get('/status-counts', authGuard, adminOnly, async (c) => {
  const month = c.req.query('month');
  const match: Record<string, unknown> = {};
  if (month) match.month = month;

  const agg = await paymentAggregate([
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {
    all: 0,
    pending_verification: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    cancelled: 0,
  };

  let total = 0;
  for (const item of agg as Array<{ _id: string; count: number }>) {
    if (item._id in counts) {
      counts[item._id] = item.count;
    }
    total += item.count;
  }
  counts.all = total;

  return c.json({ success: true, data: counts });
});

// ── GET /payments/summary ───────────────────────────────
// Optional ?month=YYYY-MM (defaults to current month). Backwards compatible.
payments.get('/summary', authGuard, adminOnly, async (c) => {
  const monthParam = c.req.query('month');
  let currentMonth: string;
  if (monthParam) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
      return badRequest(c, 'month must be YYYY-MM format', 'INVALID_MONTH');
    }
    currentMonth = monthParam;
  } else {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    currentMonth = `${year}-${month}`;
  }

  const data = await getPaymentsMonthSummary(currentMonth);
  return c.json({ success: true, data });
});

// ── GET /payments/trend?months=6 ────────────────────────
// Collected vs expected per month for the last N months (default 6, max 12).
payments.get('/trend', authGuard, adminOnly, async (c) => {
  const monthsParam = Number(c.req.query('months')) || 6;
  const months = Math.min(12, Math.max(1, Math.floor(monthsParam)));

  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const collectedAgg = (await paymentAggregate([
    { $match: { status: 'paid', month: { $in: monthKeys } } },
    { $group: { _id: '$month', total: { $sum: '$amount' } } },
  ])) as Array<Record<string, unknown>>;
  const expectedAgg = (await paymentAggregate([
    { $match: { month: { $in: monthKeys }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$month', total: { $sum: '$amount' } } },
  ])) as Array<Record<string, unknown>>;

  const collectedMap = new Map(collectedAgg.map((r) => [String(r._id), (r.total as number) ?? 0]));
  const expectedMap = new Map(expectedAgg.map((r) => [String(r._id), (r.total as number) ?? 0]));

  const data = monthKeys.map((month) => ({
    month,
    collected: collectedMap.get(month) ?? 0,
    expected: expectedMap.get(month) ?? 0,
  }));

  return c.json({ success: true, data });
});

// ── GET /payments/my ────────────────────────────────────
payments.get('/my', authGuard, tenantOnly, async (c) => {
  const userId = c.get('user').sub;
  const tenantRaw = await tenantFindOne(safeFilter({ userId }));
  if (!tenantRaw) return notFound(c, 'Tenant profile');

  const tenant = tenantRaw as Record<string, unknown>;
  const data = await (Payment.find(safeFilter({ tenantId: tenant._id }))
    .sort({ createdAt: -1 } as Record<string, 1 | -1>)
    .populate({
      path: 'tenantId',
      populate: [
        { path: 'userId', select: 'name email phone' },
        {
          path: 'roomId',
          select: 'roomNumber floor',
          populate: { path: 'floor', select: 'label floorNumber' },
        },
      ],
    })
    .populate('invoiceId')
    .lean() as unknown);

  return c.json({ success: true, data });
});

// ── POST /payments/offline ──────────────────────────────
// Records an admin offline payment. Reconciles the pending Payment row
// created by generateSingleInvoice so summary "expected" is not double-counted.
//
// The write is idempotent. The client sends an `Idempotency-Key` header and
// the key is looked up BEFORE anything is written, so two requests carrying
// the same key can never record the same cash twice: the second one replays
// the payment the first one created instead of creating a second payment.
// A request without the key behaves exactly as it always did.
payments.post(
  '/offline',
  authGuard,
  adminOnly,
  zValidator('json', offlinePaymentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const adminId = c.get('user').sub;

    // ── Idempotency key ─────────────────────────────────
    // The header is the contract. The body field is the fallback for a client
    // that cannot set a header; without either, the write behaves exactly as
    // it always did.
    const idempotencyKey =
      c.req.header('Idempotency-Key')?.trim() || body.idempotencyKey?.trim() || undefined;
    if (idempotencyKey && idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      return badRequest(
        c,
        `Idempotency-Key cannot exceed ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
        'INVALID_IDEMPOTENCY_KEY',
      );
    }

    if (idempotencyKey) {
      // Look the key up FIRST. A replay must not write anything, not even
      // when the invoice has been settled since the first request.
      const existing = await paymentFindOne(safeFilter({ idempotencyKey }));
      if (existing) {
        logger.info(
          { idempotencyKey, paymentId: String((existing as Record<string, unknown>)._id ?? '') },
          'Offline payment replayed: the idempotency key was already recorded',
        );
        return c.json({ success: true, data: existing, idempotent: true }, 200);
      }
    }

    if (!parseId(body.tenantId) || !parseId(body.invoiceId)) {
      return badRequest(c, 'Invalid tenantId or invoiceId');
    }

    const invoiceRaw = await invoiceFindOne(
      safeFilter({ _id: new mongoose.Types.ObjectId(body.invoiceId) }),
    );
    if (!invoiceRaw) return notFound(c, 'Invoice');

    const invoice = invoiceRaw as Record<string, unknown>;
    const invoiceTenantId = String(invoice.tenantId ?? '');

    if (invoiceTenantId !== body.tenantId) {
      return badRequest(c, 'tenantId does not match the invoice tenant', 'TENANT_INVOICE_MISMATCH');
    }

    const invoiceStatus = String(invoice.status ?? '');
    // draft included: admin may collect cash before formal send
    const payableStatuses = new Set(['draft', 'sent', 'partial', 'overdue']);
    if (!payableStatuses.has(invoiceStatus)) {
      return badRequest(
        c,
        `Cannot record offline payment on invoice with status "${invoiceStatus}"`,
        'INVOICE_NOT_PAYABLE',
      );
    }

    // One balance definition: the shared money helper, the same one the
    // invoice list, the QR, the dues summary and the invoice row use.
    const rawTotal = invoice.totalAmount;
    const invoiceTotal =
      typeof rawTotal === 'number' && Number.isFinite(rawTotal) ? rawTotal : undefined;
    const settlement = await getInvoiceSettlement(body.invoiceId, invoiceTotal);
    const balance = settlement.balance;
    if (balance == null) {
      // An unknown total means the amount is still outstanding, never zero.
      // The server cannot check what was collected, so it refuses instead of
      // recording cash against an unknown balance.
      return badRequest(
        c,
        'Invoice total is unknown, the payment cannot be recorded',
        'INVOICE_TOTAL_UNKNOWN',
      );
    }

    if (body.amount > balance + 0.001) {
      return badRequest(
        c,
        `Amount exceeds remaining balance of ₹${balance.toFixed(2)}`,
        'AMOUNT_EXCEEDS_BALANCE',
      );
    }

    const dueDate = resolveInvoiceDueDate(invoice);
    const paidAt = new Date(body.paidAt);
    if (Number.isNaN(paidAt.getTime())) {
      return badRequest(c, 'paidAt must be a valid ISO 8601 datetime', 'INVALID_PAID_AT');
    }

    const openPayments = (await Payment.find(
      safeFilter({
        invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
        status: { $in: ['pending', 'pending_verification'] },
      }),
    )
      .sort({ createdAt: 1 })
      .exec()) as unknown as Array<{
      _id: mongoose.Types.ObjectId;
      amount: number;
      method: string;
      type?: string;
      status: string;
      paidAt: Date | null;
      verifiedBy: mongoose.Types.ObjectId | null;
      notes?: string;
      dueDate: Date;
      idempotencyKey?: string;
      save: () => Promise<unknown>;
    }>;

    let paymentResult: unknown;
    const paymentType = body.type ?? 'rent';
    // What is still due after this collection, from the shared money helper.
    const residual = roundMoney(Math.max(0, balance - body.amount));

    // The office's own obligation row is the only open row the office may
    // adjust. A resident's declared transfer (status pending_verification) is
    // the resident's statement of what they sent: its amount is never
    // rewritten here, only the verification step may change it.
    const officeRow = openPayments.find((row) => row.status === 'pending') ?? null;

    if (officeRow) {
      officeRow.amount = body.amount;
      officeRow.method = body.method;
      if (body.type !== undefined) officeRow.type = body.type;
      officeRow.status = 'paid';
      officeRow.paidAt = paidAt;
      officeRow.verifiedBy = new mongoose.Types.ObjectId(adminId);
      officeRow.dueDate = dueDate;
      if (body.notes !== undefined) officeRow.notes = body.notes;
      // The key marks the payment that carries the collected cash, so a
      // replay of the same request finds this row and nothing else.
      if (idempotencyKey) officeRow.idempotencyKey = idempotencyKey;
      await officeRow.save();
      paymentResult = officeRow;
    } else {
      // No office row to carry the cash: either there is no open row at all,
      // or the only open row is the resident's declared transfer. The cash is
      // recorded on a row of its own and the resident's row is left alone.
      const paymentDoc: Record<string, unknown> = {
        tenantId: new mongoose.Types.ObjectId(body.tenantId),
        invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
        amount: body.amount,
        type: paymentType,
        method: body.method,
        status: 'paid',
        month: invoice.month,
        dueDate,
        paidAt,
        verifiedBy: new mongoose.Types.ObjectId(adminId),
        notes: body.notes,
      };
      if (idempotencyKey) paymentDoc.idempotencyKey = idempotencyKey;

      try {
        paymentResult = await paymentCreate(paymentDoc);
      } catch (err) {
        // Two requests with the same key raced: both looked the key up before
        // either wrote, so the unique index refused the second write. The
        // first payment is the answer.
        if (idempotencyKey && isDuplicateKeyError(err)) {
          const existing = await paymentFindOne(safeFilter({ idempotencyKey }));
          if (existing) {
            const existingId = String((existing as Record<string, unknown>)._id ?? '');
            logger.info(
              { idempotencyKey, paymentId: existingId },
              'Offline payment replayed: a concurrent write took the idempotency key',
            );
            return c.json({ success: true, data: existing, idempotent: true }, 200);
          }
        }
        throw err;
      }
    }

    // The office's leftover obligation rows are closed. A resident's declared
    // transfer is left exactly as it is: the verification step decides it.
    for (const extra of openPayments) {
      if (extra === officeRow) continue;
      if (extra.status !== 'pending') continue;
      extra.status = 'cancelled';
      await extra.save();
    }

    if (residual > 0.01) {
      await paymentCreate({
        tenantId: new mongoose.Types.ObjectId(body.tenantId),
        invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
        amount: residual,
        type: (officeRow?.type as string | undefined) ?? paymentType,
        method: 'upi',
        status: 'pending',
        month: invoice.month,
        dueDate,
      });
    }

    // The resident's declared transfer rows, captured before the status
    // recompute: the shared helper closes the open rows that no longer fit
    // the balance, and a resident's transfer is not the office's to void.
    const residentTransferIds = openPayments
      .filter((row) => row.status === 'pending_verification')
      .map((row) => row._id);

    await updateInvoicePaymentStatus(body.invoiceId);

    if (residentTransferIds.length > 0) {
      // The shared helper cancels the open rows that no longer fit the
      // balance. A resident's transfer is not the office's to void: an offline
      // collection leaves it alone and the verification step resolves the
      // mismatch.
      const restored = await Payment.updateMany(
        safeFilter({ _id: { $in: residentTransferIds }, status: 'cancelled' }),
        { $set: { status: 'pending_verification' } },
      );
      if (restored.modifiedCount > 0) {
        logger.warn(
          { invoiceId: body.invoiceId, restored: restored.modifiedCount },
          'Offline collection: restored the resident transfer rows the status recompute had voided',
        );
      }
    }

    const paymentId = String(
      (paymentResult as Record<string, unknown>)?._id ??
        (paymentResult as Record<string, unknown>)?.id ??
        '',
    );

    await writeAuditLog({
      userId: adminId,
      action: 'payment_verify',
      resource: 'payment',
      resourceId: paymentId,
      details: {
        invoiceId: body.invoiceId,
        tenantId: body.tenantId,
        amount: body.amount,
        method: body.method,
        source: 'offline',
        idempotencyKey: idempotencyKey ?? undefined,
      },
    });

    // The money is settled: tell the resident it landed.
    await notifyTenantOfPayment(body.tenantId, {
      title: 'Payment recorded',
      body: `Your payment of ₹${body.amount.toFixed(2)} for ${String(invoice.month ?? '')} has been recorded.`,
      type: 'payment_verified',
      data: { paymentId, invoiceId: body.invoiceId },
    });

    logger.info(
      { paymentId, tenantId: body.tenantId, invoiceId: body.invoiceId },
      'Offline payment recorded',
    );

    // `idempotent` tells the client whether this request recorded the cash or
    // handed back the payment an earlier request with the same key recorded.
    return c.json({ success: true, data: paymentResult, idempotent: false }, 201);
  },
);

// ── GET /payments/qr-code ───────────────────────────────
payments.get('/qr-code', authGuard, async (c) => {
  const invoiceId = c.req.query('invoiceId');
  if (!invoiceId) return badRequest(c, 'invoiceId query param required');

  const invoiceRaw = await invoiceFindOne(
    safeFilter({ _id: new mongoose.Types.ObjectId(invoiceId) }),
  );
  if (!invoiceRaw) return notFound(c, 'Invoice');

  const invoice = invoiceRaw as Record<string, unknown>;
  const user = c.get('user');

  // Tenants may only request QR for their own invoices; guardians for their active linked ward
  if (user.role === 'tenant') {
    const tenantRaw = await tenantFindOne(safeFilter({ userId: user.sub }));
    if (!tenantRaw) return notFound(c, 'Tenant profile');
    if (String((tenantRaw as Record<string, unknown>)._id) !== String(invoice.tenantId)) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  } else if (user.role === 'guardian') {
    const guardian = await Guardian.findOne(
      safeFilter({ userId: user.sub, tenantId: invoice.tenantId, isActive: true }),
    ).lean();
    if (!guardian) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  } else if (user.role !== 'admin') {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } }, 403);
  }

  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return badRequest(c, 'Invoice is not payable', 'INVOICE_NOT_PAYABLE');
  }

  const balance = await getInvoiceBalance(
    String(invoice._id),
    invoice.totalAmount as number | undefined,
  );
  if (balance == null) {
    // An unknown total means the amount is still outstanding and the amount to
    // collect cannot be computed. A QR for a zero amount would be a lie.
    return badRequest(
      c,
      'Invoice total is unknown, the amount to pay cannot be computed',
      'INVOICE_TOTAL_UNKNOWN',
    );
  }
  if (balance <= 0) {
    return badRequest(c, 'Invoice has no remaining balance', 'INVOICE_PAID');
  }

  const tenantRaw = await Tenant.findById(invoice.tenantId).populate('user').lean();
  if (!tenantRaw) return notFound(c, 'Tenant');

  const tenant = tenantRaw as unknown as Record<string, unknown>;
  const userInfo = (tenant.userId as unknown as Record<string, unknown> | null) ?? {};
  const roomInfo = (tenant.roomId as unknown as Record<string, unknown> | null) ?? {};

  const upiConfig = await getPgUpiConfig();
  const txnRef = generateTransactionRef(invoice.invoiceNumber as string);
  const note = `Invoice ${invoice.invoiceNumber}`;

  const { qrDataUrl, upiDeepLink } = await generateUpiQr({
    upiId: upiConfig.upiId,
    payeeName: upiConfig.upiPayeeName,
    amount: balance,
    transactionNote: note,
    transactionRef: txnRef,
  });

  const shareText = formatInvoiceShareText({
    tenantName: (userInfo.name as string) ?? 'Tenant',
    roomNumber: (roomInfo.roomNumber as string) ?? 'Unknown',
    month: invoice.month as string,
    totalAmount: balance,
    invoiceNumber: invoice.invoiceNumber as string,
    upiId: upiConfig.upiId,
  });

  const whatsAppUrl = buildWhatsAppUrl((userInfo.phone as string) ?? '+910000000000', shareText);

  return c.json({
    success: true,
    data: {
      qrDataUrl,
      upiDeepLink,
      amount: balance,
      invoiceTotal: invoice.totalAmount,
      upiId: upiConfig.upiId,
      payeeName: upiConfig.upiPayeeName,
      invoiceNumber: invoice.invoiceNumber,
      transactionRef: txnRef,
      whatsAppUrl,
      shareText,
    },
  });
});

// ── POST /payments/submit-utr ───────────────────────────
payments.post(
  '/submit-utr',
  authGuard,
  tenantOnly,
  zValidator('json', utrSubmitSchema),
  async (c) => {
    const body = c.req.valid('json');
    const userId = c.get('user').sub;

    const invoiceRaw = await invoiceFindOne(
      safeFilter({ _id: new mongoose.Types.ObjectId(body.invoiceId) }),
    );
    if (!invoiceRaw) return notFound(c, 'Invoice');

    const invoice = invoiceRaw as Record<string, unknown>;

    const tenantRaw = await tenantFindOne(safeFilter({ userId }));
    if (!tenantRaw) return notFound(c, 'Tenant profile');
    const tenant = tenantRaw as Record<string, unknown>;

    if (String(invoice.tenantId) !== String(tenant._id)) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return badRequest(c, 'Invoice is not payable', 'INVOICE_NOT_PAYABLE');
    }

    const balance = await getInvoiceBalance(
      String(invoice._id),
      invoice.totalAmount as number | undefined,
    );
    if (balance == null) {
      // An unknown total means the amount is still outstanding and the amount
      // to collect cannot be computed. A UTR for an unknown amount is a guess.
      return badRequest(
        c,
        'Invoice total is unknown, the amount to pay cannot be computed',
        'INVOICE_TOTAL_UNKNOWN',
      );
    }
    if (balance <= 0) {
      return badRequest(c, 'Invoice has no remaining balance', 'INVOICE_PAID');
    }

    const existingUtr = await paymentFindOne(safeFilter({ utrNumber: body.utrNumber }));
    if (existingUtr) {
      return c.json(
        {
          success: false,
          error: { code: 'DUPLICATE_UTR', message: 'This UTR number has already been submitted.' },
        },
        409,
      );
    }

    // Only open (pending / pending_verification) rows may receive a UTR.
    // Never mutate a paid row (would reopen a settled payment).
    const openRow = (await Payment.findOne(
      safeFilter({
        invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
        status: { $in: ['pending', 'pending_verification'] },
      }),
    )
      .sort({ createdAt: 1 })
      .lean()) as unknown as Record<string, unknown> | null;

    if (!openRow) {
      const newPayment = await paymentCreate({
        tenantId: tenant._id,
        invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
        amount: balance,
        type: 'rent',
        method: 'upi',
        status: 'pending_verification',
        month: invoice.month,
        dueDate: resolveInvoiceDueDate(invoice as unknown as Record<string, unknown>),
        utrNumber: body.utrNumber,
        screenshotUrl: body.screenshotUrl ?? null,
      });

      logger.info(
        { paymentId: (newPayment as Record<string, unknown>)._id, utr: body.utrNumber },
        'UTR submitted',
      );

      return c.json({ success: true, data: newPayment }, 201);
    }

    const updated = await (Payment.findByIdAndUpdate(
      openRow._id,
      {
        utrNumber: body.utrNumber,
        screenshotUrl: body.screenshotUrl ?? openRow.screenshotUrl ?? null,
        status: 'pending_verification',
        // Align open obligation to remaining balance when submitting UTR.
        amount: balance,
      },
      { returnDocument: 'after' },
    ).lean() as unknown);

    logger.info(
      { paymentId: openRow._id, utr: body.utrNumber },
      'UTR submitted (existing payment updated)',
    );

    return c.json({ success: true, data: updated });
  },
);

// ── POST /payments/verify-utr/:paymentId ────────────────
payments.post(
  '/verify-utr/:paymentId',
  authGuard,
  adminOnly,
  zValidator('json', verifyUtrSchema),
  async (c) => {
    const paymentId = parseId(c.req.param('paymentId'));
    if (!paymentId) return badRequest(c, 'Invalid payment ID');

    const body = c.req.valid('json');
    const adminId = c.get('user').sub;

    const setData: Record<string, unknown> = {
      verifiedBy: new mongoose.Types.ObjectId(adminId),
    };

    if (body.notes) {
      const existing = (await Payment.findById(paymentId).lean()) as unknown as Record<
        string,
        unknown
      > | null;
      if (existing) {
        const existingNotes = (existing.notes as string) ?? '';
        setData.notes = existingNotes
          ? `${existingNotes} | Admin: ${body.notes}`
          : `Admin: ${body.notes}`;
      }
    }

    let updateDoc: Record<string, unknown>;
    if (body.status === 'paid') {
      setData.status = 'paid';
      setData.paidAt = new Date();
      updateDoc = { $set: setData };
    } else if (body.status === 'rejected') {
      setData.status = 'pending';
      // Must $unset: plain undefined is stripped by Mongoose and leaves the old UTR.
      updateDoc = { $set: setData, $unset: { utrNumber: 1, screenshotUrl: 1 } };
    } else {
      updateDoc = { $set: setData };
    }

    const paymentRaw = await (Payment.findByIdAndUpdate(paymentId, updateDoc, {
      returnDocument: 'after',
    }).lean() as unknown);
    if (!paymentRaw) return notFound(c, 'Payment');

    const payment = paymentRaw as Record<string, unknown>;
    await updateInvoicePaymentStatus(String(payment.invoiceId));

    logger.info({ paymentId, status: body.status, adminId }, 'UTR verification processed');

    await writeAuditLog({
      userId: adminId,
      action: 'payment_verify',
      resource: 'payment',
      resourceId: paymentId,
      details: {
        invoiceId: payment.invoiceId,
        tenantId: payment.tenantId,
        status: body.status,
        method: 'utr',
        notes: body.notes,
      },
    });

    // The resident submitted this UTR and is waiting for the verdict.
    const amount = (payment.amount as number) ?? 0;
    const month = String(payment.month ?? '');
    const invoiceId = String(payment.invoiceId ?? '');
    if (body.status === 'paid') {
      await notifyTenantOfPayment(payment.tenantId, {
        title: 'Payment verified',
        body: `Your payment of ₹${amount.toFixed(2)} for ${month} has been verified.`,
        type: 'payment_verified',
        data: { paymentId, invoiceId },
      });
    } else {
      await notifyTenantOfPayment(payment.tenantId, {
        title: 'Payment not verified',
        body:
          `Your payment of ₹${amount.toFixed(2)} for ${month} could not be verified. ` +
          `The amount is still due, please submit the payment again.` +
          (body.notes ? ` Reason: ${body.notes}` : ''),
        type: 'payment_reminder',
        data: { paymentId, invoiceId },
      });
    }

    return c.json({ success: true, data: payment });
  },
);

/** Map lean payment so FE can use tenant.user / invoiceNumber consistently. */
function mapPayment(doc: Record<string, unknown>) {
  const tenantRaw = doc.tenantId;
  const tenant =
    tenantRaw && typeof tenantRaw === 'object' ? (tenantRaw as Record<string, unknown>) : undefined;
  const userRaw = tenant?.userId;
  const user =
    userRaw && typeof userRaw === 'object' ? (userRaw as Record<string, unknown>) : undefined;
  const roomRaw = tenant?.roomId;
  const room =
    roomRaw && typeof roomRaw === 'object' ? (roomRaw as Record<string, unknown>) : undefined;
  const roomFloor = room?.floor as Record<string, unknown> | undefined;
  const invRaw = doc.invoiceId;
  const inv =
    invRaw && typeof invRaw === 'object' ? (invRaw as Record<string, unknown>) : undefined;

  return {
    ...doc,
    tenant: tenant
      ? {
          _id: String(tenant._id ?? ''),
          bedId: (tenant.bedId as string | undefined) ?? null,
          user: user
            ? {
                name: user.name,
                email: user.email,
                phone: user.phone,
              }
            : undefined,
          room: room
            ? {
                _id: String(room._id ?? ''),
                roomNumber: room.roomNumber,
                floor:
                  roomFloor && typeof roomFloor === 'object' && 'label' in roomFloor
                    ? {
                        _id: String(roomFloor._id ?? ''),
                        label: roomFloor.label,
                        floorNumber: roomFloor.floorNumber,
                      }
                    : null,
              }
            : undefined,
        }
      : undefined,
    invoiceId: inv ? String(inv._id ?? '') : invRaw ? String(invRaw) : undefined,
    invoiceNumber: inv?.invoiceNumber as string | undefined,
  };
}

// ── GET /payments/:id/receipt ───────────────────────────
payments.get('/:id/receipt', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid payment ID');

  const paymentRaw = await (Payment.findById(id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
    .populate({
      path: 'tenantId',
      populate: {
        path: 'roomId',
        select: 'roomNumber floor',
        populate: { path: 'floor', select: 'label floorNumber' },
      },
    })
    .populate('invoiceId')
    .lean() as unknown);

  if (!paymentRaw) return notFound(c, 'Payment');

  const payment = paymentRaw as Record<string, unknown>;
  const user = c.get('user');

  if (user.role === 'tenant') {
    const tenantInfo = payment.tenantId as Record<string, unknown> | null;
    const tenantUserId = tenantInfo?.userId as Record<string, unknown> | null;
    if (tenantUserId?._id?.toString() !== user.sub) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  } else if (user.role === 'guardian') {
    const tenantInfo = payment.tenantId as Record<string, unknown> | null;
    const targetTenantId = tenantInfo?._id;
    const guardian = await Guardian.findOne(
      safeFilter({ userId: user.sub, tenantId: targetTenantId, isActive: true }),
    ).lean();
    if (!guardian) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  } else if (user.role !== 'admin') {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } }, 403);
  }

  const config = await AppConfig.findOne().lean();
  const pgBranding = config
    ? {
        pgName: config.pgName,
        tagline: config.tagline,
        address: config.address,
        phone: config.phone,
        email: config.email,
        gstNumber: config.gstNumber,
        upiId: config.upiId,
        upiPayeeName: config.upiPayeeName,
      }
    : null;

  return c.json({ success: true, data: { ...payment, pgBranding } });
});

// ── GET /payments/:id ─────────────────────────────────
payments.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid payment ID');

  const paymentRaw = await (Payment.findById(id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
    .populate({
      path: 'tenantId',
      populate: {
        path: 'roomId',
        select: 'roomNumber floor',
        populate: { path: 'floor', select: 'label floorNumber' },
      },
    })
    .populate('invoiceId')
    .lean() as unknown);

  if (!paymentRaw) return notFound(c, 'Payment');

  const payment = paymentRaw as Record<string, unknown>;
  const user = c.get('user');

  if (user.role === 'tenant') {
    const tenantInfo = payment.tenantId as Record<string, unknown> | null;
    const tenantUserId = tenantInfo?.userId as Record<string, unknown> | null;
    if (tenantUserId?._id?.toString() !== user.sub) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  } else if (user.role === 'guardian') {
    const tenantInfo = payment.tenantId as Record<string, unknown> | null;
    const targetTenantId = tenantInfo?._id;
    const guardian = await Guardian.findOne(
      safeFilter({ userId: user.sub, tenantId: targetTenantId, isActive: true }),
    ).lean();
    if (!guardian) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  } else if (user.role !== 'admin') {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } }, 403);
  }

  return c.json({ success: true, data: mapPayment(payment) });
});

// ── PUT /payments/:id ──────────────────────────────────
payments.put('/:id', authGuard, adminOnly, zValidator('json', updatePaymentSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid payment ID');

  const body = c.req.valid('json');
  if (Object.keys(body).length === 0) return badRequest(c, 'No fields to update');

  const existing = (await Payment.findById(id).lean()) as unknown as Record<string, unknown> | null;
  if (!existing) return notFound(c, 'Payment');

  // Paid rows are immutable via generic PUT. Use verify/void flows instead.
  if (existing.status === 'paid') {
    return c.json(
      {
        success: false,
        error: {
          code: 'PAYMENT_LOCKED',
          message: 'Paid payments cannot be edited. Use a dedicated void/adjust flow if needed.',
        },
      },
      422,
    );
  }

  const updateData: Record<string, unknown> = {};
  if (body.amount !== undefined) updateData.amount = body.amount;
  if (body.method !== undefined) updateData.method = body.method;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const paymentRaw = await (Payment.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
  }).lean() as unknown);
  if (!paymentRaw) return notFound(c, 'Payment');

  const payment = paymentRaw as Record<string, unknown>;
  await updateInvoicePaymentStatus(String(payment.invoiceId));

  const user = c.get('user');
  await writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'payment',
    resourceId: id,
    details: updateData,
  });

  logger.info({ paymentId: id, fields: Object.keys(updateData) }, 'Payment updated');

  // The resident is waiting on this record: an edited payment changes what they
  // owe, so they are told. A failed push never undoes the edit.
  await notifyTenantOfPayment(payment.tenantId, {
    title: 'Payment updated',
    body:
      updateData.amount !== undefined
        ? `The office changed your payment to ${Number(updateData.amount).toFixed(2)}.`
        : 'The office updated your payment.',
    type: 'payment_reminder',
    data: { paymentId: id },
  });

  return c.json({ success: true, data: payment });
});

// ── POST /payments/:id/verify ──────────────────────────
payments.post(
  '/:id/verify',
  authGuard,
  adminOnly,
  zValidator('json', verifyPaymentSchema),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid payment ID');

    const body = c.req.valid('json');
    const adminId = c.get('user').sub;

    const setData: Record<string, unknown> = {
      verifiedBy: new mongoose.Types.ObjectId(adminId),
    };

    if (body.notes) {
      const existing = (await Payment.findById(id).lean()) as unknown as Record<
        string,
        unknown
      > | null;
      if (existing) {
        const existingNotes = (existing.notes as string) ?? '';
        setData.notes = existingNotes
          ? `${existingNotes} | Admin: ${body.notes}`
          : `Admin: ${body.notes}`;
      }
    }

    let updateDoc: Record<string, unknown>;
    if (body.approved) {
      setData.status = 'paid';
      setData.paidAt = new Date();
      updateDoc = { $set: setData };
    } else {
      setData.status = 'pending';
      // Must $unset: plain undefined is stripped by Mongoose and leaves the old UTR.
      updateDoc = { $set: setData, $unset: { utrNumber: 1, screenshotUrl: 1 } };
    }

    const paymentRaw = await (Payment.findByIdAndUpdate(id, updateDoc, {
      returnDocument: 'after',
    }).lean() as unknown);
    if (!paymentRaw) return notFound(c, 'Payment');

    const payment = paymentRaw as Record<string, unknown>;
    await updateInvoicePaymentStatus(String(payment.invoiceId));

    logger.info({ paymentId: id, approved: body.approved, adminId }, 'Payment verified');

    await writeAuditLog({
      userId: adminId,
      action: 'payment_verify',
      resource: 'payment',
      resourceId: id,
      details: {
        invoiceId: payment.invoiceId,
        tenantId: payment.tenantId,
        approved: body.approved,
        notes: body.notes,
      },
    });

    // The resident is waiting on this verdict, approved or not.
    const amount = (payment.amount as number) ?? 0;
    const month = String(payment.month ?? '');
    const invoiceId = String(payment.invoiceId ?? '');
    if (body.approved) {
      await notifyTenantOfPayment(payment.tenantId, {
        title: 'Payment verified',
        body: `Your payment of ₹${amount.toFixed(2)} for ${month} has been verified.`,
        type: 'payment_verified',
        data: { paymentId: id, invoiceId },
      });
    } else {
      await notifyTenantOfPayment(payment.tenantId, {
        title: 'Payment not verified',
        body:
          `Your payment of ₹${amount.toFixed(2)} for ${month} was not verified. ` +
          `The amount is still due, please submit the payment again.` +
          (body.notes ? ` Reason: ${body.notes}` : ''),
        type: 'payment_reminder',
        data: { paymentId: id, invoiceId },
      });
    }

    return c.json({ success: true, data: payment });
  },
);

// ── POST /payments/:id/void — void a paid payment (admin only) ──
// Returns money to owed state: status -> cancelled + invoice re-sync.
payments.post(
  '/:id/void',
  authGuard,
  adminOnly,
  zValidator('json', z.strictObject({ notes: z.string().max(500).optional() })),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid payment ID');

    const body = c.req.valid('json');
    const adminId = c.get('user').sub;

    const payment = await Payment.findById(id);
    if (!payment) return notFound(c, 'Payment');
    if (payment.status !== 'paid') {
      return c.json(
        {
          success: false,
          error: {
            code: 'PAYMENT_NOT_PAID',
            message: `Only paid payments can be voided (current: ${payment.status}).`,
          },
        },
        422,
      );
    }

    payment.status = 'cancelled';
    if (body.notes) {
      const existingNotes = (payment.notes as string) ?? '';
      payment.notes = existingNotes
        ? `${existingNotes} | Void: ${body.notes}`
        : `Void: ${body.notes}`;
    }
    await payment.save();
    await updateInvoicePaymentStatus(String(payment.invoiceId));

    await writeAuditLog({
      userId: adminId,
      action: 'update',
      resource: 'payment',
      resourceId: id,
      details: { voided: true, invoiceId: String(payment.invoiceId), notes: body.notes },
    });

    // The money went back to owed: the resident owes it again and must know.
    const voidedAmount = (payment.amount as number) ?? 0;
    const voidedMonth = String(payment.month ?? '');
    await notifyTenantOfPayment(payment.tenantId, {
      title: 'Payment voided',
      body:
        `Your payment of ₹${voidedAmount.toFixed(2)} for ${voidedMonth} was voided, ` +
        `so the amount is due again.` +
        (body.notes ? ` Reason: ${body.notes}` : ''),
      type: 'payment_reminder',
      data: { paymentId: id, invoiceId: String(payment.invoiceId) },
    });

    return c.json({ success: true, data: payment });
  },
);

// ── DELETE /payments/:id ────────────────────────────────
payments.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid payment ID');

  const payment = await Payment.findById(id);
  if (!payment) return notFound(c, 'Payment');

  // Check if payment is verified (paid) - only allow delete of unverified payments
  if (payment.status === 'paid') {
    return c.json(
      {
        success: false,
        error: {
          code: 'PAYMENT_VERIFIED',
          message: 'Cannot delete verified payments. Void the payment instead.',
        },
      },
      422,
    );
  }

  const invoiceId = String(payment.invoiceId);
  const deletedAmount = (payment.amount as number) ?? 0;
  const deletedMonth = String(payment.month ?? '');
  await Payment.findByIdAndDelete(id);

  // Update invoice payment status after deletion
  await updateInvoicePaymentStatus(invoiceId);

  const user = c.get('user');
  await writeAuditLog({
    userId: user.sub,
    action: 'delete',
    resource: 'payment',
    resourceId: id,
    details: {
      invoiceId,
      amount: payment.amount,
      status: payment.status,
    },
  });

  // The resident's payment record is gone. A UTR number and its screenshot
  // are the evidence that money moved, so the resident hears it from the
  // server instead of finding a vanished row later.
  await notifyTenantOfPayment(payment.tenantId, {
    title: 'Payment record removed',
    body:
      `The payment record of Rs. ${deletedAmount.toFixed(2)} for ${deletedMonth} was removed ` +
      `from your account. If you have already paid, please contact the PG office.`,
    type: 'payment_reminder',
    data: { paymentId: id, invoiceId },
  });

  return c.json({ success: true, data: { message: 'Payment deleted' } });
});

export default payments;
