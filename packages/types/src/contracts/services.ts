import type { ModuleContract } from './module';

/**
 * The services contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/serviceStatus.ts:32
 * - routes: apps/api/src/routes/services.ts
 * - the update handler and its permission rule: apps/api/src/routes/services.ts:361-462
 * - the admin screens: apps/web/src/app/(admin)/services
 *
 * One row per floor and service type: wifi, water, geyser, lift. The status is
 * what the floor is told, and the floor is told by the server on every status
 * change.
 */
export const SERVICES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'holding the health of the building: one status per floor and per service, and putting it back to operational when it is fixed',
    doneLooksLike:
      'every floor and every service carries a status that is true today, and nothing reads degraded or down without a reason and a note',
    primaryAction: 'Set the status of a service on a floor',
  },
  stateMachine: {
    domain: 'services',
    model: 'serviceStatus',
    kind: 'grid',
    statuses: [
      {
        // The service works.
        status: 'operational',
        enteredBy: {
          method: 'PUT',
          path: '/services/:id',
          condition:
            'an admin puts the service back to operational; only an admin may do this, a resident may never report a service as working (apps/api/src/routes/services.ts:317-323). POST /services creates a row with the model default operational (apps/api/src/models/serviceStatus.ts:32)',
        },
      },
      {
        // The service works badly.
        status: 'degraded',
        enteredBy: {
          method: 'PUT',
          path: '/services/:id',
          condition:
            'an admin or a resident on that floor reports the service as degraded (apps/api/src/routes/services.ts:277-334)',
        },
      },
      {
        // The service does not work.
        status: 'down',
        enteredBy: {
          method: 'PUT',
          path: '/services/:id',
          condition:
            'an admin or a resident on that floor reports the service as down (apps/api/src/routes/services.ts:277-334)',
        },
      },
    ],
  },
  truthContract: [
    {
      action: 'Report a service as degraded or down',
      operatorBelieves: 'the residents of that floor know their service is broken',
      serverCommits:
        'PUT /services/:id checks that a non-admin may only touch a service on their own floor and may never set operational, writes the status, stamps lastUpdatedBy and lastUpdatedAt, keeps the note, and writes an update audit log entry with the previous status (apps/api/src/routes/services.ts:361-462). When the status actually moved it then pushes a service_update notification to the residents of that floor, resolved from the service through the rooms and the tenant records (apps/api/src/routes/services.ts:132-190, :441-453). A floor with nobody living on it has nobody to tell, so nothing is sent and the reason is logged. A failed push never undoes the write.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the service page and the floor service grid show the new status, and the residents of that floor get the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/services/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the service reads down, the residents are still without it, and either the push failed or the note that would explain it was never written',
      runbook3am:
        'open /services?status=down and, if the residents have no notification, tell the floor directly',
    },
    {
      action: 'Put a service back to operational',
      operatorBelieves: 'the floor knows the service is working again',
      serverCommits:
        'PUT /services/:id writes the status back to operational with the note and writes an update audit log entry (apps/api/src/routes/services.ts:361-462). The status change also pushes a service_update notification to the residents of that floor, with the note in the body when there is one (apps/api/src/routes/services.ts:132-190, :441-453).',
      mismatchSurfacedAt:
        'both sides see it: the service page and the floor service grid show operational again, and the residents of that floor get the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/services/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the service reads operational while the residents still have no service, because the push failed and they heard about the repair from a neighbour',
      runbook3am: 'open /services and check the floors that still read degraded or down',
    },
  ],
  layout: {
    archetype: 'board',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'StatCard',
      'ResourceSelect',
      'FloorServiceGrid',
    ],
    mustNotLookLike:
      'a complaints queue: a service row is a floor and a service type, and the cell is the status of the building, not a person waiting',
    ownNumber: 'floors with a degraded or down service',
  },
  nextBestAction: {
    perStatus: {
      operational: {
        label: 'Open the service',
        target: '/services/[id]',
      },
      degraded: {
        label: 'Fix it',
        target: '/services/[id]',
        enabledWhen: 'the service is still degraded',
      },
      down: {
        label: 'Tell the floor',
        target: '/services/[id]',
      },
    },
    perEmptyState: {
      services: {
        label: 'Add a service for a floor',
        target: '/services/new',
      },
      degraded: {
        label: 'Open the broken services',
        target: '/services?status=degraded',
      },
    },
  },
};
