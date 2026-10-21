import type { ModuleContract } from './module';

/**
 * The guardians contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - the model: apps/api/src/models/guardian.ts (no status field, see below)
 * - routes: apps/api/src/routes/guardians.ts
 * - the deactivate path: apps/api/src/routes/guardians.ts:522-557
 * - the admin screens: apps/web/src/app/(admin)/guardians
 *
 * THE GUARDIAN MODEL HAS NO STATUS FIELD. Its only flag is isActive: a guardian
 * is either reachable by the office or not. A tenant checkout deactivates the
 * guardians of that tenant as well (apps/api/src/routes/tenants.ts:815-829).
 */
export const GUARDIANS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the people who stand behind a resident reachable: one contact per ward, with a phone number that works',
    doneLooksLike:
      'every resident that has a guardian has exactly one active contact, and every deactivated guardian has a reason in the trail',
    primaryAction: 'Add or fix the contact of a resident',
  },
  stateMachine: {
    domain: 'guardians',
    model: 'guardian',
    kind: 'grid',
    // The guardian model carries no status enum (apps/api/src/models/guardian.ts).
    // The only flag on the record is:
    //   isActive=true   the guardian is reachable and the portal login works
    //   isActive=false  the guardian was deactivated
    statuses: [],
  },
  truthContract: [
    {
      action: 'Add a guardian',
      operatorBelieves: 'the guardian can reach the resident ward from the portal',
      serverCommits:
        'POST /guardians creates the guardian login with a temporary password, creates the guardian record linked to the tenant with isActive=true, links the user and writes a create audit log entry (apps/api/src/routes/guardians.ts:112-241). It sends no notification: the temporary password is handed over out of band.',
      mismatchSurfacedAt:
        'the guardians list shows the contact with its ward; the guardian reaches the ward only through the portal login',
      provenance: {
        auditAction: 'create',
        screen: '/guardians/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the guardian record exists with no login, so the ward cannot be reached in an emergency',
      runbook3am:
        'open /guardians, filter on the tenant, and check that every guardian has a working phone number',
    },
    {
      action: 'Deactivate a guardian',
      operatorBelieves: 'the guardian and the office both know the contact is closed',
      serverCommits:
        'DELETE /guardians/:id sets isActive=false, deactivates the guardian login and writes a delete audit log entry with the name and the tenant (apps/api/src/routes/guardians.ts:522-557). It sends no notification, and the notification path cannot reach a deactivated user anyway: recipients are resolved with isActive=true (apps/api/src/services/notification.service.ts:50).',
      mismatchSurfacedAt: 'the guardians list shows the contact as deactivated',
      provenance: {
        auditAction: 'delete',
        screen: '/guardians/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the guardian still appears as the contact of a resident whose stay has ended',
      runbook3am: 'open /guardians, sort on the deactivated ones, and clear the ward list',
    },
  ],
  layout: {
    archetype: 'roster',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'Input',
      'TenantStayCalendar',
    ],
    mustNotLookLike:
      'the tenant roster: a guardian row is the contact beside a resident, and the resident is not the protagonist here',
    ownNumber: 'wards with no active guardian contact',
  },
  nextBestAction: {
    perStatus: {
      active: {
        label: 'Open the contact',
        target: '/guardians/[id]',
      },
      deactivated: {
        label: 'Read the deactivation',
        target: '/guardians/[id]',
      },
    },
    perEmptyState: {
      guardians: {
        label: 'Add a guardian',
        target: '/guardians/new',
      },
      ward: {
        label: 'Open the resident',
        target: '/tenants/[id]',
      },
    },
  },
};
