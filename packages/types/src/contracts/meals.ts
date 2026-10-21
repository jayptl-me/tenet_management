import type { ModuleContract } from './module';

/**
 * The meals contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the four admin screens (2026-10-21, wave 6):
 *
 * - the statuses: apps/api/src/models/mealFeedback.ts:38-42
 * - the unique record: the resident, the day and the meal (apps/api/src/models/mealFeedback.ts:69)
 * - the routes: apps/api/src/routes/meals.ts
 * - the resident feedback path: apps/api/src/routes/meals.ts:191-240
 * - the office path: apps/api/src/routes/meals.ts:141-188 (record), :431-513 (answer), :516-538
 *   (delete)
 * - the message the resident is sent: apps/api/src/routes/meals.ts:479-493
 * - the rollup the server computes: apps/api/src/routes/meals.ts:243-282
 * - the write trail: apps/api/src/routes/audit.ts:13-52
 * - the admin screens: apps/web/src/app/(admin)/meals
 *
 * MEAL FEEDBACK IS A LADDER OF THREE STATES. The resident rates a meal, the office reads the
 * rating and the kitchen acts on it. Nothing else moves the record: a second rating for the same
 * resident, day and meal replaces the first and puts the record back at the bottom of the ladder.
 *
 * NO DWELL IS DECLARED, AND THAT IS A FINDING. The model keeps createdAt and turns updatedAt off
 * (apps/api/src/models/mealFeedback.ts:55), so the record carries no stamp of the moment it was
 * read or actioned. The age of a rating cannot be read from the record, and the write trail that
 * holds the time of the office's writes expires after 90 days. The dwell is a product decision
 * that the code does not make, so it is not written here as if it did.
 */
export const MEALS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'reading what the residents said about the food, and closing the loop on the ratings that were bad',
    doneLooksLike:
      'every rating that was read has been read, the low ones have been actioned, and the resident who left each rating was told what the office did with it',
    primaryAction: 'Acknowledge or action a rating, from where it stands',
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
            'the resident submits a rating for a day and a meal; the record lands with the model default submitted (apps/api/src/models/mealFeedback.ts:38-42, apps/api/src/routes/meals.ts:191-240). A second rating for the same resident, day and meal replaces the first and resets the status to submitted, so it returns to the triage queue (apps/api/src/routes/meals.ts:218-228). The office records a rating on the resident behalf the same way (apps/api/src/routes/meals.ts:158-168)',
        },
      },
      {
        // Somebody read it and the resident was told.
        status: 'acknowledged',
        enteredBy: {
          method: 'PUT',
          path: '/meals/:id',
          condition:
            'an admin writes the status acknowledged; the server writes the status and an update audit log entry, and pushes a meal_feedback message to the resident who left the rating (apps/api/src/routes/meals.ts:462-493). The message is sent only when the status actually moved',
        },
      },
      {
        // The kitchen did something about it and the resident was told.
        status: 'actioned',
        enteredBy: {
          method: 'PUT',
          path: '/meals/:id',
          condition:
            'an admin writes the status actioned; the server writes the status and an update audit log entry, and pushes a meal_feedback message that says the office has acted on the feedback (apps/api/src/routes/meals.ts:462-493)',
        },
      },
    ],
    terminal: 'actioned',
    // Nothing is a dead letter box: a rating the resident leaves again, or the office records
    // again, resets the record to submitted and it returns to the queue.
  },
  truthContract: [
    {
      action: 'Acknowledge a rating',
      operatorBelieves: 'the resident who left the rating knows that the office read it',
      serverCommits:
        'PUT /meals/:id writes the status, writes an update audit log entry with the fields that moved and pushes a meal_feedback message to the resident who left the rating, resolved from the rating record itself (apps/api/src/routes/meals.ts:462-493). The message reads "We have read your feedback about the <meal> on <day>." A push that fails is logged and never undoes the write, and the server does not report a failed push back to the office.',
      notification: {
        to: 'tenant',
        type: 'meal_feedback',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the list shows the new state and the resident reads the message in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/meals/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the rating reads acknowledged and the resident never got the message, so they still do not know whether the food changed',
      runbook3am:
        'open /meals?status=acknowledged, read the write trail of the rating, and answer the resident by hand',
    },
    {
      action: 'Mark a rating actioned',
      operatorBelieves: 'the kitchen did something about the rating and the resident knows it',
      serverCommits:
        'PUT /meals/:id writes the status, writes an update audit log entry with the fields that moved and pushes a meal_feedback message to the resident who left the rating (apps/api/src/routes/meals.ts:462-493). The message reads "We have acted on your feedback about the <meal> on <day>." The server records the status change; it does not record what the kitchen actually changed, so the write trail proves the answer was given and not what it was',
      notification: {
        to: 'tenant',
        type: 'meal_feedback',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the list shows the new state, the write trail shows who wrote it and when, and the resident reads the message in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/meals/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the rating reads actioned, the resident was told, and nobody wrote down what the kitchen did, so the answer cannot be repeated to the next resident',
      runbook3am:
        'open /meals?status=actioned, read the write trail, and write the kitchen change into the rating comment so the next office can see it',
    },
    {
      action: 'Edit a rating',
      operatorBelieves: 'the rating now says what really happened',
      serverCommits:
        'PUT /meals/:id writes the rating, the comment, the categories and the meal that the body carries, and writes an update audit log entry with them (apps/api/src/routes/meals.ts:462-477). It refuses a meal type that collides with another rating of the same resident on the same day (DUPLICATE_FEEDBACK, apps/api/src/routes/meals.ts:496-511). It pushes a message to the resident only when the status moved in the same write (apps/api/src/routes/meals.ts:481-493), so rewriting the words of a resident tells them nothing',
      mismatchSurfacedAt:
        'the rating page shows the new words and the write trail shows the fields that moved; the resident sees nothing unless the status moved',
      provenance: {
        auditAction: 'update',
        screen: '/meals/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office rewrote what a resident said and the resident still reads their own words in the portal, so the two records disagree',
      runbook3am:
        'open /meals/[id], read the update entry in the write trail, and tell the resident what the office changed',
    },
    {
      action: 'Record a rating on the resident behalf',
      operatorBelieves: 'the rating of that resident is now on the record',
      serverCommits:
        'POST /meals upserts the rating for that resident, day and meal, resets the status to submitted and writes a create audit log entry with the resident, the day, the meal and the rating (apps/api/src/routes/meals.ts:141-188). It refuses a day that has not happened yet (FUTURE_DATE_INVALID) and a resident the server does not know. It sends no message: the resident is not told that the office wrote a rating in their name, and a rating they had already left for that day and meal is replaced by this one',
      notification: {
        to: 'tenant',
        type: 'meal_feedback',
        required: false,
      },
      mismatchSurfacedAt:
        'the list shows the new rating as submitted, and the resident sees it in their portal as their own rating',
      provenance: {
        auditAction: 'create',
        screen: '/meals/new',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office wrote a rating for a resident and the resident never heard of it, so the record holds a voice that is not theirs',
      runbook3am:
        'open /meals/new, record the rating the office actually heard, and tell the resident by hand',
    },
    {
      action: 'Delete a rating',
      operatorBelieves: 'the rating is gone and the office is rid of it',
      serverCommits:
        'DELETE /meals/:id removes the record and writes a delete audit log entry with the day, the meal and the rating (apps/api/src/routes/meals.ts:516-538). The comment is not kept anywhere: the entry holds the number, not the words. The resident is not told, and the rating disappears from their portal',
      notification: {
        to: 'tenant',
        type: 'meal_feedback',
        required: false,
      },
      mismatchSurfacedAt:
        'the rating is gone from the list and from the portal; only the delete entry in the write trail is left',
      provenance: {
        auditAction: 'delete',
        screen: '/meals/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the rating was deleted for a reason nobody wrote down, and the resident still believes they said it',
      runbook3am:
        'open the write trail of the rating, read the delete entry, and tell the resident why it is gone',
    },
    {
      action: 'Read the ledger of ratings',
      operatorBelieves:
        'the numbers on the screen are the numbers of the ratings they are looking at',
      serverCommits:
        'GET /meals/feedback reads the filters of the address bar (day, meal, status, rating, the name of the resident) and returns the rows with the resident, the room and the bed (apps/api/src/routes/meals.ts:319-401). The average of a meal service is computed by the server, which groups the ratings of a day and a service and averages them (apps/api/src/routes/meals.ts:243-282); the screen shows that number and never averages anything again. The server serves at most 100 rows in one page (apps/api/src/lib/routeUtils.ts:16), and its rollup cannot be filtered by status, by meal or by resident',
      mismatchSurfacedAt:
        'the band of the list names the scope of every number, and the legend says what the rollup covers and what it does not',
      provenance: {
        screen: '/meals',
        actor: 'admin',
      },
      stuckStateMeans:
        'the ratings in the band and the rows on the table cover different sets, so the average of the day and the rows of the ledger do not agree',
      runbook3am:
        'open /meals, read the address bar, and compare the rating of the day in the band with the rows of the table',
    },
    {
      action: 'The resident rates a meal',
      operatorBelieves: 'the kitchen sees the rating',
      serverCommits:
        'POST /meals/feedback writes the rating, the categories and the comment for that resident, day and meal, and publishes a meal_feedback_submitted event on the event bus (apps/api/src/routes/meals.ts:191-240). It writes no notification and no audit log entry: the office learns about the rating from the list and the dashboard, not from a message, and the write trail of the rating starts with the office first write',
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
      'PageBand',
      'StatusTabs',
      'FilterChips',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'DetailCard',
      'ContentFrame',
      'StarRating',
      'Select',
      'DatePicker',
      'FormPage',
      'FormCard',
    ],
    mustNotLookLike:
      'a menu planner: a row is a resident rating a meal that already happened, the stars are the protagonist and the numbers are the ratings the server computed',
    ownNumber:
      'the average rating the server reports for a meal service of the day in view, with the number of residents who rated it',
  },
  nextBestAction: {
    perStatus: {
      submitted: {
        label: 'Acknowledge it',
        target: '/meals/[id]',
        enabledWhen: 'the office has not read the rating yet',
      },
      acknowledged: {
        label: 'Action it',
        target: '/meals/[id]',
        enabledWhen: 'the office has read the rating and the kitchen has not acted on it',
      },
      actioned: {
        label: 'Read what was done',
        target: '/meals/[id]',
        enabledWhen: 'the kitchen has acted on the rating',
      },
    },
    perEmptyState: {
      feedback: {
        label: 'Record a rating',
        target: '/meals/new',
      },
      filtered: {
        label: 'Clear the filters',
        target: '/meals',
      },
      queue: {
        label: 'See every rating',
        target: '/meals',
      },
    },
  },
};
