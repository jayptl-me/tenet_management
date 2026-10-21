import type { ModuleContract } from './module';

/**
 * The export contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - the admin screen: apps/web/src/app/(admin)/export/page.tsx
 * - the only server write it makes: apps/api/src/routes/audit.ts:63-75
 * - the list APIs it walks: one per resource, capped at 100 rows a page
 *
 * THE EXPORT MODULE HAS NO SERVER STATE AND NO MODEL. It is a client side CSV
 * engine: it pages through the ordinary list APIs of seventeen resources,
 * flattens the rows, sanitizes them and hands a file to the browser. The only
 * thing the server ever learns about it is one audit entry. So this contract
 * declares no status, and the checker resolves no model and no route for it.
 */
export const EXPORT_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'taking the data out of the office for reporting, compliance or an offline look',
    doneLooksLike:
      'the file that was downloaded holds every row of the resource, with no credential in it and no cell that a spreadsheet would run',
    primaryAction: 'Export a dataset as CSV',
  },
  stateMachine: {
    domain: 'export',
    kind: 'grid',
    // No model, no route, no status: the export is a read path over the list
    // APIs plus one audit write (apps/web/src/app/(admin)/export/page.tsx:262-267).
    statuses: [],
  },
  truthContract: [
    {
      action: 'Export a dataset',
      operatorBelieves: 'the file holds the whole dataset',
      serverCommits:
        'the page pages through the resource list API with a page size of 100 until the last page, stops at 200 pages and so 20000 rows, flattens the nested objects into dotted columns, drops every key that looks like a credential, escapes the formula triggers that a spreadsheet would run, and downloads the file (apps/web/src/app/(admin)/export/page.tsx:201-336). It posts one audit entry with the resource and the row count to POST /audit-logs/log-export, fire and forget: a failed audit call leaves the export itself intact and unlogged (apps/web/src/app/(admin)/export/page.tsx:262-267).',
      mismatchSurfacedAt:
        'the page reports the row count it downloaded; the trail carries the same count when the audit call lands',
      provenance: {
        auditAction: 'export',
        screen: '/audit-logs',
        actor: 'admin',
      },
      stuckStateMeans:
        'the file stopped at 20000 rows, so the export is a prefix of the data and nothing on the page says so',
      runbook3am:
        'open /audit-logs, filter on the export action, and compare the row count with what the resource list reports',
    },
    {
      action: 'Export a resource with more than 20000 rows',
      operatorBelieves: 'the file holds every row',
      serverCommits:
        'the page stops after 200 pages and drops the rest (apps/web/src/app/(admin)/export/page.tsx:227-239). The response says nothing about the rows it left behind, and the audit entry carries the row count that was actually written, so the trail shows a smaller number than the resource holds.',
      mismatchSurfacedAt: 'the audit entry row count against the total on the source list',
      provenance: {
        auditAction: 'export',
        screen: '/audit-logs',
        actor: 'admin',
      },
      stuckStateMeans:
        'a truncated export was taken as the whole dataset, because the file itself does not say that it was cut',
      runbook3am: 'open the source list, read its total, and split the export by date range',
    },
  ],
  layout: {
    archetype: 'workspace',
    grammarTokens: ['PageHeader', 'StatCard', 'Button', 'ErrorBanner'],
    mustNotLookLike:
      'a report screen: this module has no data of its own, it is a console of choices that walks other modules list APIs',
    ownNumber: 'rows in the last export',
  },
  nextBestAction: {
    perStatus: {
      // There is no status on an export. The only state the operator sees is
      // whether the run finished.
      done: {
        label: 'Open the export trail',
        target: '/audit-logs',
      },
    },
    perEmptyState: {
      export: {
        label: 'Open the trail',
        target: '/audit-logs',
      },
      tenants: {
        label: 'Open the tenants',
        target: '/tenants',
      },
      payments: {
        label: 'Open the payments',
        target: '/payments',
      },
      invoices: {
        label: 'Open the invoices',
        target: '/invoices',
      },
    },
  },
};
