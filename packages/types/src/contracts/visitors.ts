import type { ModuleContract } from './module';

/**
 * The visitors contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/visitor.ts:56
 * - the lifecycle handlers: apps/api/src/routes/visitors.ts:253-500
 * - the admin screens: apps/web/src/app/(admin)/visitors
 *
 * The visitor record is a gate pass. The resident registers the visit, the
 * gate marks the arrival and the departure, and the resident has no other way
 * to learn what the gate did with it.
 */
export const VISITORS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'running the gate: letting expected visitors in, stamping the arrival and the departure, and closing out the ones that never came',
    doneLooksLike:
      'every visitor who came is marked arrived and then departed with a real timestamp, and the ones that did not come are cancelled or still waiting for their hour',
    primaryAction: 'Mark a visitor arrived or departed',
  },
  stateMachine: {
    domain: 'visitors',
    model: 'visitor',
    kind: 'ladder',
    statuses: [
      {
        // The visit is registered and expected.
        status: 'expected',
        enteredBy: {
          method: 'POST',
          path: '/visitors',
          condition:
            'a tenant or an admin registers a visitor; the record lands with the model default expected (apps/api/src/models/visitor.ts:56). POST /visitors/:id/approve puts a cancelled visitor back into expected',
        },
      },
      {
        // The person is on site.
        status: 'arrived',
        enteredBy: {
          method: 'POST',
          path: '/visitors/:id/arrive',
          condition:
            'the tenant owner or an admin stamps the arrival; only an expected visitor can arrive (apps/api/src/routes/visitors.ts:302-366)',
        },
      },
      {
        // The person left.
        status: 'departed',
        enteredBy: {
          method: 'POST',
          path: '/visitors/:id/depart',
          condition:
            'the tenant owner or an admin stamps the departure; only an arrived visitor can depart (apps/api/src/routes/visitors.ts:369-433)',
        },
      },
      {
        // The visit will not happen.
        status: 'cancelled',
        enteredBy: {
          method: 'POST',
          path: '/visitors/:id/cancel',
          condition:
            'the tenant owner or an admin cancels an expected visitor (apps/api/src/routes/visitors.ts:437-499)',
        },
      },
    ],
    terminal: 'departed',
    // Nothing is a dead letter box: a cancelled visitor can be re-approved back
    // to expected (apps/api/src/routes/visitors.ts:313-325).
  },
  truthContract: [
    {
      action: 'Approve a visitor again',
      operatorBelieves: 'the resident who registered the visitor knows the gate allowed it in',
      serverCommits:
        'POST /visitors/:id/approve only works on a cancelled visitor: it sets status=expected with approvedBy and writes a visitor_approve audit log entry (apps/api/src/routes/visitors.ts:304-344). It then pushes a service_update notification to the tenant who registered the visit, resolved from the visitor record itself and never from a client supplied id (apps/api/src/routes/visitors.ts:346-356). A failed push is logged and never undoes the approval.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the admin visitor list shows the visitor back in expected, and the resident gets the notification in the portal',
      provenance: {
        auditAction: 'visitor_approve',
        screen: '/visitors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the visitor was re-approved but the push failed, so the resident is still waiting at the gate for a verdict the server already gave',
      runbook3am:
        'open /visitors?status=expected, read the visitor_approve entry, and if the resident has no notification, tell them at the gate',
    },
    {
      action: 'Mark a visitor arrived',
      operatorBelieves: 'the gate log and the resident agree that the person is on site',
      serverCommits:
        'POST /visitors/:id/arrive refuses any visitor that is not expected, sets status=arrived with actualArrival stamped from the server clock and writes an update audit log entry (apps/api/src/routes/visitors.ts:364-430). It sends no notification: the gate records the arrival, the resident reads it on the visitor screen.',
      mismatchSurfacedAt:
        'the admin visitor list and the gate pass card; the resident sees the arrival only on the next portal load',
      provenance: {
        auditAction: 'update',
        screen: '/visitors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the visitor is on site but still reads expected, so the gate sheet and the desk disagree',
      runbook3am: 'open /visitors?status=expected and stamp the arrival by hand',
    },
    {
      action: 'Cancel a visitor',
      operatorBelieves: 'the visit is off and the resident knows it',
      serverCommits:
        'POST /visitors/:id/cancel sets status=cancelled and writes an update audit log entry (apps/api/src/routes/visitors.ts:499-562). It sends no notification: only the approve path pushes to the resident (apps/api/src/routes/visitors.ts:351).',
      mismatchSurfacedAt: 'the admin visitor list shows the cancelled chip',
      provenance: {
        auditAction: 'update',
        screen: '/visitors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the visitor was cancelled but the resident still expects them, and the gate has no record of why',
      runbook3am: 'open /visitors?status=cancelled, read the audit entry, and call the resident',
    },
  ],
  layout: {
    archetype: 'stepper',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'StatusFilterSelect',
      'EmptyState',
      'PageHeader',
      'VisitorGatePassCard',
      'VisitorLifecycleActions',
    ],
    mustNotLookLike:
      'a roster of people: a visitor row is one pass through the gate with a clock on it, and the progression is the point',
    ownNumber: 'visitors on site right now',
  },
  nextBestAction: {
    perStatus: {
      expected: {
        label: 'Stamp the arrival',
        target: '/visitors/[id]',
        enabledWhen: 'the visitor has not been stamped yet',
      },
      arrived: {
        label: 'Stamp the departure',
        target: '/visitors/[id]',
      },
      departed: {
        label: 'Read the gate log',
        target: '/visitors/[id]',
      },
      cancelled: {
        label: 'Re-approve the visit',
        target: '/visitors/[id]',
      },
    },
    perEmptyState: {
      visitors: {
        label: 'Register a visitor',
        target: '/visitors/new',
      },
      expected: {
        label: 'Open the gate list',
        target: '/visitors?status=expected',
      },
    },
  },
};
