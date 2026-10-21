import type { ModuleContract } from './module';

/**
 * The notices contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - the model: apps/api/src/models/noticePost.ts (no status field, see below)
 * - routes: apps/api/src/routes/notices.ts
 * - the send path: apps/api/src/routes/notices.ts:214-247
 * - the admin screens: apps/web/src/app/(admin)/notices
 *
 * THE NOTICE MODEL HAS NO STATUS FIELD. A notice is posted once, it is either
 * pinned or not, and it has an audience. There is no read receipt: the
 * delivery chain ends when the notification is pushed, never in an
 * acknowledgement. That is the honest state of this module.
 */
export const NOTICES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'telling the building something: posting an announcement to everybody, to a floor, to a room or to one person',
    doneLooksLike:
      'every notice names its audience and its author, the announcement reached that audience as a notification, and the pinned notice is the one at the top',
    primaryAction: 'Post an announcement',
  },
  stateMachine: {
    domain: 'notices',
    model: 'noticePost',
    kind: 'grid',
    // The notice model carries no status enum (apps/api/src/models/noticePost.ts).
    // The only flags on the record are:
    //   pinned=true    the notice sits on top of the list
    //   pinned=false   an ordinary notice
    // There is no read receipt: nothing on the record says who read it.
    statuses: [],
  },
  truthContract: [
    {
      action: 'Post an announcement',
      operatorBelieves: 'the audience got the announcement',
      serverCommits:
        'POST /notices writes the notice with the author and the audience, writes a create audit log entry and pushes an announcement notification to the same target type and target ids (apps/api/src/routes/notices.ts:214-247). The push is fire and forget: a failed push is swallowed and nothing is retried. Nothing records who received it and nobody can acknowledge it.',
      notification: {
        to: 'tenant',
        type: 'announcement',
        required: true,
      },
      mismatchSurfacedAt:
        'the notices list shows the notice with its audience; the residents see it in the portal bell and on the push',
      provenance: {
        auditAction: 'create',
        screen: '/notices/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the notice is on the board but the audience was wrong, so the message reached nobody and there is no record of that',
      runbook3am:
        'open /notices, read the audience of the last post, and post it again with the right target',
    },
    {
      action: 'Edit or delete a notice',
      operatorBelieves: 'the audience sees the corrected version',
      serverCommits:
        'PUT /notices/:id rewrites the notice and writes an update audit log entry (apps/api/src/routes/notices.ts:250-275). It sends no notification, so a corrected notice never reaches the people who read the wrong one. DELETE /notices/:id removes the record.',
      mismatchSurfacedAt:
        'the notices list shows the corrected text; the residents keep the original notification',
      provenance: {
        auditAction: 'update',
        screen: '/notices/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the board and the notification disagree, so the residents act on the old text',
      runbook3am:
        'open /notices/[id], read the update entry, and post a fresh announcement with the correction',
    },
  ],
  layout: {
    archetype: 'workspace',
    grammarTokens: ['DataTable', 'StatusBadge', 'EmptyState', 'PageHeader', 'Select', 'Input'],
    mustNotLookLike:
      'a complaint board: a notice is one message to an audience, and the audience is the thing being chosen, not the state',
    ownNumber: 'notices still without a read receipt',
  },
  nextBestAction: {
    perStatus: {
      pinned: {
        label: 'Read the notice',
        target: '/notices/[id]',
      },
      normal: {
        label: 'Read the notice',
        target: '/notices/[id]',
      },
    },
    perEmptyState: {
      notices: {
        label: 'Post an announcement',
        target: '/notices/new',
      },
    },
  },
};
