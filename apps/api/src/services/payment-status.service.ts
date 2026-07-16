import mongoose from 'mongoose';
import { Payment } from '../models/payment.js';
import { Invoice } from '../models/invoice.js';
import { safeFilter } from '../lib/routeUtils.js';
import { logger } from '../lib/logger.js';

type FindFn = (filter: Record<string, unknown>) => Promise<unknown[]>;
type FindOneFn = (filter: Record<string, unknown>) => Promise<unknown>;

const paymentFind = Payment.find.bind(Payment) as unknown as FindFn;
const invoiceFindOne = Invoice.findOne.bind(Invoice) as unknown as FindOneFn;

/**
 * Recompute invoice.status from non-cancelled payments (paid total vs invoice total).
 * Used by offline record, verify, update, and delete payment handlers.
 */
export async function updateInvoicePaymentStatus(invoiceId: string): Promise<void> {
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
    await Payment.findByIdAndUpdate(openId, { status: 'cancelled' });
    logger.info(
      {
        paymentId: openId,
        invoiceId,
        reason: keepFirst ? 'amount exceeds balance' : 'duplicate pending row',
      },
      'Cancelled excess pending payment row',
    );
  }

  const currentStatus = (invoice.status as string) ?? 'sent';
  let newStatus: string;

  if (totalPaid >= invoiceTotal && invoiceTotal > 0) {
    newStatus = 'paid';
  } else if (totalPaid > 0) {
    // Keep partial for overdue partially-paid invoices (do not clobber to overdue).
    newStatus = 'partial';
  } else if (currentStatus === 'cancelled') {
    newStatus = 'cancelled';
  } else {
    // No paid amount: leave overdue if already overdue, else sent (never sticky paid).
    const due = invoice.dueDate ? new Date(invoice.dueDate as string | Date) : null;
    const pastDue = due != null && !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
    newStatus = currentStatus === 'overdue' || pastDue ? 'overdue' : 'sent';
  }

  await Invoice.findByIdAndUpdate(invoiceId, { status: newStatus });
}

/**
 * Remaining balance on an invoice (total - sum of paid payments).
 * Shared by QR, UTR submit, and offline residual logic.
 */
export async function getInvoiceBalance(invoiceId: string, invoiceTotal?: number): Promise<number> {
  const paymentsRaw = await paymentFind(
    safeFilter({
      invoiceId: new mongoose.Types.ObjectId(invoiceId),
      status: 'paid',
    }),
  );
  const totalPaid = (paymentsRaw as unknown as Array<Record<string, unknown>>).reduce(
    (sum, p) => sum + ((p.amount as number) ?? 0),
    0,
  );

  let total = invoiceTotal;
  if (total === undefined) {
    const invoiceRaw = await invoiceFindOne(
      safeFilter({ _id: new mongoose.Types.ObjectId(invoiceId) }),
    );
    if (!invoiceRaw) return 0;
    total = ((invoiceRaw as Record<string, unknown>).totalAmount as number) ?? 0;
  }

  return Math.max(0, Math.round(((total as number) - totalPaid) * 100) / 100);
}
