import mongoose from 'mongoose';
import { Payment } from '../models/payment.js';
import { Invoice } from '../models/invoice.js';
import { safeFilter } from '../lib/routeUtils.js';
import { logger } from '../lib/logger.js';

type FindOneFn = (filter: Record<string, unknown>) => Promise<unknown>;
/** The raw driver surface this service needs from a collection. */
type RawCollection = {
  find(filter: Record<string, unknown>): { toArray(): Promise<Array<Record<string, unknown>>> };
};

const invoiceFindOne = Invoice.findOne.bind(Invoice) as unknown as FindOneFn;
/**
 * Raw driver read of the payment rows.
 *
 * The model casts a query value of an ObjectId path to an ObjectId, so a
 * payment row that stored its invoice id as a plain hex string would be
 * invisible to `Payment.find`. The aggregation path does not cast, so the two
 * paths would then report different money for the same invoice. Reading the
 * rows without the cast makes both paths see exactly the same rows.
 */
const paymentCollection = Payment.collection as unknown as RawCollection;
const paymentFindRaw = (filter: Record<string, unknown>): Promise<Array<Record<string, unknown>>> =>
  paymentCollection.find(filter).toArray();

/**
 * The money state of an invoice, as the server computes it.
 *
 * `paidAmount` is the REAL settled sum: every paid payment row on the
 * invoice, added up, NOT capped at the invoice total. An invoice that was
 * over-collected reports the overpayment here, so the invoice view can never
 * under-report what the payments ledger shows.
 *
 * `balance` is the amount still due: max(0, total - paidAmount). It never
 * goes negative, so a client can render it as "due" without a sign check.
 *
 * `balance` is `null` when the invoice total is not known. An unknown total
 * means the amount is still OUTSTANDING, never settled: `null` must never be
 * read as 0, because 0 means "nothing due" and "fully paid" at the same time.
 */
export interface InvoiceSettlement {
  /** The invoice total this settlement was computed against. null when unknown. */
  totalAmount: number | null;
  /** Sum of every paid payment row on the invoice. May exceed totalAmount. */
  paidAmount: number;
  /** Amount still due. null when the total is unknown (still outstanding). */
  balance: number | null;
}

/**
 * Cap on the number of invoices one settlement batch may cover.
 *
 * GET /invoices/my and GET /tenants/:id/invoices are unpaginated, so an
 * unbounded id list must never become an unbounded query. The invoices past
 * the cap are reported as unknown (balance null), never as settled.
 */
export const MAX_SETTLEMENT_IDS = 500;

/**
 * Rounds a money amount to 2 decimals (paise) so derived fields carry no float
 * noise. Every money value the API returns passes through this.
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * THE single definition of an invoice balance.
 *
 * `paidAmount` is the settled sum of the paid payment rows (uncapped);
 * `totalAmount` is the invoice total, or null when it is unknown. Both
 * numbers are rounded by the same rule and the balance is derived from the
 * SAME rounded paid sum the status helper compares, so no read path can
 * disagree with another and no client ever has to derive a balance from the
 * gross total.
 */
export function settleInvoiceMoney(
  totalAmount: number | null | undefined,
  paidAmount: number,
): InvoiceSettlement {
  const paid = Number.isFinite(paidAmount) ? roundMoney(paidAmount) : 0;
  if (totalAmount == null || !Number.isFinite(totalAmount)) {
    // An unknown total means the amount is still outstanding, never settled.
    return { totalAmount: null, paidAmount: paid, balance: null };
  }
  const total = roundMoney(totalAmount);
  return {
    totalAmount: total,
    paidAmount: paid,
    balance: Math.max(0, roundMoney(total - paid)),
  };
}

/**
 * Canonical key of an invoice id.
 *
 * Every money map is keyed with this, so the single-invoice path and the
 * batch path can never return different numbers for the same invoice. Both
 * sides go through the ObjectId cast, so a 12-byte string and its hex form
 * land on the same key, and a row that stored its invoice id as a plain hex
 * string lands on the same key as a row that stored an ObjectId.
 */
function invoiceKey(id: unknown): string {
  if (id == null) return '';
  const raw = typeof id === 'string' ? id : String(id);
  if (!mongoose.isValidObjectId(raw)) return raw;
  return new mongoose.Types.ObjectId(raw).toString();
}

/** The invoice id as an ObjectId, or null when it is not a valid id. */
function invoiceIdObjectId(invoiceId: string): mongoose.Types.ObjectId | null {
  const raw = invoiceId.trim();
  if (!mongoose.isValidObjectId(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

/**
 * Every stored form of an invoice id: the ObjectId and the hex string a
 * legacy payment row may still carry. Money is found under either one, so a
 * row written before the id was cast counts exactly like a row written after
 * it. Both the single and the batch path use this, so they always see the
 * same rows.
 */
function invoiceIdCandidates(invoiceId: string): Array<mongoose.Types.ObjectId | string> {
  const oid = invoiceIdObjectId(invoiceId);
  if (!oid) return [invoiceId.trim()];
  return [oid, oid.toHexString()];
}

/**
 * Recompute invoice.status from non-cancelled payments (paid total vs invoice total).
 * Used by offline record, verify, update, and delete payment handlers.
 */
export async function updateInvoicePaymentStatus(invoiceId: string): Promise<void> {
  const paymentsRaw = await paymentFindRaw(
    safeFilter({
      invoiceId: { $in: invoiceIdCandidates(invoiceId) },
      status: { $ne: 'cancelled' },
    }),
  );

  const invoiceOid = invoiceIdObjectId(invoiceId);
  if (!invoiceOid) return;

  const invoiceRaw = await invoiceFindOne(safeFilter({ _id: invoiceOid }));
  if (!invoiceRaw) return;

  const invoice = invoiceRaw as Record<string, unknown>;
  const rawTotal = invoice.totalAmount;
  const invoiceTotal = typeof rawTotal === 'number' && Number.isFinite(rawTotal) ? rawTotal : null;

  const allActive = paymentsRaw;
  // One balance definition, same as every read path: the settled sum of the
  // paid rows and the balance it leaves behind. The status below is compared
  // against the SAME rounded paid sum, so a status and a balance can never
  // disagree.
  const { paidAmount: totalPaid, balance } = settleInvoiceMoney(
    invoiceTotal,
    allActive
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + ((p.amount as number) ?? 0), 0),
  );
  // An unknown total leaves the whole amount outstanding.
  const remainingBalance = balance ?? Number.POSITIVE_INFINITY;

  // Cancel any excess pending / pending_verification rows beyond the first,
  // and cancel any pending row whose amount exceeds the remaining balance.
  const openPayments = allActive.filter(
    (p) => p.status === 'pending' || p.status === 'pending_verification',
  );
  let keepFirst = true;

  for (const open of openPayments) {
    const openId = String(open._id ?? '');
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

  if (invoiceTotal != null && invoiceTotal > 0 && totalPaid >= invoiceTotal) {
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
 * The settled sum and the balance of ONE invoice, straight from the payment
 * rows. This is the only definition of an invoice balance in the API.
 *
 * Only paid payment rows count: a pending, pending_verification or cancelled
 * row never reduces the balance.
 */
export async function getInvoiceSettlement(
  invoiceId: string,
  invoiceTotal?: number,
): Promise<InvoiceSettlement> {
  const paidRows = await paymentFindRaw(
    safeFilter({
      invoiceId: { $in: invoiceIdCandidates(invoiceId) },
      status: 'paid',
    }),
  );
  const paid = paidRows.reduce((sum, p) => sum + ((p.amount as number) ?? 0), 0);

  // `null` means the total is unknown: the amount is still outstanding, never
  // settled. It has to be part of the type, or the unknown case would be
  // silently turned into a zero.
  let total: number | null | undefined = invoiceTotal;
  if (total === undefined) {
    const invoiceOid = invoiceIdObjectId(invoiceId);
    if (!invoiceOid) return settleInvoiceMoney(null, paid);
    const invoiceRaw = await invoiceFindOne(safeFilter({ _id: invoiceOid }));
    if (!invoiceRaw) return settleInvoiceMoney(null, paid);
    const raw = (invoiceRaw as Record<string, unknown>).totalAmount;
    total = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }

  return settleInvoiceMoney(total, paid);
}

/**
 * Batch form of getInvoiceSettlement: one paid-payments query for every
 * invoice in the batch instead of one query per invoice.
 *
 * `totals` maps invoice id to its total amount. An id with no total is
 * reported as unknown (balance null), never as settled. The returned map is
 * keyed by the same ids and holds the same numbers getInvoiceSettlement would
 * return, so a list route cannot disagree with a single read.
 */
export async function getInvoiceSettlements(
  invoiceIds: string[],
  totals: Record<string, number | undefined>,
): Promise<Map<string, InvoiceSettlement>> {
  const settlements = new Map<string, InvoiceSettlement>();
  if (invoiceIds.length === 0) return settlements;

  // An unbounded id list must never become an unbounded query.
  const ids = invoiceIds.slice(0, MAX_SETTLEMENT_IDS);
  if (ids.length < invoiceIds.length) {
    logger.warn(
      { requested: invoiceIds.length, covered: ids.length },
      'Invoice settlement batch capped; the invoices past the cap are reported as unknown',
    );
  }

  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  const paidByInvoice = new Map<string, number>();

  if (validIds.length > 0) {
    const candidates = validIds.flatMap((id) => invoiceIdCandidates(id));
    const rows = await Payment.aggregate([
      {
        $match: {
          invoiceId: { $in: candidates },
          status: 'paid',
        },
      },
      { $group: { _id: '$invoiceId', total: { $sum: '$amount' } } },
    ]);
    for (const row of rows as Array<Record<string, unknown>>) {
      // The group key is cast through the ObjectId exactly like the lookup
      // key, so both land on the same invoice. A legacy row that stored the
      // id as a hex string groups separately from an ObjectId row: add the
      // groups instead of letting the second overwrite the first.
      const key = invoiceKey(row._id);
      const amount = (row.total as number) ?? 0;
      paidByInvoice.set(key, (paidByInvoice.get(key) ?? 0) + amount);
    }
  }

  for (const id of ids) {
    const paid = paidByInvoice.get(invoiceKey(id)) ?? 0;
    settlements.set(id, settleInvoiceMoney(totals[id], paid));
  }

  // The invoices past the cap are unknown, never settled.
  for (const id of invoiceIds.slice(MAX_SETTLEMENT_IDS)) {
    settlements.set(id, settleInvoiceMoney(null, 0));
  }

  return settlements;
}

/**
 * Remaining balance on an invoice (total - settled sum).
 * Shared by QR, UTR submit, and offline residual logic.
 *
 * `null` when the invoice total is unknown: an unknown total means the amount
 * is still outstanding, never settled. Callers must not read it as 0.
 */
export async function getInvoiceBalance(
  invoiceId: string,
  invoiceTotal?: number,
): Promise<number | null> {
  const { balance } = await getInvoiceSettlement(invoiceId, invoiceTotal);
  return balance;
}

/**
 * Batch form of getInvoiceBalance: one paid-payments query for every invoice
 * in the batch instead of one query per invoice.
 *
 * `totals` maps invoice id to its total amount. The returned map is keyed by
 * the same ids and holds the same number getInvoiceBalance would return, so a
 * list route cannot disagree with a single read. A null balance means the
 * invoice total is unknown and the amount is still outstanding.
 */
export async function getInvoiceBalances(
  invoiceIds: string[],
  totals: Record<string, number | undefined>,
): Promise<Map<string, number | null>> {
  const settlements = await getInvoiceSettlements(invoiceIds, totals);
  const balances = new Map<string, number | null>();
  for (const [id, settlement] of settlements) balances.set(id, settlement.balance);
  return balances;
}
