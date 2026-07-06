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

// ── GET /payments ───────────────────────────────────────
payments.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, sort, order, skip } = parsePagination(c);
  const status = c.req.query('status');
  const month = c.req.query('month');
  const tenantId = c.req.query('tenantId');
  const roomId = c.req.query('roomId');

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (month) filter.month = month;
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
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
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
payments.post(
  '/offline',
  authGuard,
  adminOnly,
  zValidator('json', offlinePaymentSchema),
  async (c) => {
    const body = c.req.valid('json');
    const adminId = c.get('user').sub;

    const invoiceRaw = await invoiceFindOne(
      safeFilter({ _id: new mongoose.Types.ObjectId(body.invoiceId) }),
    );
    if (!invoiceRaw) return notFound(c, 'Invoice');

    const invoice = invoiceRaw as Record<string, unknown>;

    const payment = await paymentCreate({
      tenantId: new mongoose.Types.ObjectId(body.tenantId),
      invoiceId: new mongoose.Types.ObjectId(body.invoiceId),
      amount: body.amount,
      type: 'rent',
      method: body.method,
      status: 'paid',
      month: invoice.month,
      dueDate: invoice.dueDate,
      paidAt: new Date(body.paidAt),
      verifiedBy: new mongoose.Types.ObjectId(adminId),
      notes: body.notes,
    });

    await updateInvoicePaymentStatus(body.invoiceId);

    logger.info(
      { paymentId: (payment as Record<string, unknown>)._id, tenantId: body.tenantId },
      'Offline payment recorded',
    );

    return c.json({ success: true, data: payment }, 201);
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

  const paymentRaw = await paymentFindOne(
    safeFilter({ invoiceId: new mongoose.Types.ObjectId(body.invoiceId) }),
  );
  if (!paymentRaw) {
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

  const payment = paymentRaw as Record<string, unknown>;
  const updated = await (Payment.findByIdAndUpdate(
    payment._id,
    {
      utrNumber: body.utrNumber,
      screenshotUrl: body.screenshotUrl ?? payment.screenshotUrl,
      status: 'pending_verification',
    },
    { new: true },
  ).lean() as unknown);

  logger.info(
    { paymentId: payment._id, utr: body.utrNumber },
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
      new: true,
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
  const invoiceTotal = invoice.totalAmount as number;

  const totalPaid = (paymentsRaw as unknown as Array<Record<string, unknown>>)
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + ((p.amount as number) ?? 0), 0);

  let newStatus: string;
  if (totalPaid >= invoiceTotal) {
    newStatus = 'paid';
  } else if (totalPaid > 0) {
    newStatus = 'partial';
  } else {
    newStatus = (invoice.status as string) ?? 'sent';
  }

  await Invoice.findByIdAndUpdate(invoiceId, { status: newStatus });
}

export default payments;
