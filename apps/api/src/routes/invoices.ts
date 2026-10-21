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
import { User } from '../models/user.js';
import { Room } from '../models/room.js';
import { ElectricityBill } from '../models/electricityBill.js';
import { AppConfig } from '../models/appConfig.js';
import { generateSingleInvoice, generateMonthlyInvoices } from '../services/invoice.service.js';
import {
  getInvoiceBalance,
  getInvoiceBalances,
  getInvoiceSettlement,
  getInvoiceSettlements,
  updateInvoicePaymentStatus,
  roundMoney,
  MAX_SETTLEMENT_IDS,
  type InvoiceSettlement,
} from '../services/payment-status.service.js';
import { createNotification } from '../services/notification.service.js';
import type { INotificationType } from '@pg/types';
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

/**
 * Adds the server-computed money fields to a batch of invoice rows in one
 * query.
 *
 * `balance` and `paidAmount` come from the shared money helper, the single
 * source of truth shared with the payment routes, the dues summary and the
 * cancellation guard, so the invoice list, the invoice detail and every
 * client read the same numbers.
 *
 * `paidAmount` is the REAL settled sum of the paid payment rows, never a
 * number capped at the invoice total, so an over-collected invoice reports
 * the overpayment instead of hiding it. `balance` is null when the invoice
 * total is not known: an unknown balance is OUTSTANDING, never zero.
 */
function withMoneyFields(
  rows: Array<Record<string, unknown>>,
  settlements: Map<string, InvoiceSettlement>,
): Array<Record<string, unknown>> {
  return rows.map((invoice) => {
    const id = invoice._id ? String(invoice._id) : '';
    const settlement = settlements.get(id);
    return {
      ...invoice,
      paidAmount: settlement?.paidAmount ?? 0,
      balance: settlement?.balance ?? null,
    };
  });
}

/**
 * Collects the ids and totals a batch settlement call needs.
 *
 * A missing total is reported as unknown (undefined), never as zero: the
 * shared helper then returns a null balance, which means the amount is still
 * outstanding.
 */
function balanceInputs(rows: Array<Record<string, unknown>>): {
  ids: string[];
  totals: Record<string, number | undefined>;
} {
  const ids: string[] = [];
  const totals: Record<string, number | undefined> = {};
  for (const row of rows) {
    const id = row._id ? String(row._id) : '';
    if (!id) continue;
    ids.push(id);
    const rawTotal = row.totalAmount;
    totals[id] = typeof rawTotal === 'number' && Number.isFinite(rawTotal) ? rawTotal : undefined;
  }
  return { ids, totals };
}

/**
 * The balance of every invoice in the batch, from the shared money helper.
 *
 * The helper caps one batch, so the ids go in chunks: a report over many
 * invoices must never silently drop the ones past the cap.
 */
async function balancesForInvoices(
  rows: Array<Record<string, unknown>>,
): Promise<Map<string, number | null>> {
  const { ids, totals } = balanceInputs(rows);
  const balances = new Map<string, number | null>();
  for (let start = 0; start < ids.length; start += MAX_SETTLEMENT_IDS) {
    const chunk = ids.slice(start, start + MAX_SETTLEMENT_IDS);
    const chunkTotals: Record<string, number | undefined> = {};
    for (const id of chunk) chunkTotals[id] = totals[id];
    const chunkBalances = await getInvoiceBalances(chunk, chunkTotals);
    for (const [id, balance] of chunkBalances) balances.set(id, balance);
  }
  return balances;
}

// ── Resident notifications ────────────────────────────────
// The resident waits on their own money: an invoice they owe, an invoice the
// office voided. Every invoice decision is pushed to the tenant's own user,
// resolved from the tenant record, never to an admin. A notification failure
// never undoes the write it follows.

/**
 * Sends one notification to the user who owns a tenant record.
 *
 * The recipient is resolved from the tenant, so an invoice can never notify
 * the wrong person. Failures are logged, never thrown: the invoice write
 * already happened and must not be undone by a push that did not go out.
 */
async function notifyTenantOfInvoice(
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
      logger.warn({ tenantId: tenantIdStr }, 'Invoice notification skipped: invalid tenant id');
      return;
    }
    const tenantRaw = await tenantFindOne(
      safeFilter({ _id: new mongoose.Types.ObjectId(tenantIdStr) }),
    );
    const tenant = tenantRaw as Record<string, unknown> | null;
    const userId = tenant?.userId;
    if (!tenant || !userId) {
      logger.warn({ tenantId: tenantIdStr }, 'Invoice notification skipped: tenant has no user');
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
    logger.error({ err, tenantId: tenantIdStr }, 'Failed to notify tenant about an invoice');
  }
}

// ── Schemas ─────────────────────────────────────────────
const generateBulkSchema = z.strictObject({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'),
});

const generateSingleSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'),
  lineItems: z
    .array(
      z.strictObject({
        description: z.string().min(1, 'Description is required'),
        amount: z.number().min(0, 'Amount cannot be negative'),
      }),
    )
    .optional(),
  dueDate: z.string().optional(),
});

// ── GET /invoices ───────────────────────────────────────
invoices.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, sort, order, skip } = parsePagination(c);
  const month = c.req.query('month');
  const status = c.req.query('status');
  const tenantId = c.req.query('tenantId');
  const search = c.req.query('search')?.trim();

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

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [matchingUsers, matchingRooms] = await Promise.all([
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
    ]);

    const userIds = matchingUsers.map((u) => u._id);
    const roomIds = matchingRooms.map((r) => r._id);

    const matchingTenants = (await Tenant.find({
      $or: [{ userId: { $in: userIds } }, { roomId: { $in: roomIds } }],
    } as Record<string, unknown>)
      .select('_id')
      .lean()) as unknown as Array<Record<string, unknown>>;

    const tenantIds = matchingTenants.map((t) => t._id);

    filter.$or = [
      { invoiceNumber: { $regex: escaped, $options: 'i' } },
      ...(tenantIds.length > 0 ? [{ tenantId: { $in: tenantIds } }] : []),
    ];
  }

  const [data, total] = await Promise.all([
    Invoice.find(filter as Record<string, unknown>)
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
    invoiceCountDocs(filter as Record<string, unknown>),
  ]);

  // Additive money fields: every row carries the server-computed settled
  // amount and balance, so no client has to derive them from the gross
  // total. One query for the whole page, not one per invoice.
  const listRows = data as Array<Record<string, unknown>>;
  const { ids, totals } = balanceInputs(listRows);
  const settlements = await getInvoiceSettlements(ids, totals);
  const rows = withMoneyFields(listRows, settlements);

  return c.json({
    success: true,
    data: rows,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /invoices/status-counts ─────────────────────────
invoices.get('/status-counts', authGuard, adminOnly, async (c) => {
  const month = c.req.query('month');
  const match: Record<string, unknown> = {};
  if (month) match.month = month;

  const agg = await Invoice.aggregate([
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {
    all: 0,
    draft: 0,
    sent: 0,
    partial: 0,
    paid: 0,
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

// ── GET /invoices/preview-bulk ──────────────────────────
invoices.get('/preview-bulk', authGuard, adminOnly, async (c) => {
  const month = c.req.query('month');
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return badRequest(c, 'month query parameter must be YYYY-MM format', 'INVALID_MONTH');
  }

  const activeTenants = (await Tenant.find(
    safeFilter({ isActive: true }),
  ).lean()) as unknown as Array<Record<string, unknown>>;
  const activeTenantsCount = activeTenants.length;

  const existingInvoices = (await Invoice.find(safeFilter({ month, status: { $ne: 'cancelled' } }))
    .select('tenantId')
    .lean()) as unknown as Array<Record<string, unknown>>;

  const invoicedTenantIds = new Set(existingInvoices.map((inv) => String(inv.tenantId)));
  const eligibleTenants = activeTenants.filter((t) => !invoicedTenantIds.has(String(t._id)));

  const estimatedTotalAmount = eligibleTenants.reduce(
    (sum, t) => sum + ((t.monthlyRent as number) ?? 0),
    0,
  );

  return c.json({
    success: true,
    data: {
      month,
      activeTenantsCount,
      alreadyInvoicedCount: existingInvoices.length,
      toGenerateCount: eligibleTenants.length,
      estimatedTotalAmount,
    },
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

  // Same money fields as the admin list: the resident sees the real balance,
  // not the gross total, on the same screen as the UPI QR.
  const myRows = data as Array<Record<string, unknown>>;
  const { ids: myIds, totals: myTotals } = balanceInputs(myRows);
  const mySettlements = await getInvoiceSettlements(myIds, myTotals);
  const rows = withMoneyFields(myRows, mySettlements);

  return c.json({ success: true, data: rows });
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

  // One balance definition: the shared money helper, the same one the invoice
  // row, the invoice list and the dues summary use. The ledger, the aging
  // report and the invoice row can never disagree about what is owed.
  const balances = await balancesForInvoices(outstanding);

  const buckets = {
    current: { count: 0, amount: 0 },
    days1_30: { count: 0, amount: 0 },
    days31_60: { count: 0, amount: 0 },
    days61_90: { count: 0, amount: 0 },
    days90Plus: { count: 0, amount: 0 },
  };

  const nowMs = Date.now();
  for (const inv of outstanding) {
    const id = inv._id ? String(inv._id) : '';
    const balance = balances.get(id);
    if (balance == null) {
      // An unknown total means the amount is still outstanding, never zero.
      // The amount is not known, so the invoice is counted as open and the
      // report says so instead of pretending nothing is due.
      logger.warn({ invoiceId: id }, 'Aging report: invoice total is unknown, amount not counted');
      buckets.current.count += 1;
      continue;
    }
    if (balance <= 0.001) continue;

    const due = inv.dueDate ? new Date(inv.dueDate as string | Date) : null;
    const dueMs = due && !Number.isNaN(due.getTime()) ? due.getTime() : null;
    const daysPastDue = dueMs != null ? Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000)) : 0;

    if (daysPastDue <= 0) {
      buckets.current.count += 1;
      buckets.current.amount = roundMoney(buckets.current.amount + balance);
    } else if (daysPastDue <= 30) {
      buckets.days1_30.count += 1;
      buckets.days1_30.amount = roundMoney(buckets.days1_30.amount + balance);
    } else if (daysPastDue <= 60) {
      buckets.days31_60.count += 1;
      buckets.days31_60.amount = roundMoney(buckets.days31_60.amount + balance);
    } else if (daysPastDue <= 90) {
      buckets.days61_90.count += 1;
      buckets.days61_90.amount = roundMoney(buckets.days61_90.amount + balance);
    } else {
      buckets.days90Plus.count += 1;
      buckets.days90Plus.amount = roundMoney(buckets.days90Plus.amount + balance);
    }
  }

  const data = {
    buckets,
    totalOutstanding: roundMoney(
      buckets.current.amount +
        buckets.days1_30.amount +
        buckets.days31_60.amount +
        buckets.days61_90.amount +
        buckets.days90Plus.amount,
    ),
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
    const { tenantId, month, lineItems, dueDate } = c.req.valid('json');
    const user = c.get('user');
    try {
      const invoice = await generateSingleInvoice({ tenantId, month, lineItems, dueDate });

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

  const rawTotal = invoice.totalAmount;
  const invoiceTotal =
    typeof rawTotal === 'number' && Number.isFinite(rawTotal) ? rawTotal : undefined;
  // One balance definition everywhere: the same helper the invoice list, the
  // payment routes and the dues summary use. `paidAmount` is the REAL settled
  // sum of the paid rows, never a number capped at the invoice total, and
  // `balance` is null when the total is unknown (still outstanding, never
  // settled).
  const { paidAmount, balance } = await getInvoiceSettlement(id, invoiceTotal);

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

  let electricityDetails: Record<string, unknown> | null = null;
  const roomIdStr = roomInfo?._id ? String(roomInfo._id) : null;
  if (roomIdStr && invoice.month) {
    const elecBill = (await ElectricityBill.findOne(
      safeFilter({ month: invoice.month }),
    ).lean()) as Record<string, unknown> | null;

    if (elecBill) {
      const roomEntries = (elecBill.roomEntries as Array<Record<string, unknown>>) ?? [];
      const entry = roomEntries.find((e) => {
        const rId =
          typeof e.roomId === 'object' && e.roomId !== null && '_id' in e.roomId
            ? String((e.roomId as { _id: unknown })._id)
            : String(e.roomId ?? '');
        return rId === roomIdStr;
      });

      if (entry) {
        const prev = (entry.previousReading as number) ?? 0;
        const curr = (entry.currentReading as number) ?? 0;
        const units = (entry.unitsConsumed as number) ?? Math.max(0, curr - prev);
        electricityDetails = {
          billId: String(elecBill._id),
          month: elecBill.month,
          billStatus: elecBill.status,
          previousReading: prev,
          currentReading: curr,
          unitsConsumed: units,
          ratePerUnit: (entry.ratePerUnit as number) ?? 0,
          roomTotalAmount: (entry.amount as number) ?? 0,
          tenantShare: (invoice.electricityAmount as number) ?? 0,
          billImageUrl: elecBill.billImageUrl ?? null,
        };
      }
    }
  }

  return c.json({
    success: true,
    data: {
      ...invoice,
      paidAmount,
      balance,
      payments,
      whatsAppUrl,
      shareText,
      pgBranding,
      electricityDetails,
    },
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
  dueDate: z.string().optional(),
});

invoices.put('/:id', authGuard, adminOnly, zValidator('json', updateInvoiceSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid invoice ID');

  const body = c.req.valid('json');
  const adminId = c.get('user').sub;

  const invoice = await Invoice.findById(id);
  if (!invoice) return notFound(c, 'Invoice');

  // The amount the resident was last told about: the edit is only news when
  // the number they owe actually moved.
  const previousTotal = invoice.totalAmount;

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
    // An unknown balance means the amount is still outstanding, never zero:
    // the cancel is refused, because the dues cannot be proven to be gone.
    if (remaining == null || remaining > 0.001) {
      const message =
        remaining == null
          ? 'Cannot cancel: the outstanding amount of this invoice is unknown.'
          : `Cannot cancel: invoice still has ₹${remaining.toLocaleString('en-IN')} outstanding.`;
      return c.json(
        {
          success: false,
          error: {
            code: 'INVOICE_HAS_BALANCE',
            message,
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

  // ── Re-sync the system obligation, never the resident's transfer ──
  // A pending_verification row is a resident's money transfer: its amount is
  // the resident's declaration and only the verification step may change it.
  // Only a row the system itself created (status 'pending') is adjusted, and
  // only to the balance the shared money helper reports.
  if (invoice.status !== 'paid' && invoice.status !== 'cancelled') {
    const systemPending = await Payment.findOne(
      safeFilter({
        invoiceId: invoice._id,
        status: 'pending',
      }),
    );
    if (systemPending) {
      // The pending obligation is the balance: same helper as every read path.
      const residual = await getInvoiceBalance(String(invoice._id), invoice.totalAmount);
      if (residual == null) {
        // An unknown balance is outstanding, never zero: the row is left as it
        // is rather than rewritten with a number nobody can prove.
        logger.warn(
          { invoiceId: id },
          'Invoice edit: the outstanding amount is unknown, the open obligation was left untouched',
        );
      } else {
        systemPending.amount = residual;
        if (invoice.dueDate) systemPending.dueDate = invoice.dueDate;
        await systemPending.save();
      }
    }
  }

  // ── The money decides the payment status ─────────────────
  // The status must never disagree with the balance: 'partial' with a zero
  // balance and 'sent' on a settled invoice are both lies. The shared helper
  // is the ONE definition of that status.
  const residentTransferRows = (await Payment.find(
    safeFilter({
      invoiceId: invoice._id,
      status: 'pending_verification',
    }),
  )
    .select('_id')
    .lean()) as unknown as Array<{ _id: mongoose.Types.ObjectId }>;
  const residentTransferIds = residentTransferRows.map((row) => row._id);

  await updateInvoicePaymentStatus(id);

  if (residentTransferIds.length > 0) {
    // The shared helper cancels the open rows that no longer fit the balance.
    // A resident's transfer is not the office's to void: an invoice edit
    // leaves it alone and the verification step resolves the mismatch.
    const restored = await Payment.updateMany(
      safeFilter({ _id: { $in: residentTransferIds }, status: 'cancelled' }),
      { $set: { status: 'pending_verification' } },
    );
    if (restored.modifiedCount > 0) {
      logger.warn(
        { invoiceId: id, restored: restored.modifiedCount },
        'Invoice edit: restored the resident transfer rows the status recompute had voided',
      );
    }
  }

  // The office decides whether an invoice is issued or void; the money
  // decides everything else. The shared helper keeps 'cancelled' and
  // 'overdue' and derives 'paid' and 'partial' from the money. The two
  // decisions it does not own are the office's: an invoice that is not
  // issued yet ('draft') and one the office voids ('cancelled').
  let officeStatus: 'draft' | 'cancelled' | undefined;
  if (body.status === 'cancelled') {
    officeStatus = 'cancelled';
  } else if (body.status === 'draft') {
    const settlement = await getInvoiceSettlement(id, invoice.totalAmount);
    // A draft invoice with money collected against it is not a draft any
    // more: the money status wins.
    if (settlement.paidAmount <= 0) officeStatus = 'draft';
  }
  if (officeStatus) {
    await Invoice.findByIdAndUpdate(id, { status: officeStatus });
  }

  const { writeAuditLog } = await import('../lib/write-audit-log.js');

  // The resident's invoice was voided: they must hear it from the server.
  if (body.status === 'cancelled' && currentStatus !== 'cancelled') {
    await notifyTenantOfInvoice(invoice.tenantId, {
      title: 'Invoice cancelled',
      body:
        `Your invoice ${String(invoice.invoiceNumber ?? '')} for ${String(invoice.month ?? '')} ` +
        `was cancelled by the PG office. Any amount already paid stays on record.`,
      type: 'payment_reminder',
      data: { invoiceId: id, invoiceNumber: String(invoice.invoiceNumber ?? '') },
    });
  }

  // The amount the resident owes moved: the old number is on their screen and
  // in their head, so they must hear the new one from the server.
  const newTotal = invoice.totalAmount;
  if (newTotal !== previousTotal) {
    await notifyTenantOfInvoice(invoice.tenantId, {
      title: 'Invoice updated',
      body:
        `Your invoice ${String(invoice.invoiceNumber ?? '')} for ${String(invoice.month ?? '')} ` +
        `was updated. The amount is now ₹${newTotal.toFixed(2)}, ` +
        `previously ₹${previousTotal.toFixed(2)}.`,
      type: 'payment_reminder',
      data: { invoiceId: id, invoiceNumber: String(invoice.invoiceNumber ?? '') },
    });
  }

  const populated = await Invoice.findById(id)
    .populate({
      path: 'tenantId',
      populate: [
        { path: 'userId', select: 'name email phone' },
        { path: 'roomId', select: 'roomNumber floorId' },
      ],
    })
    .lean();

  await writeAuditLog({
    userId: adminId,
    action: 'update',
    resource: 'invoice',
    resourceId: id,
    details: {
      fields: Object.keys(body),
      // The status the server committed, not the one the request asked for.
      status: populated?.status ?? invoice.status,
      totalAmount: invoice.totalAmount,
    },
  });

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

  // A payment row is the evidence that money moved. A pending_verification
  // row holds a resident's UTR number and its screenshot: deleting it with
  // the invoice wipes the only trace of the resident's transfer. The delete
  // is refused while any payment record exists against the invoice, and the
  // reason is named.
  const paymentRows = (await Payment.find(
    safeFilter({ invoiceId: new mongoose.Types.ObjectId(id) }),
  )
    .select('status')
    .lean()) as unknown as Array<{ status?: string }>;
  if (paymentRows.length > 0) {
    const livePayments = paymentRows.filter((row) => row.status !== 'cancelled');
    const reason =
      livePayments.length > 0
        ? `${livePayments.length} payment record(s) still exist against this invoice`
        : `${paymentRows.length} cancelled payment record(s) still exist against this invoice`;
    return c.json(
      {
        success: false,
        error: {
          code: 'INVOICE_HAS_PAYMENTS',
          message:
            `Cannot delete invoice: ${reason}. Payment records are evidence of money moved ` +
            `and cannot be purged. Void the payments instead.`,
        },
      },
      409,
    );
  }

  // The invoice carries no payment record at all, so there is nothing to
  // purge with it.
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

export default invoices;
