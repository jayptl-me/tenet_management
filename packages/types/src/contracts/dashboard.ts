import type { ModuleContract } from './module';

/**
 * The dashboard contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - routes: apps/api/src/routes/dashboard.ts
 * - the stats aggregate: apps/api/src/routes/dashboard.ts:94-570
 * - the badge counts: apps/api/src/routes/dashboard.ts:52-58
 * - the admin screen: apps/web/src/app/(admin)/dashboard
 *
 * THE DASHBOARD HAS NO MODEL AND NO STATE. It reads the other modules and
 * writes nothing, so it declares no status. Its whole risk is that the
 * numbers it sums do not agree with the numbers the module screens show, and
 * the truth contract below names the one that does not agree today.
 */
export const DASHBOARD_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing: 'seeing the whole PG at once and deciding what to work on next',
    doneLooksLike:
      'the number at the top is the one that decides the day, and every act now link lands on a list that is already filtered',
    primaryAction: 'Pick the thing to work on now',
  },
  stateMachine: {
    domain: 'dashboard',
    kind: 'grid',
    // No model and no status: the dashboard is a read model over the other
    // modules (apps/api/src/routes/dashboard.ts:94-570).
    statuses: [],
  },
  truthContract: [
    {
      action: 'Read the month money',
      operatorBelieves: 'the money on the dashboard is the money the invoices module shows',
      serverCommits:
        'GET /dashboard/stats sums the paid payments of the month and sums the totalAmount of every invoice of the month whose status is sent, partial, paid or overdue (apps/api/src/routes/dashboard.ts:46-48, :184-191, :398-399). The invoice side is the GROSS total: it does not subtract what is already paid, while the invoice screens show the balance that the payment ledger leaves. The two numbers can differ on every partly paid invoice.',
      mismatchSurfacedAt:
        'the dashboard revenue tile against the invoices screen; the two come from two different definitions of what is owed',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'the dashboard says more money is out than the invoice list says is due, and nobody can tell which one is right',
      runbook3am:
        'open /invoices?status=partial and compare the outstanding total with the dashboard revenue tile',
    },
    {
      action: 'Act now',
      operatorBelieves: 'the act now link lands on the records that need work',
      serverCommits:
        'the dashboard and the attention banner link into the module lists with the status in the query string (apps/web/src/app/(admin)/dashboard/page.tsx:562, :606, apps/web/src/components/admin/AttentionRequiredBanner.tsx:105). The complaints and the enquiries lists read that filter out of the URL, so those two links land filtered (apps/web/src/app/(admin)/complaints/page.tsx:292, apps/web/src/app/(admin)/enquiries/page.tsx:135). The payments list still reads no query parameter at all, so the pending verification link lands on the whole ledger (apps/web/src/app/(admin)/payments/page.tsx).',
      mismatchSurfacedAt:
        'the list the link lands on, which shows every record instead of the ones that need work',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'the operator clicked the money act now link and got the whole ledger instead of the verification queue, so the triage ribbon does nothing there',
      runbook3am: 'open /payments and set the status filter by hand until the list reads the URL',
    },
  ],
  layout: {
    archetype: 'workspace',
    grammarTokens: [
      'PageHeader',
      'StatCard',
      'Surface',
      'Timeline',
      'LineChart',
      'Sparkline',
      'HeatmapCalendar',
    ],
    mustNotLookLike:
      'a module root: the dashboard is the only place that crosses modules, so it may not look like one of them',
    ownNumber: 'the collection rate of the month: paid against billed',
  },
  nextBestAction: {
    perStatus: {
      // There is no status on a dashboard. The states here are the queues it
      // can hand over to a module.
      money: {
        label: 'Open the money',
        target: '/payments',
      },
      complaints: {
        label: 'Open the complaints',
        target: '/complaints?status=open',
      },
      leads: {
        label: 'Open the new leads',
        target: '/enquiries?status=new',
      },
      occupancy: {
        label: 'Open the rooms',
        target: '/rooms',
      },
    },
    perEmptyState: {
      dashboard: {
        label: 'Open the payments',
        target: '/payments',
      },
      no_data: {
        label: 'Open the tenants',
        target: '/tenants',
      },
    },
  },
};
