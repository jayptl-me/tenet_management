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
import { Tenant } from '../models/tenant.js';
import { generateSingleInvoice, generateMonthlyInvoices } from '../services/invoice.service.js';
import { InvoicePdf } from '../templates/InvoicePdf.js';
import { buildWhatsAppUrl, formatInvoiceShareText } from '../lib/whatsapp.js';
import { getPgUpiConfig } from '../lib/upi.js';
import { logger } from '../lib/logger.js';

// ── Cast helpers ────────────────────────────────────────
type FindFn = (filter: Record<string, unknown>) => Promise<unknown[]>;
type FindOneFn = (filter: Record<string, unknown>) => Promise<unknown>;
type CountFn = (filter: Record<string, unknown>) => Promise<number>;
const invoiceFind = Invoice.find as unknown as FindFn;
const invoiceFindOne = Invoice.findOne.bind(Invoice) as unknown as FindOneFn;
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
  if (status) filter.status = status;
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
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
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

// ── POST /invoices/generate-bulk ────────────────────────
invoices.post(
  '/generate-bulk',
  authGuard,
  adminOnly,
  zValidator('json', generateBulkSchema),
  async (c) => {
    const { month } = c.req.valid('json');
    const result = await generateMonthlyInvoices(month);
    return c.json({
      success: true,
      data: { month, generated: result.generated, skipped: result.skipped, errors: result.errors },
    });
  },
);

// ── POST /invoices/generate-single ──────────────────────
invoices.post(
  '/generate-single',
  authGuard,
  adminOnly,
  zValidator('json', generateSingleSchema),
  async (c) => {
    const { tenantId, month } = c.req.valid('json');
    try {
      const invoice = await generateSingleInvoice({ tenantId, month });
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
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber floor' } })
    .lean() as unknown);

  if (!invoiceRaw) return notFound(c, 'Invoice');

  const invoice = invoiceRaw as Record<string, unknown>;
  const user = c.get('user');

  if (user.role === 'tenant') {
    const tenantInfo = invoice.tenantId as Record<string, unknown> | null;
    const tenantUserId = tenantInfo?.userId as Record<string, unknown> | null;
    if (tenantUserId?._id?.toString() !== user.sub) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  }

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
    data: { ...invoice, whatsAppUrl, shareText },
  });
});

// ── GET /invoices/:id/pdf ───────────────────────────────
invoices.get('/:id/pdf', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid invoice ID');

  const invoiceRaw = await (Invoice.findById(id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber floor' } })
    .lean() as unknown);

  if (!invoiceRaw) return notFound(c, 'Invoice');

  const invoice = invoiceRaw as Record<string, unknown>;
  const user = c.get('user');

  if (user.role === 'tenant') {
    const tenantInfo = invoice.tenantId as Record<string, unknown> | null;
    const tenantUserId = tenantInfo?.userId as Record<string, unknown> | null;
    if (tenantUserId?._id?.toString() !== user.sub) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  }

  try {
    const upiConfig = await getPgUpiConfig();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await (ReactPDF as any).renderToBuffer(
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

// ── GET /invoices/:id/payment-status ────────────────────
invoices.get('/:id/payment-status', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid invoice ID');

  const invoiceRaw = await (Invoice.findById(id).lean() as unknown);
  if (!invoiceRaw) return notFound(c, 'Invoice');

  const invoice = invoiceRaw as Record<string, unknown>;

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
