import type { ModuleContract } from './module';

/**
 * The electricity contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/electricityBill.ts:112
 * - routes: apps/api/src/routes/electricity.ts
 * - the finalize and the distribute: apps/api/src/routes/electricity.ts:643-937
 * - the invoice cron that runs on the 1st: apps/api/src/jobs/scheduler.ts:136-145
 * - the admin screens: apps/web/src/app/(admin)/electricity
 *
 * One bill per month. The bill is entered from the utility invoice, the
 * readings are split per room, and the share of every room is pushed onto the
 * resident invoice.
 */
export const ELECTRICITY_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'turning the utility bill into the right share for every room, and getting that share onto the resident invoice',
    doneLooksLike:
      'every month has one bill, it is distributed, and every resident invoice carries the electricity share that belongs to them',
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
            'the operator creates the month bill with the meter readings; the record lands with the model default draft (apps/api/src/models/electricityBill.ts:112). A draft is the only status the bill can be edited in (apps/api/src/routes/electricity.ts:572-574)',
        },
        // The bill covers one billing month and has to be distributed before the
        // 1st, when the invoice cron runs (apps/api/src/jobs/scheduler.ts:136-145).
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
            'an admin finalizes a draft bill; the status guard lives in the update filter so two concurrent finalize calls cannot both win (apps/api/src/routes/electricity.ts:643-689)',
        },
      },
      {
        // The shares are on the resident invoices.
        status: 'distributed',
        enteredBy: {
          method: 'POST',
          path: '/electricity/:id/distribute',
          condition:
            'an admin distributes a finalized bill; the handler claims the flip to distributed upfront, attaches the share to every resident invoice of that month, opens a new invoice when there is none, re-syncs the pending payment and pushes an electricity_bill notification to every affected resident (apps/api/src/routes/electricity.ts:691-937). If any tenant path errors the bill is rolled back to finalized so the run can be retried',
        },
      },
    ],
    terminal: 'distributed',
    // Nothing is a dead letter box: a failed distribution rolls back to finalized.
  },
  truthContract: [
    {
      action: 'Distribute the month bill',
      operatorBelieves: 'every resident has been charged their share and knows about it',
      serverCommits:
        'POST /electricity/:id/distribute flips the bill to distributed, splits each room entry across the tenants who were in that room during the billing month, writes the electricity line item onto the resident invoice, re-syncs the open pending payment to the new residual, opens a pending payment when the invoice grew, and pushes an electricity_bill notification to each affected resident (apps/api/src/routes/electricity.ts:691-937). The bill is rolled back to finalized when any tenant path errors, and the response then reports the partial result with the error count.',
      notification: {
        to: 'tenant',
        type: 'electricity_bill',
        required: true,
      },
      mismatchSurfacedAt:
        'the bill detail shows the distributed counts and the resident invoice shows the electricity line item; the resident gets the notification in the portal',
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
      action: 'Finalize the bill',
      operatorBelieves: 'the numbers are locked and the month can be charged',
      serverCommits:
        'POST /electricity/:id/finalize refuses a bill that is not draft, writes status=finalized and an update audit log entry with the bill total, the computed room total and the variance (apps/api/src/routes/electricity.ts:643-689). It sends no notification: nothing is owed to a resident before the share is on their invoice.',
      mismatchSurfacedAt: 'the electricity list shows the finalized badge',
      provenance: {
        auditAction: 'update',
        screen: '/electricity/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bill is finalized and never distributed, so the month is billed to the PG and not to the residents',
      runbook3am: 'open /electricity?status=finalized and distribute the oldest one',
    },
    {
      action: 'Enter the meter readings',
      operatorBelieves: 'the readings on screen are the readings on the bill',
      serverCommits:
        'POST /electricity writes the bill, derives unitsConsumed, the room amount, the computed room total and the variance from the readings before saving (apps/api/src/models/electricityBill.ts:138-148). It writes no audit log entry for the draft itself.',
      mismatchSurfacedAt:
        'the bill detail shows the variance between the utility total and the computed room total',
      provenance: {
        screen: '/electricity/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the readings are in but the variance was never explained, so the bill cannot be finalized with confidence',
      runbook3am:
        'open /electricity/[id], read the variance, and write the reason in varianceReason',
    },
  ],
  layout: {
    archetype: 'ledger',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'StatCard',
      'DatePicker',
    ],
    mustNotLookLike:
      'a resident invoice list: an electricity row is one month of the whole building, and the variance is the number that decides it',
    ownNumber: 'the variance between the utility total and the computed room total',
  },
  nextBestAction: {
    perStatus: {
      draft: {
        label: 'Finalize the bill',
        target: '/electricity/[id]',
        enabledWhen: 'the readings are in and the variance is explained',
      },
      finalized: {
        label: 'Distribute the shares',
        target: '/electricity/[id]',
      },
      distributed: {
        label: 'Read the distribution',
        target: '/electricity/[id]',
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
    },
  },
};
