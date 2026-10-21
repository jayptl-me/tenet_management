import type { ModuleContract } from './module';

/**
 * The enquiries contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/enquiry.ts:49
 * - the transition guard: apps/api/src/routes/enquiries.ts:68-80
 * - the status route: apps/api/src/routes/enquiries.ts:231-284
 * - the conversion, which happens in the tenant route: apps/api/src/routes/tenants.ts:304-314
 * - the admin screens: apps/web/src/app/(admin)/enquiries
 *
 * An enquiry is a lead, not a resident. Nobody waits on a notification here;
 * the lead pipeline is the operator own desk.
 */
export const ENQUIRIES_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'working the lead pipeline: calling the people who asked, and turning the ones who are serious into residents',
    doneLooksLike:
      'every enquiry carries a status that says where it stands, and every converted enquiry points at the tenant it became',
    primaryAction: 'Move a lead to its next status',
  },
  stateMachine: {
    domain: 'enquiries',
    model: 'enquiry',
    kind: 'ladder',
    statuses: [
      {
        // The lead arrives from the landing page.
        status: 'new',
        enteredBy: {
          method: 'POST',
          path: '/enquiries',
          condition:
            'the public enquiry form creates the lead with status=new and source=landing_page unless an admin source is given (apps/api/src/routes/enquiries.ts:83-115)',
        },
      },
      {
        // Somebody spoke to them.
        status: 'contacted',
        enteredBy: {
          method: 'PUT',
          path: '/enquiries/:id/status',
          condition: 'an admin records that the lead was contacted',
        },
      },
      {
        // The lead became a resident.
        status: 'converted',
        enteredBy: {
          method: 'POST',
          path: '/tenants',
          condition:
            'creating the tenant from the enquiry flips the lead to converted and links convertedTenantId (apps/api/src/routes/tenants.ts:304-314). PUT /enquiries/:id/status refuses converted unless a tenant is already linked (apps/api/src/routes/enquiries.ts:70-72)',
        },
      },
      {
        // The lead is gone.
        status: 'lost',
        enteredBy: {
          method: 'PUT',
          path: '/enquiries/:id/status',
          condition:
            'an admin marks the lead lost; a lost lead can only reopen to new or contacted',
        },
      },
    ],
    terminal: 'converted',
    // A converted lead is pinned to its tenant and cannot change status
    // (apps/api/src/routes/enquiries.ts:73-75).
    deadEnd: 'converted',
  },
  truthContract: [
    {
      action: 'Convert a lead into a resident',
      operatorBelieves: 'the lead pipeline moved and the lead is now a resident',
      serverCommits:
        'the conversion happens in the tenant route: POST /tenants with enquiryId writes the tenant, then flips the enquiry to converted with convertedTenantId set inside the same transaction (apps/api/src/routes/tenants.ts:304-314). If the enquiry is missing the whole transaction is rolled back. The admin Convert button only navigates to /tenants/new, so the status moves when the tenant is actually created, not when the button is pressed.',
      mismatchSurfacedAt:
        'the enquiries list shows the converted chip with the linked tenant; until the tenant is created the lead still reads new',
      provenance: {
        auditAction: 'update',
        screen: '/enquiries/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the lead was called and qualified but no tenant was created, so the pipeline has no terminal state to show',
      runbook3am:
        'open /enquiries?status=new, open the oldest lead and check whether a tenant was ever created from it',
    },
    {
      action: 'Record that a lead was contacted',
      operatorBelieves: 'the desk knows where this lead stands',
      serverCommits:
        'PUT /enquiries/:id/status checks the transition, writes the new status with the notes, writes an update audit log entry and refreshes the sidebar badge (apps/api/src/routes/enquiries.ts:231-284). It writes no notification: a prospect has no account and no channel in this product.',
      mismatchSurfacedAt: 'the enquiries list and the pipeline counts on /enquiries',
      provenance: {
        auditAction: 'update',
        screen: '/enquiries/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'a lead sits in new while the desk believes it was called, so the pipeline counts are wrong',
      runbook3am:
        'open /enquiries?status=new, read the oldest leads and set the ones that were called to contacted',
    },
  ],
  layout: {
    archetype: 'board',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'StatCard',
      'DateRangePicker',
      'Input',
    ],
    mustNotLookLike:
      'a resident list: an enquiry row is a person who is not living here yet, and the funnel stage is what the row is about',
    ownNumber: 'leads older than two days with no call',
  },
  nextBestAction: {
    perStatus: {
      new: {
        label: 'Call the lead',
        target: '/enquiries/[id]',
      },
      contacted: {
        label: 'Turn it into a resident',
        target: '/enquiries/[id]',
      },
      converted: {
        label: 'Open the resident',
        target: '/tenants/[id]',
      },
      lost: {
        label: 'Reopen the lead',
        target: '/enquiries/[id]',
      },
    },
    perEmptyState: {
      enquiries: {
        label: 'Record a lead',
        target: '/enquiries/new',
      },
      new: {
        label: 'Open the new leads',
        target: '/enquiries?status=new',
      },
    },
  },
};
