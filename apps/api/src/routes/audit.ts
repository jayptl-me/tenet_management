import { Hono } from 'hono';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { parsePagination, badRequest, safeFilter } from '../lib/routeUtils.js';
import { AuditLog } from '../models/auditLog.js';

const audit = new Hono();

// ── GET /audit-logs — paginated audit trail (admin only)
audit.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, skip } = parsePagination(c);
  const action = c.req.query('action');
  const resource = c.req.query('resource');
  const userId = c.req.query('userId');
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');

  const filter: Record<string, unknown> = {};
  if (action) filter.action = action;
  if (resource) filter.resource = resource;
  if (userId) filter.userId = userId;

  if (fromDate || toDate) {
    const timestampFilter: Record<string, unknown> = {};
    if (fromDate) timestampFilter.$gte = new Date(fromDate);
    if (toDate) timestampFilter.$lte = new Date(toDate);
    filter.timestamp = timestampFilter;
  }

  const [data, total] = await Promise.all([
    AuditLog.find(safeFilter(filter))
      .sort({ timestamp: -1 } as Record<string, -1>)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email role')
      .lean(),
    AuditLog.countDocuments(safeFilter(filter)),
  ]);

  return c.json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /audit-logs/actions — list of distinct actions for filter dropdown
audit.get('/actions', authGuard, adminOnly, async (_c) => {
  const actions = await AuditLog.distinct('action');
  return _c.json({ success: true, data: actions });
});

export default audit;
