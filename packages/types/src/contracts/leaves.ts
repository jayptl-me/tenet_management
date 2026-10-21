import type { ModuleContract } from './module';

/**
 * The leaves contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the four admin screens (2026-10-21, wave 6):
 *
 * - the model and its status enum: apps/api/src/models/leaveApplication.ts:17-78
 * - the routes: apps/api/src/routes/leaves.ts:228-753
 * - the notification of a decision: apps/api/src/routes/leaves.ts:180-219
 * - the attendance side effect of an approval: apps/api/src/routes/leaves.ts:33-79 and :650
 * - the rent a resident is billed from: apps/api/src/services/invoice.service.ts:97
 * - the attendance board the days are written on: apps/api/src/routes/attendance.ts:296-402
 * - the notification list the office reads: apps/api/src/routes/notifications.ts:26-54
 * - the write trail: apps/api/src/routes/audit.ts:13-52 and apps/api/src/models/auditLog.ts:82
 * - the admin screens: apps/web/src/app/(admin)/leaves
 *
 * A leave request is a decision the resident is waiting for. The decision travels to the resident
 * in the notification body, because the portal card does not render adminNotes.
 *
 * THE MONEY OF THIS MODULE: a leave does not change the rent. The monthly bill is raised from the
 * rent on the resident's own record (apps/api/src/services/invoice.service.ts:97), and nothing in
 * the leave route touches it. What a decision costs is the attendance board: an approval writes one
 * on-leave row per day of the window. Every screen of the module says so, because an office that
 * believes a leave reduces the bill will approve the wrong requests.
 */
export const LEAVES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'answering the absence requests residents filed, and keeping the attendance board true against the answers',
    doneLooksLike:
      'every request carries a decision, the approved days are marked on the attendance board, the resident has been told the outcome and the reason, and nobody believes a leave reduced a bill',
    primaryAction: 'Approve, reject with a reason, or cancel a leave request',
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
            'a tenant or an admin files a leave application and the record lands with the model default pending (apps/api/src/routes/leaves.ts:305-308). The server refuses a window that ends before it starts (LEAVE_INVALID_RANGE, :245-256), a resident who is not active (TENANT_INACTIVE, :259-263) and a window that overlaps another pending or approved leave of the same resident (OVERLAPPING_LEAVE, :266-284).',
        },
        // The clock of this status is the start date of the window: the request has to be
        // answered before the resident leaves, because the answer is what marks the days. A
        // request that waits longer than a day is a resident who leaves without an answer.
        dwell: 1,
        dwellUnit: 'days',
      },
      {
        // The office said yes.
        status: 'approved',
        enteredBy: {
          method: 'PUT',
          path: '/leaves/:id/approve',
          condition:
            'an admin approves a pending request; the handler re-checks the overlap against the approved leaves (OVERLAPPING_LEAVE, apps/api/src/routes/leaves.ts:622-642), stamps approvedBy and approvedAt (:644-647), marks every day of the window as on_leave on the attendance board (:650, :33-79), writes an update audit log entry (:652-665) and sends the resident a service_update notification that carries the dates and the reason (:667-675).',
        },
      },
      {
        // The office said no.
        status: 'rejected',
        enteredBy: {
          method: 'PUT',
          path: '/leaves/:id/reject',
          condition:
            'an admin rejects a pending request and may leave a reason in adminNotes (apps/api/src/routes/leaves.ts:709-717); the handler writes an update audit log entry (:719-732) and sends the resident a service_update notification that carries the reason in its body (:734-742). The reason is optional in the API, so a rejection without one tells the resident nothing: the screens of this module require one.',
        },
      },
      {
        // Withdrawn before a decision.
        status: 'cancelled',
        enteredBy: {
          method: 'POST',
          path: '/leaves/:id/cancel',
          condition:
            'the tenant owner or an admin withdraws a pending request (apps/api/src/routes/leaves.ts:535-536); the handler writes an update audit log entry (:538-551) and pushes a service_update notification to the resident, whose body says the leave was cancelled by the PG office when the office withdrew it and simply that it was cancelled when the resident withdrew it (:555-563, :193-201).',
        },
      },
    ],
    terminal: 'approved',
    // approved and rejected are both final: the approve, reject and cancel handlers only accept a
    // pending record (apps/api/src/routes/leaves.ts:616, :705, :504). Cancelled can still be hard
    // deleted.
    deadEnd: 'rejected',
  },
  truthContract: [
    {
      action: 'Approve a leave request',
      operatorBelieves:
        'the resident is away for those days, the attendance board says so, and the resident has been told',
      serverCommits:
        'PUT /leaves/:id/approve re-checks that no approved leave of the same resident overlaps, sets status=approved with approvedBy and approvedAt, marks each day of the window as on_leave on the attendance board (method manual, the note Leave approved, the office as the one recorded), writes an update audit log entry and sends the resident a service_update notification that carries the dates and the reason the resident gave (apps/api/src/routes/leaves.ts:608-683, :33-79, :180-219). The approval carries no note of the office: the route takes no body, so adminNotes is never written on that path. A day with a real on-site check-in keeps its own record. It does not change the rent: the bill is raised from the rent on the resident record (apps/api/src/services/invoice.service.ts:97). A failed push is logged and never undoes the approval.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'the leave page shows the attendance rows the approval wrote and the notification the server holds; the resident gets the message in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/leaves/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the request is approved but the attendance days were never marked, so the resident is marked absent on a day they were home',
      runbook3am:
        'open /leaves?status=approved, open the leave, and compare its window with the attendance rows it shows',
    },
    {
      action: 'Reject a leave request',
      operatorBelieves: 'the resident knows the leave was refused and why',
      serverCommits:
        'PUT /leaves/:id/reject sets status=rejected, keeps the reason in adminNotes, writes an update audit log entry and sends the resident a service_update notification (apps/api/src/routes/leaves.ts:686-751). The reason travels in the notification body, because the portal leave card does not render adminNotes. The attendance board is not touched and the rent does not change. A failed push is logged and never undoes the rejection.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'the leave page shows the reason of the office and the notification the server holds; the resident only sees the notification body',
      provenance: {
        auditAction: 'update',
        screen: '/leaves/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the request was rejected with no reason written, so the notification tells the resident nothing',
      runbook3am:
        'open /leaves?status=rejected, read the reason in the leave and in the notification the server holds',
    },
    {
      action: 'Cancel a pending leave',
      operatorBelieves: 'whoever asked knows the request is gone',
      serverCommits:
        'POST /leaves/:id/cancel sets status=cancelled and writes an update audit log entry (apps/api/src/routes/leaves.ts:497-574). It then pushes a service_update notification to the resident, resolved from the tenant record; the body says the leave was cancelled by the PG office when the office withdrew it, and simply that it was cancelled when the resident withdrew it themselves (apps/api/src/routes/leaves.ts:180-219, :553-563). The attendance board is not touched. A failed push never undoes the cancellation.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the leaves queue drops the request and the resident gets the notification in the portal',
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
    {
      action: 'File a leave request for a resident',
      operatorBelieves: 'the office has recorded the absence of this resident',
      serverCommits:
        'POST /leaves writes the record with the status pending, refuses a window that ends before it starts (LEAVE_INVALID_RANGE), a resident who is not active (TENANT_INACTIVE) and a window that overlaps another pending or approved leave of the same resident (OVERLAPPING_LEAVE), and writes a create audit log entry (apps/api/src/routes/leaves.ts:228-326). It sends no message to the resident: the office files the request, the resident is told when it is decided. The attendance board is not touched by the filing, and the rent does not change (apps/api/src/services/invoice.service.ts:97).',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the leaves queue shows the request as waiting; the resident sees nothing until the request is decided',
      provenance: {
        auditAction: 'create',
        screen: '/leaves/new',
        actor: 'admin',
      },
      stuckStateMeans:
        'the request was filed for the wrong resident or the wrong window, and nobody was told, so the resident finds out only when the office decides',
      runbook3am:
        'open /leaves?status=pending, find the request and read the window the office wrote',
    },
    {
      action: 'Delete a leave record',
      operatorBelieves: 'the request is off the record',
      serverCommits:
        'DELETE /leaves/:id refuses a record that is neither pending nor cancelled (LEAVE_NOT_PENDING), removes the row and writes a delete audit log entry (apps/api/src/routes/leaves.ts:577-605). It sends no message to the resident: a deleted request is a silence. Cancelling the request instead keeps the record and tells the resident.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the request is gone from every list; the resident never learns that it existed',
      provenance: {
        auditAction: 'delete',
        screen: '/leaves',
        actor: 'admin',
      },
      stuckStateMeans:
        'the request was deleted while the resident still plans to leave, and the only trace is the delete entry in the audit log',
      runbook3am:
        'open /audit-logs?resource=leave_application and read the delete entries of the day',
    },
    {
      action: 'Read the queue and the decided history',
      operatorBelieves:
        'the queue holds every request that waits for an answer and the tabs hold what was decided',
      serverCommits:
        'GET /leaves reads the filters of the address bar (status, tenant, the resident name, the window the request overlaps), returns the requests with the resident, the room, the bed and the floor, and answers with the total of the whole filtered set (apps/api/src/routes/leaves.ts:329-411). The server serves at most 100 rows in one page, so the queue names its ceiling. The days a pending request covers are counted by the screen from the window the server holds, and the rent is never part of the answer: the bill is raised from the resident record (apps/api/src/services/invoice.service.ts:97).',
      mismatchSurfacedAt:
        'the band of the leaves page names the scope of every number, and the legend says what the queue and the tabs hold',
      provenance: {
        screen: '/leaves',
        actor: 'admin',
      },
      stuckStateMeans:
        'the queue shows fewer requests than the office believes are waiting, so a resident is left without an answer',
      runbook3am:
        'open /leaves, read the address bar, and compare the waiting count with the requests the server reports',
    },
  ],
  layout: {
    archetype: 'board',
    grammarTokens: [
      'PageBand',
      'StatusTabs',
      'FilterChips',
      'DataTable',
      'StatusBadge',
      'StatusStepper',
      'DetailCard',
      'ContentFrame',
      'EmptyState',
      'PageHeader',
      'ErrorBanner',
      'FormPage',
      'FormCard',
      'FormSection',
      'FormActions',
      'Textarea',
      'LeaveAttendanceImpact',
      'ResourceSelect',
      'DateRangePicker',
      'DatePicker',
      'ConfirmModal',
      'Button',
      'Input',
      'TableActions',
    ],
    mustNotLookLike:
      'an attendance calendar: a leave is a decision waiting for an answer, and the calendar is what the decision costs',
    ownNumber:
      'the leave days that are still waiting for a decision, over the pending requests the server reports for the filters in the address bar',
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
      decided: {
        label: 'Read the approved requests',
        target: '/leaves?status=approved',
      },
    },
  },
};
