import type { ModuleContract } from './module';

/**
 * The notifications contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - the model: apps/api/src/models/notification.ts (no status field, see below)
 * - routes: apps/api/src/routes/notifications.ts
 * - the send path: apps/api/src/services/notification.service.ts:84-156
 * - the admin screens: apps/web/src/app/(admin)/notifications
 *
 * THE NOTIFICATION MODEL HAS NO STATUS FIELD. A notification is sent once and
 * then lives; the only state on it is read or unread, and that state is per
 * recipient (the unreadBy array), not on the record. So the state machine
 * below declares no status and the truth contract carries the two states the
 * operator actually sees.
 */
export const NOTIFICATIONS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'sending the office voice to the people who live here, and keeping the record of what was sent',
    doneLooksLike:
      'every broadcast names its audience and its type, and the history shows who was on the list when it went out',
    primaryAction: 'Send a broadcast',
  },
  stateMachine: {
    domain: 'notifications',
    model: 'notification',
    kind: 'grid',
    // The notification model carries no status enum
    // (apps/api/src/models/notification.ts). The two states the operator sees
    // are per recipient and live in unreadBy:
    //   unreadBy contains the user  the message is unread for that user
    //   unreadBy no longer contains the user  the message is read
    statuses: [],
  },
  truthContract: [
    {
      action: 'Send a broadcast',
      operatorBelieves: 'the residents on that audience got the message',
      serverCommits:
        'POST /notifications resolves the audience from the target type (all active residents, one person, a room or a floor), writes the notification with the permanent recipient set and the unread set, pushes it to ntfy for every recipient that has a topic, broadcasts it on the SSE stream, and writes a notification_send audit log entry with the target type, the type and the target ids (apps/api/src/routes/notifications.ts:90-148, apps/api/src/services/notification.service.ts:84-156). An emergency broadcast is refused while the emergencyAlertsEnabled flag is off.',
      mismatchSurfacedAt:
        'the admin history shows the notification with its audience; the resident sees it in the portal bell and on the push',
      provenance: {
        auditAction: 'notification_send',
        screen: '/notifications/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the message is in the history but the reader count never moved, so nobody on the audience opened it',
      runbook3am: 'open /notifications, filter on the type, and read the audience of the last send',
    },
    {
      action: 'A resident marks a message as read',
      operatorBelieves: 'the message is read and it leaves the unread list',
      serverCommits:
        'PATCH /notifications/:id/read pulls the user out of the unreadBy array and keeps the row, so the history survives (apps/api/src/services/notification.service.ts:170-186). The admin side of the module never writes a read state for anybody else.',
      mismatchSurfacedAt: 'the bell count of that resident drops; the admin history is unchanged',
      provenance: {
        screen: '/notifications',
        actor: 'tenant',
      },
      stuckStateMeans: 'the count says unread while the resident has read it, so the badge lies',
      runbook3am: 'open /notifications and check the unread count against the send list',
    },
  ],
  layout: {
    archetype: 'workspace',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'ResourceSelect',
      'Textarea',
    ],
    mustNotLookLike:
      'a money ledger: a notification row is a message that was sent, and the audience it reached is what the row is about',
    ownNumber: 'messages still unread by somebody',
  },
  nextBestAction: {
    perStatus: {
      // The two states the operator sees. They are per recipient, not on the record.
      unread: {
        label: 'Read the message',
        target: '/notifications/[id]',
      },
      read: {
        label: 'Read the message',
        target: '/notifications/[id]',
      },
    },
    perEmptyState: {
      notifications: {
        label: 'Send the first broadcast',
        target: '/notifications/new',
      },
      unread: {
        label: 'Open the unread list',
        target: '/notifications',
      },
    },
  },
};
