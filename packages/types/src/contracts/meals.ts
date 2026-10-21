import type { ModuleContract } from './module';

/**
 * The meals contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/mealFeedback.ts:40
 * - routes: apps/api/src/routes/meals.ts
 * - the resident feedback path: apps/api/src/routes/meals.ts:191-241
 * - the admin triage path: apps/api/src/routes/meals.ts:431-514
 * - the admin screens: apps/web/src/app/(admin)/meals
 *
 * Meal feedback is the resident rate of a meal. The resident leaves it, the
 * kitchen answers by acting on it, and the resident is waiting to hear that
 * something came of it.
 */
export const MEALS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'reading what the residents say about the food and closing the loop on the ones that were bad',
    doneLooksLike:
      'every feedback row is acknowledged or actioned, and the low ratings are the ones the kitchen worked on',
    primaryAction: 'Acknowledge or action a piece of feedback',
  },
  stateMachine: {
    domain: 'meals',
    model: 'mealFeedback',
    kind: 'ladder',
    statuses: [
      {
        // The resident rated the meal.
        status: 'submitted',
        enteredBy: {
          method: 'POST',
          path: '/meals/feedback',
          condition:
            'the resident submits a rating for a date and a meal; the record lands with the model default submitted (apps/api/src/models/mealFeedback.ts:40). A second rating for the same tenant, date and meal type resets the status to submitted so it reappears in the triage queue (apps/api/src/routes/meals.ts:160-171)',
        },
      },
      {
        // Somebody read it.
        status: 'acknowledged',
        enteredBy: {
          method: 'PUT',
          path: '/meals/:id',
          condition:
            'an admin acknowledges the feedback and writes an update audit log entry (apps/api/src/routes/meals.ts:373-430)',
        },
      },
      {
        // The kitchen did something about it.
        status: 'actioned',
        enteredBy: {
          method: 'PUT',
          path: '/meals/:id',
          condition: 'an admin marks the feedback as actioned',
        },
      },
    ],
    terminal: 'actioned',
    // Nothing is a dead letter box: a re-submitted rating resets the row to submitted.
  },
  truthContract: [
    {
      action: 'Acknowledge or action a piece of feedback',
      operatorBelieves: 'the resident who left the feedback knows the kitchen saw it',
      serverCommits:
        'PUT /meals/:id writes the new status with the fields the admin changed and writes an update audit log entry (apps/api/src/routes/meals.ts:431-514). When the status moved it then pushes a meal_feedback notification to the tenant who left the feedback, resolved from the feedback record itself, saying whether it was read or acted on (apps/api/src/routes/meals.ts:481-494). A failed push is logged and never undoes the write.',
      notification: {
        to: 'tenant',
        type: 'meal_feedback',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the meals list shows the new status chip and the resident gets the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/meals/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the feedback reads actioned and the resident never got the message, so they still do not know whether the food changed',
      runbook3am:
        'open /meals?status=submitted, read the low ratings first, and answer the resident directly',
    },
    {
      action: 'The resident rates a meal',
      operatorBelieves: 'the kitchen sees the rating',
      serverCommits:
        'POST /meals/feedback writes the rating, the categories and the comment for that tenant, date and meal type, and publishes a meal_feedback_submitted event on the event bus (apps/api/src/routes/meals.ts:191-241). It writes no notification: the office learns about it from the meals list and the dashboard, not from a message.',
      mismatchSurfacedAt:
        'the meals list and the dashboard feedback strip; the resident sees their own rating in the portal',
      provenance: {
        screen: '/meals/[id]',
        actor: 'tenant',
      },
      stuckStateMeans:
        'the rating was written but nobody triaged it, so it sits in submitted with no clock on it',
      runbook3am: 'open /meals?status=submitted and work the oldest rows',
    },
  ],
  layout: {
    archetype: 'ledger',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'FeedbackSummaryStrip',
      'StarRating',
      'Select',
    ],
    mustNotLookLike:
      'a menu planner: a feedback row is a resident rating a meal that already happened, and the stars are the protagonist',
    ownNumber: 'the mean rating of the last seven days',
  },
  nextBestAction: {
    perStatus: {
      submitted: {
        label: 'Acknowledge it',
        target: '/meals/[id]',
      },
      acknowledged: {
        label: 'Action it',
        target: '/meals/[id]',
      },
      actioned: {
        label: 'Read what was done',
        target: '/meals/[id]',
      },
    },
    perEmptyState: {
      meals: {
        label: 'Record a rating',
        target: '/meals/new',
      },
      submitted: {
        label: 'Open the triage queue',
        target: '/meals?status=submitted',
      },
    },
  },
};
