import type { ModuleContract } from './module';

/**
 * The invoices contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/invoice.ts:89
 * - routes: apps/api/src/routes/invoices.ts
 * - the generator that writes the invoice and pushes it to the resident:
 *   apps/api/src/services/invoice.service.ts:152-202
 * - the status that follows the money: apps/api/src/services/payment-status.service.ts:195-209
 * - the daily overdue sweep and the notice it sends:
 *   apps/api/src/jobs/scheduler.ts:21-56, :96-124
 * - the admin screens: apps/web/src/app/(admin)/invoices
 *
 * The invoice is the obligation side of the money loop. The payment ledger
 * (packages/types/src/contracts/payments.ts) is the money that came in.
 */
export const INVOICES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'issuing the month bills, chasing the ones that are not settled, and keeping the outstanding total honest against the payment ledger',
    doneLooksLike:
      'every active tenant has one invoice for the month, and every invoice reads sent, partial, paid, overdue or cancelled with a balance that equals total minus the settled payments',
    primaryAction: 'Issue a bill or chase an unpaid one',
  },
  stateMachine: {
    domain: 'invoices',
    model: 'invoice',
    kind: 'ladder',
    statuses: [
      {
        // The only way into draft is reopening a cancelled invoice. Nothing
        // generates a draft: the generator hardcodes sent.
        status: 'draft',
        enteredBy: {
          method: 'PUT',
          path: '/invoices/:id',
          condition:
            'a cancelled invoice is reopened as a draft (apps/api/src/routes/invoices.ts:709-716)',
        },
      },
      {
        // The bill is issued and the resident is charged.
        status: 'sent',
        enteredBy: {
          method: 'POST',
          path: '/invoices/generate-single',
          condition:
            'the generator writes status=sent for every invoice it creates (apps/api/src/services/invoice.service.ts:161); POST /invoices/generate-bulk does the same for every active tenant',
        },
        // Due on the 5th of the billing month (apps/api/src/services/invoice.service.ts:139-150),
        // so an issued bill is expected to settle inside the billing month.
        dwell: 5,
        dwellUnit: 'days',
      },
      {
        // The settled payments add up to the invoice total.
        status: 'paid',
        enteredBy: {
          method: 'POST',
          path: '/payments/:id/verify',
          condition:
            'the paid payments on the invoice add up to the invoice total, so updateInvoicePaymentStatus writes paid (apps/api/src/services/payment-status.service.ts:196)',
        },
      },
      {
        // Some money is in, the rest is not.
        status: 'partial',
        enteredBy: {
          method: 'POST',
          path: '/payments/:id/verify',
          condition:
            'at least one payment is settled but the total is not reached (apps/api/src/services/payment-status.service.ts:199)',
        },
      },
      {
        // The due date passed. Only the clock writes this.
        status: 'overdue',
        enteredBy: {
          method: 'POST',
          path: '/jobs/overdue-check',
          condition:
            'the daily 08:00 sweep moves every sent invoice whose due date has passed to overdue, and then tells every tenant whose invoice it moved (apps/api/src/jobs/scheduler.ts:21-56, :96-124). The cron secret route POST /jobs/overdue-check performs the same bulk write without that notice (apps/api/src/routes/jobs.ts:52-90)',
        },
      },
      {
        // The bill is void. It can only be cancelled when nothing is outstanding.
        status: 'cancelled',
        enteredBy: {
          method: 'PUT',
          path: '/invoices/:id',
          condition:
            'an admin cancels an invoice that has no remaining balance; a bill with money still due is refused with INVOICE_HAS_BALANCE (apps/api/src/routes/invoices.ts:727-750)',
        },
      },
    ],
    terminal: 'paid',
    deadEnd: 'cancelled',
  },
  truthContract: [
    {
      action: 'Issue an invoice',
      operatorBelieves: 'the resident has been billed and knows about it',
      serverCommits:
        'POST /invoices/generate-single calls generateSingleInvoice, which writes the invoice with status=sent, creates a pending payment row for the same amount, stamps the due date on the 5th of the billing month and sends the resident a payment_reminder notification (apps/api/src/services/invoice.service.ts:152-202). A failed push is logged and never undoes the invoice.',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: true,
      },
      mismatchSurfacedAt:
        'the admin invoice list shows the sent badge and the resident sees the notification in the portal',
      provenance: {
        auditAction: 'create',
        screen: '/invoices/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the invoice sits sent with nothing settled against it until the resident pays or the admin records the payment',
      runbook3am:
        'open /invoices, filter by status=sent, open the invoice and read the payment rows under it',
    },
    {
      action: 'Edit an invoice after it was issued',
      operatorBelieves: 'the corrected amount is what the resident owes now',
      serverCommits:
        'PUT /invoices/:id rewrites the amounts, rebuilds the line items, re-saves the invoice, re-syncs only the office own pending payment row to the new residual, leaves a resident pending_verification row alone and writes an audit log entry with the new status and total (apps/api/src/routes/invoices.ts:690-935). When the amount actually moved it then pushes a payment_reminder notification to the resident with the old and the new number in the body (apps/api/src/routes/invoices.ts:897-910); an edit that moved nothing but the due date or the wording sends no notification. A cancellation pushes its own payment_reminder (apps/api/src/routes/invoices.ts:885-895). A failed push never undoes the edit.',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it when the amount moved: the admin invoice detail shows the new total and the resident gets the notification with the old and the new number',
      provenance: {
        auditAction: 'update',
        screen: '/invoices/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the amount moved and the push failed, so the resident is still paying the old number and the balance never agrees with the money',
      runbook3am:
        'open /invoices/[id], read the update entry in the audit timeline, and if the resident has no notification, tell them the new amount',
    },
  ],
  layout: {
    archetype: 'ledger',
    grammarTokens: [
      'DataTable',
      'StatusTabs',
      'FilterChips',
      'AgingBars',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
    ],
    mustNotLookLike:
      'a payment queue: an invoice row is a month of dues owed, not money received, and the outstanding total has to sit on the band',
    ownNumber: 'INR outstanding past its due date',
  },
  nextBestAction: {
    perStatus: {
      draft: {
        label: 'Finish and send it',
        target: '/invoices/[id]/edit',
        enabledWhen: 'the invoice was reopened and still carries no line items',
      },
      sent: {
        label: 'Record the payment',
        target: '/payments/new',
        enabledWhen: 'the invoice still carries an unpaid balance',
      },
      paid: {
        label: 'Open the receipt',
        target: '/invoices/[id]',
      },
      partial: {
        label: 'Record the rest',
        target: '/payments/new',
        enabledWhen: 'the balance is still above zero',
      },
      overdue: {
        label: 'Open the overdue ledger',
        target: '/invoices?status=overdue',
      },
      cancelled: {
        label: 'Read the cancellation',
        target: '/invoices/[id]',
      },
    },
    perEmptyState: {
      invoices: {
        label: 'Generate the month invoices',
        target: '/invoices/new',
      },
      sent: {
        label: 'Open the paid ledger',
        target: '/invoices?status=paid',
      },
    },
  },
};
