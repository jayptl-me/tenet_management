import type { ModuleContract } from './module';

/**
 * The payments contract.
 *
 * Money is the module with the most expensive gap between what the operator believes and what
 * the server commits, so it is the first module to carry a contract. Every anchor below was
 * read out of source on 2026-10-21 and again after the depth rebuild of the four admin
 * screens (2026-10-21, wave 6):
 *
 * - statuses: apps/api/src/models/payment.ts:56-59
 * - routes: apps/api/src/routes/payments.ts
 * - the scheduler that writes overdue and tells the tenants:
 *   apps/api/src/jobs/scheduler.ts:91-119, :143-189
 * - the generator that opens the obligation row:
 *   apps/api/src/services/invoice.service.ts:152-174
 * - the admin screens: apps/web/src/app/(admin)/payments
 *
 * The contract describes the code as it is, including the places where a person is still not
 * told: a payment edit reaches the admin only, and the admin form does not carry an
 * idempotency key, so the guard against a double record is the in-flight lock of the form.
 *
 * The known gap of this contract (the verify action owes the resident a notification and the
 * handler never sent one) was closed in wave 2: the verify handler now pushes to the resident
 * itself, and the checker proved it, so the baseline entry was deleted instead of being left to
 * rot (packages/types/src/contracts/baseline.ts).
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
        // (apps/api/src/services/invoice.service.ts:165-174), an offline
        // collection that does not settle the invoice leaves the remainder open
        // (apps/api/src/routes/payments.ts:627-638), and a refused verification
        // sends the row back to it with its UTR cleared
        // (apps/api/src/routes/payments.ts:1274-1277).
        status: 'pending',
        enteredBy: {
          method: 'POST',
          path: '/payments/offline',
          condition:
            'an offline payment is recorded and the invoice still has a remaining balance, so an open pending row is left behind (apps/api/src/routes/payments.ts:627-638). The same status is written by the invoice generator that opens the month obligation (POST /invoices/generate-single, apps/api/src/services/invoice.service.ts:165-174), by a refused verification (POST /payments/:id/verify with approved=false, apps/api/src/routes/payments.ts:1274-1277) and by the admin through PUT /payments/:id',
        },
        // Due on the 5th of the billing month (apps/api/src/routes/payments.ts:29-32), so an open
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
          condition:
            'the resident submits a UTR for an invoice that still has an open balance: the open row is stamped pending_verification with the UTR and the screenshot, or a new row is created with that status (apps/api/src/routes/payments.ts:873-921)',
        },
        // No dwell is declared: the code has no clock for this state. The daily overdue sweep
        // only touches pending rows (apps/api/src/jobs/scheduler.ts:104) and the reminder cron
        // only chases pending and overdue ones (apps/api/src/jobs/scheduler.ts:148-152), so a
        // submitted UTR waits for a human until somebody opens the record.
      },
      {
        // The money is settled and verified by a human.
        status: 'paid',
        enteredBy: {
          method: 'POST',
          path: '/payments/:id/verify',
          condition:
            'an admin approves the payment, which stamps paid with the server clock and verifiedBy with the admin id (apps/api/src/routes/payments.ts:1269-1273). POST /payments/offline writes the same status on the row that carries the collected cash, with the collecting admin as the verifier (apps/api/src/routes/payments.ts:564-576)',
        },
      },
      {
        // The due date passed. The scheduler writes this, and the admin can write it by hand.
        status: 'overdue',
        enteredBy: {
          method: 'PUT',
          path: '/payments/:id',
          condition:
            'the admin sets the status to overdue by hand; the daily sweep at 08:00 writes the same status for every pending row past its due date (apps/api/src/jobs/scheduler.ts:91-119). No dwell is declared: the sweep never moves the row on its own, it only chases it again on the 5th, 10th and 15th (apps/api/src/jobs/scheduler.ts:143-189)',
        },
      },
      {
        // The money was returned to the resident, or the obligation was written off.
        status: 'cancelled',
        enteredBy: {
          method: 'POST',
          path: '/payments/:id/void',
          condition:
            'an admin voids a paid payment, which cancels the row, appends the void note and reopens the invoice (apps/api/src/routes/payments.ts:1332-1392). An offline collection also cancels the office rows it replaces, and the admin can set the status through PUT /payments/:id',
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
        'POST /payments/:id/verify sets status=paid, stamps paidAt with the server clock and verifiedBy with the admin id, calls updateInvoicePaymentStatus so the invoice follows the payment, writes an audit log entry with the action payment_verify, and notifies the resident: a payment_verified when the admin approved it, a payment_reminder saying it was not verified when the admin rejected it (apps/api/src/routes/payments.ts:1239-1328). A failed notification is logged and never undoes the write.',
      notification: {
        to: 'tenant',
        type: 'payment_verified',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides now see it: the admin audit timeline on /payments/[id] shows the payment_verify entry, and the resident gets the notification in the portal',
      provenance: {
        auditAction: 'payment_verify',
        screen: '/payments/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the payment stays pending_verification and the invoice stays unpaid until an admin opens the record and approves it',
      runbook3am:
        'open /payments and filter by status=pending_verification, approve the record, then confirm on /invoices/[id] that the invoice reads paid',
    },
    {
      action: 'Reject a payment',
      operatorBelieves: 'the UTR was refused and the resident has to send the money again',
      serverCommits:
        'POST /payments/:id/verify with approved=false sets status back to pending, unsets utrNumber and screenshotUrl, appends the admin note to the payment notes, re-syncs the invoice, writes an audit entry with approved=false and pushes a payment_reminder to the resident that names the reason (apps/api/src/routes/payments.ts:1274-1277, :1290-1301, :1314-1324). The row therefore looks exactly like a payment that was never submitted: the only proof is the audit timeline and the note the server appended to the payment.',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: true,
      },
      mismatchSurfacedAt:
        'the payment progress card on /payments/[id] names the refused verification, its date and its reason, and the resident gets the reminder in the portal',
      provenance: {
        auditAction: 'payment_verify',
        screen: '/payments/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the row waits in the pending queue with no UTR and no screenshot, so it is indistinguishable from a payment nobody submitted: read the audit timeline of the record, not its badges',
      runbook3am:
        'open /payments?status=pending, open a row without a UTR and read the last payment_verify entry of its audit timeline: approved=false means it was refused',
    },
    {
      action: 'Void a paid payment',
      operatorBelieves: 'the payment is voided and the resident owes the money again',
      serverCommits:
        'POST /payments/:id/void sets status=cancelled, appends the void note, calls updateInvoicePaymentStatus so the invoice reopens, writes an audit log entry, and notifies the resident with a payment_reminder saying the amount is due again, with the void note in the body (apps/api/src/routes/payments.ts:1332-1392, :1380-1388).',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: true,
      },
      mismatchSurfacedAt:
        'the admin audit timeline on /payments/[id], and the resident gets the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/payments/[id]',
        actor: 'admin',
      },
      stuckStateMeans: 'the invoice still reads paid while the payment row reads cancelled',
      runbook3am:
        'open /payments/[id], read the void note in the audit timeline, then compare /invoices/[id] with the payment ledger',
    },
    {
      action: 'Record an offline payment',
      operatorBelieves: 'the cash is on the invoice and the resident has been told',
      serverCommits:
        'POST /payments/offline refuses an amount above the balance the server computed (AMOUNT_EXCEEDS_BALANCE, apps/api/src/routes/payments.ts:518-524), stamps the office obligation row paid with the collecting admin as the verifier, or creates a paid row of its own when the only open row is the resident declared transfer (apps/api/src/routes/payments.ts:562-616), leaves a pending residual row when the invoice is not settled (apps/api/src/routes/payments.ts:627-638), re-syncs the invoice, writes an audit entry with source=offline and pushes a payment_verified to the resident (apps/api/src/routes/payments.ts:672-693). The write is idempotent when it carries an Idempotency-Key (header or body field): the key is looked up before anything is written, so a replay returns the payment the first request recorded (apps/api/src/routes/payments.ts:446-471). The admin form does not send a key, so its only guard against a double record is the in-flight lock of the form.',
      notification: {
        to: 'tenant',
        type: 'payment_verified',
        required: true,
      },
      mismatchSurfacedAt:
        'the payment detail of the created record, the invoice balance on /invoices/[id] and the audit timeline of the payment',
      provenance: {
        auditAction: 'payment_verify',
        screen: '/payments/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the money is recorded but the resident was not told: the notification failed and was logged, and the resident still sees the invoice as due',
      runbook3am:
        'open the payment the form sent, check the invoice balance on /invoices/[id] and, if the resident has no notification, tell them the money was received',
    },
    {
      action: 'Edit a payment',
      operatorBelieves: 'the corrected amount is what the resident owes now',
      serverCommits:
        'PUT /payments/:id refuses a paid row with PAYMENT_LOCKED (apps/api/src/routes/payments.ts:1196-1208), writes the changed fields, re-syncs the invoice status, and writes an audit log entry with the fields that moved (apps/api/src/routes/payments.ts:1210-1236). It sends no notification: the resident is not told that the amount, the method, the category, the status or the notes of a recorded payment changed.',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: false,
      },
      mismatchSurfacedAt:
        'the admin audit timeline on /payments/[id] and the changed values on the record; the resident sees nothing',
      provenance: {
        auditAction: 'update',
        screen: '/payments/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the admin and the resident disagree about the same payment without anybody being told: the resident still holds the old amount',
      runbook3am:
        'open /payments/[id], read the update entry in the audit timeline and tell the resident the new amount by hand',
    },
    {
      action: 'Delete an unverified payment',
      operatorBelieves: 'the wrong payment record is gone',
      serverCommits:
        'DELETE /payments/:id refuses a paid row with PAYMENT_VERIFIED (apps/api/src/routes/payments.ts:1402-1414), removes the row, re-syncs the invoice, writes an audit log entry and pushes a payment_reminder to the resident that the record was removed (apps/api/src/routes/payments.ts:1419-1447).',
      notification: {
        to: 'tenant',
        type: 'payment_reminder',
        required: true,
      },
      mismatchSurfacedAt:
        'the audit timeline of the deleted payment and the notification in the resident portal',
      provenance: {
        auditAction: 'delete',
        screen: '/payments',
        actor: 'admin',
      },
      stuckStateMeans:
        'the row is gone and the invoice was re-synced, so the ledger no longer shows what the office believed was collected',
      runbook3am:
        'open /payments?status=pending and compare the invoice balance on /invoices/[id] with the ledger',
    },
  ],
  layout: {
    archetype: 'ledger',
    grammarTokens: [
      'DataTable',
      'StatusTabs',
      'FilterChips',
      'PageBand',
      'StatusBadge',
      'StatusStepper',
      'DetailCard',
      'EmptyState',
      'PageHeader',
    ],
    mustNotLookLike:
      'a roster of people or a kanban board: the payments root is a chronological ledger of money, and a person-first table hides the amount',
    ownNumber:
      'the INR collected this month against the INR expected, with the count of the rows in view that still wait for a verification',
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
