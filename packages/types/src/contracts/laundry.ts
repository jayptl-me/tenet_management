import type { ModuleContract } from './module';

/**
 * The laundry contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/laundrySlot.ts:38
 * - routes: apps/api/src/routes/laundry.ts
 * - the booking guard and the capacity limit: apps/api/src/routes/laundry.ts:263-355
 * - the admin screens: apps/web/src/app/(admin)/laundry
 *
 * A laundry slot is a booked place in a shared machine queue. The clock is the
 * slot date and time, not a due date: the slot has to be used on the day it
 * was booked for.
 */
export const LAUNDRY_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the shared laundry slots fair: confirming the bookings, closing the ones that were used and freeing the ones that were not',
    doneLooksLike:
      'every booked slot was confirmed, used or cancelled, and no slot time carries more than five active bookings',
    primaryAction: 'Confirm or close a laundry slot',
  },
  stateMachine: {
    domain: 'laundry',
    model: 'laundrySlot',
    kind: 'ladder',
    statuses: [
      {
        // The resident booked a place.
        status: 'booked',
        enteredBy: {
          method: 'POST',
          path: '/laundry-slots',
          condition:
            'a tenant or an admin books a slot; the record lands with the model default booked (apps/api/src/models/laundrySlot.ts:38). The route refuses a date in the past and a slot time that already carries five active bookings (SLOT_FULL)',
        },
      },
      {
        // The office confirmed the place.
        status: 'confirmed',
        enteredBy: {
          method: 'PUT',
          path: '/laundry-slots/:id',
          condition: 'an admin confirms a booked slot',
        },
      },
      {
        // The laundry was done.
        status: 'completed',
        enteredBy: {
          method: 'PUT',
          path: '/laundry-slots/:id',
          condition: 'an admin closes a slot that was used',
        },
      },
      {
        // The place was given up.
        status: 'cancelled',
        enteredBy: {
          method: 'POST',
          path: '/laundry-slots/:id/cancel',
          condition:
            'the tenant owner or an admin gives the slot up; a completed slot cannot be cancelled (apps/api/src/routes/laundry.ts:478-500)',
        },
      },
    ],
    terminal: 'completed',
    // Nothing is a dead letter box: completed and cancelled can only be
    // reopened to booked (apps/api/src/routes/laundry.ts:366-378).
  },
  truthContract: [
    {
      action: 'Confirm a booked slot',
      operatorBelieves: 'the resident knows the place in the queue is theirs',
      serverCommits:
        'PUT /laundry-slots/:id writes the new status with the date, the time, the item count and the notes, and writes an update audit log entry with the status and the slot (apps/api/src/routes/laundry.ts:357-467). When the status moved to confirmed it then pushes a service_update notification to the tenant who booked the slot, resolved from the slot record itself, with the date and the time in the body (apps/api/src/routes/laundry.ts:91-131, :440-450). A failed push is logged and never undoes the write.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the laundry list shows the confirmed chip and the resident gets the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/laundry/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the slot is confirmed in the office and the resident never got the message, so they do not know when to bring the laundry',
      runbook3am:
        'open /laundry?status=booked, confirm the slots for tomorrow, and if the residents have no notification, tell them at the desk',
    },
    {
      action: 'The resident books a slot',
      operatorBelieves: 'the place is reserved and the office knows about it',
      serverCommits:
        'POST /laundry-slots forces the tenant to book for their own profile, refuses a date in the past, refuses a slot time that already carries five active bookings, writes the slot with the model default booked and writes a create audit log entry (apps/api/src/routes/laundry.ts:263-355). It sends no notification: the office sees the booking in the list, and the resident gets a message only when the slot is confirmed.',
      mismatchSurfacedAt: 'the laundry list shows the new booking',
      provenance: {
        auditAction: 'create',
        screen: '/laundry/[id]',
        actor: 'tenant',
      },
      stuckStateMeans:
        'the slot was booked and never confirmed, so the resident turns up at a machine that is taken',
      runbook3am: 'open /laundry?status=booked and confirm the oldest slots for today',
    },
  ],
  layout: {
    archetype: 'calendar',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'DatePicker',
      'ResourceSelect',
    ],
    mustNotLookLike:
      'an attendance calendar: a laundry cell is a booked place at a time, and the day is a queue of slots rather than a head count',
    ownNumber: 'slots booked for tomorrow',
  },
  nextBestAction: {
    perStatus: {
      booked: {
        label: 'Confirm the slot',
        target: '/laundry/[id]',
      },
      confirmed: {
        label: 'Close the slot',
        target: '/laundry/[id]',
        enabledWhen: 'the slot date has passed',
      },
      completed: {
        label: 'Read the slot',
        target: '/laundry/[id]',
      },
      cancelled: {
        label: 'Read the cancellation',
        target: '/laundry/[id]',
      },
    },
    perEmptyState: {
      laundry: {
        label: 'Book a slot',
        target: '/laundry/new',
      },
      booked: {
        label: 'Open the booking list',
        target: '/laundry?status=booked',
      },
    },
  },
};
