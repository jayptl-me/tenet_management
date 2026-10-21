import type { ModuleContract } from './module';

/**
 * The washing machines contract.
 *
 * Every anchor below was read out of source on 2026-10-21, after the depth rebuild of the four
 * admin screens:
 *
 * - the model and its four states: apps/api/src/models/washingMachine.ts:37-41
 * - the routes: apps/api/src/routes/washingMachines.ts
 * - the claim: apps/api/src/routes/washingMachines.ts:330-434
 * - the release: apps/api/src/routes/washingMachines.ts:437-489
 * - the state write that clears the claim: apps/api/src/routes/washingMachines.ts:273-327
 * - the create, the floor check and the duplicate number: apps/api/src/routes/washingMachines.ts:219-270
 * - the delete and its refusal while a claim runs: apps/api/src/routes/washingMachines.ts:492-522
 * - the timer release that runs every minute: apps/api/src/jobs/scheduler.ts:227-250
 * - the claim history the office reads: apps/api/src/routes/audit.ts:13-52
 * - the admin screens: apps/web/src/app/(admin)/washing-machines
 *
 * A machine is a shared unit with a timer on it. The dwell of the running state is the machine
 * timer, which the resident chooses per claim between 10 and 180 minutes, so it is not a fixed
 * number of hours or days and no dwell is declared here.
 *
 * THE GRID, in full. A machine is in one cell of this grid and no other:
 *
 *   state      free to claim | running | in maintenance | down
 *   claim      nobody holds it | a resident holds it until the timer runs out
 *
 * The move between the cells is a write of the state, and every write of a state that is not the
 * running one clears the claim. The one state the office cannot write is the running one: a claim
 * is written by a resident and the server refuses a claim from anyone else.
 *
 * THE CHANNEL. The residents are pulled, not pushed. A resident reads the machine list of their own
 * floor right before they claim, the server refuses a claim on a machine that is not free to
 * claim, and the module sends no notification at all. That is why no truth entry below owes a
 * message.
 *
 * THE CODES. Only two refusals of this module reach the client with a code of their own:
 * FLOOR_NOT_FOUND (the floor does not exist) and MACHINE_IN_USE (the delete of a machine that is
 * running). Every other refusal travels as a conflict or a validation error with the message of
 * the route: "A machine with this number already exists on this floor", "Machine number already
 * taken on this floor", "You already have an active washing machine claim. Release it first.",
 * "This washing machine is already in use or unavailable", "This washing machine is not on your
 * floor", "No active tenant profile found", "Only tenants can claim a washing machine", "Machine is
 * not currently in use" and "You can only release your own claim"
 * (apps/api/src/lib/routeUtils.ts:18-30, apps/api/src/lib/errors.ts:40-80).
 */
export const WASHING_MACHINES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the machines usable: seeing floor by floor which are free, who is washing on them and which are broken, and acting on the ones that need it',
    doneLooksLike:
      'every machine reads free, running, in maintenance or down with the claim it actually holds, no machine stays running after its timer ran out, and the residents of a floor read the same list the office reads',
    primaryAction: 'Take a broken machine out of the pool, or release a claim that is stuck',
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
            'the tenant who claimed it or an admin releases the machine, which sets status=available and clears the claim (apps/api/src/routes/washingMachines.ts:437-489). An admin also writes the state with PUT /washing-machines/:id, which clears the claim the same way (apps/api/src/routes/washingMachines.ts:273-327), and a machine is created in this state (apps/api/src/routes/washingMachines.ts:219-270). The timer release does the same every minute for a claim whose timer ran out (apps/api/src/jobs/scheduler.ts:227-250)',
        },
      },
      {
        // Somebody is washing.
        status: 'in_use',
        enteredBy: {
          method: 'POST',
          path: '/washing-machines/:id/claim',
          condition:
            'a tenant on that floor claims a machine that still reads available; the claim stamps currentUserId, claimedAt, the timer duration and timerEndsAt and writes an update audit log entry (apps/api/src/routes/washingMachines.ts:330-434). The server refuses a claim from anyone but a tenant, a claim on another floor and a second claim from the same tenant, and the claim is atomic: it is written only while the machine still reads available',
        },
      },
      {
        // It is being fixed.
        status: 'under_maintenance',
        enteredBy: {
          method: 'PUT',
          path: '/washing-machines/:id',
          condition:
            'an admin marks a machine as under_maintenance; the handler clears any claim on the machine (apps/api/src/routes/washingMachines.ts:273-327). A machine can also be registered in this state (apps/api/src/routes/washingMachines.ts:219-270)',
        },
      },
      {
        // It is broken.
        status: 'down',
        enteredBy: {
          method: 'PUT',
          path: '/washing-machines/:id',
          condition:
            'an admin marks a machine as down and any claim on the machine is cleared (apps/api/src/routes/washingMachines.ts:273-327). A machine can also be registered in this state (apps/api/src/routes/washingMachines.ts:219-270)',
        },
      },
    ],
    // Nothing is a dead letter box: a machine can be put back into the pool.
  },
  truthContract: [
    {
      action: 'Read the machines of the building',
      operatorBelieves:
        'the board shows every machine of the building, with the state the server holds and the resident who holds it',
      serverCommits:
        'GET /washing-machines reads the floor and the state from the address bar, returns the machines with the label and the number of their floor and with the name, the room and the id of the resident who holds the machine, and returns the total of the whole filtered set, not of the page (apps/api/src/routes/washingMachines.ts:91-148). The server serves at most 100 machines in one page (apps/api/src/lib/routeUtils.ts:16), so the board draws the first 100 of the set and says so when the set is larger. The count behind every state tab is a second read of the same set with that state, so a tab count is the number of machines that tab would show. The minutes still running are the one number the client adds up, from the timers the server holds, and the label says that it covers the board.',
      mismatchSurfacedAt:
        'the board, the state tabs and the counts in the band all read the same set, and the notice under the band names the machines the board could not draw',
      provenance: {
        screen: '/washing-machines',
        actor: 'admin',
      },
      stuckStateMeans:
        'the board shows a machine as free while a claim is still on it, so the floor waits for a machine that is already booked',
      runbook3am:
        'open /washing-machines, read the address bar, and open the machine whose timer has run out',
    },
    {
      action: 'Register a machine',
      operatorBelieves:
        'the machine is on that floor and the residents of that floor can claim it from now on',
      serverCommits:
        'POST /washing-machines checks that the floor exists (FLOOR_NOT_FOUND), writes the machine with the number, the label, the length of a claim, the state and the notes, and writes a create audit log entry with the floor and the number (apps/api/src/routes/washingMachines.ts:219-270). The model refuses a second machine with the same number on the same floor (apps/api/src/models/washingMachine.ts:88) and the route answers that with a conflict and the message "A machine with this number already exists on this floor" (apps/api/src/routes/washingMachines.ts:259-268). The residents are not told: they read the machine list of their own floor, and a claim on a machine that is not free to claim is refused.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the board shows the new machine with its state; the resident meets it in their own machine list',
      provenance: {
        auditAction: 'create',
        screen: '/washing-machines/new',
        actor: 'admin',
      },
      stuckStateMeans:
        'the machine is on the floor but the residents never saw it, so nobody claims it and the office does not know whether the pool grew',
      runbook3am:
        'open /washing-machines and look for the machine on its floor; the create entry in the audit log says when it was written',
    },
    {
      action: 'Edit a machine',
      operatorBelieves:
        'the label, the number, the length of a claim or the notes of the machine are what the office said they are',
      serverCommits:
        'PUT /washing-machines/:id writes the fields the body carries and writes an update audit log entry with the body it wrote (apps/api/src/routes/washingMachines.ts:273-327). A change of the state is not in this entry: it is the next one, because a state write also clears the claim. A number that is already taken on that floor is refused with a conflict and the message "Machine number already taken on this floor" (apps/api/src/routes/washingMachines.ts:320-326). The residents are not told: they read the machine list of their own floor.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt: 'the machine page shows the record the server holds after the write',
      provenance: {
        auditAction: 'update',
        screen: '/washing-machines/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office believes the machine was changed and the residents were told, and neither happened: no message reached them and only the audit entry records the write',
      runbook3am:
        'open /washing-machines/[id], read the update entry in the audit log, and tell the residents of the floor by hand if the change matters to them',
    },
    {
      action: 'Change the state of a machine, to take it out of the pool or to put it back',
      operatorBelieves:
        'the machine is out of the pool or back in it, and the resident who held it knows',
      serverCommits:
        'PUT /washing-machines/:id writes the new state and clears the claim on the machine whenever the state is not the running one, so the claim of the resident ends with the write, and it writes an update audit log entry with the body (apps/api/src/routes/washingMachines.ts:273-327). It sends no notification. The machine list is the channel here: a resident reads the machine list of their own floor right before they claim, and a claim on a machine that is not free to claim is refused (apps/api/src/routes/washingMachines.ts:330-434). The notification is therefore declared as not required.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the board and the machine page show the new state the server holds; the resident meets the refusal when the claim is refused',
      provenance: {
        auditAction: 'update',
        screen: '/washing-machines/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the machine reads free while the claim is stuck on it, so the floor waits for a machine that is already booked',
      runbook3am:
        'open /washing-machines and look for the machines whose timer ended without a release',
    },
    {
      action: 'Release a claim',
      operatorBelieves: 'the machine is free again and the resident who held it knows it ended',
      serverCommits:
        'POST /washing-machines/:id/release refuses a machine that is not running (the message "Machine is not currently in use"), lets a tenant release only their own claim (the message "You can only release your own claim") and lets an admin release any claim, then sets the machine free, clears the claim and writes an update audit log entry (apps/api/src/routes/washingMachines.ts:437-489). It sends no notification: the resident sees the machine free the next time they open the app, and a timer that runs out is released by the scheduler, not by the resident (apps/api/src/jobs/scheduler.ts:227-250).',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the board and the machine page show the state the server returned; the resident sees it in their own machine list',
      provenance: {
        auditAction: 'update',
        screen: '/washing-machines/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the machine reads running with no timer, so nobody can take it and nobody is charged for it',
      runbook3am: 'open /washing-machines?status=in_use and release the claim by hand',
    },
    {
      action: 'Delete a machine',
      operatorBelieves: 'the machine is gone and the residents of the floor know',
      serverCommits:
        'DELETE /washing-machines/:id refuses while a claim runs on the machine (MACHINE_IN_USE), removes the record and writes a delete audit log entry with the number of the machine (apps/api/src/routes/washingMachines.ts:492-522). It sends no notification: the residents see the machine missing in their own list, and the machine number is free again on that floor.',
      notification: {
        to: 'tenant',
        type: 'service_update',
        required: false,
      },
      mismatchSurfacedAt:
        'the board no longer shows the machine; the resident sees it missing in their own list',
      provenance: {
        auditAction: 'delete',
        screen: '/washing-machines',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office believes the machine was deleted and the floor was told, and only the audit entry records it',
      runbook3am:
        'open /washing-machines and check the delete entry in the audit log of the machine',
    },
    {
      action: 'A resident claims a machine',
      operatorBelieves: 'the machine is theirs until the timer ends',
      serverCommits:
        'POST /washing-machines/:id/claim checks that the caller is a tenant, refuses a second claim from the same tenant (the message "You already have an active washing machine claim. Release it first.") and claims the machine atomically only when it still reads available (the message "This washing machine is already in use or unavailable"); it stamps currentUserId, claimedAt, the timer duration and timerEndsAt and writes an update audit log entry with the action, the tenant, the length and the end of the timer (apps/api/src/routes/washingMachines.ts:330-434). A timer that runs out is released by the scheduler, not by the resident (apps/api/src/jobs/scheduler.ts:227-250). The claim and the release are the history the office reads on the machine page, and the server keeps that trail for 90 days (apps/api/src/models/auditLog.ts:79-80).',
      mismatchSurfacedAt:
        'the board and the machine page show the claim and its timer; the resident sees the same on the portal',
      provenance: {
        auditAction: 'update',
        screen: '/washing-machines/[id]',
        actor: 'tenant',
      },
      stuckStateMeans:
        'the machine reads running with no timer, so nobody can take it and nobody is charged for it',
      runbook3am: 'open /washing-machines?status=in_use and release the claim by hand',
    },
  ],
  layout: {
    archetype: 'board',
    grammarTokens: [
      'PageBand',
      'StatusTabs',
      'FilterChips',
      'ResourceSelect',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'DetailCard',
      'ContentFrame',
      'Timeline',
      'FormPage',
      'FormCard',
      'ConfirmModal',
    ],
    mustNotLookLike:
      'a booking calendar: a machine is a physical unit on a floor with a timer on it, and the cell is the state of the machine, not a place in a queue',
    ownNumber:
      'the minutes of laundry still running, summed from the timers of the held machines on the board, with the machines free to claim beside it',
  },
  nextBestAction: {
    perStatus: {
      available: {
        label: 'Open the machine',
        target: '/washing-machines/[id]',
      },
      in_use: {
        label: 'Release the claim',
        target: '/washing-machines/[id]',
        enabledWhen: 'the claim is stuck or the timer has run out',
      },
      under_maintenance: {
        label: 'Bring it back to the pool',
        target: '/washing-machines/[id]',
        enabledWhen: 'the machine is fixed',
      },
      down: {
        label: 'Decide: repair or scrap it',
        target: '/washing-machines/[id]',
        enabledWhen: 'the machine is broken',
      },
    },
    perEmptyState: {
      washing_machines: {
        label: 'Register a machine',
        target: '/washing-machines/new',
      },
      no_machine_in_view: {
        label: 'Clear the filters',
        target: '/washing-machines',
      },
      in_use: {
        label: 'Open the free machines',
        target: '/washing-machines?status=available',
      },
      under_maintenance: {
        label: 'Open the machines that are broken',
        target: '/washing-machines?status=down',
      },
    },
  },
};
