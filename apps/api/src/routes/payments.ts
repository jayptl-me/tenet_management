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

const paymentFind = Payment.find as unknown as FindFn;
const paymentFindOne = Payment.findOne.bind(Payment) as unknown as FindOneFn;
const paymentCreate = Payment.create as unknown as CreateFn;
const paymentAggregate = Payment.aggregate as unknown as AggregateFn;
const paymentCountDocs = Payment.countDocuments.bind(Payment) as unknown as CountFn;
const invoiceFindOne = Invoice.findOne.bind(Invoice) as unknown as FindOneFn;
const tenantFindOne = Tenant.findOne.bind(Tenant) as unknown as FindOneFn;

const payments = new Hono();

// ── Helper: Update invoice status based on payments ─────
async function updateInvoicePaymentStatus(invoiceId: string): Promise<void> {
  const paymentsRaw = await paymentFind(
    safeFilter({
      invoiceId: new mongoose.Types.ObjectId(invoiceId),
      status: { $ne: 'cancelled' },
    }),
  );

  const invoiceRaw = await invoiceFindOne(
    safeFilter({ _id: new mongoose.Types.ObjectId(invoiceId) }),
  );
  if (!invoiceRaw) return;

  const invoice = invoiceRaw as Record<string, unknown>;
  const invoiceTotal = (invoice.totalAmount as number) ?? 0;

  const allActive = paymentsRaw as unknown as Array<Record<string, unknown>>;
  const totalPaid = allActive
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + ((p.amount as number) ?? 0), 0);

  // Cancel any excess pending / pending_verification rows beyond the first,
  // and cancel any pending row whose amount exceeds the remaining balance.
  const openPayments = allActive.filter(
    (p) => p.status === 'pending' || p.status === 'pending_verification',
  );
  let keepFirst = true;
  const remainingBalance = Math.max(0, invoiceTotal - totalPaid);

  for (const open of openPayments) {
    const openId = open._id as string;
    if (keepFirst && (open.amount as number) <= remainingBalance + 0.001) {
      keepFirst = false;
      continue;
    }
    // Cancel duplicate or excess pending rows
    await Payment.findByIdAndUpdate(openId, { status: 'cancelled' });
    logger.info(
      { paymentId: openId, invoiceId, reason: keepFirst ? 'amount exceeds balance' : 'duplicate pending row' },
      'Cancelled excess pending payment row',
    );
  }

  // Determine invoice status — never regress from partial/paid
  const currentStatus = (invoice.status as string) ?? 'sent';
  let newStatus: string;

  if (totalPaid >= invoiceTotal && invoiceTotal > 0) {
    newStatus = 'paid';
  } else if (totalPaid > 0) {
    newStatus = 'partial';
  } else if (currentStatus === 'paid' || currentStatus === 'partial') {
    // Preserve partial/paid if zero-paid should be impossible
    // (e.g. all payments just got cancelled). Keep the stronger status.
    newStatus = currentStatus;
  } else {
    newStatus = currentStatus === 'overdue' ? 'overdue' : 'sent';
  }

  await Invoice.findByIdAndUpdate(invoiceId, { status: newStatus });
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

  return c.json({
    success: true,
    data: { month: currentMonth, collected, expected, pending: expected - collected },
  });
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
    amount: invoice.totalAmount as number,
    transactionNote: note,
    transactionRef: txnRef,
  });

  const shareText = formatInvoiceShareText({
    tenantName: (userInfo.name as string) ?? 'Tenant',
    roomNumber: (roomInfo.roomNumber as string) ?? 'Unknown',
    month: invoice.month as string,
    totalAmount: invoice.totalAmount as number,
    invoiceNumber: invoice.invoiceNumber as string,
    upiId: upiConfig.upiId,
  });

  const whatsAppUrl = buildWhatsAppUrl((userInfo.phone as string) ?? '+910000000000', shareText);

  return c.json({
    success: true,
    data: {
      qrDataUrl,
      upiDeepLink,
      amount: invoice.totalAmount,
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
payments.post('/submit-utr', authGuard, zValidator('json', utrSubmitSchema), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('user').sub;

  const invoiceRaw = await invoiceFindOne(
    safeFilter({ _id: new mongoose.Types.ObjectId(body.invoiceId) }),
  );
  if (!invoiceRaw) return notFound(c, 'Invoice');

  const invoice = invoiceRaw as Record<string, unknown>;

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

  // Find all existing payments for this invoice (not cancelled).
  // Prefer updating an existing open row; create only if none exist.
  const existingPayments = (await Payment.find(
    safeFilter({
      invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
      status: { $ne: 'cancelled' },
    }),
  )
    .sort({ createdAt: 1 })
    .lean()) as unknown as Array<Record<string, unknown>>;

  if (existingPayments.length === 0) {
    const tenantRaw = await tenantFindOne(safeFilter({ userId }));
    if (!tenantRaw) return notFound(c, 'Tenant profile');

    const tenant = tenantRaw as Record<string, unknown>;
    const newPayment = await paymentCreate({
      tenantId: tenant._id,
      invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
      amount: invoice.totalAmount,
      type: 'rent',
      method: 'upi',
      status: 'pending_verification',
      month: invoice.month,
      dueDate: invoice.dueDate,
      utrNumber: body.utrNumber,
      screenshotUrl: body.screenshotUrl ?? null,
    });

    logger.info(
      { paymentId: (newPayment as Record<string, unknown>)._id, utr: body.utrNumber },
      'UTR submitted',
    );

    return c.json({ success: true, data: newPayment }, 201);
  }

  // Pick the first open (pending / pending_verification) row if available;
  // otherwise fall back to the first row.
  const openRow = existingPayments.find(
    (p) => p.status === 'pending' || p.status === 'pending_verification',
  );
  const targetPayment = openRow ?? existingPayments[0]!;

  const updated = await (Payment.findByIdAndUpdate(
    targetPayment._id,
    {
      utrNumber: body.utrNumber,
      screenshotUrl: body.screenshotUrl ?? targetPayment.screenshotUrl ?? null,
      status: 'pending_verification',
    },
    { returnDocument: 'after' },
  ).lean() as unknown);

  logger.info(
    { paymentId: targetPayment._id, utr: body.utrNumber },
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

    const updateData: Record<string, unknown> = {
      verifiedBy: new mongoose.Types.ObjectId(adminId),
    };

    if (body.notes) {
      const existing = (await Payment.findById(paymentId).lean()) as unknown as Record<
        string,
        unknown
      > | null;
      if (existing) {
        const existingNotes = (existing.notes as string) ?? '';
        updateData.notes = existingNotes
          ? `${existingNotes} | Admin: ${body.notes}`
          : `Admin: ${body.notes}`;
      }
    }

    if (body.status === 'paid') {
      updateData.status = 'paid';
      updateData.paidAt = new Date();
    } else if (body.status === 'rejected') {
      updateData.status = 'pending';
      updateData.utrNumber = undefined;
    }

    const paymentRaw = await (Payment.findByIdAndUpdate(paymentId, updateData, {
      returnDocument: 'after',
    }).lean() as unknown);
    if (!paymentRaw) return notFound(c, 'Payment');

    const payment = paymentRaw as Record<string, unknown>;
    await updateInvoicePaymentStatus(String(payment.invoiceId));

    logger.info({ paymentId, status: body.status, adminId }, 'UTR verification processed');

    return c.json({ success: true, data: payment });
  },
);

// ── GET /payments/pending-verification ──────────────────
payments.get('/pending-verification', authGuard, adminOnly, async (c) => {
  const { page, limit, skip } = parsePagination(c);

  const [data, total] = await Promise.all([
    Payment.find(safeFilter({ status: 'pending_verification' }))
      .sort({ createdAt: -1 } as Record<string, -1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
      .populate('invoiceId')
      .lean() as unknown,
    paymentCountDocs(safeFilter({ status: 'pending_verification' })),
  ]);

  return c.json({
    success: true,
    data,
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

// ── PUT /payments/:id ──────────────────────────────────
payments.put('/:id', authGuard, adminOnly, zValidator('json', updatePaymentSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid payment ID');

  const body = c.req.valid('json');
  if (Object.keys(body).length === 0) return badRequest(c, 'No fields to update');

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

    const updateData: Record<string, unknown> = {
      verifiedBy: new mongoose.Types.ObjectId(adminId),
    };

    if (body.notes) {
      const existing = (await Payment.findById(id).lean()) as unknown as Record<
        string,
        unknown
      > | null;
      if (existing) {
        const existingNotes = (existing.notes as string) ?? '';
        updateData.notes = existingNotes
          ? `${existingNotes} | Admin: ${body.notes}`
          : `Admin: ${body.notes}`;
      }
    }

    if (body.approved) {
      updateData.status = 'paid';
      updateData.paidAt = new Date();
    } else {
      updateData.status = 'pending';
      updateData.utrNumber = undefined;
    }

    const paymentRaw = await (Payment.findByIdAndUpdate(id, updateData, {
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
