import type { ModuleContract } from './module';

/**
 * The audit logs contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - the model: apps/api/src/models/auditLog.ts (no status field, see below)
 * - the action vocabulary: apps/api/src/lib/write-audit-log.ts:5-19
 * - routes: apps/api/src/routes/audit.ts
 * - the admin screen: apps/web/src/app/(admin)/audit-logs
 *
 * THE AUDIT LOG MODEL HAS NO STATUS FIELD. An entry is a write that already
 * happened: it carries an action from the closed AuditAction enum, the resource
 * it touched, who did it and when. There is nothing to move it to, so the
 * state machine below declares no status.
 */
export const AUDIT_LOGS_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'reading the trail: finding out who changed what, when, and whether the money decisions were really made',
    doneLooksLike:
      'every decision the office made has an entry with an action, an actor and a timestamp, and the trail can be filtered down to one person or one resource',
    primaryAction: 'Find the write that matters',
  },
  stateMachine: {
    domain: 'audit',
    model: 'auditLog',
    kind: 'grid',
    // The audit log model carries no status enum (apps/api/src/models/auditLog.ts).
    // The only dimension on an entry is the action, which comes from the closed
    // AuditAction union (apps/api/src/lib/write-audit-log.ts:5-19):
    // create, update, delete, login, logout, payment_verify,
    // complaint_status_change, tenant_checkout, tenant_transfer,
    // settings_change, notification_send, visitor_approve, export, reconcile
    statuses: [],
  },
  truthContract: [
    {
      action: 'Read the trail',
      operatorBelieves: 'the trail shows every write that happened',
      serverCommits:
        'GET /audit-logs filters on action, resource, userId and a date range and returns the entries newest first with the actor populated (apps/api/src/routes/audit.ts:13-48). The trail only holds what a handler chose to write: writeAuditLog swallows its own failures so a write never breaks the flow (apps/api/src/lib/write-audit-log.ts:50-54), and a handler that forgets to call it leaves no entry at all.',
      mismatchSurfacedAt: 'the audit list itself; a missing write simply is not there',
      provenance: {
        screen: '/audit-logs',
        actor: 'admin',
      },
      stuckStateMeans:
        'a decision the office remembers cannot be found in the trail, so the entry was never written',
      runbook3am:
        'open /audit-logs, filter on the action and the date range, and read the details of the entry',
    },
    {
      action: 'Record an export',
      operatorBelieves: 'the export is in the trail with its row count',
      serverCommits:
        'POST /audit-logs/log-export writes an entry with action=export, the resource, the record count and the format (apps/api/src/routes/audit.ts:63-75). The admin export page calls it after the CSV has been built in the browser, and the call is fire and forget: a failed log leaves the export itself intact and unlogged (apps/web/src/app/(admin)/export/page.tsx:262-267).',
      mismatchSurfacedAt: 'the audit list shows an export entry with the row count',
      provenance: {
        auditAction: 'export',
        screen: '/audit-logs',
        actor: 'admin',
      },
      stuckStateMeans: 'data left the building and the trail has no export entry for it',
      runbook3am: 'open /audit-logs, filter on the export action, and look at the row counts',
    },
  ],
  layout: {
    archetype: 'ledger',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'DateRangePicker',
      'Input',
      'Select',
    ],
    mustNotLookLike:
      'a money ledger: a trail entry is a write, and the money and the people are read out of it, not out of it',
    ownNumber: 'writes in the last 24 hours',
  },
  nextBestAction: {
    perStatus: {
      // The trail has no status. The action is the dimension, so the next best
      // action is per action that an operator goes to from the trail.
      payment_verify: {
        label: 'Open the payment',
        target: '/payments',
      },
      tenant_checkout: {
        label: 'Open the resident',
        target: '/tenants',
      },
      complaint_status_change: {
        label: 'Open the complaint',
        target: '/complaints',
      },
      visitor_approve: {
        label: 'Open the visitor',
        target: '/visitors',
      },
      notification_send: {
        label: 'Open the broadcast',
        target: '/notifications',
      },
      export: {
        label: 'Open the export log',
        target: '/audit-logs',
      },
    },
    perEmptyState: {
      audit_logs: {
        label: 'Open the export log',
        target: '/export',
      },
    },
  },
};
