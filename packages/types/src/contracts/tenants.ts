import type { ModuleContract } from './module';

/**
 * The tenants contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the four admin screens (2026-10-21, wave 6):
 *
 * - the model: apps/api/src/models/tenant.ts (no status field, see below)
 * - routes: apps/api/src/routes/tenants.ts
 * - the create transaction: apps/api/src/routes/tenants.ts:207-388
 * - the update transaction: apps/api/src/routes/tenants.ts:503-730
 * - the checkout transaction: apps/api/src/routes/tenants.ts:733-876
 * - the reinstate transaction: apps/api/src/routes/tenants.ts:888-1000
 * - the KYC verdict: apps/api/src/routes/tenants.ts:1232-1286
 * - the dues summary: apps/api/src/routes/tenants.ts:1808-1929
 * - the cascade delete: apps/api/src/routes/tenants.ts:1519-1681
 * - the admin screens: apps/web/src/app/(admin)/tenants
 *
 * THE TENANT MODEL HAS NO STATUS FIELD. Its lifecycle is two booleans and one nested flag:
 * isActive (checked in or checked out), documents.isVerified (KYC pending or verified) and the
 * room bed that carries the stay. The model enum the contract checker can read is empty, so the
 * state machine below declares no status and the grid is written out in the truth contract
 * instead. That is the code as it stands, not a contract that dodges the question.
 *
 * THE GRID, in full. The tenant record can be in one of these six states, and no others:
 *
 *   in_house_verified    isActive=true,  documents.isVerified=true
 *   in_house_waiting     isActive=true,  documents.isVerified=false, a document is uploaded
 *   in_house_incomplete  isActive=true,  documents.isVerified=false, no document is uploaded
 *   closed_verified      isActive=false, documents.isVerified=true
 *   closed_waiting       isActive=false, documents.isVerified=false, a document is uploaded
 *   closed_incomplete    isActive=false, documents.isVerified=false, no document is uploaded
 *
 * The move between them is not a status change but a write to one of the two fields, so the
 * next best action is declared per grid cell and per empty state.
 */
export const TENANTS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'putting residents in beds, proving who they are, collecting what they owe and closing their stay when they leave',
    doneLooksLike:
      'every bed is either taken by a named resident or marked free, every checked-in resident has a verified identity and a reachable phone number, and a checked-out resident has no open dues and no portal access',
    primaryAction: 'Check a resident in or out',
  },
  stateMachine: {
    domain: 'tenants',
    model: 'tenant',
    kind: 'grid',
    // The tenant model carries no status enum (apps/api/src/models/tenant.ts), so there is no
    // status to declare. The grid is:
    //   isActive=true          the resident occupies a bed
    //   isActive=false         the stay is closed, moveOutDate is stamped
    //   documents.isVerified   the identity documents were checked by an admin
    statuses: [],
  },
  truthContract: [
    {
      action: 'Check a resident in',
      operatorBelieves:
        'the resident has a bed, an account and a rent, and knows that the account exists',
      serverCommits:
        'POST /tenants creates the login with a temporary password (the user model hashes it on save, apps/api/src/models/user.ts:125-129) and returns it once in the create response, creates the tenant record with isActive=true and the move-in date, marks the chosen bed occupied with the tenant id, updates the room occupancy count, links the user to the tenant, marks the source enquiry converted when enquiryId is present, and writes a create audit log entry (apps/api/src/routes/tenants.ts:207-388). It refuses a bed that is already taken (BED_OCCUPIED), a room that is not active (ROOM_INACTIVE) and an email or a phone another account already uses (DUPLICATE_EMAIL, DUPLICATE_PHONE). It sends no notification: the resident is handed the temporary password out of band.',
      mismatchSurfacedAt:
        'the roster shows the resident with the room and the bed, the temp credentials dialog shows the password once, and the portal login is the only proof the account exists',
      provenance: {
        auditAction: 'create',
        screen: '/tenants/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the tenant row exists but the bed it points at is still marked free, so the occupancy count and the room disagree',
      runbook3am:
        'open /tenants/[id], read the room and bed, then compare them with the bed grid on /rooms/[id]',
    },
    {
      action: 'Check a resident out',
      operatorBelieves: 'the stay is closed, the bed is free and the resident has been told',
      serverCommits:
        'POST /tenants/:id/checkout refuses to run while an invoice still carries a balance (UNPAID_INVOICES; an invoice whose total the server does not know counts as a balance) or a payment is unresolved (UNRESOLVED_PAYMENTS), then in one transaction stamps moveOutDate, sets isActive=false, frees the bed, updates the room occupancy count, deactivates the login and deactivates the guardians, and writes a tenant_checkout audit log entry (apps/api/src/routes/tenants.ts:733-876). It sends no notification, and the notification path cannot reach a checked-out resident anyway: recipients are resolved with isActive=true (apps/api/src/services/notification.service.ts:50).',
      mismatchSurfacedAt:
        'the roster shows the resident as checked out and the room bed as free; the resident sees only that the portal login stopped working',
      provenance: {
        auditAction: 'tenant_checkout',
        screen: '/tenants/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the stay is closed but the bed still shows occupied, so occupancy and the rent roll disagree',
      runbook3am:
        'open /tenants/[id], read the tenant_checkout entry, then reconcile the bed on /rooms/[id]',
    },
    {
      action: 'Reinstate a checked-out resident',
      operatorBelieves: 'the resident is back on a bed and can log in again',
      serverCommits:
        'POST /tenants/:id/reinstate takes a free bed (or the same bed), sets isActive=true, clears moveOutDate, occupies the bed, updates the room occupancy count, reactivates the login and the guardians, and writes an audit log entry with details.reinstated=true (apps/api/src/routes/tenants.ts:888-1000). It sends no notification.',
      mismatchSurfacedAt: 'the roster shows the resident as in house again',
      provenance: {
        auditAction: 'update',
        screen: '/tenants/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the tenant row is active but the login is still deactivated, so the resident cannot get back in',
      runbook3am:
        'open /tenants/[id], read the reinstate entry, then try the login as the resident',
    },
    {
      action: 'Edit a resident',
      operatorBelieves: 'the resident now owes the new rent and knows about the change',
      serverCommits:
        'PUT /tenants/:id writes monthlyRent, depositPaid, moveInDate, the emergency contact, the verification profile and the user fields (name, email, phone) in one transaction, and moves the resident to another room or bed when one is given: the old bed is freed and the new one taken in the same transaction (apps/api/src/routes/tenants.ts:503-730). It refuses a transfer for a checked-out resident (TENANT_INACTIVE) and a bed that is taken (BED_OCCUPIED). It writes an audit log entry only when the room or the bed moved (action tenant_transfer); a rent or a contact change writes no audit entry at all. It sends no notification.',
      mismatchSurfacedAt:
        'the resident record and the next invoice, because the invoice is raised from the rent on the record; the invoices already issued keep their own amounts, and the resident sees the old rent until the next bill',
      provenance: {
        auditAction: 'tenant_transfer',
        screen: '/tenants/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office believes the rent was changed and the resident was told, and neither happened: the resident was never notified and no audit entry records the change',
      runbook3am:
        'open /tenants/[id], compare the rent on the record with the rent on the last invoice, and tell the resident the new number by hand',
    },
    {
      action: 'Verify the identity documents',
      operatorBelieves: 'the resident knows that their documents passed',
      serverCommits:
        'POST /tenants/:id/verify-kyc sets documents.isVerified and verifiedAt, writes an audit log entry with details.kycVerified=true and pushes a kyc_uploaded notification to the tenant user (apps/api/src/routes/tenants.ts:1232-1286). A failed push is logged and never undoes the verdict. The office screen only offers the verdict when both the identity document and the photo are on file; the server itself does not check.',
      notification: {
        to: 'tenant',
        type: 'kyc_uploaded',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the admin resident page shows the verified state, the resident gets the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/tenants/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the resident uploaded documents and no admin has looked at them, so the tenant sits unverified with no queue of its own',
      runbook3am:
        'open /tenants, look at the residents whose identity column reads Waiting, and verify the record the resident is waiting on',
    },
    {
      action: 'A resident uploads their own documents',
      operatorBelieves: 'somebody in the office will look at this',
      serverCommits:
        'POST /tenants/me/documents stores the file, flips documents.isVerified back to false so the office must review again, and pushes a kyc_uploaded notification to every active admin (apps/api/src/routes/tenants.ts:1182-1211). The notification is the only queue: there is no pending-review list in the admin app.',
      notification: {
        to: 'admin',
        type: 'kyc_uploaded',
        required: true,
      },
      mismatchSurfacedAt:
        'the admin notification bell carries the upload and links to the resident record',
      provenance: {
        auditAction: 'update',
        screen: '/tenants/[id]',
        actor: 'tenant',
      },
      stuckStateMeans:
        'the upload reached no admin and the resident waits for a verdict that nobody is queued to give',
      runbook3am: 'open /notifications, filter on kyc_uploaded, and verify the oldest upload',
    },
    {
      action: 'Read what a resident owes',
      operatorBelieves: 'the office and the resident are looking at the same amount',
      serverCommits:
        'GET /tenants/:id/dues and GET /tenants/me/dues call the same helper, buildDuesSummary, with the same record (apps/api/src/routes/tenants.ts:1808-1929). The summary holds the total still due across the open invoices, the remaining balance of each invoice, the electricity share, the deposit held and the count of the unresolved payments. A balance the server cannot compute is null and the invoice stays open: an unknown balance is outstanding, never zero. A checked-out resident carries no open invoice at all.',
      mismatchSurfacedAt:
        'the resident page shows the summary the resident reads, and the invoice ledger shows the same remaining balance per invoice',
      provenance: {
        screen: '/tenants/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the invoice ledger and the dues summary disagree, which means one of them was read from a stale copy',
      runbook3am:
        'open /tenants/[id] and compare the per invoice remaining balance with the balance on /invoices/[id]',
    },
    {
      action: 'Delete a resident',
      operatorBelieves: 'the record and everything attached to it is gone',
      serverCommits:
        'DELETE /tenants/:id deletes the payments, the invoices, the complaints, the visitors, the guardians, the laundry slots, the meal feedback, the attendance records and the leave applications of the resident, deletes the identity files from the storage, frees the bed, deactivates the login and empties its email and phone so the account can be re-created, removes the tenant record and writes a delete audit log entry with the counts (apps/api/src/routes/tenants.ts:1519-1681). It sends no notification and there is no undo.',
      mismatchSurfacedAt:
        'the roster no longer lists the resident and the bed is free again; the resident only sees that the portal login stopped working',
      provenance: {
        auditAction: 'delete',
        screen: '/tenants',
        actor: 'admin',
      },
      stuckStateMeans:
        'a payment or an invoice that referred to the resident has no resident any more, and the money trail is gone with the record',
      runbook3am:
        'open /audit-logs, filter on the delete entry of the tenant, and read the counts the server recorded',
    },
  ],
  layout: {
    archetype: 'roster',
    grammarTokens: [
      'DataTable',
      'StatusTabs',
      'FilterChips',
      'PageBand',
      'StatusBadge',
      'DetailCard',
      'EmptyState',
      'PageHeader',
      'ResourceSelect',
      'TenantStayCalendar',
      'DocumentUpload',
    ],
    mustNotLookLike:
      'a money ledger: a resident row is a person with a bed and an identity state, and the amount must never be the protagonist',
    ownNumber:
      'the residents who owe money and the free beds the server reports for the floor in view, with the identity state and the length of the stay named on every row',
  },
  nextBestAction: {
    perStatus: {
      in_house_verified: {
        label: 'Open the resident',
        target: '/tenants/[id]',
        enabledWhen: 'the resident is in house and the identity is verified',
      },
      in_house_waiting: {
        label: 'Verify the documents',
        target: '/tenants/[id]',
        enabledWhen:
          'the resident uploaded the identity document and the photo and no admin has verified them',
      },
      in_house_incomplete: {
        label: 'Ask for the missing document',
        target: '/tenants/[id]',
        enabledWhen: 'the identity document or the photo is still missing',
      },
      closed_verified: {
        label: 'Open the closed stay',
        target: '/tenants/[id]',
      },
      closed_waiting: {
        label: 'Verify the documents',
        target: '/tenants/[id]',
        enabledWhen: 'a checked-out resident still has an unverified document on file',
      },
      closed_incomplete: {
        label: 'Open the closed stay',
        target: '/tenants/[id]',
      },
    },
    perEmptyState: {
      tenants: {
        label: 'Check a resident in',
        target: '/tenants/new',
      },
      no_free_bed: {
        label: 'Open the floor map',
        target: '/rooms',
      },
      no_open_invoice: {
        label: 'Raise the first bill',
        target: '/invoices/new',
      },
      no_guardian: {
        label: 'Add a guardian',
        target: '/guardians/new',
      },
    },
  },
};
