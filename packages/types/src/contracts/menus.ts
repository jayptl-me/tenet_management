import type { ModuleContract } from './module';

/**
 * The menus contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild
 * of the four admin screens (2026-10-21, wave 6):
 *
 * - the model: apps/api/src/models/dailyMenu.ts (no status field, see below)
 * - routes: apps/api/src/routes/menus.ts
 * - the create path: apps/api/src/routes/menus.ts:127-166
 * - the edit path: apps/api/src/routes/menus.ts:179-244
 * - the delete path: apps/api/src/routes/menus.ts:246-279
 * - the list and its filters: apps/api/src/routes/menus.ts:51-125
 * - the read of one day: apps/api/src/routes/menus.ts:168-177
 * - the read of today: apps/api/src/routes/menus.ts:43-49
 * - the feature flag that guards the whole module: apps/api/src/routes/menus.ts:14
 * - the portal that pulls the menu: mobile/lib/features/tenant/data/tenant_repository.dart:206-216
 * - the admin screens: apps/web/src/app/(admin)/menus
 *
 * THE MENU MODEL HAS NO STATUS FIELD. A menu is one date and the dishes of the four slots of
 * that date (apps/api/src/models/dailyMenu.ts:31-45). There is no publish button and no draft
 * state: a day is on the plan or it is not, and the date decides whether the day is past.
 *
 * THE GRID, in full. A day of the plan is in one cell of this grid and no other:
 *
 *   plan state     not planned (the server holds no menu for the date)
 *                  planned (the menu holds a dish in every slot)
 *                  partly planned (the menu holds an empty slot)
 *   date           past (the server refuses a write) | today | ahead
 *
 * The move between the cells is not a status change but a write: the dishes of the four slots,
 * or the existence of the record. The next best action is therefore declared per cell and per
 * empty state.
 *
 * THE RESIDENT IS PULLED, NOT PUSHED. No route of this module calls createNotification: the
 * plan reaches the resident when the portal reads GET /menus/today (menus.ts:43-49). The
 * notification is therefore not owed on this path and is declared as not required.
 */
export const MENUS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'planning what the kitchen cooks: filling the week so that every day carries a breakfast, a lunch and a dinner before the residents ask for it',
    doneLooksLike:
      'every day of the planned week carries its dishes, no day of the week is left empty for the residents to read, and the day that still misses a dish is named on the screen',
    primaryAction: 'Plan a day of meals',
  },
  stateMachine: {
    domain: 'menus',
    model: 'dailyMenu',
    kind: 'grid',
    // The menu model carries no status enum (apps/api/src/models/dailyMenu.ts:31-45), so there is
    // no status to declare here. The cells of the grid are written out above and in the next
    // best action map below: not planned, planned, partly planned, and the date that decides
    // whether the day is past.
    statuses: [],
  },
  truthContract: [
    {
      action: 'Plan a day of meals',
      operatorBelieves: 'the residents will see this menu on that day',
      serverCommits:
        'POST /menus writes one menu for the date with the dishes of each slot and writes a create audit log entry with the date (apps/api/src/routes/menus.ts:127-166). It refuses a date that is already past (422 PAST_DATE, :132-140) and refuses a second menu for a date that already has one (409 DUPLICATE_MENU, :155-165). The menu reaches the residents by pull, not by push: the portal reads GET /menus/today (apps/api/src/routes/menus.ts:43-49, mobile/lib/features/tenant/data/tenant_repository.dart:206-216). Nothing is sent to anybody, so a resident who never opens the app never learns the menu. The notification is therefore not owed on this path and is declared as not required.',
      notification: {
        to: 'tenant',
        type: 'announcement',
        required: false,
      },
      mismatchSurfacedAt:
        'the week planner shows the day filled; the residents see the menu on their next portal load, and a day with no menu shows them nothing',
      provenance: {
        auditAction: 'create',
        screen: '/menus/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the day is missing from the plan, so the residents read no menu at all for that day',
      runbook3am: 'open /menus and look at the days the band names as "days to plan"',
    },
    {
      action: 'Change a planned day',
      operatorBelieves: 'the residents see the corrected menu',
      serverCommits:
        'PUT /menus/:id rewrites the dishes of the four slots of that day and writes an update audit log entry with the date (apps/api/src/routes/menus.ts:179-244). It refuses a date that is already past (422 PAST_DATE, :184-195). The date in the body moves the menu to that day, and the move is refused when another menu already holds that date (409 DUPLICATE_MENU, :233-243). It sends no notification, so the correction reaches the residents only on their next portal load.',
      notification: {
        to: 'tenant',
        type: 'announcement',
        required: false,
      },
      mismatchSurfacedAt:
        'the day shows the corrected dishes; the residents see them on their next portal load',
      provenance: {
        auditAction: 'update',
        screen: '/menus/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the kitchen cooked the old plan and the screen shows the new one, with nothing in the trail but the audit entry to say when it changed',
      runbook3am: 'open /menus/[id] and read the day against what the kitchen served',
    },
    {
      action: 'Fill another day with a planned day',
      operatorBelieves: 'the other day now carries the same dishes',
      serverCommits:
        'PUT /menus/:id with the target date as the id writes the four slots of that day and creates the menu when the date carries none (the upsert by date, apps/api/src/routes/menus.ts:200-216). It refuses a date that is already past (422 PAST_DATE, :184-195) and writes an update audit log entry with the date. It overwrites the dishes of the target day without asking, so the office reads the target day first. It sends no notification.',
      notification: {
        to: 'tenant',
        type: 'announcement',
        required: false,
      },
      mismatchSurfacedAt:
        'the target day shows the copied dishes; the residents read it on their next portal load',
      provenance: {
        auditAction: 'update',
        screen: '/menus/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'two days carry the same dishes and the trail does not say which one was copied into which',
      runbook3am: 'open /menus/[id] and read the write trail of both days',
    },
    {
      action: 'Delete a day from the plan',
      operatorBelieves: 'the day is off the plan',
      serverCommits:
        'DELETE /menus/:id removes the menu of that date and writes a delete audit log entry with the date (apps/api/src/routes/menus.ts:246-279). It has no guard for a past date, so a day that has already been served can be deleted. It sends no notification: the residents who already read the menu are not told, and a resident who opens the portal on that day sees no menu at all.',
      notification: {
        to: 'tenant',
        type: 'announcement',
        required: false,
      },
      mismatchSurfacedAt:
        'the week planner shows the day as not planned again; the portal shows nothing for that date',
      provenance: {
        auditAction: 'delete',
        screen: '/menus/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the kitchen served a menu the plan no longer holds, and only the audit entry remembers it',
      runbook3am: 'open /menus/[id] and read the delete entry of the day',
    },
    {
      action: 'Read the week of the plan and the days that are still missing',
      operatorBelieves: 'the grid shows what the residents will eat and what is not planned yet',
      serverCommits:
        'GET /menus reads the date range of the week in view and returns the days it holds, sorted by the date, with the isActive flag derived from the business day (apps/api/src/routes/menus.ts:51-125, :33-41). The search matches a dish name across the four slots or an exact date and is not scoped to the week, so the page also names the days outside the week that matched (apps/api/src/routes/menus.ts:83-99). GET /menus/:id answers for a record and for a date (apps/api/src/routes/menus.ts:168-177). The server records no attendance: the model holds the date and the dishes and nothing else, so there is no answer to who ate.',
      mismatchSurfacedAt:
        'the band of the week planner names the scope of every number, and the day page says that the server holds no attendance',
      provenance: {
        screen: '/menus',
        actor: 'admin',
      },
      stuckStateMeans:
        'the grid shows a day as planned while the kitchen serves something else, and no record of what was served exists',
      runbook3am:
        'open /menus, read the week in the address bar, and compare the days with the kitchen sheet',
    },
  ],
  layout: {
    archetype: 'calendar',
    grammarTokens: [
      'PageBand',
      'StatusTabs',
      'StatusBadge',
      'FilterChips',
      'EmptyState',
      'PageHeader',
      'ErrorBanner',
      'Input',
      'Button',
      'FormPage',
      'FormCard',
      'FormActions',
      'FormSection',
      'DetailCard',
      'Timeline',
      'DatePicker',
    ],
    mustNotLookLike:
      'an attendance calendar: a cell of the grid is a menu with four slots and a dish, not a person, and the week is planned ahead rather than recorded',
    ownNumber:
      'the days of the week that still carry no menu, and the meal slots of the planned days that hold no dish',
  },
  nextBestAction: {
    perStatus: {
      planned: {
        label: 'Open the day',
        target: '/menus/[id]',
        enabledWhen: 'the day carries a menu and every one of its four slots holds a dish',
      },
      partly_planned: {
        label: 'Fill the gap',
        target: '/menus/[id]/edit',
        enabledWhen: 'the day carries a menu and at least one of its four slots holds no dish',
      },
      not_planned: {
        label: 'Plan the day',
        target: '/menus/new',
        enabledWhen: 'the server holds no menu for the date and the date is not past',
      },
      past: {
        label: 'Read the day',
        target: '/menus/[id]',
        enabledWhen: 'the date is past: the server refuses a write on it',
      },
    },
    perEmptyState: {
      menus: {
        label: 'Plan a day',
        target: '/menus/new',
        enabledWhen: 'the server holds no menu at all',
      },
      week_without_menu: {
        label: 'Plan the first day of the week',
        target: '/menus/new',
        enabledWhen: 'the week in view carries no menu',
      },
      no_day_matches: {
        label: 'Open the week',
        target: '/menus',
        enabledWhen: 'no day of the week matches the search',
      },
    },
  },
};
