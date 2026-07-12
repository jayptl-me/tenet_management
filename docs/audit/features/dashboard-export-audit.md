# Dashboard, Export, Audit Logs -- Gap Analysis

**Priority:** P3

## Dashboard

- Routes: badges, occupancy-history, stats
- FE heavy page with charts using theme tokens and StatusBadge
- Gaps: verify each widget endpoint 200; no hardcoded chart colors outside ThemeChart

## Export

- Page exists under `(admin)/export`
- Types: `packages/types/src/export.ts`
- Gaps: confirm backend export endpoints exist (may be jobs or client-only CSV) -- re-read page when remediating

## Audit logs

- API: GET `/audit-logs`, GET `/actions`
- FE list only -- no edit (correct)
- StatusBadge on action types
- Gaps: ensure writeAuditLog called on sensitive mutations (tenant transfer already does)

## Acceptance

- [ ] Dashboard loads without console errors
- [ ] Audit list filters by action
- [ ] Export produces download or clear unsupported message
