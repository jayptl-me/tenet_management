import type { ModuleContract } from './module';

/**
 * The washing machines contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/washingMachine.ts:39
 * - routes: apps/api/src/routes/washingMachines.ts
 * - the claim and the release: apps/api/src/routes/washingMachines.ts:329-489
 * - the timer release that runs every minute: apps/api/src/jobs/scheduler.ts:231-255
 * - the admin screens: apps/web/src/app/(admin)/washing-machines
 *
 * A machine is a shared unit with a timer on it. The dwell of the in_use state
 * is the machine timer, which the resident chooses per claim between 10 and 180
 * minutes, so it is not a fixed number of hours or days and no dwell is
 * declared here.
 */
export const WASHING_MACHINES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the machines usable: claiming them, releasing them and taking the broken ones out of the pool',
    doneLooksLike:
      'every machine reads available, in_use, under_maintenance or down with a real claim on it, and no machine is stuck in use after its timer ran out',
    primaryAction: 'Take a broken machine out of the pool',
  },
  stateMachine: {
    domain: 'washing-machines',
    model: 'washingMachine',
    kind: 'grid',
    statuses: [
      {
        // The machine is free.
        status: 'available',
        enteredBy: {
          method: 'POST',
          path: '/washing-machines/:id/release',
          condition:
            'the tenant who claimed it or an admin releases the machine, which sets status=available and clears the claim (apps/api/src/routes/washingMachines.ts:437-489). The timer release does the same every minute for a claim whose timer ran out (apps/api/src/jobs/scheduler.ts:231-255)',
        },
      },
      {
        // Somebody is washing.
        status: 'in_use',
        enteredBy: {
          method: 'POST',
          path: '/washing-machines/:id/claim',
          condition:
            'a tenant on that floor claims a machine that still reads available; the claim stamps currentUserId, claimedAt, the timer duration and timerEndsAt (apps/api/src/routes/washingMachines.ts:329-434)',
        },
      },
      {
        // It is being fixed.
        status: 'under_maintenance',
        enteredBy: {
          method: 'PUT',
          path: '/washing-machines/:id',
          condition:
            'an admin marks a machine as under_maintenance; the handler clears any claim on the machine (apps/api/src/routes/washingMachines.ts:273-300)',
        },
      },
      {
        // It is broken.
        status: 'down',
        enteredBy: {
          method: 'PUT',
          path: '/washing-machines/:id',
          condition: 'an admin marks a machine as down and any claim on it is cleared',
        },
      },
    ],
    // Nothing is a dead letter box: a machine can be put back into the pool.
  },
  truthContract: [
    {
      action: 'Take a machine out of the pool',
      operatorBelieves: 'the residents of that floor know the machine is broken',
      serverCommits:
        'PUT /washing-machines/:id writes the new status and clears the claim when the machine is no longer in use, and writes an update audit log entry (apps/api/src/routes/washingMachines.ts:273-300). It sends no notification. The machine list in the portal is the channel here, because a resident reads the machine list right before claiming one, and a claim is refused for a machine that is not available (apps/api/src/routes/washingMachines.ts:385-419). The notification is therefore declared as not required.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the admin machines list shows the new status; the resident meets the refusal when the claim is refused',
      provenance: {
        auditAction: 'update',
        screen: '/washing-machines/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the machine reads available but the claim is stuck on it, so the floor waits for a machine that is already booked',
      runbook3am:
        'open /washing-machines and look for the machines whose timer ended without a release',
    },
    {
      action: 'A resident claims a machine',
      operatorBelieves: 'the machine is theirs until the timer ends',
      serverCommits:
        'POST /washing-machines/:id/claim checks that the caller is a tenant on the floor of the machine, refuses a second claim from the same tenant, and claims the machine atomically only when it still reads available; it stamps currentUserId, claimedAt, the timer duration and timerEndsAt and writes an update audit log entry (apps/api/src/routes/washingMachines.ts:329-434). A timer that runs out is released by the scheduler, not by the resident.',
      mismatchSurfacedAt:
        'the machines list shows the claim and the timer; the resident sees the same on the portal',
      provenance: {
        auditAction: 'update',
        screen: '/washing-machines/[id]',
        actor: 'tenant',
      },
      stuckStateMeans:
        'the machine reads in_use with no timer, so nobody can take it and nobody is charged for it',
      runbook3am: 'open /washing-machines?status=in_use and release the claim by hand',
    },
  ],
  layout: {
    archetype: 'board',
    grammarTokens: ['DataTable', 'StatusBadge', 'EmptyState', 'PageHeader', 'Select'],
    mustNotLookLike:
      'a booking calendar: a machine is a physical unit with a timer on it, and the cell is the state of the machine, not a place in a queue',
    ownNumber: 'machines still running right now',
  },
  nextBestAction: {
    perStatus: {
      available: {
        label: 'Open the machine',
        target: '/washing-machines/[id]',
      },
      in_use: {
        label: 'Release it',
        target: '/washing-machines/[id]',
        enabledWhen: 'the timer has run out',
      },
      under_maintenance: {
        label: 'Book the repair',
        target: '/washing-machines/[id]',
      },
      down: {
        label: 'Decide: repair or scrap',
        target: '/washing-machines/[id]',
      },
    },
    perEmptyState: {
      washing_machines: {
        label: 'Register a machine',
        target: '/washing-machines/new',
      },
      in_use: {
        label: 'Open the running machines',
        target: '/washing-machines?status=in_use',
      },
    },
  },
};
