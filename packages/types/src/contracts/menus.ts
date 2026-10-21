import type { ModuleContract } from './module';

/**
 * The menus contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - the model: apps/api/src/models/dailyMenu.ts (no status field, see below)
 * - routes: apps/api/src/routes/menus.ts
 * - the create path: apps/api/src/routes/menus.ts:127-166
 * - the admin screens: apps/web/src/app/(admin)/menus
 *
 * THE MENU MODEL HAS NO STATUS FIELD. A menu is one date and the three or four
 * meals of that day. The only state on it is whether the date has arrived.
 */
export const MENUS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'planning what gets cooked: filling the week so every day has a breakfast, a lunch and a dinner before the residents ask',
    doneLooksLike:
      'every day of the planned week carries its three meals, and no day is left empty for the residents to read',
    primaryAction: 'Plan a day of meals',
  },
  stateMachine: {
    domain: 'menus',
    model: 'dailyMenu',
    kind: 'grid',
    // The menu model carries no status enum (apps/api/src/models/dailyMenu.ts).
    // The only states on a menu are:
    //   planned   the date has meals written against it
    //   empty     the date exists but a meal slot is still empty
    // and the date itself decides whether the day is past or still to come.
    statuses: [],
  },
  truthContract: [
    {
      action: 'Plan a day of meals',
      operatorBelieves: 'the residents will see the menu for that day',
      serverCommits:
        'POST /menus writes the menu for the date with the meals of each slot, refuses a date in the past and writes a create audit log entry (apps/api/src/routes/menus.ts:127-166). The menu reaches the residents by pull, not by push: the portal reads GET /menus/today. Nothing is sent to anybody, so a resident who never opens the app never learns the menu. The notification is therefore not owed on this path and is declared as not required.',
      notification: {
        to: 'tenant',
        type: 'announcement',
        required: false,
      },
      mismatchSurfacedAt:
        'the week planner shows the day filled; the residents see the menu on their next portal load',
      provenance: {
        auditAction: 'create',
        screen: '/menus/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the day is missing from the planner, so the residents read yesterday menu or no menu at all',
      runbook3am: 'open /menus and look at the days with an empty meal slot',
    },
    {
      action: 'Edit a planned day',
      operatorBelieves: 'the residents see the corrected menu',
      serverCommits:
        'PUT /menus/:id rewrites the meals of the day and writes an update audit log entry with the date (apps/api/src/routes/menus.ts:179-244). It sends no notification, so the correction reaches the residents only on their next portal load.',
      mismatchSurfacedAt:
        'the week planner shows the corrected menu; the residents see it on their next portal load',
      provenance: {
        auditAction: 'update',
        screen: '/menus/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the kitchen cooked the old plan and the board shows the new one, with nothing in the trail to say when it changed',
      runbook3am: 'open /menus/[id] and read the day against what the kitchen served',
    },
  ],
  layout: {
    archetype: 'calendar',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'WeekMenuPlanner',
      'Select',
    ],
    mustNotLookLike:
      'an attendance calendar: a menu cell is a dish, not a person, and the week is planned ahead rather than recorded',
    ownNumber: 'meals planned for today',
  },
  nextBestAction: {
    perStatus: {
      planned: {
        label: 'Open the day',
        target: '/menus/[id]',
      },
      empty: {
        label: 'Fill the day',
        target: '/menus/new',
        enabledWhen: 'a meal slot of that day is still empty',
      },
    },
    perEmptyState: {
      menus: {
        label: 'Plan a day',
        target: '/menus/new',
      },
      today: {
        label: 'Open the week',
        target: '/menus',
      },
    },
  },
};
