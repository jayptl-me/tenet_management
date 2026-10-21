import type { ModuleContract } from './module';

/**
 * The invoices contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the
 * depth rebuild of the four admin screens (wave 6):
 *
 * - statuses: apps/api/src/models/invoice.ts:87-91
 * - routes: apps/api/src/routes/invoices.ts
 * - the generator that writes the invoice and pushes it to the resident:
 *   apps/api/src/services/invoice.service.ts:82-210
 * - the status that follows the money: apps/api/src/services/payment-status.service.ts:135-209
 * - the daily overdue sweep and the notice it sends:
 *   apps/api/src/jobs/scheduler.ts:88-124, :143-189
 * - the dues summary of a resident: apps/api/src/routes/tenants.ts:1838-1930
 * - the offline collection the invoice screen offers:
 *   apps/api/src/routes/payments.ts:440-700
 * - the admin screens: apps/web/src/app/(admin)/invoices
 *
 * The contract describes the code as it is, including the places where a
 * person is still not told: a deletion takes the bill away without telling the
 * resident, and sending a draft does not tell them either. The screens say so
 * where the operator can see it; the gap itself stays open in
 * docs/audit/features/invoices.md.
 */
export const INVOICES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'issuing the month bills, chasing the ones that are not settled, and keeping the outstanding total honest against the payment ledger',
    doneLooksLike:
      'every active tenant has one invoice for the month, and every invoice reads sent, partial, paid, overdue or cancelled with a balance the server computed, never a number the office typed',
    primaryAction: 'Issue a bill or chase an unpaid one',
  },
  stateMachine: {
    domain: 'invoices',
    model: 'invoice',
    kind: 'ladder',
    statuses: [
      {
        // The only way into draft is reopening a cancelled invoice or moving a
        // bill back. Nothing generates a draft: the generator hardcodes sent.
        status: 'draft',
        enteredBy: {
          method: 'PUT',
          path: '/invoices/:id',
          condition:
            'an admin writes status=draft on an invoice: a cancelled invoice is reopened as a draft (apps/api/src/routes/invoices.ts:708-715, :870-881), and a bill that collected money is not allowed back into draft, because the money status wins (apps/api/src/routes/invoices.ts:873-878)',
        },
      },
      {
        // The bill is issued and the resident is charged.
        status: 'sent',
        enteredBy: {
          method: 'POST',
          path: '/invoices/generate-single',
          condition:
            'the generator writes status=sent for every invoice it creates (apps/api/src/services/invoice.service.ts:161); POST /invoices/generate-bulk does the same for every active tenant that has no invoice for the month (apps/api/src/services/invoice.service.ts:47-77). PUT /invoices/:id with status=sent sends a draft or reopens a cancelled one (apps/api/src/routes/invoices.ts:708-715)',
        },
        // Due on the 5th of the billing month (apps/api/src/services/invoice.service.ts:139-150),
        // so an issued bill is expected to settle inside the billing month.
        dwell: 5,
        dwellUnit: 'days',
      },
      {
        // Some money is in, the rest is not.
        status: 'partial',
        enteredBy: {
          method: 'POST',
          path: '/payments/:id/verify',
          condition:
            'at least one payment is settled but the total is not reached, so updateInvoicePaymentStatus writes partial (apps/api/src/services/payment-status.service.ts:197-198). The same happens when an offline collection leaves a residual (apps/api/src/routes/payments.ts:627-638)',
        },
      },
      {
        // The settled payments add up to the invoice total.
        status: 'paid',
        enteredBy: {
          method: 'POST',
          path: '/payments/:id/verify',
          condition:
            'the paid payments on the invoice add up to the invoice total, so updateInvoicePaymentStatus writes paid (apps/api/src/services/payment-status.service.ts:194-196). An offline collection that settles the bill reaches it the same way (apps/api/src/routes/payments.ts:562-616)',
        },
      },
      {
        // The due date passed. Only the clock writes this.
        status: 'overdue',
        enteredBy: {
          method: 'POST',
          path: '/jobs/overdue-check',
          condition:
            'the daily 08:00 sweep moves every sent invoice whose due date has passed to overdue and then tells every tenant whose invoice it moved (apps/api/src/jobs/scheduler.ts:91-124, scheduled at :192). The cron secret route POST /jobs/overdue-check performs the same bulk write without that notice (apps/api/src/routes/jobs.ts:52-90)',
        },
      },
      {
        // The bill is void. It can only be cancelled when nothing is outstanding.
        status: 'cancelled',
        enteredBy: {
          method: 'PUT',
          path: '/invoices/:id',
          condition:
            'an admin cancels an invoice that has no remaining balance; a bill with money still due is refused with INVOICE_HAS_BALANCE (apps/api/src/routes/invoices.ts:727-747)',
        },
      },
    ],
    terminal: 'paid',
    // No invoice status is a dead letter box: a cancelled invoice is reopened
    // through PUT /invoices/:id (apps/api/src/routes/invoices.ts:708-715), and a
    // paid one reopens when a payment is voided
    // (apps/api/src/routes/payments.ts:1342-1405). The field is left empty on
    // purpose rather than naming a status that can still move.
  },
  truthContract: [
    {
      action: 'Issue an invoice to one resident',
      operatorBelieves: 'the resident has been billed and knows about it',
      serverCommits:
        'POST /invoices/generate-single calls generateSingleInvoice, which writes the invoice with status=sent, creates a pending payment row for the same amount, stamps the due date on the 5th of the billing month when the request carries none, and sends the resident a payment_reminder with the invoice number, the amount and the due date (apps/api/src/services/invoice.service.ts:82-210). The route writes an audit log entry with the action create (apps/api/src/routes/invoices.ts:517-528). A failed push is logged and never undoes the invoice.',
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
      runbook3am: 'open /invoices?status=sent, open the invoice and read the payment rows under it',
    },
    {
      action: 'Issue the month invoices to every active resident',
      operatorBelieves: 'every active resident has one bill for the month',
      serverCommits:
        'POST /invoices/generate-bulk calls generateMonthlyInvoices, which walks the active tenants, skips every tenant that already has an invoice for that month, and issues the rest exactly as a single invoice: status=sent, a pending payment row for the full amount and a payment_reminder to the resident (apps/api/src/services/invoice.service.ts:47-77). The route writes an audit log entry with the action create and the resource id bulk:<month> (apps/api/src/routes/invoices.ts:413-423). The pre-flight count comes from GET /invoices/preview-bulk (apps/api/src/routes/invoices.ts:313-346).',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: true,
      },
      mismatchSurfacedAt:
        'the bulk preview before the write names how many residents are eligible, and every issued bill shows up in the list with its sent badge',
      provenance: {
        auditAction: 'create',
        screen: '/invoices',
        actor: 'admin',
      },
      stuckStateMeans:
        'a resident was skipped because a bill for that month already existed, so the month is not billed for them twice but the office has to look at the old one',
      runbook3am:
        'open /invoices, filter by the month, and compare the residents in the preview with the bills in the list',
    },
    {
      action: 'Record a payment against the invoice',
      operatorBelieves: 'the cash is on the bill and the resident knows it',
      serverCommits:
        'POST /payments/offline refuses an amount above the balance the server computed (AMOUNT_EXCEEDS_BALANCE, apps/api/src/routes/payments.ts:512-530) and refuses an invoice that is not collectible (INVOICE_NOT_PAYABLE, apps/api/src/routes/payments.ts:491-502). It stamps the office obligation row paid with the collecting admin as the verifier, or creates a paid row of its own, leaves a pending residual when the bill is not settled, re-syncs the invoice status, writes an audit entry with source=offline and pushes a payment_verified to the resident (apps/api/src/routes/payments.ts:562-693). The admin screen opens the server receipt of that payment (apps/web/src/components/admin/RecordPaymentModal.tsx:158-191).',
      notification: {
        to: 'tenant',
        type: 'payment_verified',
        required: true,
      },
      mismatchSurfacedAt:
        'the receipt modal on /invoices/[id] and the balance and status the invoice detail re-reads from the server',
      provenance: {
        auditAction: 'payment_verify',
        screen: '/invoices/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the money is recorded but the resident was not told: the notification failed and was logged, and the resident still sees the bill as due',
      runbook3am:
        'open the payment the form sent, check the invoice balance on /invoices/[id] and, if the resident has no notification, tell them the money was received',
    },
    {
      action: 'Edit the amounts of an invoice',
      operatorBelieves: 'the corrected amount is what the resident owes now',
      serverCommits:
        'PUT /invoices/:id refuses a paid invoice (INVOICE_LOCKED, apps/api/src/routes/invoices.ts:705-707), rewrites the amounts, rebuilds the line items, re-saves the invoice, re-syncs only the office own pending payment row to the new residual, leaves a resident pending_verification row alone, recomputes the status from the money and writes an audit log entry with the fields that moved and the status the server committed (apps/api/src/routes/invoices.ts:690-936). When the amount actually moved it pushes a payment_reminder to the resident with the old and the new number in the body (apps/api/src/routes/invoices.ts:899-910); an edit that moved nothing but the due date or the wording sends no notification. A failed push never undoes the edit.',
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
        'open /invoices/[id], read the update entry in the activity trail, and if the resident has no notification, tell them the new amount',
    },
    {
      action: 'Cancel an invoice',
      operatorBelieves: 'the bill is void and the resident knows it',
      serverCommits:
        'PUT /invoices/:id with status=cancelled refuses a bill that still carries a balance (INVOICE_HAS_BALANCE, apps/api/src/routes/invoices.ts:727-747), writes the cancelled status, recomputes the money status around it, writes an audit log entry and pushes a payment_reminder to the resident that names the cancelled invoice and says that any amount already paid stays on record (apps/api/src/routes/invoices.ts:886-895). A failed push never undoes the cancel.',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: true,
      },
      mismatchSurfacedAt:
        'the status and the balance the invoice detail re-reads, and the notification in the resident portal',
      provenance: {
        auditAction: 'update',
        screen: '/invoices/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bill reads cancelled but the resident was not told, so they still believe they owe it',
      runbook3am:
        'open /invoices/[id], read the update entry in the activity trail, and if the resident has no notification, tell them the bill was voided',
    },
    {
      action: 'Send a draft or reopen a cancelled invoice',
      operatorBelieves: 'the bill is on its way to the resident',
      serverCommits:
        'PUT /invoices/:id with status=sent writes the status and nothing else: no notification goes to the resident and no payment row is opened (apps/api/src/routes/invoices.ts:774-936). The screen says so before the write (apps/web/src/app/(admin)/invoices/[id]/edit/page.tsx).',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: false,
      },
      mismatchSurfacedAt: 'the admin audit timeline on /invoices/[id]; the resident sees nothing',
      provenance: {
        auditAction: 'update',
        screen: '/invoices/[id]',
        actor: 'admin',
      },
      stuckStateMeans: 'the bill reads sent and the resident has never heard of it',
      runbook3am:
        'open /invoices/[id], read the update entry in the activity trail, and tell the resident by hand',
    },
    {
      action: 'Delete an invoice',
      operatorBelieves: 'the wrong bill record is gone',
      serverCommits:
        'DELETE /invoices/:id refuses a paid invoice (INVOICE_PAID, apps/api/src/routes/invoices.ts:1011-1019), refuses an invoice with paid payments (INVOICE_HAS_PAID_PAYMENTS, apps/api/src/routes/invoices.ts:1022-1036) and refuses an invoice with any payment record at all, because a payment row is the evidence that money moved (INVOICE_HAS_PAYMENTS, apps/api/src/routes/invoices.ts:1043-1066). It removes the record, writes an audit log entry and sends the resident nothing (apps/api/src/routes/invoices.ts:1068-1084).',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: false,
      },
      mismatchSurfacedAt:
        'the audit trail of the deleted invoice and the bill disappearing from the ledger; the resident is told by nobody',
      provenance: {
        auditAction: 'delete',
        screen: '/invoices',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bill is gone and the resident still believes it exists, with no notification to correct it',
      runbook3am:
        'open /audit-logs, filter by resource=invoice, and read the delete entry of the record',
    },
    {
      action: 'Let the daily sweep mark a bill overdue',
      operatorBelieves: 'a resident who is late was chased',
      serverCommits:
        'the daily sweep at 08:00 moves every sent invoice whose due date has passed to overdue, moves the pending payment rows with it, and pushes a payment_reminder to every tenant whose invoice it moved (apps/api/src/jobs/scheduler.ts:91-124). The cron secret route POST /jobs/overdue-check performs the same bulk write without any notice, so a bill marked through it stays silent for the resident (apps/api/src/routes/jobs.ts:52-90). The reminder cron chases the pending and overdue rows on the 5th, the 10th and the 15th (apps/api/src/jobs/scheduler.ts:143-189).',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: true,
      },
      mismatchSurfacedAt:
        'the overdue badge and the aging report on /invoices, and the notification in the resident portal',
      provenance: {
        auditAction: 'update',
        screen: '/invoices',
        actor: 'system',
      },
      stuckStateMeans:
        'the bill reads overdue but the resident was never told, which happens when the sweep ran through the cron secret route',
      runbook3am:
        'open /invoices?status=overdue and compare the bills with the notifications the resident received',
    },
  ],
  layout: {
    archetype: 'ledger',
    grammarTokens: [
      'DataTable',
      'StatusTabs',
      'FilterChips',
      'PageBand',
      'AgingBars',
      'StatusBadge',
      'StatusStepper',
      'DetailCard',
      'ContentFrame',
      'Timeline',
      'StatCard',
      'EmptyState',
      'PageHeader',
    ],
    mustNotLookLike:
      'a payment queue: an invoice row is a month of dues owed, not money received, and the outstanding total has to sit on the band',
    ownNumber:
      'the INR outstanding across every open invoice, split by how many days past its due date it is: the aging report is the only read in the product that says how old the debt is',
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
      overdue: {
        label: 'Open the whole ledger',
        target: '/invoices',
      },
    },
  },
};
