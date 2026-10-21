import type { ModuleContract } from './module';

/**
 * The guardians contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the four admin screens (wave 6 of the depth program):
 *
 * - the model: apps/api/src/models/guardian.ts (no status field, see below)
 * - the routes: apps/api/src/routes/guardians.ts
 * - the create transaction: apps/api/src/routes/guardians.ts:112-238
 * - the update and the user sync: apps/api/src/routes/guardians.ts:470-526
 * - the deactivate: apps/api/src/routes/guardians.ts:529-564
 * - the dues summary the guardian reads: apps/api/src/routes/guardians.ts:323-366
 * - the dues summary the office reads: apps/api/src/routes/tenants.ts:1808-1929
 * - the check out that deactivates the guardians: apps/api/src/routes/tenants.ts:827-843
 * - the money helper both summaries use: apps/api/src/services/payment-status.service.ts:78-93
 * - the admin screens: apps/web/src/app/(admin)/guardians
 *
 * THE GUARDIAN MODEL HAS NO STATUS FIELD. Its only flag is isActive: a guardian is either
 * reachable by the office or not. A tenant checkout deactivates the guardians of that tenant as
 * well (apps/api/src/routes/tenants.ts:827-843).
 *
 * THE GRID, in full. The guardian record can be in one of these four cells, and no others. The
 * second axis is the ward: the resident the guardian pays for, whose own stay is open or over.
 * Both axes are already in the list response, because the mapper puts the resident and the
 * resident's own flag on the row (apps/api/src/routes/guardians.ts:68-104):
 *
 *   active_ward_in_house      isActive=true,  the resident is in house
 *   active_ward_stay_over      isActive=true,  the resident's stay is over
 *   off_ward_in_house          isActive=false, the resident is in house   <- nobody can call
 *   off_ward_stay_over         isActive=false, the resident's stay is over
 *
 * The move between them is not a status change but a write to isActive (or to the resident's own
 * isActive, which the check out does), so the next best action is declared per grid cell and per
 * empty state.
 *
 * THIS IS THE MONEY MODULE OF THE HOUSEHOLD SIDE: a guardian is the person who pays for
 * someone. The money belongs to the invoice and the payment modules, and the office reads it
 * through the ward's dues summary, which is built from the same money helper the guardian's own
 * summary uses (the two summaries are two functions, and the open gap GU-D3-2 in
 * docs/audit/features/guardians.md names where they differ). What this module owns is the
 * contact, the ward it stands behind and the reach of that contact.
 */
export const GUARDIANS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'keeping the people who stand behind a resident reachable, and answering the one question about money that matters here: whose money is this and what is owed',
    doneLooksLike:
      'every resident who has a guardian has one live contact with a phone number that works, every guardian in view names the resident they pay for and what that resident owes, and a contact that was switched off says so on the row',
    primaryAction: 'Add or fix the contact of a resident',
  },
  stateMachine: {
    domain: 'guardians',
    model: 'guardian',
    kind: 'grid',
    // The guardian model carries no status enum (apps/api/src/models/guardian.ts), so there is no
    // status to declare. The grid is:
    //   isActive=true   the contact is live and the portal login of that person works
    //   isActive=false  the contact was switched off and the login does not work
    //   ward.isActive   the stay of the resident the contact pays for is open or over
    statuses: [],
  },
  truthContract: [
    {
      action: 'Add a guardian',
      operatorBelieves:
        'the guardian can reach the resident from the portal, and the resident knows that a guardian stands behind them',
      serverCommits:
        'POST /guardians creates a User with the role guardian and a temporary password, creates the guardian record linked to the resident with isActive=true, points the user at the guardian, and writes a create audit log entry (apps/api/src/routes/guardians.ts:112-238). It refuses a resident the server does not hold (TENANT_NOT_FOUND) and a phone or an email another account already uses (DUPLICATE_USER, 409). It sends no notification to anybody: the guardian and the resident are both told nothing, and the temporary password comes back once, in the create response, for the office to hand over. Nothing of the resident is written: the resident keeps their own login, their own bills and their own dues view. The guardian portal itself is behind the guardianPortalEnabled feature flag (apps/api/src/routes/guardians.ts:109).',
      mismatchSurfacedAt:
        'the guardians list shows the contact with its ward, the temp credentials dialog shows the password once, and the only proof that the guardian can reach the ward is that they sign in',
      provenance: {
        auditAction: 'create',
        screen: '/guardians/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the guardian record exists but nobody has the temporary password, so the ward cannot be reached in an emergency',
      runbook3am:
        'open /guardians, filter on the resident, and check that every contact has a phone number that works',
    },
    {
      action: 'Change the contact',
      operatorBelieves:
        'the new phone number, the new email and the new relation are what the guardian and the resident will see from now on',
      serverCommits:
        'PUT /guardians/:id writes the name, the phone, the email, the relation and the active flag on the guardian record, writes the same name, phone, email and active flag onto the linked portal login, and writes an update audit log entry with the list of the fields it changed (apps/api/src/routes/guardians.ts:470-526). It cannot move a guardian to another resident: the update schema holds no resident field (apps/api/src/routes/guardians.ts:48-58) and the form keeps the link fixed. It sends no notification, so the guardian and the resident are not told that the contact changed.',
      mismatchSurfacedAt:
        'the guardians list shows the new contact, and the portal login of the guardian carries the same name, phone and email',
      provenance: {
        auditAction: 'update',
        screen: '/guardians/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office believes the number changed and the guardian still gets the old one on their phone, because the login and the record were written apart',
      runbook3am:
        'open /guardians/[id], read the update entry, and compare the phone on the record with the phone the guardian signs in with',
    },
    {
      action: 'Deactivate a guardian',
      operatorBelieves: 'the contact is closed, the office knows it and the person knows it',
      serverCommits:
        'DELETE /guardians/:id keeps the record, sets isActive=false, switches the portal login of that person off, and writes a delete audit log entry with the name and the resident (apps/api/src/routes/guardians.ts:529-564). It sends no notification, and the notification path could not reach them anyway: recipients are resolved with isActive=true (apps/api/src/services/notification.service.ts:50).',
      mismatchSurfacedAt:
        'the guardians list shows the contact as switched off, and the portal login of that person stops working',
      provenance: {
        auditAction: 'delete',
        screen: '/guardians/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the contact is off but the resident page still shows them as the emergency contact of a resident who lives here',
      runbook3am:
        'open /guardians, filter on the switched off ones, and check the resident each one stands behind',
    },
    {
      action: 'Reactivate a guardian',
      operatorBelieves: 'the contact can reach the ward again',
      serverCommits:
        'PUT /guardians/:id with isActive=true sets the flag back on the record and on the portal login, and writes an update audit log entry (apps/api/src/routes/guardians.ts:470-526). It sends no notification, so the person does not know that the login works again until they try it.',
      mismatchSurfacedAt: 'the guardians list shows the contact as reachable again',
      provenance: {
        auditAction: 'update',
        screen: '/guardians/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the record is live again but the login is still off, so the guardian signs in and is refused',
      runbook3am: 'open /guardians/[id], read the update entry, and try the login as the guardian',
    },
    {
      action: 'Read what the ward owes',
      operatorBelieves: 'the office and the guardian are looking at the same money',
      serverCommits:
        'the office reads GET /tenants/:id/dues, which calls buildDuesSummary (apps/api/src/routes/tenants.ts:1808-1929): the total still due across the open invoices, the remaining balance of each invoice, the electricity share, the deposit held and the count of the unresolved payments. The guardian reads GET /guardians/me/ward, which computes the same summary in its own function (apps/api/src/routes/guardians.ts:323-366). Both go through the one money helper (apps/api/src/services/payment-status.service.ts:78-93), so the balance of an invoice is the same number on both sides. The two are not the same function: the guardian total adds the whole total of an invoice whose balance the server cannot compute, the office total leaves that amount out of the sum and keeps the invoice in the open list. A balance the server cannot compute is outstanding, never zero.',
      mismatchSurfacedAt:
        'the guardian page shows the summary and the invoices behind it with the balance of each, and the ledger shows the same balance per invoice',
      provenance: {
        screen: '/guardians/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office and the guardian quote different totals, which means one of them read a stale copy or the unknown invoice case',
      runbook3am:
        'open /guardians/[id] and compare the total with the per invoice balance on /invoices/[id]',
    },
    {
      action: 'A resident checks out',
      operatorBelieves: 'the stay is over, so the contact of that resident is no longer needed',
      serverCommits:
        'POST /tenants/:id/checkout flips every guardian of that resident to isActive=false and switches their portal logins off, in the same transaction as the check out (apps/api/src/routes/tenants.ts:827-843). It sends no notification, so neither the resident nor the person who pays is told that the contact was switched off.',
      mismatchSurfacedAt:
        'the guardians list shows the contact as switched off, and the resident page shows the stay is over',
      provenance: {
        auditAction: 'tenant_checkout',
        screen: '/tenants/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the contact of a resident who still lives here is switched off and nobody was told',
      runbook3am:
        'open /guardians, filter on the switched off ones, and check whether the resident still lives here',
    },
  ],
  layout: {
    archetype: 'roster',
    grammarTokens: [
      'DataTable',
      'PageBand',
      'FilterChips',
      'PageHeader',
      'StatusBadge',
      'EmptyState',
      'ErrorBanner',
      'ConfirmModal',
      'TableActions',
      'ResourceSelect',
      'Select',
      'Input',
      'DetailCard',
      'FormCard',
      'FormActions',
      'FormSection',
      'Button',
      'Checkbox',
      'TempCredentialsDialog',
      'TenantStayCalendar',
    ],
    mustNotLookLike:
      'the tenant roster: a guardian row is the payer beside a resident, the resident is not the protagonist here, and the money is shown as what the ward owes, never as a bill of this module',
    ownNumber:
      'the payers behind the residents in view: how many of their wards the server says owe money, and how many owe nothing',
  },
  nextBestAction: {
    perStatus: {
      active_ward_in_house: {
        label: 'Open the contact',
        target: '/guardians/[id]',
        enabledWhen: 'the contact is live and the resident still lives here',
      },
      active_ward_stay_over: {
        label: 'Open the contact',
        target: '/guardians/[id]',
        enabledWhen: 'the contact is live but the stay of the resident is over',
      },
      off_ward_in_house: {
        label: 'Switch the contact back on',
        target: '/guardians/[id]/edit',
        enabledWhen: 'the contact is off while the resident still lives here',
      },
      off_ward_stay_over: {
        label: 'Open the record',
        target: '/guardians/[id]',
      },
    },
    perEmptyState: {
      guardians: {
        label: 'Add a guardian',
        target: '/guardians/new',
      },
      no_match: {
        label: 'Clear the filters',
        target: '/guardians',
      },
      ward: {
        label: 'Add a guardian for this resident',
        target: '/guardians/new',
      },
      no_open_invoice: {
        label: 'Open the resident',
        target: '/tenants/[id]',
      },
      no_ward: {
        label: 'Open the guardian record',
        target: '/guardians/[id]',
      },
    },
  },
};
