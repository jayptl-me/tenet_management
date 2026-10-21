import type { ModuleContract } from './module';

/**
 * The dashboard contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the admin dashboard (2026-10-21, wave 6):
 *
 * - the stats aggregate: apps/api/src/routes/dashboard.ts:94-575
 * - the badge counts: apps/api/src/routes/dashboard.ts:52-58
 * - the admin screen: apps/web/src/app/(admin)/dashboard/page.tsx
 * - the lists the screen links into: apps/web/src/app/(admin)/{payments,invoices,complaints,enquiries,
 *   services,rooms,tenants,meals}/page.tsx
 *
 * THE DASHBOARD HAS NO MODEL AND NO STATE. It reads the other modules and writes nothing, so it
 * declares no status. Its whole risk is that the numbers it sums do not agree with the numbers the
 * module screens show, and that a link it pushes does not land on the list it names.
 *
 * THE THREE THINGS THIS CONTRACT NAMES, because the code cannot close them:
 *
 * 1. The ledger cannot be filtered by billing month from a link. GET /payments reads a month
 *    (apps/api/src/routes/payments.ts:209), but the payments screen reads only the status, the
 *    method, the type, the search and the date range out of the address bar
 *    (apps/web/src/app/(admin)/payments/page.tsx:225-231), so the money of a month opens the whole
 *    ledger.
 * 2. The service board cannot be filtered by state from a link. GET /services reads a status
 *    (apps/api/src/routes/services.ts:222), but the services screen keeps its status filter in local
 *    state and reads no parameter out of the address bar
 *    (apps/web/src/app/(admin)/services/page.tsx:125-128), so the service counts open the whole
 *    board.
 * 3. The aging rails of the complaint SLA count the open and in-progress tickets, while the window
 *    they open holds every complaint raised in that window, of any status.
 */
export const DASHBOARD_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'reading the whole building at once and deciding what to work on in the next hour',
    doneLooksLike:
      'the number at the top is the one that decides the day, every act now link opens the list it names with that list already filtered, and every number on the screen is the count the server holds for the set it names',
    primaryAction: 'Pick the queue to work on now',
  },
  stateMachine: {
    domain: 'dashboard',
    kind: 'grid',
    // No model and no status: the dashboard is a read model over the other
    // modules (apps/api/src/routes/dashboard.ts:94-575).
    statuses: [],
  },
  truthContract: [
    {
      action: 'Read the act now band and follow one of its links',
      operatorBelieves:
        'the number on the band is the number of records waiting, and the link opens exactly those records',
      serverCommits:
        'GET /dashboard/stats returns the four counts the band shows: the payments the server holds as pending_verification (apps/api/src/routes/dashboard.ts:209), the invoices of the month whose status is overdue (:360-376), the complaints the server holds as open (:192, :213-221) and the enquiries the server holds as new (:194). The four lists read the parameter out of the address bar, so the link lands filtered: /payments?status=pending_verification (apps/web/src/app/(admin)/payments/page.tsx:225), /invoices?status=overdue&month=YYYY-MM (apps/web/src/app/(admin)/invoices/page.tsx:252-253) and /complaints?status=open, /enquiries?status=new (apps/web/src/app/(admin)/complaints/page.tsx:292, apps/web/src/app/(admin)/enquiries/page.tsx:135). The band holds one number the dashboard owns: the sum of the four queues, which no other module can compute because each of the four is the own count of another module.',
      mismatchSurfacedAt:
        'the band names the scope of every count, and the header says the day and the filters, so a count that disagrees with the rows shows up on the list it opened',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'a payment waits for its verification, a bill is overdue, a complaint is open or a lead is unanswered, and nobody works the queue because the count and the rows do not match',
      runbook3am:
        'open /dashboard, read the band, and open the queue with the count that is not zero; if the list it opens does not show that many rows, the address bar of the list is the thing to read',
    },
    {
      action: 'Read the money of the month',
      operatorBelieves:
        'the money on the dashboard is the money the invoices module shows, and the collected share is the share of the month that came in',
      serverCommits:
        'GET /dashboard/stats sums the amount of the payments the server reports as paid for the month (apps/api/src/routes/dashboard.ts:184-187) and the GROSS total of the invoices of that month whose status is sent, partial, paid or overdue (:188-191, :48). Both numbers cover the same billing cohort, because a payment carries the month of its invoice (apps/api/src/routes/payments.ts:589, :635, :786, :890), but they are not the same question: the gross total of an invoice does not fall when the invoice is partly paid, and a payment that is still waiting for its verification is not counted as collected at all. The ledger opens the whole ledger, because the payments screen reads no billing month out of the address bar (apps/web/src/app/(admin)/payments/page.tsx:225-231) although the server can filter one (apps/api/src/routes/payments.ts:209).',
      mismatchSurfacedAt:
        'the money panel names both numbers and their scope, and the bills panel next to it opens the bills of that month, so the gross billed total and the balance the invoices screen shows can be compared side by side',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'the dashboard says more was billed than the invoice list says is due, and the office cannot tell which of the two is the truth, because one is a gross total and the other is a balance',
      runbook3am:
        'open /invoices?month=YYYY-MM, read the balance column of the partly paid rows, and compare it with the billed figure of the dashboard; the difference is what has been paid against the month',
    },
    {
      action: 'Read the bills of the month and open one of the rows',
      operatorBelieves:
        'the count of a bill row is the number of bills waiting for money, and the row opens them',
      serverCommits:
        'GET /dashboard/stats groups the invoices of the month by status (apps/api/src/routes/dashboard.ts:360-376), and the row opens the invoice list of that status and that month (apps/web/src/app/(admin)/invoices/page.tsx:252-253), which reads the same month and the same status (apps/api/src/routes/invoices.ts:191-203). A bill that is overdue is a resident who owes money, and the resident half of that money is the resident invoice list of the portal (GET /invoices/my, apps/api/src/routes/invoices.ts:206-218).',
      mismatchSurfacedAt:
        'the row shows the count of the server and opens the list of the same status and the same month',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'a resident owes money for a month and the dashboard shows the bill as issued or overdue while the resident has not been told',
      runbook3am:
        'open /invoices?status=overdue&month=YYYY-MM, then open the resident of the first row and check what the portal shows them',
    },
    {
      action: 'Read the building, the beds and the residents',
      operatorBelieves:
        'the occupancy of the building is one number, and the bed map and the occupancy history are two views of it',
      serverCommits:
        'the bed map counts the beds of the rooms in service and marks the taken ones from the bed array of the room (apps/api/src/routes/dashboard.ts:110-170), while the occupancy history counts the RESIDENTS whose stay overlaps the month and sets that number against the beds of the active rooms (:495-508). The two are different measures over different records, so the panel labels the series Residents and Beds and keeps the bed snapshot and the resident count apart.',
      mismatchSurfacedAt:
        'the occupancy panel names what each series is, and the rooms module can rebuild the bed map from the resident records when they drift (apps/web/src/app/(admin)/rooms/page.tsx, GET /rooms/reconcile-occupancy)',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'the bed map says a bed is taken while the resident record says the resident has left, so the occupancy of the screen and the occupancy of the beds disagree',
      runbook3am:
        'open /rooms, run the check of the bed map, and compare the beds of the rooms with the residents on their records',
    },
    {
      action: 'Read the complaint queue and follow a status or an aging rail',
      operatorBelieves:
        'the number of a status segment is the number of complaints in that status, and the aging rail opens those complaints',
      serverCommits:
        'GET /dashboard/stats counts the complaints by status over every complaint (:192, :213-221) and buckets the open and in-progress ones by age (:241-312). The status segments open the complaint list of that status (apps/web/src/app/(admin)/complaints/page.tsx:292) and the aging rails open the complaints raised in that window by their created-at date (apps/web/src/app/(admin)/complaints/page.tsx:309-310, apps/api/src/routes/complaints.ts:386-393). The rail counts the open and in-progress tickets, while the window holds every complaint raised in it, of any status; the panel says so under the rail.',
      mismatchSurfacedAt:
        'the complaint panel states that the rails count the open and in-progress tickets and open every complaint raised in the window',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'a complaint has been open for days and the rail counts it, but the list it opens is wider than the rail, so the office cannot see which ticket is the old one',
      runbook3am:
        'open /complaints?status=open, sort by the oldest first, and work the rows the dashboard could not narrow down',
    },
    {
      action: 'Read the service health',
      operatorBelieves:
        'the number of services that are not working is a number the office can work through from the board',
      serverCommits:
        'GET /dashboard/stats counts the service rows by status and by service type over every row (apps/api/src/routes/dashboard.ts:193, :379-396), and the panel shows both. The service board reads no state out of the address bar (apps/web/src/app/(admin)/services/page.tsx:125-128), although the server can filter one (apps/api/src/routes/services.ts:222), so the panel opens the whole board and says so in its own subtitle.',
      mismatchSurfacedAt:
        'the services panel names the counts, names the board it opens and states that the board cannot be filtered by state from a link',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'a floor is degraded and the dashboard counts it, but the office has to find the row by hand on the board, because the board opens unfiltered',
      runbook3am:
        'open /services and set the state filter by hand; the count on the dashboard is the number of rows that filter returns',
    },
    {
      action: 'Read the meal feedback',
      operatorBelieves: 'the meal panel shows what the residents thought of the food',
      serverCommits:
        'GET /dashboard/stats returns the average rating per meal for each of the last 14 days (apps/api/src/routes/dashboard.ts:437-463), and the panel draws those series and the mean of the days the residents rated. It does not render the shared meal ledger (apps/web/src/components/ui/MealFeedbackLedger.tsx), because that component writes a sentiment share, a week on week delta, a fallback score and three aspect tags that the server never sends (:35-42, :110-126, :142, :157).',
      mismatchSurfacedAt:
        'the meal panel shows only the series the server sent and names the window it covers',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'the residents rated the food and the dashboard shows the ratings, but the office never hears a word about them: no complaint and no notification carries the score',
      runbook3am:
        'open /meals and read the ratings of the last 14 days, then check whether any of them turned into a complaint',
    },
    {
      action: 'Read the leads',
      operatorBelieves: 'the leads panel shows the leads that still have to be answered',
      serverCommits:
        'GET /dashboard/stats counts the enquiries the server holds as new, as contacted, and as raised in the last 7 days (apps/api/src/routes/dashboard.ts:194-199) and returns the 5 most recent enquiries (:205-208). The panel links the new ones to the filtered list (apps/web/src/app/(admin)/enquiries/page.tsx:135) and every row to the enquiry itself. The enquiries list has no convert action (apps/web/src/app/(admin)/enquiries/page.tsx:260-276): the office converts a lead from the enquiry record, and that button only carries the enquiry to the tenant form (apps/web/src/app/(admin)/enquiries/[id]/page.tsx:452-457), so the lead stays new until somebody sets it by hand.',
      mismatchSurfacedAt:
        'the leads panel names the three counts and their scopes, and the row opens the enquiry',
      provenance: {
        screen: '/dashboard',
        actor: 'admin',
      },
      stuckStateMeans:
        'a lead has been sitting in the new column for a week and the dashboard counts it every morning, because nothing moves an enquiry out of new by itself',
      runbook3am:
        'open /enquiries?status=new and work the oldest row; the converted enquiries are the ones the portal of the module already knows about',
    },
  ],
  layout: {
    archetype: 'workspace',
    grammarTokens: [
      'PageHeader',
      'PageBand',
      'Surface',
      'StatusBadge',
      'Button',
      'LineChart',
      'GaugeChart',
      'Timeline',
      'HeatmapCalendar',
      'RoomBedHeatmap',
      'ComplaintResolutionHub',
      'ComplaintCategoryMatrix',
      'Skeleton',
      'ErrorState',
    ],
    mustNotLookLike:
      'a module root: the dashboard is the only place that crosses modules, so it may not look like one of them',
    ownNumber:
      'the number of items waiting across the four queues of the office (the payments to verify, the overdue bills of the month, the open complaints and the new leads), which no other module can compute because each of the four is the own count of another module',
  },
  nextBestAction: {
    perStatus: {
      // There is no status on a dashboard. The states here are the queues it
      // can hand over to a module.
      money: {
        label: 'Open the ledger',
        target: '/payments',
      },
      verifications: {
        label: 'Open the payments to verify',
        target: '/payments?status=pending_verification',
      },
      bills: {
        label: 'Open the bills',
        target: '/invoices',
      },
      complaints: {
        label: 'Open the open complaints',
        target: '/complaints?status=open',
      },
      leads: {
        label: 'Open the new leads',
        target: '/enquiries?status=new',
      },
      occupancy: {
        label: 'Open the bed map',
        target: '/rooms',
      },
      residents: {
        label: 'Open the residents',
        target: '/tenants',
      },
      services: {
        label: 'Open the service board',
        target: '/services',
      },
      meals: {
        label: 'Open the meals',
        target: '/meals',
      },
    },
    perEmptyState: {
      dashboard: {
        label: 'Open the payments',
        target: '/payments',
      },
      no_room_in_service: {
        label: 'Open the rooms',
        target: '/rooms',
      },
      no_stay_history: {
        label: 'Open the residents',
        target: '/tenants',
      },
      no_money_recorded: {
        label: 'Open the ledger',
        target: '/payments',
      },
      no_complaint_logged: {
        label: 'Open the complaint board',
        target: '/complaints',
      },
      no_service_row: {
        label: 'Open the service board',
        target: '/services',
      },
      no_meal_feedback: {
        label: 'Open the meals',
        target: '/meals',
      },
      no_enquiry: {
        label: 'Open the leads',
        target: '/enquiries',
      },
    },
  },
};
