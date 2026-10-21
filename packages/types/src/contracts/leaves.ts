import type { ModuleContract } from './module';

/**
 * The leaves contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/leaveApplication.ts:43
 * - the decision handlers: apps/api/src/routes/leaves.ts:608-752
 * - the notification helper: apps/api/src/routes/leaves.ts:160-219
 * - the attendance side effect: apps/api/src/routes/leaves.ts:650 and :33-79
 * - the admin screens: apps/web/src/app/(admin)/leaves
 *
 * A leave request is a decision the resident is waiting for. The decision
 * travels to the resident in the notification body, because the portal card
 * does not render adminNotes.
 */
export const LEAVES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'deciding the leave requests residents filed, and keeping the attendance board honest against them',
    doneLooksLike:
      'every request carries a decision, the approved days are marked on the attendance board, and the resident has been told the outcome and the reason',
    primaryAction: 'Approve or reject a leave request',
  },
  stateMachine: {
    domain: 'leaves',
    model: 'leaveApplication',
    kind: 'ladder',
    statuses: [
      {
        // The resident asks.
        status: 'pending',
        enteredBy: {
          method: 'POST',
          path: '/leaves',
          condition:
            'a tenant or an admin files a leave application; the record lands with the model default pending (apps/api/src/models/leaveApplication.ts:43). A second leave overlapping a pending or approved one is refused (OVERLAPPING_LEAVE)',
        },
      },
      {
        // The office said yes.
        status: 'approved',
        enteredBy: {
          method: 'PUT',
          path: '/leaves/:id/approve',
          condition:
            'an admin approves a pending request; the handler re-checks the overlap, stamps approvedBy and approvedAt, writes an audit log entry and marks every leave day as on_leave on the attendance board (apps/api/src/routes/leaves.ts:608-684)',
        },
      },
      {
        // The office said no.
        status: 'rejected',
        enteredBy: {
          method: 'PUT',
          path: '/leaves/:id/reject',
          condition:
            'an admin rejects a pending request and may leave a reason in adminNotes (apps/api/src/routes/leaves.ts:686-752)',
        },
      },
      {
        // Withdrawn before a decision.
        status: 'cancelled',
        enteredBy: {
          method: 'POST',
          path: '/leaves/:id/cancel',
          condition:
            'the tenant owner or an admin withdraws a pending request (apps/api/src/routes/leaves.ts:497-574)',
        },
      },
    ],
    terminal: 'approved',
    // approved and rejected are both final: the approve, reject and cancel
    // handlers only accept a pending record (apps/api/src/routes/leaves.ts:615,
    // :704, :504). Cancelled can still be hard deleted.
    deadEnd: 'rejected',
  },
  truthContract: [
    {
      action: 'Approve a leave request',
      operatorBelieves: 'the resident knows the leave is approved',
      serverCommits:
        'PUT /leaves/:id/approve re-checks that no other leave overlaps, sets status=approved with approvedBy and approvedAt, marks each leave day as on_leave on the attendance board, writes an update audit log entry and sends the resident a service_update notification that carries the dates and the reason (apps/api/src/routes/leaves.ts:608-684). A failed push is logged and never undoes the approval.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'the leaves list shows the approved chip and the attendance board shows the leave days; the resident gets the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/leaves/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the request is approved but the attendance days were never marked, so the resident is marked absent on a day they were home',
      runbook3am:
        'open /leaves?status=pending, approve the request, then confirm the days on /attendance',
    },
    {
      action: 'Reject a leave request',
      operatorBelieves: 'the resident knows the leave was refused and why',
      serverCommits:
        'PUT /leaves/:id/reject sets status=rejected, keeps the reason in adminNotes, writes an update audit log entry and sends the resident a service_update notification (apps/api/src/routes/leaves.ts:686-752). The reason travels in the notification body, because the portal leave card does not render adminNotes. A failed push is logged and never undoes the rejection.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'the leaves list shows the rejected chip with the admin notes; the resident only sees the notification body',
      provenance: {
        auditAction: 'update',
        screen: '/leaves/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the request was rejected with no reason written, so the notification tells the resident nothing',
      runbook3am: 'open /leaves?status=pending, write the reason in adminNotes, then reject',
    },
    {
      action: 'Cancel a pending leave',
      operatorBelieves: 'whoever asked knows the request is gone',
      serverCommits:
        'POST /leaves/:id/cancel sets status=cancelled and writes an update audit log entry (apps/api/src/routes/leaves.ts:497-574). It then pushes a service_update notification to the resident, resolved from the tenant record; the body says the leave was cancelled by the PG office when the office withdrew it, and simply that it was cancelled when the resident withdrew it themselves (apps/api/src/routes/leaves.ts:180-219, :553-563). A failed push never undoes the cancellation.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the leaves list shows the cancelled chip and the resident gets the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/leaves/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the request was cancelled by the office and the push failed, so the resident still plans to leave',
      runbook3am:
        'open /leaves?status=cancelled, read the audit entry, and if the resident has no notification, tell them directly',
    },
  ],
  layout: {
    archetype: 'board',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'DateRangePicker',
      'ResourceSelect',
      'LeaveAttendanceImpact',
    ],
    mustNotLookLike:
      'an attendance calendar: a leave row is a decision waiting for an answer, and the calendar is what the decision costs',
    ownNumber: 'leave days approved for today',
  },
  nextBestAction: {
    perStatus: {
      pending: {
        label: 'Decide it',
        target: '/leaves/[id]',
        enabledWhen: 'the request has no decision yet',
      },
      approved: {
        label: 'Read the approval',
        target: '/leaves/[id]',
      },
      rejected: {
        label: 'Read the reason',
        target: '/leaves/[id]',
      },
      cancelled: {
        label: 'Read the cancellation',
        target: '/leaves/[id]',
      },
    },
    perEmptyState: {
      leaves: {
        label: 'Record a leave for a resident',
        target: '/leaves/new',
      },
      pending: {
        label: 'Open the decision queue',
        target: '/leaves?status=pending',
      },
    },
  },
};
