import type { ModuleContract } from './module';

/**
 * The electricity contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the
 * depth rebuild of the four admin screens (wave 6):
 *
 * - the model and its enum: apps/api/src/models/electricityBill.ts:110-114
 * - the pre-save that derives the units, the room amounts and the variance:
 *   apps/api/src/models/electricityBill.ts:138-148
 * - the routes: apps/api/src/routes/electricity.ts
 * - the create and the reconcile gate: apps/api/src/routes/electricity.ts:491-560
 * - the update and the lock: apps/api/src/routes/electricity.ts:564-641
 * - the finalize: apps/api/src/routes/electricity.ts:644-689
 * - the distribute: apps/api/src/routes/electricity.ts:694-937
 * - the share the server computes for one resident:
 *   apps/api/src/services/invoice.service.ts:215-256
 * - the invoice the share lands on: apps/api/src/services/invoice.service.ts:82-210
 * - the invoice cron of the 1st: apps/api/src/jobs/scheduler.ts:129-140
 * - the admin screens: apps/web/src/app/(admin)/electricity
 *
 * One bill per month. The bill is entered from the utility invoice, the readings are split per
 * room, and the share of every room is pushed onto the resident invoice of that same month. The
 * bill's money and the invoice's money are the same money: the share the bill produced is the
 * electricity amount on the invoice, and the page shows the server's number on both sides.
 *
 * The contract describes the code as it is, including the places where a person is still not
 * told: the office is told nothing when the readings are entered or the bill is finalized, the
 * bill image is not a resident's business, and a resident whose invoice the server skipped while
 * distributing is neither charged nor notified.
 */
export const ELECTRICITY_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'turning the utility bill into the right share for every room and every resident, and checking that the readings add up to the utility total before the month is charged',
    doneLooksLike:
      'every month has one bill, the readings add up to the utility total or the gap is explained in writing, the bill is distributed, and every resident invoice carries the electricity share that belongs to its resident',
    primaryAction: 'Finalize and distribute the month bill',
  },
  stateMachine: {
    domain: 'electricity',
    model: 'electricityBill',
    kind: 'ladder',
    statuses: [
      {
        // The readings are entered, the bill is still editable.
        status: 'draft',
        enteredBy: {
          method: 'POST',
          path: '/electricity',
          condition:
            'the operator creates the month bill with the meter readings; the route writes status=draft itself (apps/api/src/routes/electricity.ts:512). The model default is the same (apps/api/src/models/electricityBill.ts:110-114). A draft is the only status the bill can be edited in: PUT /electricity/:id refuses a finalized or a distributed bill with BILL_LOCKED (apps/api/src/routes/electricity.ts:572-574)',
        },
        // The clock is the billing month. The invoice of that month is issued by the cron on the
        // 1st (apps/api/src/jobs/scheduler.ts:131-140) and is due on the 5th
        // (apps/api/src/services/invoice.service.ts:139-150), while the utility bill of the month
        // usually reaches the office after the month has closed. The share lands on the invoice of
        // its own month (apps/api/src/routes/electricity.ts:763-868), so a bill that is
        // distributed late reaches a resident whose invoice for that month is already due.
        dwell: 30,
        dwellUnit: 'days',
      },
      {
        // The readings are locked.
        status: 'finalized',
        enteredBy: {
          method: 'POST',
          path: '/electricity/:id/finalize',
          condition:
            'an admin finalizes a draft bill; the status guard lives in the update filter, so two concurrent finalize calls cannot both win (apps/api/src/routes/electricity.ts:658-669). The handler writes an update audit log entry with the bill total, the computed room total and the variance, and it sends no notification: nothing is owed to a resident before the share is on their invoice',
        },
        // The same billing month clock, counted from the finalize. A bill that stays finalized
        // past its month is paid by the PG and not recovered from the residents.
        dwell: 30,
        dwellUnit: 'days',
      },
      {
        // The shares are on the resident invoices.
        status: 'distributed',
        enteredBy: {
          method: 'POST',
          path: '/electricity/:id/distribute',
          condition:
            'an admin distributes a finalized bill; the handler claims the flip to distributed upfront, so a second concurrent distribute cannot double-charge the invoices (apps/api/src/routes/electricity.ts:709-715). It splits every room entry between the residents who were in that room during the billing month, writes the electricity amount and the line item onto the resident invoice of that month, opens the invoice when there is none, re-syncs the pending payment to the new residual and pushes an electricity_bill notification to every resident it charged (apps/api/src/routes/electricity.ts:724-894). If any tenant path errors the bill is rolled back to finalized so the run can be retried (apps/api/src/routes/electricity.ts:896-899)',
        },
      },
    ],
    terminal: 'distributed',
    // Nothing is a dead letter box: a failed distribution rolls the bill back to finalized
    // (apps/api/src/routes/electricity.ts:896-899), and a draft can be edited or deleted.
  },
  truthContract: [
    {
      action: 'Enter the month bill and its readings',
      operatorBelieves:
        'the readings on the utility bill are on the bill, and the month is now on record',
      serverCommits:
        'POST /electricity refuses a reading that is lower than the previous one (apps/api/src/routes/electricity.ts:494-498), refuses a bill whose room amounts and total are more than 10,000 apart (apps/api/src/routes/electricity.ts:68-85, :501), refuses a second bill for a month that already has one (DUPLICATE_BILL, :547-558) and writes the bill with status=draft, a create audit log entry and the month (apps/api/src/routes/electricity.ts:503-546). The model derives the units, the room amount, the computed room total and the variance from the readings when it saves (apps/api/src/models/electricityBill.ts:138-148). It sends no notification: a draft is on no invoice.',
      notification: {
        to: 'tenant',
        type: 'electricity_bill',
        required: false,
      },
      mismatchSurfacedAt:
        'the bill detail shows the variance the server computed between the utility total and the sum of the room readings, and the readings it holds',
      provenance: {
        auditAction: 'create',
        screen: '/electricity/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the readings are in but the variance was never explained, so the bill cannot be finalized with confidence and the month is not charged',
      runbook3am:
        'open /electricity?status=draft, open the bill and read the difference between the utility total and the readings at the tariff',
    },
    {
      action: 'Edit the readings of a draft bill',
      operatorBelieves: 'the corrected readings are the readings the residents will be charged on',
      serverCommits:
        'PUT /electricity/:id refuses a finalized or a distributed bill with BILL_LOCKED (apps/api/src/routes/electricity.ts:572-574), re-checks the readings and the reconcile gate on the entries that arrive (apps/api/src/routes/electricity.ts:582-613), saves the document so the model recomputes the units, the room amounts and the variance (apps/api/src/models/electricityBill.ts:138-148) and writes an update audit log entry (apps/api/src/routes/electricity.ts:616-630). It sends no notification.',
      notification: {
        to: 'tenant',
        type: 'electricity_bill',
        required: false,
      },
      mismatchSurfacedAt:
        'the bill detail shows the server recomputed room amounts and the new variance, and the edit page shows the difference between the readings and the utility total while it is being typed',
      provenance: {
        auditAction: 'update',
        screen: '/electricity/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the readings were corrected in the office and the bill still carries the old ones, which happens when the edit was refused by BILL_LOCKED and the office did not read the refusal',
      runbook3am:
        'open /electricity/[id], read the update entry in the activity of the bill and compare the room amounts with the readings on the utility invoice',
    },
    {
      action: 'Finalize the bill',
      operatorBelieves: 'the numbers are locked and the month can be charged',
      serverCommits:
        'POST /electricity/:id/finalize refuses a bill that is not draft (INVALID_BILL_STATUS, apps/api/src/routes/electricity.ts:651-654), flips the status with an atomic claim (apps/api/src/routes/electricity.ts:658-669) and writes an update audit log entry with the bill total, the computed room total and the variance (apps/api/src/routes/electricity.ts:672-684). It checks nothing about the variance: the server does not refuse a bill whose readings do not add up. The admin screen refuses it and says so, because the office has to write down the reason for the gap first (apps/web/src/app/(admin)/electricity/[id]/page.tsx). It sends no notification: nothing is owed to a resident before the share is on their invoice.',
      notification: {
        to: 'tenant',
        type: 'electricity_bill',
        required: false,
      },
      mismatchSurfacedAt:
        'the electricity list shows the finalized badge and the bill detail names the state and what it means',
      provenance: {
        auditAction: 'update',
        screen: '/electricity/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bill is finalized and never distributed, so the month is paid by the PG and not recovered from the residents',
      runbook3am: 'open /electricity?status=finalized and distribute the oldest one',
    },
    {
      action: 'Distribute the shares',
      operatorBelieves: 'every resident has been charged their share and knows about it',
      serverCommits:
        'POST /electricity/:id/distribute refuses a bill that is not finalized (BILL_NOT_FINALIZED, apps/api/src/routes/electricity.ts:702-704), claims the flip to distributed upfront (apps/api/src/routes/electricity.ts:709-715) and then, for every room entry, splits the room amount between the residents who were in that room during the billing month (apps/api/src/routes/electricity.ts:744-756). It writes the share onto the resident invoice of that month: the electricity amount and the line item on an invoice that exists, or a new invoice issued by generateSingleInvoice, which computes the same share from the same rule (apps/api/src/services/invoice.service.ts:215-256, :82-210). It re-syncs the open pending payment to the new residual, opens one when the invoice grew, refreshes the invoice status from the money and pushes an electricity_bill notification with the share to every resident it charged (apps/api/src/routes/electricity.ts:801-883). Two residents are skipped without an error and without a charge: a cancelled invoice and an invoice that is already paid and already carries electricity (apps/api/src/routes/electricity.ts:774-787). The response reports the counts, and the bill is rolled back to finalized when any tenant path errors (apps/api/src/routes/electricity.ts:896-936).',
      notification: {
        to: 'tenant',
        type: 'electricity_bill',
        required: true,
      },
      mismatchSurfacedAt:
        'the bill detail shows the shares the server wrote, one per resident, each with the invoice it became, and it names the invoices that carry no share because the server skipped them',
      provenance: {
        auditAction: 'update',
        screen: '/electricity/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bill is finalized but the shares never reached the invoices, so the residents were never charged for the month',
      runbook3am:
        'open /electricity?status=finalized, distribute the bill again and read the error count in the response',
    },
    {
      action: 'Upload the utility bill as proof',
      operatorBelieves: 'the office keeps the proof of what it billed',
      serverCommits:
        'POST /electricity/:id/image stores the file on Cloudinary, replaces the previous asset and writes the url onto the bill, with an update audit log entry (apps/api/src/routes/electricity.ts:940-1051). The route refuses the write when Cloudinary is not configured (ServiceUnavailableError, apps/api/src/routes/electricity.ts:944-950). It sends no notification: the proof is the office business, not the resident business.',
      notification: {
        to: 'tenant',
        type: 'electricity_bill',
        required: false,
      },
      mismatchSurfacedAt:
        'the bill detail shows the image the server stored, and the office actions say whether the image can still be replaced',
      provenance: {
        auditAction: 'update',
        screen: '/electricity/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bill was entered without the utility invoice as proof, so the office cannot show what it billed from',
      runbook3am: 'open /electricity/[id] and check whether the bill image is on the record',
    },
    {
      action: 'Delete the month bill',
      operatorBelieves: 'the wrong bill record is gone',
      serverCommits:
        'DELETE /electricity/:id refuses a distributed bill (BILL_ALREADY_DISTRIBUTED, apps/api/src/routes/electricity.ts:1089-1091), removes the record, deletes the image from Cloudinary and writes a delete audit log entry (apps/api/src/routes/electricity.ts:1093-1113). It sends no notification.',
      notification: {
        to: 'tenant',
        type: 'electricity_bill',
        required: false,
      },
      mismatchSurfacedAt:
        'the bill disappears from the ledger and the audit trail of the resource keeps the delete entry',
      provenance: {
        auditAction: 'delete',
        screen: '/electricity',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bill was deleted after it had been finalized but before it was distributed, so the month is neither charged to the residents nor to the PG',
      runbook3am:
        'open /audit-logs, filter on the delete entry of the bill, and enter the month again',
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
      'DetailCard',
      'ContentFrame',
      'EmptyState',
      'PageHeader',
      'DatePicker',
      'ResourceSelect',
      'FormCard',
      'FormSection',
      'FormActions',
    ],
    mustNotLookLike:
      'a resident invoice ledger: an electricity row is one month of the whole building, and the number that decides it is whether the readings add up to the utility total',
    ownNumber:
      'the difference between the utility total and the sum of the room readings at the tariff, the variance the server writes when it saves the bill. It is the number that decides whether a bill can be finalized, and no other module can compute it',
  },
  nextBestAction: {
    perStatus: {
      draft: {
        label: 'Finalize the bill',
        target: '/electricity/[id]',
        enabledWhen:
          'the readings add up to the utility total, or the office has written down the reason for the gap',
      },
      finalized: {
        label: 'Distribute the shares',
        target: '/electricity/[id]',
      },
      distributed: {
        label: 'Open the invoices it produced',
        target: '/invoices',
      },
    },
    perEmptyState: {
      electricity: {
        label: 'Enter the month bill',
        target: '/electricity/new',
      },
      draft: {
        label: 'Open the unfinished bills',
        target: '/electricity?status=draft',
      },
      distributed: {
        label: 'Open the distributed bills',
        target: '/electricity?status=distributed',
      },
      filtered: {
        label: 'Open the whole ledger',
        target: '/electricity',
      },
    },
  },
};
