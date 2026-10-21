import type { ModuleContract } from './module';

/**
 * The payments contract.
 *
 * Money is the module with the most expensive gap between what the operator believes and what
 * the server commits, so it is the first module to carry a contract. Every anchor below was
 * read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/payment.ts:51
 * - routes: apps/api/src/routes/payments.ts
 * - the scheduler that writes overdue: apps/api/src/jobs/scheduler.ts:93-114
 * - the admin screens: apps/web/src/app/(admin)/payments
 *
 * The known gap of this contract (the verify action owes the resident a notification and the
 * handler never sends one) is tracked in packages/types/src/contracts/baseline.ts.
 */
export const PAYMENTS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'reconciling what residents say they paid against what the ledger says is due, and deciding which payments are genuinely settled',
    doneLooksLike:
      'every payment that carries money is either stamped paid with a verifiedBy, or explicitly voided, and the invoice balance agrees with the payment ledger',
    primaryAction: 'Verify or void a payment',
  },
  stateMachine: {
    domain: 'payments',
    // The route file is payments.ts, the model is payment.ts.
    model: 'payment',
    kind: 'ladder',
    statuses: [
      {
        // The open obligation. A monthly invoice opens one of these
        // (apps/api/src/services/invoice.service.ts:164-170), and an offline payment leaves the
        // remainder open (apps/api/src/routes/payments.ts:457-497).
        status: 'pending',
        enteredBy: {
          method: 'POST',
          path: '/payments/offline',
          condition:
            'an offline payment is recorded and the invoice still has a remaining balance, so an open pending row is left behind',
        },
        // Due on the 5th of the billing month (apps/api/src/routes/payments.ts:25-28), so an open
        // obligation is expected to settle within five days of the month opening.
        dwell: 5,
        dwellUnit: 'days',
      },
      {
        // The resident claims to have paid. The row waits for an admin to check the UTR.
        status: 'pending_verification',
        enteredBy: {
          method: 'POST',
          path: '/payments/submit-utr',
          condition: 'the resident submits a UTR for an invoice that still has an open balance',
        },
      },
      {
        // The money is settled and verified by a human.
        status: 'paid',
        enteredBy: {
          method: 'POST',
          path: '/payments/:id/verify',
          condition: 'an admin approves the payment, which stamps paidAt and verifiedBy',
        },
      },
      {
        // The due date passed. The scheduler writes this, and the admin can write it by hand.
        status: 'overdue',
        enteredBy: {
          method: 'PUT',
          path: '/payments/:id',
          condition:
            'the admin sets the status to overdue by hand; the daily scheduler at 08:00 writes the same status for any pending row past its due date',
        },
      },
      {
        // The money was returned to the resident, or the obligation was written off.
        status: 'cancelled',
        enteredBy: {
          method: 'POST',
          path: '/payments/:id/void',
          condition: 'an admin voids a paid payment, which cancels the row and reopens the invoice',
        },
      },
    ],
    terminal: 'paid',
    deadEnd: 'cancelled',
  },
  truthContract: [
    {
      action: 'Verify a payment',
      operatorBelieves: 'the payment is verified and the invoice is settled',
      serverCommits:
        'POST /payments/:id/verify sets status=paid, stamps paidAt with the server clock and verifiedBy with the admin id, calls updateInvoicePaymentStatus so the invoice follows the payment, and writes an audit log entry with the action payment_verify. It writes no notification, so the resident is told nothing.',
      notification: {
        to: 'tenant',
        type: 'payment_verified',
        required: true,
      },
      mismatchSurfacedAt:
        'nowhere for the resident: the admin audit timeline on /payments/[id] shows the payment_verify entry, but the resident only learns of it on the next portal load',
      provenance: {
        auditAction: 'payment_verify',
        screen: '/payments/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the payment stays pending_verification and the invoice stays unpaid until an admin opens the record and approves it',
      runbook3am:
        'GET /payments/pending-verification, open the payment, approve it, then confirm on /invoices/[id] that the invoice reads paid',
    },
    {
      action: 'Void a paid payment',
      operatorBelieves: 'the payment is voided and the resident owes the money again',
      serverCommits:
        'POST /payments/:id/void sets status=cancelled, appends the void note, calls updateInvoicePaymentStatus so the invoice reopens, and writes an audit log entry. It writes no notification.',
      mismatchSurfacedAt:
        'the admin audit timeline on /payments/[id]; the resident sees the invoice open again only on the next portal load',
      provenance: {
        auditAction: 'update',
        screen: '/payments/[id]',
        actor: 'admin',
      },
      stuckStateMeans: 'the invoice still reads paid while the payment row reads cancelled',
      runbook3am:
        'open /payments/[id], read the void note in the audit timeline, then compare /invoices/[id] with the payment ledger',
    },
  ],
  layout: {
    archetype: 'ledger',
    grammarTokens: [
      'DataTable',
      'StatusTabs',
      'FilterChips',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
    ],
    mustNotLookLike:
      'a roster of people or a kanban board: the payments root is a chronological ledger of money, and a person-first table hides the amount',
    ownNumber: 'INR collected but still unverified',
  },
  nextBestAction: {
    perStatus: {
      pending: {
        label: 'Collect the balance',
        target: '/payments/new',
        enabledWhen: 'the invoice still carries an unpaid balance',
      },
      pending_verification: {
        label: 'Verify the UTR',
        target: '/payments/[id]',
        enabledWhen: 'a UTR has been submitted against this payment',
      },
      paid: {
        label: 'Open the receipt',
        target: '/payments/[id]',
      },
      overdue: {
        label: 'Record the payment',
        target: '/payments/new',
        enabledWhen: 'the resident has paid but the payment is not recorded yet',
      },
      cancelled: {
        label: 'Read the void note',
        target: '/payments/[id]',
      },
    },
    perEmptyState: {
      payments: {
        label: 'Record a payment',
        target: '/payments/new',
      },
      pending_verification: {
        label: 'Open the verification queue',
        target: '/payments?status=pending_verification',
      },
    },
  },
};
