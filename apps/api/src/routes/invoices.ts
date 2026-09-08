import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import ReactPDF from '@react-pdf/renderer';
import React from 'react';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { Invoice } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { Tenant } from '../models/tenant.js';
import { Guardian } from '../models/guardian.js';
import { generateSingleInvoice, generateMonthlyInvoices } from '../services/invoice.service.js';
import { getInvoiceBalance } from '../services/payment-status.service.js';
import { InvoicePdf } from '../templates/InvoicePdf.js';
import { buildWhatsAppUrl, formatInvoiceShareText } from '../lib/whatsapp.js';
import { getPgUpiConfig } from '../lib/upi.js';
import { logger } from '../lib/logger.js';
import { writeAuditLog } from '../lib/write-audit-log.js';

// ── Cast helpers ────────────────────────────────────────
type FindOneFn = (filter: Record<string, unknown>) => Promise<unknown>;
type CountFn = (filter: Record<string, unknown>) => Promise<number>;
const invoiceCountDocs = Invoice.countDocuments.bind(Invoice) as unknown as CountFn;
const tenantFindOne = Tenant.findOne.bind(Tenant) as unknown as FindOneFn;

const invoices = new Hono();

// ── Schemas ─────────────────────────────────────────────
const generateBulkSchema = z.strictObject({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'),
});

const generateSingleSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'),
});

// ── GET /invoices ───────────────────────────────────────
invoices.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, sort, order, skip } = parsePagination(c);
  const month = c.req.query('month');
  const status = c.req.query('status');
  const tenantId = c.req.query('tenantId');

  const filter: Record<string, unknown> = {};
  if (month) filter.month = month;
  if (status) {
    if (!['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'].includes(status)) {
      return badRequest(c, 'Invalid status filter', 'INVALID_STATUS');
    }
    filter.status = status;
  }
  if (tenantId) {
    const parsed = parseId(tenantId);
    if (!parsed) return badRequest(c, 'Invalid tenantId');
    filter.tenantId = new mongoose.Types.ObjectId(parsed);
  }

  const [data, total] = await Promise.all([
    Invoice.find(safeFilter(filter))
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'tenantId',
        populate: [
          { path: 'userId', select: 'name email phone' },
          {
            path: 'roomId',
            select: 'roomNumber floorId',
            populate: { path: 'floorId', select: 'label floorNumber' },
          },
        ],
      })
      .lean() as unknown,
    invoiceCountDocs(safeFilter(filter)),
  ]);

  return c.json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /invoices/my ────────────────────────────────────
invoices.get('/my', authGuard, tenantOnly, async (c) => {
  const userId = c.get('user').sub;
  const tenantRaw = await tenantFindOne(safeFilter({ userId }));
  if (!tenantRaw) return notFound(c, 'Tenant profile');

  const tenant = tenantRaw as Record<string, unknown>;
  const data = await (Invoice.find(safeFilter({ tenantId: tenant._id }))
    .sort({ month: -1 } as Record<string, -1>)
    .populate('tenantId')
    .lean() as unknown);

  return c.json({ success: true, data });
});

/** Check role-based access to an invoice. Admin can access all; tenant can access own; guardian can access ward. */
async function canAccessInvoice(
  user: { sub: string; role: string },
  invoice: Record<string, unknown>,
): Promise<boolean> {
  if (user.role === 'admin') return true;

  const tenantInfo = invoice.tenantId as Record<string, unknown> | null;
  if (!tenantInfo) return false;

  if (user.role === 'tenant') {
    const tenantUserId = tenantInfo.userId as Record<string, unknown> | null;
    const uid = tenantUserId?._id ? String(tenantUserId._id) : String(tenantUserId ?? '');
    return uid === user.sub;
  }

  if (user.role === 'guardian') {
    const tenantId = tenantInfo._id ? String(tenantInfo._id) : '';
    if (!tenantId) return false;
    const guardian = await Guardian.findOne(
      safeFilter({
        userId: new mongoose.Types.ObjectId(user.sub),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isActive: true,
      }),
    ).lean();
    return !!guardian;
  }

  return false;
}

// ── POST /invoices/generate-bulk ────────────────────────
invoices.post(
  '/generate-bulk',
  authGuard,
  adminOnly,
  zValidator('json', generateBulkSchema),
  async (c) => {
    const { month } = c.req.valid('json');
    const user = c.get('user');
    const result = await generateMonthlyInvoices(month);

    writeAuditLog({
      userId: user.sub,
      action: 'create',
      resource: 'invoice',
      resourceId: `bulk:${month}`,
      details: {
        month,
        generated: result.generated,
        skipped: result.skipped,
      },
    });

    return c.json({
      success: true,
      data: { month, generated: result.generated, skipped: result.skipped, errors: result.errors },
    });
  },
);

// ── GET /invoices/aging — AR aging buckets (admin) ──────
// Outstanding (unpaid, non-cancelled) invoices bucketed by days past due:
// current, 1-30, 31-60, 61-90, 90+ with counts and outstanding totals.
invoices.get('/aging', authGuard, adminOnly, async (c) => {
  const outstanding = (await Invoice.find(
    safeFilter({ status: { $in: ['sent', 'partial', 'overdue'] } }),
  )
    .select('totalAmount dueDate status month invoiceNumber tenantId')
    .lean()) as unknown as Array<Record<string, unknown>>;

  const paidAgg = (await Payment.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: '$invoiceId', total: { $sum: '$amount' } } },
  ])) as Array<Record<string, unknown>>;
  const paidMap = new Map(
    paidAgg.map((r) => [String(r._id), (r.total as number) ?? 0]),
  );

  const buckets = {
    current: { count: 0, amount: 0 },
    days1_30: { count: 0, amount: 0 },
    days31_60: { count: 0, amount: 0 },
    days61_90: { count: 0, amount: 0 },
    days90Plus: { count: 0, amount: 0 },
  };

  const nowMs = Date.now();
  for (const inv of outstanding) {
    const total = (inv.totalAmount as number) ?? 0;
    const paid = paidMap.get(String(inv._id)) ?? 0;
    const balance = Math.max(0, total - paid);
    if (balance <= 0.001) continue;

    const due = inv.dueDate ? new Date(inv.dueDate as string | Date) : null;
    const dueMs = due && !Number.isNaN(due.getTime()) ? due.getTime() : null;
    const daysPastDue =
      dueMs != null ? Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000)) : 0;

    if (daysPastDue <= 0) {
      buckets.current.count += 1;
      buckets.current.amount += balance;
    } else if (daysPastDue <= 30) {
      buckets.days1_30.count += 1;
      buckets.days1_30.amount += balance;
    } else if (daysPastDue <= 60) {
      buckets.days31_60.count += 1;
      buckets.days31_60.amount += balance;
    } else if (daysPastDue <= 90) {
      buckets.days61_90.count += 1;
      buckets.days61_90.amount += balance;
    } else {
      buckets.days90Plus.count += 1;
      buckets.days90Plus.amount += balance;
    }
  }

  const data = {
    buckets,
    totalOutstanding:
      buckets.current.amount +
      buckets.days1_30.amount +
      buckets.days31_60.amount +
      buckets.days61_90.amount +
      buckets.days90Plus.amount,
  };

  return c.json({ success: true, data });
});

// ── POST /invoices/generate-single ──────────────────────
invoices.post(
  '/generate-single',
  authGuard,
  adminOnly,
  zValidator('json', generateSingleSchema),
  async (c) => {
    const { tenantId, month } = c.req.valid('json');
    const user = c.get('user');
    try {
      const invoice = await generateSingleInvoice({ tenantId, month });

      writeAuditLog({
        userId: user.sub,
        action: 'create',
        resource: 'invoice',
        resourceId: String((invoice as unknown as Record<string, unknown>)._id ?? ''),
        details: {
          tenantId,
          month,
          invoiceNumber: (invoice as unknown as Record<string, unknown>).invoiceNumber,
          totalAmount: (invoice as unknown as Record<string, unknown>).totalAmount,
        },
      });

      return c.json({ success: true, data: invoice }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate invoice';
      return badRequest(c, message, 'INVOICE_GENERATION_FAILED');
    }
  },
);

// ── GET /invoices/:id ───────────────────────────────────
invoices.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid invoice ID');

  const invoiceRaw = await (Invoice.findById(id)
    .populate({
      path: 'tenantId',
      populate: [
        { path: 'userId', select: 'name email phone' },
        {
          path: 'roomId',
          select: 'roomNumber floorId',
          populate: { path: 'floorId', select: 'label floorNumber' },
        },
      ],
    })
    .lean() as unknown);

  if (!invoiceRaw) return notFound(c, 'Invoice');

  const invoice = invoiceRaw as Record<string, unknown>;
  const user = c.get('user');

  if (!(await canAccessInvoice(user, invoice))) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } }, 403);
  }

  // All non-cancelled payment rows for history (pending UTR, partial residual, paid).
  const payments = (await Payment.find(
    safeFilter({
      invoiceId: new mongoose.Types.ObjectId(id),
      status: { $ne: 'cancelled' },
    }),
  )
    .sort({ createdAt: 1 })
    .lean()) as unknown as Array<Record<string, unknown>>;

  const paidAmount = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + ((p.amount as number) ?? 0), 0);
  const totalAmount = (invoice.totalAmount as number) ?? 0;
  const balance = totalAmount - paidAmount;

  const upiConfig = await getPgUpiConfig();
  const tenantInfo = invoice.tenantId as Record<string, unknown> | null;
  const userInfo = tenantInfo?.userId as Record<string, unknown> | null;
  const roomInfo = tenantInfo?.roomId as Record<string, unknown> | null;

  const shareText = formatInvoiceShareText({
    tenantName: (userInfo?.name as string) ?? 'Tenant',
    roomNumber: (roomInfo?.roomNumber as string) ?? 'Unknown',
    month: invoice.month as string,
    totalAmount: invoice.totalAmount as number,
    invoiceNumber: invoice.invoiceNumber as string,
    upiId: upiConfig.upiId,
  });

  const whatsAppUrl = buildWhatsAppUrl((userInfo?.phone as string) ?? '+910000000000', shareText);

  return c.json({
    success: true,
    data: { ...invoice, paidAmount, balance, payments, whatsAppUrl, shareText },
  });
});

// ── PUT /invoices/:id — update amounts / status (admin) ──
const updateInvoiceSchema = z.strictObject({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format')
    .optional(),
  tenantId: z.string().min(1).optional(),
  rentAmount: z.number().min(0).optional(),
  electricityAmount: z.number().min(0).optional(),
  otherCharges: z.number().min(0).optional(),
  lineItems: z
    .array(
      z.strictObject({
        description: z.string().min(1),
        amount: z.number().min(0),
      }),
    )
    .optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'cancelled']).optional(),
  dueDate: z.string().datetime().optional(),
});

invoices.put('/:id', authGuard, adminOnly, zValidator('json', updateInvoiceSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid invoice ID');

  const body = c.req.valid('json');
  const adminId = c.get('user').sub;

  const invoice = await Invoice.findById(id);
  if (!invoice) return notFound(c, 'Invoice');

  const currentStatus = invoice.status;
  if (currentStatus === 'paid') {
    return badRequest(c, 'Paid invoices cannot be edited', 'INVOICE_LOCKED');
  }
  if (currentStatus === 'cancelled') {
    if (body.status !== 'draft' && body.status !== 'sent') {
      return badRequest(
        c,
        'Cancelled invoices can only be reopened to draft or sent',
        'INVALID_STATUS_TRANSITION',
      );
    }
  } else if (
    currentStatus !== 'draft' &&
    currentStatus !== 'sent' &&
    currentStatus !== 'partial' &&
    currentStatus !== 'overdue'
  ) {
    return badRequest(c, `Cannot edit invoice with status "${currentStatus}"`, 'INVOICE_LOCKED');
  }

  // Cancelling an invoice that still carries a remaining balance would
  // silently erase dues — collect payment first or adjust amounts instead.
  if (body.status === 'cancelled' && currentStatus !== 'cancelled') {
    const remaining = await getInvoiceBalance(id, invoice.totalAmount ?? 0);
    if (remaining > 0.001) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVOICE_HAS_BALANCE',
            message: `Cannot cancel: invoice still has ₹${remaining.toLocaleString('en-IN')} outstanding.`,
          },
        },
        409,
      );
    }
  }

  // ── Duplicate check: month + tenantId ──
  if (body.month !== undefined || body.tenantId !== undefined) {
    const checkMonth = body.month ?? invoice.month;
    const checkTenantId = body.tenantId ?? String(invoice.tenantId);
    const exists = await Invoice.findOne(
      safeFilter({
        tenantId: new mongoose.Types.ObjectId(checkTenantId),
        month: checkMonth,
        _id: { $ne: invoice._id },
      }),
    );
    if (exists) {
      return c.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_INVOICE',
            message: 'An invoice already exists for this tenant and month.',
          },
        },
        409,
      );
    }
  }

  if (body.rentAmount !== undefined) invoice.rentAmount = body.rentAmount;
  if (body.electricityAmount !== undefined) invoice.electricityAmount = body.electricityAmount;
  if (body.otherCharges !== undefined) invoice.otherCharges = body.otherCharges;
  if (body.lineItems !== undefined) invoice.lineItems = body.lineItems;
  if (body.dueDate !== undefined) invoice.dueDate = new Date(body.dueDate);
  if (body.status !== undefined) invoice.status = body.status;

  // When amounts change without explicit lineItems, rebuild line items so PDF stays in sync
  if (
    body.lineItems === undefined &&
    (body.rentAmount !== undefined ||
      body.electricityAmount !== undefined ||
      body.otherCharges !== undefined)
  ) {
    const items: Array<{ description: string; amount: number }> = [
      { description: 'Monthly Rent', amount: invoice.rentAmount },
    ];
    if (invoice.electricityAmount > 0) {
      items.push({ description: 'Electricity', amount: invoice.electricityAmount });
    }
    if (invoice.otherCharges > 0) {
      items.push({ description: 'Other Charges', amount: invoice.otherCharges });
    }
    invoice.lineItems = items;
  }

  // pre-save recomputes totalAmount
  await invoice.save();

  // Re-sync pending obligation amount if not paid/cancelled
  if (invoice.status !== 'paid' && invoice.status !== 'cancelled') {
    const openPending = await Payment.findOne(
      safeFilter({
        invoiceId: invoice._id,
        status: { $in: ['pending', 'pending_verification'] },
      }),
    );
    if (openPending) {
      const paidSum = await Payment.aggregate([
        {
          $match: {
            invoiceId: invoice._id,
            status: 'paid',
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const alreadyPaid = (paidSum[0]?.total as number) ?? 0;
      const residual = Math.max(0, invoice.totalAmount - alreadyPaid);
      openPending.amount = residual;
      if (invoice.dueDate) openPending.dueDate = invoice.dueDate;
      await openPending.save();
    }
  }

  const { writeAuditLog } = await import('../lib/write-audit-log.js');
  await writeAuditLog({
    userId: adminId,
    action: 'update',
    resource: 'invoice',
    resourceId: id,
    details: {
      fields: Object.keys(body),
      status: invoice.status,
      totalAmount: invoice.totalAmount,
    },
  });

  const populated = await Invoice.findById(id)
    .populate({
      path: 'tenantId',
      populate: [
        { path: 'userId', select: 'name email phone' },
        { path: 'roomId', select: 'roomNumber floorId' },
      ],
    })
    .lean();

  return c.json({ success: true, data: populated });
});

// ── GET /invoices/:id/pdf ───────────────────────────────
invoices.get('/:id/pdf', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid invoice ID');

  const invoiceRaw = await (Invoice.findById(id)
    .populate({
      path: 'tenantId',
      populate: [
        { path: 'userId', select: 'name email phone' },
        {
          path: 'roomId',
          select: 'roomNumber floorId',
          populate: { path: 'floorId', select: 'label floorNumber' },
        },
      ],
    })
    .lean() as unknown);

  if (!invoiceRaw) return notFound(c, 'Invoice');

  const invoice = invoiceRaw as Record<string, unknown>;
  const user = c.get('user');

  if (!(await canAccessInvoice(user, invoice))) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } }, 403);
  }

  try {
    const upiConfig = await getPgUpiConfig();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await (ReactPDF as any).renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(InvoicePdf as any, {
        invoice,
        appConfig: upiConfig,
      }),
    );

    const invoiceNumber = (invoice.invoiceNumber as string) ?? 'invoice';

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoiceNumber}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    logger.error({ err, invoiceId: id }, 'Failed to render invoice PDF');
    return c.json(
      {
        success: false,
        error: { code: 'PDF_GENERATION_FAILED', message: 'Failed to generate PDF.' },
      },
      500,
    );
  }
});

// ── DELETE /invoices/:id ──────────────────────────────────
invoices.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid invoice ID');
  const user = c.get('user');

  const invoice = await Invoice.findById(id).lean();
  if (!invoice) return notFound(c, 'Invoice');

  const invoiceRecord = invoice as unknown as Record<string, unknown>;

  // Prevent deletion of paid invoices
  if (invoiceRecord.status === 'paid') {
    return c.json(
      {
        success: false,
        error: { code: 'INVOICE_PAID', message: 'Cannot delete paid invoices.' },
      },
      422,
    );
  }

  // Prevent deletion of invoices with any paid payment records (ledger integrity)
  const paidPayments = await Payment.countDocuments(
    safeFilter({ invoiceId: new mongoose.Types.ObjectId(id), status: 'paid' }),
  );
  if (paidPayments > 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVOICE_HAS_PAID_PAYMENTS',
          message: `Cannot delete invoice with ${paidPayments} paid payment(s). Accounting records cannot be purged.`,
        },
      },
      409,
    );
  }

  // Delete all linked payments first
  await Payment.deleteMany(
    safeFilter({ invoiceId: new mongoose.Types.ObjectId(id) } as Record<string, unknown>),
  );
  await Invoice.findByIdAndDelete(id);

  writeAuditLog({
    userId: user.sub,
    action: 'delete',
    resource: 'invoice',
    resourceId: id,
    details: {
      invoiceNumber: invoiceRecord.invoiceNumber,
      month: invoiceRecord.month,
      totalAmount: invoiceRecord.totalAmount,
    },
  });

  return c.json({ success: true, data: { message: 'Invoice deleted' } });
});

// ── GET /invoices/:id/payment-status ────────────────────
invoices.get('/:id/payment-status', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid invoice ID');

  const invoiceRaw = await (Invoice.findById(id)
    .populate({
      path: 'tenantId',
      populate: [{ path: 'userId', select: 'name email phone' }],
    })
    .lean() as unknown);
  if (!invoiceRaw) return notFound(c, 'Invoice');

  const invoice = invoiceRaw as Record<string, unknown>;
  const user = c.get('user');
  if (!(await canAccessInvoice(user, invoice))) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } }, 403);
  }

  const payments = (await (Invoice.db
    ?.model('Payment')
    .find(safeFilter({ invoiceId: new mongoose.Types.ObjectId(id) }))
    .sort({ createdAt: -1 })
    .lean() as unknown)) as Array<Record<string, unknown>>;

  const totalPaid = (payments ?? [])
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + ((p.amount as number) ?? 0), 0);

  const totalAmount = (invoice.totalAmount as number) ?? 0;
  const remaining = totalAmount - totalPaid;

  return c.json({
    success: true,
    data: { totalAmount, totalPaid, remaining, paymentCount: (payments ?? []).length, payments },
  });
});

export default invoices;
