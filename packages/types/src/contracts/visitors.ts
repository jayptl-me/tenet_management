import type { ModuleContract } from './module';

/**
 * The visitors contract.
 *
 * The visitor record is a gate pass. The resident registers the visit, the gate marks the arrival
 * and the departure, and the resident has no other way to learn what the gate did with it.
 *
 * Every anchor below was read out of source on 2026-10-21, after the depth rebuild of the four
 * admin screens (wave 6):
 *
 * - the model: apps/api/src/models/visitor.ts:54-59 (the status enum and its default)
 * - the lifecycle handlers: apps/api/src/routes/visitors.ts:305-586
 * - the registration and the list: apps/api/src/routes/visitors.ts:102-233
 * - the notification the gate sends to the resident who registered the visit:
 *   apps/api/src/routes/visitors.ts:66-99 (the helper) and the four call sites
 * - the write trail of a pass: apps/api/src/routes/audit.ts:13-52
 * - the admin screens: apps/web/src/app/(admin)/visitors
 *
 * THE LADDER. A pass moves one way: expected, arrived, departed. Cancelled is the branch off
 * expected, and a cancelled pass can be approved back into expected, so nothing here is a dead
 * letter box. The vocabulary is shared with the portal through packages/types/src/lifecycle.json,
 * so the admin stepper and the portal show the same four states.
 *
 * WHAT THE RESIDENT HEARS. The server pushes a service_update to the resident who registered the
 * visit on the arrival, the departure and the re-approval. It pushes NOTHING on the registration,
 * on a change of the details and on a cancellation: those three silences are named below and in
 * docs/audit/features/visitors.md.
 */
export const VISITORS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'running the gate: reading who is expected and who is on site right now, stamping the arrival and the departure, and closing out the visits that will not happen',
    doneLooksLike:
      'every visitor who came carries a real arrival and a real departure timestamp on the pass, the ones still expected are on the expected list with their hour, and the ones that will not come are cancelled or approved again',
    primaryAction: 'Stamp the arrival and the departure at the gate',
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
            'a tenant or the office registers a visit; the record lands with the model default expected (apps/api/src/models/visitor.ts:54-59, apps/api/src/routes/visitors.ts:144-152). POST /visitors/:id/approve puts a cancelled pass back into expected (apps/api/src/routes/visitors.ts:327-334)',
        },
        // The target the office works to. The record carries the hour the
        // visitor is expected at the gate (expectedArrival), and the desk
        // clears the expected list on that day.
        dwell: 24,
        dwellUnit: 'hours',
      },
      {
        // The person is on site.
        status: 'arrived',
        enteredBy: {
          method: 'POST',
          path: '/visitors/:id/arrive',
          condition:
            'the tenant who registered the visit or an admin stamps the arrival; only an expected pass can arrive (apps/api/src/routes/visitors.ts:397-409). The server stamps actualArrival with its own clock and pushes a service_update to the resident who registered the visit (apps/api/src/routes/visitors.ts:411-439)',
        },
        // The target the office works to. The record carries the arrival and
        // the departure, so the desk can read how long the person has been on
        // site, and it stamps the departure the same day they came in.
        dwell: 12,
        dwellUnit: 'hours',
      },
      {
        // The person left.
        status: 'departed',
        enteredBy: {
          method: 'POST',
          path: '/visitors/:id/depart',
          condition:
            'the tenant who registered the visit or an admin stamps the departure; only an arrived pass can depart (apps/api/src/routes/visitors.ts:477-489). The server stamps actualDeparture with its own clock and pushes a service_update to the resident who registered the visit (apps/api/src/routes/visitors.ts:491-518)',
        },
      },
      {
        // The visit will not happen.
        status: 'cancelled',
        enteredBy: {
          method: 'POST',
          path: '/visitors/:id/cancel',
          condition:
            'the tenant who registered the visit or an admin cancels an expected pass (apps/api/src/routes/visitors.ts:556-568). The server writes the entry in the audit log and pushes nothing to the resident (apps/api/src/routes/visitors.ts:569-583)',
        },
      },
    ],
    terminal: 'departed',
    // Nothing is a dead letter box: a cancelled pass can be approved back to
    // expected (apps/api/src/routes/visitors.ts:313-334).
  },
  truthContract: [
    {
      action: 'Register a visitor',
      operatorBelieves:
        'the resident who registered the visit knows that the pass exists and that the gate will let their guest in',
      serverCommits:
        'POST /visitors creates the visitor record with the state expected, the hour the office picked, the name, the phone and the resident, and writes a create entry in the audit log (apps/api/src/routes/visitors.ts:144-167). It refuses a resident who has checked out (TENANT_INACTIVE, apps/api/src/routes/visitors.ts:122-133), refuses a phone that is not an Indian mobile in the +91 form, and it lets the office register a visit in the past. It sends NO message to the resident: a resident who registered the visit themselves in the portal already knows, and when the office registers a pass on their behalf nobody is told.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'both sides see the same pass: the office sees it on the expected list and the resident sees it in their portal (GET /visitors/my), but neither side is told that it was registered',
      provenance: {
        auditAction: 'create',
        screen: '/visitors/new',
        actor: 'admin',
      },
      stuckStateMeans:
        'the pass is registered and the resident has no idea it exists, so the gate and the resident are looking at two different visits',
      runbook3am:
        'open /visitors?status=expected, read the create entry of the pass, and tell the resident at the desk that their guest is expected',
    },
    {
      action: 'Stamp the arrival of a visitor',
      operatorBelieves:
        'the gate log and the resident agree that the person is on site',
      serverCommits:
        'POST /visitors/:id/arrive refuses any pass that is not expected (INVALID_TRANSITION, apps/api/src/routes/visitors.ts:397-409), sets status=arrived with actualArrival stamped from the server clock and writes an update entry in the audit log with the transition (apps/api/src/routes/visitors.ts:411-426). It then pushes a service_update to the resident who registered the visit (apps/api/src/routes/visitors.ts:428-439); a failed push is logged and never undoes the arrival.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the office sees the pass move to arrived and the resident gets the message in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/visitors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the arrival was stamped but the push to the resident failed, so the gate sheet says the person is inside and the resident was never told',
      runbook3am:
        'open /visitors?status=arrived, read the update entry, and if the resident has no message, tell them at the gate',
    },
    {
      action: 'Stamp the departure of a visitor',
      operatorBelieves: 'the visit is over and the resident knows it is over',
      serverCommits:
        'POST /visitors/:id/depart refuses any pass that did not arrive (INVALID_TRANSITION, apps/api/src/routes/visitors.ts:477-489), sets status=departed with actualDeparture stamped from the server clock and writes an update entry in the audit log with the transition (apps/api/src/routes/visitors.ts:491-506). It then pushes a service_update to the resident who registered the visit (apps/api/src/routes/visitors.ts:508-518); a failed push is logged and never undoes the departure.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the office sees the pass move to departed and the resident gets the message in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/visitors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the departure was stamped but the push to the resident failed, so the resident does not know that their guest has left',
      runbook3am:
        'open /visitors?status=departed, read the update entry, and if the resident has no message, tell them at the gate',
    },
    {
      action: 'Refuse a visit',
      operatorBelieves: 'the visit is off and the resident knows it',
      serverCommits:
        'POST /visitors/:id/cancel refuses any pass that is not expected (INVALID_TRANSITION, apps/api/src/routes/visitors.ts:556-568), sets status=cancelled and writes an update entry in the audit log with the transition (apps/api/src/routes/visitors.ts:569-583). It sends NO message: the resident still expects the visitor, and only the gate tells them. A cancelled pass can be approved again, which does reach the resident.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the admin visitor list shows the cancelled chip and the write trail shows the refusal; the resident sees nothing',
      provenance: {
        auditAction: 'update',
        screen: '/visitors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the pass was cancelled but the resident still expects the visitor, and the gate has no record of why it was refused',
      runbook3am:
        'open /visitors?status=cancelled, read the update entry, and call the resident',
    },
    {
      action: 'Approve a refused visit again',
      operatorBelieves:
        'the resident who registered the visit knows that the gate allowed it in',
      serverCommits:
        'POST /visitors/:id/approve only works on a cancelled pass (INVALID_TRANSITION, apps/api/src/routes/visitors.ts:313-325): it sets status=expected with approvedBy and writes a visitor_approve entry in the audit log (apps/api/src/routes/visitors.ts:327-344). It then pushes a service_update to the tenant who registered the visit, resolved from the visitor record itself and never from a client supplied id (apps/api/src/routes/visitors.ts:351-356). A failed push is logged and never undoes the approval.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the admin visitor list shows the pass back in expected, and the resident gets the notification in the portal',
      provenance: {
        auditAction: 'visitor_approve',
        screen: '/visitors/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the pass was re-approved but the push failed, so the resident is still waiting at the gate for a verdict the server already gave',
      runbook3am:
        'open /visitors?status=expected, read the visitor_approve entry, and if the resident has no message, tell them at the gate',
    },
    {
      action: 'Change the details of a pass',
      operatorBelieves: 'the pass carries the new name, the new phone and the new hour, and the resident knows it',
      serverCommits:
        'PUT /visitors/:id writes only the fields the body carries: the name, the phone, the purpose and the expected hour. It cannot write the state: the status field is deliberately omitted from the schema and from the write (apps/api/src/routes/visitors.ts:594-601), and the gate moves the pass with arrive, depart, cancel and approve. It writes an update entry in the audit log with the fields that moved (apps/api/src/routes/visitors.ts:610-616). It sends NO message to the resident.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the pass page shows the new details; the resident sees them the next time they open the app',
      provenance: {
        auditAction: 'update',
        screen: '/visitors/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office moved the hour of a visit and the resident was not told, so the resident is at the gate at the old hour',
      runbook3am:
        'open /visitors/[id], read the update entry of the pass, and call the resident with the new hour',
    },
    {
      action: 'Delete a pass',
      operatorBelieves: 'the gate sheet forgets the visit',
      serverCommits:
        'DELETE /visitors/:id removes the visitor record and writes a delete entry in the audit log with the name and the phone of the visitor (apps/api/src/routes/visitors.ts:624-641). It is a hard delete: the pass, and with it the arrival and the departure timestamps, are gone. It sends NO message to the resident, so a resident who was told that their guest arrived is never told that the record of it was deleted.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the pass is gone from every list and from the write trail of the record; the resident keeps the message they were sent',
      provenance: {
        auditAction: 'delete',
        screen: '/visitors',
        actor: 'admin',
      },
      stuckStateMeans:
        'a pass was deleted while the visitor was on site, so nobody can say who was inside or when they came in',
      runbook3am:
        'open /visitors, read the delete entry in the audit log, and tell the resident that the pass was removed',
    },
    {
      action: 'Read the gate sheet',
      operatorBelieves: 'the numbers on the screen are the numbers of the gate they are looking at',
      serverCommits:
        'GET /visitors reads the filters of the address bar (status, resident, search), returns the passes with the resident, the room and the floor of the host, and returns the total of the WHOLE filtered set in meta.total (apps/api/src/routes/visitors.ts:191-233). It sorts by createdAt descending and serves at most 100 passes in one page (apps/api/src/lib/routeUtils.ts:16). The server cannot count the passes by state in one call, so the counts behind the tabs are read as one count query per state over the same filtered set.',
      mismatchSurfacedAt:
        'the band of the visitor list names the scope of every number, and the legend says what the filters and the tab really do',
      provenance: {
        screen: '/visitors',
        actor: 'admin',
      },
      stuckStateMeans:
        'the band and the rows cover different sets, so the count of the visitors on site and the rows on screen do not agree',
      runbook3am:
        'open /visitors, read the address bar, and compare the count of the visitors on site with the rows on screen',
    },
  ],
  layout: {
    archetype: 'stepper',
    grammarTokens: [
      'DataTable',
      'PageBand',
      'StatusTabs',
      'FilterChips',
      'StatusBadge',
      'StatusStepper',
      'VisitorGatePassCard',
      'VisitorLifecycleActions',
      'DetailCard',
      'ContentFrame',
      'EmptyState',
      'PageHeader',
      'FormPage',
      'FormCard',
    ],
    mustNotLookLike:
      'a roster of people: a visitor row is one pass through the gate with a clock on it, and the progression is the point',
    ownNumber:
      'the visitors on site right now: the passes the server still counts as arrived, over the filters of the address bar',
  },
  nextBestAction: {
    perStatus: {
      expected: {
        label: 'Stamp the arrival',
        target: '/visitors/[id]',
        enabledWhen: 'the pass has not been stamped at the gate yet',
      },
      arrived: {
        label: 'Stamp the departure',
        target: '/visitors/[id]',
        enabledWhen: 'the visitor is on site',
      },
      departed: {
        label: 'Read the gate log',
        target: '/visitors/[id]',
        enabledWhen: 'the visit is over and the pass is the record of it',
      },
      cancelled: {
        label: 'Re-approve the visit',
        target: '/visitors/[id]',
        enabledWhen: 'the pass was refused and the visit is on again',
      },
    },
    perEmptyState: {
      visitors: {
        label: 'Register a visitor',
        target: '/visitors/new',
      },
      expected: {
        label: 'See who is on site',
        target: '/visitors?status=arrived',
      },
      arrived: {
        label: 'See who is expected',
        target: '/visitors?status=expected',
      },
      departed: {
        label: 'See who is expected',
        target: '/visitors?status=expected',
      },
      cancelled: {
        label: 'See who is expected',
        target: '/visitors?status=expected',
      },
    },
  },
};
