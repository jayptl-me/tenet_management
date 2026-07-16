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
import { generateUpiQr, generateTransactionRef, getPgUpiConfig } from '../lib/upi.js';
import { buildWhatsAppUrl, formatInvoiceShareText } from '../lib/whatsapp.js';
import { logger } from '../lib/logger.js';
import { writeAuditLog } from '../lib/write-audit-log.js';
import {
  updateInvoicePaymentStatus,
  getInvoiceBalance,
} from '../services/payment-status.service.js';

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
type FindFn = (filter: Record<string, unknown>) => Promise<unknown[]>;
type FindOneFn = (filter: Record<string, unknown>) => Promise<unknown>;
type CountFn = (filter: Record<string, unknown>) => Promise<number>;
type AggregateFn = (pipeline: unknown[]) => Promise<unknown[]>;

const paymentFind = Payment.find.bind(Payment) as unknown as FindFn;
const paymentFindOne = Payment.findOne.bind(Payment) as unknown as FindOneFn;
const paymentCreate = Payment.create.bind(Payment) as unknown as CreateFn;
const paymentAggregate = Payment.aggregate.bind(Payment) as unknown as AggregateFn;
const paymentCountDocs = Payment.countDocuments.bind(Payment) as unknown as CountFn;
const invoiceFindOne = Invoice.findOne.bind(Invoice) as unknown as FindOneFn;
const tenantFindOne = Tenant.findOne.bind(Tenant) as unknown as FindOneFn;

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
  method: z.enum(['cash', 'bank_transfer', 'other']),
  paidAt: z.string().datetime('Must be ISO 8601 date string'),
  notes: z.string().max(500).optional(),
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
  status: z.enum(['pending', 'pending_verification', 'paid', 'overdue', 'cancelled']).optional(),
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

  const [data, total] = await Promise.all([
    Payment.find(safeFilter(filter))
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'tenantId',
        populate: [
          { path: 'userId', select: 'name email phone' },
          { path: 'roomId', select: 'roomNumber floorId' },
        ],
      })
      .populate('invoiceId')
      .lean() as unknown,
    paymentCountDocs(safeFilter(filter)),
  ]);

  return c.json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /payments/summary ───────────────────────────────
payments.get('/summary', authGuard, adminOnly, async (c) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonth = `${year}-${month}`;

  const data = await getPaymentsMonthSummary(currentMonth);
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
    .populate('invoiceId')
    .lean() as unknown);

  return c.json({ success: true, data });
});

// ── POST /payments/offline ──────────────────────────────
// Records an admin offline payment. Reconciles the pending Payment row
// created by generateSingleInvoice so summary "expected" is not double-counted.
payments.post(
  '/offline',
  authGuard,
  adminOnly,
  zValidator('json', offlinePaymentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const adminId = c.get('user').sub;

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

    const invoiceTotal = (invoice.totalAmount as number) ?? 0;
    const paidRows = (await paymentFind(
      safeFilter({
        invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
        status: 'paid',
      }),
    )) as Array<Record<string, unknown>>;
    const alreadyPaid = paidRows.reduce((sum, p) => sum + ((p.amount as number) ?? 0), 0);
    const balance = Math.max(0, invoiceTotal - alreadyPaid);

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
      status: string;
      paidAt: Date | null;
      verifiedBy: mongoose.Types.ObjectId | null;
      notes?: string;
      dueDate: Date;
      save: () => Promise<unknown>;
    }>;

    let paymentResult: unknown;

    if (openPayments.length > 0) {
      const primary = openPayments[0]!;
      primary.amount = body.amount;
      primary.method = body.method;
      primary.status = 'paid';
      primary.paidAt = paidAt;
      primary.verifiedBy = new mongoose.Types.ObjectId(adminId);
      primary.dueDate = dueDate;
      if (body.notes !== undefined) primary.notes = body.notes;
      await primary.save();
      paymentResult = primary;

      for (const extra of openPayments.slice(1)) {
        extra.status = 'cancelled';
        await extra.save();
      }

      const remaining = Math.max(0, balance - body.amount);
      if (remaining > 0.01) {
        await paymentCreate({
          tenantId: new mongoose.Types.ObjectId(body.tenantId),
          invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
          amount: remaining,
          type: 'rent',
          method: 'upi',
          status: 'pending',
          month: invoice.month,
          dueDate,
        });
      }
    } else {
      paymentResult = await paymentCreate({
        tenantId: new mongoose.Types.ObjectId(body.tenantId),
        invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
        amount: body.amount,
        type: 'rent',
        method: body.method,
        status: 'paid',
        month: invoice.month,
        dueDate,
        paidAt,
        verifiedBy: new mongoose.Types.ObjectId(adminId),
        notes: body.notes,
      });
    }

    await updateInvoicePaymentStatus(body.invoiceId);

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
      },
    });

    logger.info(
      { paymentId, tenantId: body.tenantId, invoiceId: body.invoiceId },
      'Offline payment recorded',
    );

    return c.json({ success: true, data: paymentResult }, 201);
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

  // Tenants may only request QR for their own invoices.
  if (user.role === 'tenant') {
    const tenantRaw = await tenantFindOne(safeFilter({ userId: user.sub }));
    if (!tenantRaw) return notFound(c, 'Tenant profile');
    if (String((tenantRaw as Record<string, unknown>)._id) !== String(invoice.tenantId)) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  }

  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return badRequest(c, 'Invoice is not payable', 'INVOICE_NOT_PAYABLE');
  }

  const balance = await getInvoiceBalance(
    String(invoice._id),
    invoice.totalAmount as number | undefined,
  );
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
});

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

    return c.json({ success: true, data: payment });
  },
);

/** Map lean payment so FE can use tenant.user / invoiceNumber consistently. */
function mapPayment(doc: Record<string, unknown>) {
  const tenantRaw = doc.tenantId;
  const tenant =
    tenantRaw && typeof tenantRaw === 'object'
      ? (tenantRaw as Record<string, unknown>)
      : undefined;
  const userRaw = tenant?.userId;
  const user =
    userRaw && typeof userRaw === 'object' ? (userRaw as Record<string, unknown>) : undefined;
  const roomRaw = tenant?.roomId;
  const room =
    roomRaw && typeof roomRaw === 'object' ? (roomRaw as Record<string, unknown>) : undefined;
  const invRaw = doc.invoiceId;
  const inv = invRaw && typeof invRaw === 'object' ? (invRaw as Record<string, unknown>) : undefined;

  return {
    ...doc,
    tenant: tenant
      ? {
          _id: String(tenant._id ?? ''),
          user: user
            ? {
                name: user.name,
                email: user.email,
                phone: user.phone,
              }
            : undefined,
          room: room
            ? { _id: String(room._id ?? ''), roomNumber: room.roomNumber }
            : undefined,
        }
      : undefined,
    invoiceId: inv ? String(inv._id ?? '') : invRaw ? String(invRaw) : undefined,
    invoiceNumber: inv?.invoiceNumber as string | undefined,
  };
}

// ── GET /payments/pending-verification ──────────────────
payments.get('/pending-verification', authGuard, adminOnly, async (c) => {
  const { page, limit, skip } = parsePagination(c);

  const [data, total] = await Promise.all([
    Payment.find(safeFilter({ status: 'pending_verification' }))
      .sort({ createdAt: -1 } as Record<string, -1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
      .populate('invoiceId')
      .lean() as unknown,
    paymentCountDocs(safeFilter({ status: 'pending_verification' })),
  ]);

  return c.json({
    success: true,
    data: (data as Record<string, unknown>[]).map(mapPayment),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /payments/:id/receipt ───────────────────────────
payments.get('/:id/receipt', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid payment ID');

  const paymentRaw = await (Payment.findById(id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
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
  }

  return c.json({ success: true, data: payment });
});

// ── GET /payments/:id ─────────────────────────────────
payments.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid payment ID');

  const paymentRaw = await (Payment.findById(id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
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
  }

  return c.json({ success: true, data: mapPayment(payment) });
});

// ── PUT /payments/:id ──────────────────────────────────
payments.put('/:id', authGuard, adminOnly, zValidator('json', updatePaymentSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid payment ID');

  const body = c.req.valid('json');
  if (Object.keys(body).length === 0) return badRequest(c, 'No fields to update');

  const existing = (await Payment.findById(id).lean()) as unknown as Record<
    string,
    unknown
  > | null;
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

  // Setting status to paid via PUT must stamp paidAt (prefer dedicated verify).
  if (body.status === 'paid' && !existing.paidAt) {
    updateData.paidAt = new Date();
  }

  const paymentRaw = await (Payment.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
  }).lean() as unknown);
  if (!paymentRaw) return notFound(c, 'Payment');

  const payment = paymentRaw as Record<string, unknown>;
  await updateInvoicePaymentStatus(String(payment.invoiceId));

  logger.info({ paymentId: id, fields: Object.keys(updateData) }, 'Payment updated');

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
  await Payment.findByIdAndDelete(id);

  // Update invoice payment status after deletion
  await updateInvoicePaymentStatus(invoiceId);

  return c.json({ success: true, data: { message: 'Payment deleted' } });
});

export default payments;
