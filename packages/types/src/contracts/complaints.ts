import type { ModuleContract } from './module';

/**
 * The complaints contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/complaint.ts:69
 * - the transition guard: apps/api/src/lib/complaint-status.ts and
 *   apps/api/src/routes/complaints.ts:147-153
 * - the status route that moves a complaint: apps/api/src/routes/complaints.ts:457-536
 * - the admin screen is a kanban board: apps/web/src/app/(admin)/complaints/page.tsx
 *
 * A complaint is the last-mile loop of the product: a resident files it, the
 * office works it, and the resident is waiting for the answer.
 */
export const COMPLAINTS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'working through the complaints residents have filed, from the column they land in to the answer they get',
    doneLooksLike:
      'every complaint sits in resolved or dismissed with a resolution note, and the resident has been told which one it is',
    primaryAction: 'Move a complaint to its next status',
  },
  stateMachine: {
    domain: 'complaints',
    model: 'complaint',
    kind: 'ladder',
    statuses: [
      {
        // The resident files it. The model default is open.
        status: 'open',
        enteredBy: {
          method: 'POST',
          path: '/complaints',
          condition:
            'a tenant or an admin files a complaint and the record lands with the model default open (apps/api/src/models/complaint.ts:69); a resolved or dismissed complaint can also be reopened to open',
        },
      },
      {
        // Somebody picked it up.
        status: 'in_progress',
        enteredBy: {
          method: 'PUT',
          path: '/complaints/:id/status',
          condition: 'an admin moves the complaint into in_progress',
        },
      },
      {
        // It is fixed.
        status: 'resolved',
        enteredBy: {
          method: 'PUT',
          path: '/complaints/:id/status',
          condition:
            'an admin resolves the complaint; the handler stamps resolvedAt through complaintStatusPatch and writes a complaint_status_change audit log entry (apps/api/src/routes/complaints.ts:457-536)',
        },
      },
      {
        // It is not a complaint the office will act on.
        status: 'dismissed',
        enteredBy: {
          method: 'PUT',
          path: '/complaints/:id/status',
          condition: 'an admin dismisses the complaint',
        },
      },
    ],
    terminal: 'resolved',
    // Nothing is a dead letter box: resolved and dismissed can both be reopened
    // to open (apps/api/src/routes/complaints.ts:147-153).
  },
  truthContract: [
    {
      action: 'Move a complaint to another status',
      operatorBelieves: 'the resident knows the complaint moved',
      serverCommits:
        'PUT /complaints/:id/status checks the transition, writes the new status with complaintStatusPatch (which stamps resolvedAt on resolve), writes a complaint_status_change audit log entry with the previous status, the new status and the admin notes, pushes a complaint_update notification to the tenant user and broadcasts the change on the event bus (apps/api/src/routes/complaints.ts:457-536). A failed push is swallowed and never undoes the write. The notification body carries the new status but not the admin notes; the notes stay in adminNotes on the record.',
      notification: {
        to: 'tenant',
        type: 'complaint_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the board shows the card in the new column and the resident gets the notification in the portal',
      provenance: {
        auditAction: 'complaint_status_change',
        screen: '/complaints/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the complaint sits in one column while the resident waits for an answer that was never written',
      runbook3am:
        'open /complaints?status=open, open the oldest card, write the note and move it to in_progress',
    },
    {
      action: 'A resident files a complaint',
      operatorBelieves: 'the office has seen it',
      serverCommits:
        'POST /complaints checks the room, takes the filing tenant, refuses a second complaint in the same category within 30 minutes (COMPLAINT_COOLDOWN), writes the complaint with the model default status, writes a create audit log entry and broadcasts new_complaint on the event bus (apps/api/src/routes/complaints.ts:199-315). It writes no notification row: the office learns about it from the live badge and the board.',
      mismatchSurfacedAt:
        'the complaint board and the sidebar badge; there is no notification in the admin inbox',
      provenance: {
        auditAction: 'create',
        screen: '/complaints/[id]',
        actor: 'tenant',
      },
      stuckStateMeans:
        'the complaint is filed but nobody picked it up, so it ages in the open column with no clock on it',
      runbook3am: 'open /complaints?status=open and work the oldest card first',
    },
  ],
  layout: {
    archetype: 'board',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'HeatmapCalendar',
      'StatCard',
      'DateRangePicker',
    ],
    mustNotLookLike:
      'a list of rows to scroll: the board has one column per status and a card has to be dragged or picked into the next column',
    ownNumber: 'complaints open past 48 hours',
  },
  nextBestAction: {
    perStatus: {
      open: {
        label: 'Pick it up',
        target: '/complaints/[id]',
        enabledWhen: 'the complaint has no owner yet',
      },
      in_progress: {
        label: 'Write the resolution',
        target: '/complaints/[id]',
      },
      resolved: {
        label: 'Read the resolution',
        target: '/complaints/[id]',
      },
      dismissed: {
        label: 'Read the dismissal',
        target: '/complaints/[id]',
      },
    },
    perEmptyState: {
      complaints: {
        label: 'File a complaint for a resident',
        target: '/complaints/new',
      },
      open: {
        label: 'Open the working board',
        target: '/complaints?status=open',
      },
    },
  },
};
