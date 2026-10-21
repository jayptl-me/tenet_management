import type { ModuleContract } from './module';

/**
 * The tenants contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - the model: apps/api/src/models/tenant.ts (no status field, see below)
 * - routes: apps/api/src/routes/tenants.ts
 * - the checkout transaction: apps/api/src/routes/tenants.ts:733-885
 * - the reinstate transaction: apps/api/src/routes/tenants.ts:888-1001
 * - the KYC verdict: apps/api/src/routes/tenants.ts:1232-1287
 * - the admin screens: apps/web/src/app/(admin)/tenants
 *
 * THE TENANT MODEL HAS NO STATUS FIELD. Its lifecycle is two booleans and one
 * nested flag: isActive (checked in or checked out), documents.isVerified (KYC
 * pending or verified) and the room bed that carries the stay. The model enum
 * the contract checker can read is empty, so the state machine below declares
 * no status and the grid is written out in the truth contract instead. That is
 * the code as it stands, not a contract that dodges the question.
 */
export const TENANTS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'putting residents in beds, proving who they are, and closing their stay when they leave',
    doneLooksLike:
      'every bed is either taken by a named resident or marked free, every checked-in resident has a verified identity, and a checked-out resident has no open dues and no portal access',
    primaryAction: 'Check a resident in or out',
  },
  stateMachine: {
    domain: 'tenants',
    model: 'tenant',
    kind: 'grid',
    // The tenant model carries no status enum (apps/api/src/models/tenant.ts),
    // so there is no status to declare. The grid is:
    //   isActive=true          the resident occupies a bed
    //   isActive=false         the stay is closed, moveOutDate is stamped
    //   documents.isVerified   the identity documents were checked by an admin
    statuses: [],
  },
  truthContract: [
    {
      action: 'Check a resident in',
      operatorBelieves: 'the resident has a bed, an account and a rent',
      serverCommits:
        'POST /tenants creates the login with a temporary password, creates the tenant record with isActive=true and the move-in date, marks the chosen bed occupied and writes an audit log entry (apps/api/src/routes/tenants.ts:207-389). It refuses a bed that is already taken (BED_OCCUPIED). It sends no notification: the resident is handed the temporary password out of band.',
      mismatchSurfacedAt:
        'the tenants list shows the resident with the room and bed, and the portal login is the only proof the account exists',
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
        'POST /tenants/:id/checkout refuses to run while an invoice still carries a balance (UNPAID_INVOICES) or a payment is unresolved (UNRESOLVED_PAYMENTS), then in one transaction stamps moveOutDate, sets isActive=false, frees the bed, deactivates the login and deactivates the guardians, and writes a tenant_checkout audit log entry (apps/api/src/routes/tenants.ts:733-885). It sends no notification, and the notification path cannot reach a checked-out resident anyway: recipients are resolved with isActive=true (apps/api/src/services/notification.service.ts:50).',
      mismatchSurfacedAt:
        'the tenants list shows the resident as inactive and the room bed as free; the resident sees only that the portal login stopped working',
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
        'POST /tenants/:id/reinstate takes a free bed (or the same bed), sets isActive=true, clears moveOutDate, reactivates the login and the guardians, and writes an audit log entry (apps/api/src/routes/tenants.ts:888-1001). It sends no notification.',
      mismatchSurfacedAt: 'the tenants list shows the resident as active again',
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
      action: 'Verify the identity documents',
      operatorBelieves: 'the resident knows that their documents passed',
      serverCommits:
        'POST /tenants/:id/verify-kyc sets documents.isVerified and verifiedAt, writes an audit log entry and pushes a kyc_uploaded notification to the tenant user (apps/api/src/routes/tenants.ts:1232-1287). A failed push is logged and never undoes the verdict.',
      notification: {
        to: 'tenant',
        type: 'kyc_uploaded',
        required: true,
      },
      mismatchSurfacedAt:
        'both sides see it: the admin tenant page shows the verified badge, the resident gets the notification in the portal',
      provenance: {
        auditAction: 'update',
        screen: '/tenants/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the resident uploaded documents and no admin has looked at them, so the tenant sits unverified with no queue of its own',
      runbook3am:
        'open /tenants, filter on the unverified residents, and verify the record the resident is waiting on',
    },
    {
      action: 'A resident uploads their own documents',
      operatorBelieves: 'somebody in the office will look at this',
      serverCommits:
        'POST /tenants/me/documents stores the file and pushes a kyc_uploaded notification to every active admin (apps/api/src/routes/tenants.ts:1097-1131). The notification is the only queue: there is no pending-review list in the admin app.',
      notification: {
        to: 'admin',
        type: 'kyc_uploaded',
        required: true,
      },
      mismatchSurfacedAt:
        'the admin notification bell carries the upload and links to the tenant record',
      provenance: {
        auditAction: 'update',
        screen: '/tenants/[id]',
        actor: 'tenant',
      },
      stuckStateMeans:
        'the upload reached no admin and the resident waits for a verdict that nobody is queued to give',
      runbook3am: 'open /notifications, filter on kyc_uploaded, and verify the oldest upload',
    },
  ],
  layout: {
    archetype: 'roster',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'PageBand',
      'ResourceSelect',
      'TenantStayCalendar',
    ],
    mustNotLookLike:
      'a money ledger: a resident row is a person with a bed and a rent, and the amount must never be the protagonist',
    ownNumber: 'beds occupied of beds let',
  },
  nextBestAction: {
    perStatus: {
      checked_in: {
        label: 'Open the resident',
        target: '/tenants/[id]',
      },
      checked_out: {
        label: 'Open the closed stay',
        target: '/tenants/[id]',
      },
      kyc_pending: {
        label: 'Verify the documents',
        target: '/tenants/[id]',
        enabledWhen: 'the resident uploaded documents and no admin has verified them',
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
    },
  },
};
