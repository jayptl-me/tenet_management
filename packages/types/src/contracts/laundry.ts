import type { ModuleContract } from './module';

/**
 * The laundry contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the four admin screens (2026-10-21, wave 6):
 *
 * - the statuses: apps/api/src/models/laundrySlot.ts:36-40
 * - the routes: apps/api/src/routes/laundry.ts
 * - the booking guard and the capacity of five places: apps/api/src/routes/laundry.ts:269-292
 * - the transition guard: apps/api/src/routes/laundry.ts:359-374
 * - the past date guard on every write: apps/api/src/routes/laundry.ts:376-381
 * - the one message the module sends: apps/api/src/routes/laundry.ts:434-443
 * - the page size the server clamps: apps/api/src/lib/routeUtils.ts:16
 * - the admin screens: apps/web/src/app/(admin)/laundry
 * - the resident screen: mobile/lib/features/tenant/presentation/laundry_screen.dart
 *
 * A laundry slot is a place in the queue of a shared machine at a date and a time. The clock of
 * the module is that slot time: a booking has to be confirmed before the slot it names, and the
 * slot is closed after the laundry is done.
 *
 * THE MODULE HOLDS NO MONEY. There is no charge, no rate and no invoice on a laundry slot, so no
 * number on these screens is a money number.
 */
export const LAUNDRY_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the queue of the shared machines fair: seeing which slot times are free, who holds the place, and closing the bookings that were used',
    doneLooksLike:
      'every booked slot was confirmed, used or given up, every resident who holds a place knows the time they have to come down, and no slot time carries more than the five places the server allows',
    primaryAction: 'Confirm the slot and tell the resident the time',
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
            'a tenant or the office books a place; the record lands with the model default booked (apps/api/src/models/laundrySlot.ts:36-40). The route refuses a date before its own today (INVALID_SLOT_DATE) and a slot time that already carries five bookings that are not cancelled (SLOT_FULL), and the model refuses a second booking by the same resident for the same date and time (apps/api/src/models/laundrySlot.ts:63)',
        },
        // The clock is the slot time. The office confirms the booking before
        // the slot it names, and the target is a day. A resident may book any
        // future date, so this is the target and not a guarantee.
        dwell: 24,
        dwellUnit: 'hours',
      },
      {
        // The office confirmed the place and the resident was told.
        status: 'confirmed',
        enteredBy: {
          method: 'PUT',
          path: '/laundry-slots/:id',
          condition:
            'an admin confirms a booked slot; the write pushes a service update to the resident who booked it, with the date and the time in the body (apps/api/src/routes/laundry.ts:434-443)',
        },
        // The clock is the slot time again: the slot is used at the date and
        // the time it names, and the office closes it after the laundry is
        // done. A confirmed slot that is never closed sits past its own clock,
        // and the server then refuses to close it.
        dwell: 24,
        dwellUnit: 'hours',
      },
      {
        // The laundry was done.
        status: 'completed',
        enteredBy: {
          method: 'PUT',
          path: '/laundry-slots/:id',
          condition:
            'an admin closes a slot that was used. The server refuses the whole write when the day of the slot has passed (INVALID_SLOT_DATE, apps/api/src/routes/laundry.ts:376-381), so a slot can only be closed on its own day or later',
        },
      },
      {
        // The place was given up.
        status: 'cancelled',
        enteredBy: {
          method: 'POST',
          path: '/laundry-slots/:id/cancel',
          condition:
            'the resident who booked it or the office gives the place up; the server refuses a completed slot (INVALID_TRANSITION) and an already cancelled one (SLOT_ALREADY_CANCELLED), and it frees the place at that time (apps/api/src/routes/laundry.ts:464-554). PUT /laundry-slots/:id can set the same status from a booked or a confirmed slot (apps/api/src/routes/laundry.ts:359-374, :411)',
        },
      },
    ],
    terminal: 'completed',
    // Nothing is a dead letter box: a closed slot can be reopened to booked
    // (apps/api/src/routes/laundry.ts:359-374).
  },
  truthContract: [
    {
      action: 'Confirm a booked slot',
      operatorBelieves: 'the resident knows the place in the queue is theirs and when to come down',
      serverCommits:
        'PUT /laundry-slots/:id writes the new status with the date, the time, the item count and the notes, and writes an update audit log entry with the status and the slot (apps/api/src/routes/laundry.ts:409-432). When the status moved to confirmed it then pushes a service_update notification to the tenant who booked the slot, resolved from the slot record itself, with the date and the time in the body (apps/api/src/routes/laundry.ts:91-125, :434-443). A failed push is logged and never undoes the write. The server refuses the write when the day of the slot has passed (apps/api/src/routes/laundry.ts:376-381), so a booking of an old day cannot be confirmed at all.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the laundry list shows the confirmed chip and the resident gets the notification in the portal. The page shows the message the server sent when the notification history holds it',
      provenance: {
        auditAction: 'update',
        screen: '/laundry/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the slot is confirmed in the office and the resident never got the message, so they do not know when to bring the laundry down',
      runbook3am:
        'open /laundry?status=booked, confirm the slots of the coming day, and if the residents have no notification, tell them at the desk',
    },
    {
      action: 'Close a slot that was used',
      operatorBelieves: 'the laundry is done and the place is free for the next resident',
      serverCommits:
        'PUT /laundry-slots/:id sets the status to completed and writes an update audit log entry (apps/api/src/routes/laundry.ts:409-432). It sends no message: the resident is not told that the slot was closed. It refuses the write when the day of the slot has passed (INVALID_SLOT_DATE, apps/api/src/routes/laundry.ts:376-381), so a slot of yesterday cannot be closed and stays confirmed until it is moved to today or later.',
      mismatchSurfacedAt:
        'the laundry list shows the closed chip and the audit trail of the slot carries the write; the resident sees nothing until they open the portal',
      provenance: {
        auditAction: 'update',
        screen: '/laundry/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the slot reads confirmed on a day that has passed, so the office cannot close it and the place at that time still counts against the five',
      runbook3am:
        'open /laundry?status=confirmed, find the slots whose day has passed, move them to today and close them',
    },
    {
      action: 'Give the place up',
      operatorBelieves: 'the place is free again and the resident knows the booking is off',
      serverCommits:
        'POST /laundry-slots/:id/cancel sets the status to cancelled and writes an update audit log entry with the role that cancelled it (apps/api/src/routes/laundry.ts:520-536). The place at that time is free again, because the server counts only the bookings that are not cancelled against the five (apps/api/src/routes/laundry.ts:276-280). It sends no message: the resident is not told.',
      mismatchSurfacedAt:
        'the laundry list shows the cancelled chip and the place count of that time drops; the resident sees the chip in the portal the next time they open it',
      provenance: {
        auditAction: 'update',
        screen: '/laundry/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the slot was cancelled in the office and the resident turns up with the laundry anyway, because nobody told them',
      runbook3am:
        'open /laundry?status=cancelled, read the cancel entry, and tell the residents of the cancelled slots by hand',
    },
    {
      action: 'Book a slot for a resident',
      operatorBelieves: 'the place is held and the resident knows their time',
      serverCommits:
        'POST /laundry-slots forces a tenant to book for their own profile, refuses a date before its own today, refuses a slot time that already carries five bookings that are not cancelled (SLOT_FULL), writes the slot with the model default booked and writes a create audit log entry (apps/api/src/routes/laundry.ts:257-331). It sends no notification: a resident who booked it in the portal already knows, and a slot the office books on their behalf reaches them only when the office confirms it. The server does not check the state of the resident, so it accepts a slot for a resident who has left.',
      mismatchSurfacedAt:
        'the laundry list shows the new booking; the resident is not told unless the office confirms it',
      provenance: {
        auditAction: 'create',
        screen: '/laundry/new',
        actor: 'admin',
      },
      stuckStateMeans:
        'the slot was booked and never confirmed, so the resident turns up at a machine that is taken, or never comes at all',
      runbook3am: 'open /laundry?status=booked and confirm the oldest bookings of the day',
    },
    {
      action: 'Edit a slot',
      operatorBelieves: 'the place moved or the note is fixed, and the resident knows',
      serverCommits:
        'PUT /laundry-slots/:id writes the date, the time, the item count, the note and the status, and writes an update audit log entry (apps/api/src/routes/laundry.ts:409-432). It refuses a second booking by the same resident for the same date and time (DUPLICATE_SLOT), a move out of a closed slot that does not land on booked (INVALID_TRANSITION) and any write whose day has passed (INVALID_SLOT_DATE). It pushes a message only when the status moves to confirmed; every other save here reaches nobody.',
      mismatchSurfacedAt:
        'the edit page names the save before it is made, and the resident sees the new state only when they open the portal',
      provenance: {
        auditAction: 'update',
        screen: '/laundry/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office believes the slot was moved and the resident was told, and neither happened: no message reached them and only the audit entry records the write',
      runbook3am:
        'open /laundry/[id], read the update entry in the write trail, and tell the resident by hand when the save moved their time',
    },
    {
      action: 'Delete a slot',
      operatorBelieves: 'the booking is off the books and the trail keeps the proof',
      serverCommits:
        'DELETE /laundry-slots/:id removes the record for good and writes a delete audit log entry with the date, the time and the status (apps/api/src/routes/laundry.ts:557-580). It is not a cancellation: the record of the booking is gone, the place at that time is free again, and the resident is not told.',
      mismatchSurfacedAt:
        'the slot is gone from the list and from the portal of the resident; only the delete entry in the audit log records that it was there',
      provenance: {
        auditAction: 'delete',
        screen: '/laundry',
        actor: 'admin',
      },
      stuckStateMeans:
        'the booking was deleted and the resident still holds a place they believe is theirs',
      runbook3am:
        'open /laundry and read the delete entries of the audit log for the slots of the day that are missing',
    },
    {
      action: 'Read the queue of a day',
      operatorBelieves: 'the numbers on the screen are the numbers of the day they are looking at',
      serverCommits:
        'GET /laundry-slots reads the status, the day and the resident out of the address bar and returns the slots with the name of the resident, the room, the bed and the floor of every one of them (apps/api/src/routes/laundry.ts:128-230). The server serves at most 100 slots in one page (apps/api/src/lib/routeUtils.ts:16), so the places of a slot time and the counts behind the tabs are read by walking the pages of the set. The places of a slot time are counted the way the server counts them: every booking that is not cancelled holds a place (apps/api/src/routes/laundry.ts:274-292).',
      mismatchSurfacedAt:
        'the band names the scope of every number, and the legend says what the places count and what the status filter does not change',
      provenance: {
        screen: '/laundry',
        actor: 'admin',
      },
      stuckStateMeans:
        'the queue of the screen and the places of the band cover different sets, so the free places and the rows do not agree',
      runbook3am:
        'open /laundry, read the address bar, and compare the free places of the busiest time with the rows of that time',
    },
  ],
  layout: {
    archetype: 'calendar',
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
      'DatePicker',
      'ResourceSelect',
      'Select',
      'Input',
      'Textarea',
      'TableActions',
      'ConfirmModal',
      'ErrorBanner',
      'FormSection',
      'FormPage',
      'FormCard',
    ],
    mustNotLookLike:
      'an attendance calendar or a payments ledger: a laundry row is a place in a queue at a time, the day is a set of slot times and the number that matters is the load of a time against the five places the server allows',
    ownNumber:
      'the busiest slot time of the set: the places it takes of the five the server allows, and the places still free there',
  },
  nextBestAction: {
    perStatus: {
      booked: {
        label: 'Confirm the slot',
        target: '/laundry/[id]',
        enabledWhen: 'the day of the slot has not passed: the server refuses the write once it has',
      },
      confirmed: {
        label: 'Close the slot as used',
        target: '/laundry/[id]',
        enabledWhen:
          'the day of the slot has not passed: the server refuses the write once it has, so a slot of yesterday has to be moved first',
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
      filtered_view: {
        label: 'Clear the filters',
        target: '/laundry',
      },
      booked: {
        label: 'Open the bookings to confirm',
        target: '/laundry?status=booked',
      },
    },
  },
};
