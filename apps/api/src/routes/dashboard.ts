import { Hono } from 'hono';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { Room } from '../models/room.js';
import { Payment } from '../models/payment.js';
import { Invoice } from '../models/invoice.js';
import { Complaint } from '../models/complaint.js';
import { ServiceStatus } from '../models/serviceStatus.js';
import { Enquiry } from '../models/enquiry.js';
import { MealFeedback } from '../models/mealFeedback.js';
import { Tenant } from '../models/tenant.js';
import { getBadgeCounts } from '../lib/broadcast-badges.js';
import { monthStringInTZ, dateStringInTZ, PG_TIMEZONE } from '../lib/dates.js';

const dashboard = new Hono();

// ── Month helpers for occupancy history ─────────────────
// A tenant counts for a YYYY-MM bucket only when their stay overlaps it:
// moveInDate <= monthEnd AND (no moveOutDate OR moveOutDate >= monthStart).
function monthBounds(monthStr: string): { start: Date; end: Date } {
  const [y, m] = monthStr.split('-').map(Number);
  const year = y ?? 1970;
  const monthIdx = (m ?? 1) - 1;
  return {
    start: new Date(year, monthIdx, 1, 0, 0, 0, 0),
    end: new Date(year, monthIdx + 1, 0, 23, 59, 59, 999),
  };
}

function isTenantActiveInMonth(
  moveIn: Date | string | null | undefined,
  moveOut: Date | string | null | undefined,
  month: string,
): boolean {
  if (moveIn == null || moveIn === '') return false;
  const inDate = new Date(String(moveIn));
  if (Number.isNaN(inDate.getTime())) return false;
  const { start, end } = monthBounds(month);
  if (inDate > end) return false;
  if (moveOut == null || moveOut === '') return true;
  const outDate = new Date(String(moveOut));
  if (Number.isNaN(outDate.getTime())) return true;
  return outDate >= start;
}

// Invoice statuses that represent real billed demand. Drafts are working
// copies and cancelled invoices are void, so both stay out of expected.
const BILLABLE_INVOICE_STATUSES = ['sent', 'partial', 'paid', 'overdue'];

// ── GET /dashboard/badges ────────────────────────────────
// Shape shared with SSE event `badges-update` (broadcast-badges.ts)
dashboard.get('/badges', authGuard, adminOnly, async (c) => {
  const data = await getBadgeCounts();
  return c.json({
    success: true,
    data,
  });
});

// ── GET /dashboard/occupancy-history ──────────────────────
dashboard.get('/occupancy-history', authGuard, adminOnly, async (c) => {
  const now = new Date();
  const last6Months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6Months.push(monthStringInTZ(d));
  }

  const allRooms = (await Room.find({ isActive: true }).lean()) as Array<{
    beds?: Array<{ isOccupied: boolean }>;
  }>;
  const totalBeds = allRooms.reduce((sum, r) => sum + (r.beds?.length ?? 0), 0);

  const tenantsForHistory = await Tenant.find({}).select('moveInDate moveOutDate').lean();
  const occupancyByMonth = new Map<string, number>();
  for (const t of tenantsForHistory) {
    for (const m of last6Months) {
      if (isTenantActiveInMonth(t.moveInDate, t.moveOutDate, m)) {
        occupancyByMonth.set(m, (occupancyByMonth.get(m) ?? 0) + 1);
      }
    }
  }

  const history = last6Months.map((month) => ({
    month,
    occupied: occupancyByMonth.get(month) ?? 0,
    total: totalBeds,
  }));

  return c.json({ success: true, data: history });
});

// ── GET /dashboard/stats ────────────────────────────────
dashboard.get('/stats', authGuard, adminOnly, async (c) => {
  const now = new Date();
  const currentMonth = monthStringInTZ(now);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  type ActiveRoomDoc = {
    _id: unknown;
    roomNumber: string;
    floor?: { _id?: unknown; label?: string; floorNumber?: number } | null;
    floorId?: unknown;
    sharingType: number;
    monthlyRent: number;
    beds?: Array<{ bedId: string; isOccupied: boolean; tenantId?: unknown }>;
  };

  const allActiveRooms = (await Room.find({ isActive: true })
    .populate('floor', 'label floorNumber')
    .sort({ roomNumber: 1 })
    .lean()) as unknown as ActiveRoomDoc[];

  const totalRooms = allActiveRooms.length;
  const totalBeds = allActiveRooms.reduce(
    (sum: number, r: ActiveRoomDoc) => sum + (r.beds?.length ?? 0),
    0,
  );
  const occupiedBeds = allActiveRooms.reduce(
    (sum: number, r: ActiveRoomDoc) =>
      sum + (r.beds?.filter((b: { isOccupied: boolean }) => b.isOccupied).length ?? 0),
    0,
  );

  // Extract tenant names for bed tooltips
  const bedTenantIds = Array.from(
    new Set(
      allActiveRooms
        .flatMap((r: ActiveRoomDoc) => r.beds ?? [])
        .map((b: { tenantId?: unknown }) => (b.tenantId ? String(b.tenantId) : ''))
        .filter((id: string) => id !== ''),
    ),
  );
  const tenantNameMap = new Map<string, string>();
  if (bedTenantIds.length > 0) {
    const tenants = await Tenant.find({ _id: { $in: bedTenantIds } })
      .populate({ path: 'userId', select: 'name' })
      .lean();
    for (const t of tenants as Array<{ _id: unknown; userId?: { name?: string } | null }>) {
      tenantNameMap.set(String(t._id), t.userId?.name ?? 'Tenant');
    }
  }

  const roomOccupancyMatrix = allActiveRooms.map((r: ActiveRoomDoc) => {
    const floor = r.floor as unknown as
      { _id?: unknown; label?: string; floorNumber?: number } | undefined;
    const roomBeds = (r.beds ?? []).map(
      (b: { bedId: string; isOccupied: boolean; tenantId?: unknown }) => ({
        bedId: b.bedId,
        isOccupied: b.isOccupied,
        tenantName: b.tenantId ? tenantNameMap.get(String(b.tenantId)) : undefined,
      }),
    );
    const totalBedsInRoom = roomBeds.length || r.sharingType || 0;
    const occupiedInRoom = roomBeds.filter((b: { isOccupied: boolean }) => b.isOccupied).length;

    return {
      _id: String(r._id),
      roomNumber: r.roomNumber,
      floorId: floor?._id ? String(floor._id) : undefined,
      floorLabel: floor?.label ?? 'Unassigned',
      floorNumber: floor?.floorNumber ?? 99,
      sharingType: r.sharingType,
      monthlyRent: r.monthlyRent,
      totalBeds: totalBedsInRoom,
      occupiedBeds: occupiedInRoom,
      beds: roomBeds,
    };
  });

  const [
    paymentAgg,
    invoiceAgg,
    complaintsByStatus,
    servicesByStatus,
    pendingEnquiries,
    contactedEnquiries,
    newThisWeekEnquiries,
    recentComplaints,
    recentEnquiries,
    pendingVerifications,
  ] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'paid', month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Invoice.aggregate([
      { $match: { month: currentMonth, status: { $in: BILLABLE_INVOICE_STATUSES } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ServiceStatus.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Enquiry.countDocuments({ status: 'new' } as Record<string, unknown>),
    Enquiry.countDocuments({ status: 'contacted' } as Record<string, unknown>),
    Enquiry.countDocuments({
      status: 'new',
      createdAt: { $gte: sevenDaysAgo },
    } as Record<string, unknown>),
    Complaint.find()
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .limit(5)
      .populate({ path: 'tenantId', populate: { path: 'userId' } })
      .lean(),
    Enquiry.find()
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .limit(5)
      .lean(),
    Payment.countDocuments({ status: 'pending_verification' } as Record<string, unknown>),
  ]);

  // Build complaint status counts map
  const complaintStatusMap: Record<string, number> = {
    open: 0,
    in_progress: 0,
    resolved: 0,
    dismissed: 0,
  };
  for (const entry of complaintsByStatus as Array<{ _id: string; count: number }>) {
    complaintStatusMap[entry._id] = entry.count;
  }

  // Build service status counts map
  const serviceStatusMap: Record<string, number> = { operational: 0, degraded: 0, down: 0 };
  for (const entry of servicesByStatus as Array<{ _id: string; count: number }>) {
    serviceStatusMap[entry._id] = entry.count;
  }

  // Complaint categories distribution
  const complaintsByCategory = (await Complaint.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 6 },
  ])) as Array<{ _id: string; count: number }>;

  // Complaint SLA & triage metrics (Linear Triage & Incident Command)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [activeComplaintStats, resolvedComplaintStats] = await Promise.all([
    Complaint.aggregate([
      { $match: { status: { $in: ['open', 'in_progress'] } } },
      {
        $facet: {
          aging: [
            {
              $group: {
                _id: null,
                under24h: {
                  $sum: { $cond: [{ $gte: ['$createdAt', twentyFourHoursAgo] }, 1, 0] },
                },
                between24And48h: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $lt: ['$createdAt', twentyFourHoursAgo] },
                          { $gte: ['$createdAt', fortyEightHoursAgo] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                over48h: {
                  $sum: { $cond: [{ $lt: ['$createdAt', fortyEightHoursAgo] }, 1, 0] },
                },
              },
            },
          ],
          priority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
    Complaint.aggregate([
      {
        $match: {
          status: 'resolved',
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $project: {
          resolutionHours: {
            $divide: [
              { $subtract: [{ $ifNull: ['$resolvedAt', '$updatedAt'] }, '$createdAt'] },
              1000 * 60 * 60,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalResolved: { $sum: 1 },
          avgResolutionHours: { $avg: '$resolutionHours' },
          resolvedWithin48h: {
            $sum: { $cond: [{ $lte: ['$resolutionHours', 48] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const activeFacet = (activeComplaintStats[0] ?? {}) as {
    aging?: Array<{ under24h: number; between24And48h: number; over48h: number }>;
    priority?: Array<{ _id: string; count: number }>;
  };
  const agingRow = activeFacet.aging?.[0];
  const priorityMap: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
  if (activeFacet.priority) {
    for (const p of activeFacet.priority) {
      if (p._id && priorityMap[p._id] !== undefined) {
        priorityMap[p._id] = p.count;
      }
    }
  }

  const resolvedRow = (resolvedComplaintStats[0] ?? {}) as {
    totalResolved?: number;
    avgResolutionHours?: number;
    resolvedWithin48h?: number;
  };

  let avgResolutionHours: number | null = null;
  let slaComplianceRate = 100;
  if (resolvedRow.totalResolved && resolvedRow.totalResolved > 0) {
    avgResolutionHours = Math.round((resolvedRow.avgResolutionHours ?? 0) * 10) / 10;
    slaComplianceRate = Math.round(
      ((resolvedRow.resolvedWithin48h ?? 0) / resolvedRow.totalResolved) * 100,
    );
  }

  const complaintSla = {
    aging: {
      under24h: agingRow?.under24h ?? 0,
      between24And48h: agingRow?.between24And48h ?? 0,
      over48h: agingRow?.over48h ?? 0,
    },
    priority: {
      urgent: priorityMap.urgent,
      high: priorityMap.high,
      medium: priorityMap.medium,
      low: priorityMap.low,
    },
    avgResolutionHours,
    slaComplianceRate,
  };

  // Payment funnel
  const paymentFunnelRaw = (await Invoice.aggregate([
    { $match: { month: currentMonth } },
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } },
  ])) as Array<{ _id: string; count: number; totalAmount: number }>;

  const paymentFunnel: Record<string, { count: number; totalAmount: number }> = {
    draft: { count: 0, totalAmount: 0 },
    sent: { count: 0, totalAmount: 0 },
    partial: { count: 0, totalAmount: 0 },
    paid: { count: 0, totalAmount: 0 },
    overdue: { count: 0, totalAmount: 0 },
  };
  for (const entry of paymentFunnelRaw) {
    if (paymentFunnel[entry._id] !== undefined) {
      paymentFunnel[entry._id] = { count: entry.count, totalAmount: entry.totalAmount };
    }
  }

  // Amenity health per-type breakdown
  const amenityBreakdownRaw = (await ServiceStatus.aggregate([
    { $group: { _id: { serviceType: '$serviceType', status: '$status' }, count: { $sum: 1 } } },
    { $sort: { '_id.serviceType': 1 } },
  ])) as Array<{ _id: { serviceType: string; status: string }; count: number }>;

  const amenityHealth: Record<
    string,
    { operational: number; degraded: number; down: number; total: number }
  > = {};
  for (const entry of amenityBreakdownRaw) {
    const type = entry._id.serviceType;
    if (!amenityHealth[type]) {
      amenityHealth[type] = { operational: 0, degraded: 0, down: 0, total: 0 };
    }
    const status = entry._id.status as 'operational' | 'degraded' | 'down';
    amenityHealth[type][status] = entry.count;
    amenityHealth[type].total += entry.count;
  }

  const revenueCollected = (paymentAgg as Array<{ _id: null; total: number }>)[0]?.total ?? 0;
  const revenueExpected = (invoiceAgg as Array<{ _id: null; total: number }>)[0]?.total ?? 0;
  const vacancyRate = totalBeds > 0 ? ((totalBeds - occupiedBeds) / totalBeds) * 100 : 0;

  // Revenue history: last 6 months
  const last6Months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6Months.push(monthStringInTZ(d));
  }

  const [revenueHistoryCollected, revenueHistoryExpected] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'paid', month: { $in: last6Months } } },
      { $group: { _id: '$month', total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Invoice.aggregate([
      {
        $match: { month: { $in: last6Months }, status: { $in: BILLABLE_INVOICE_STATUSES } },
      },
      { $group: { _id: '$month', total: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const collectedMap = Object.fromEntries(
    (revenueHistoryCollected as Array<{ _id: string; total: number }>).map((r) => [r._id, r.total]),
  );
  const expectedMap = Object.fromEntries(
    (revenueHistoryExpected as Array<{ _id: string; total: number }>).map((r) => [r._id, r.total]),
  );

  const revenueHistory = last6Months.map((m) => ({
    month: m,
    collected: collectedMap[m] ?? 0,
    expected: expectedMap[m] ?? 0,
  }));

  // Meal feedback trend: last 14 days
  const last14Days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    last14Days.push(dateStringInTZ(d));
  }

  const mealTrendRows = (await MealFeedback.aggregate([
    { $match: { date: { $in: last14Days } } },
    { $group: { _id: { date: '$date', mealType: '$mealType' }, avgRating: { $avg: '$rating' } } },
    { $sort: { '_id.date': 1 } },
  ])) as Array<{ _id: { date: string; mealType: string }; avgRating: number }>;

  const mealTrendMap: Record<string, Record<string, number>> = {};
  for (const row of mealTrendRows) {
    const date = row._id.date;
    if (!mealTrendMap[date]) mealTrendMap[date] = {};
    mealTrendMap[date][row._id.mealType] = Math.round(row.avgRating * 10) / 10;
  }

  const mealFeedbackTrend = last14Days.map((date) => ({
    date,
    breakfast: mealTrendMap[date]?.breakfast ?? 0,
    lunch: mealTrendMap[date]?.lunch ?? 0,
    dinner: mealTrendMap[date]?.dinner ?? 0,
  }));

  // Daily complaint count for current month (heatmap)
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const daysInCurrentMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const complaintDailyCounts = (await Complaint.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(currentYear, currentMonthIndex, 1),
          $lte: new Date(currentYear, currentMonthIndex, daysInCurrentMonth, 23, 59, 59, 999),
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: PG_TIMEZONE } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])) as Array<{ _id: string; count: number }>;

  const complaintHeatmap: Record<string, number> = {};
  for (const entry of complaintDailyCounts) {
    complaintHeatmap[entry._id] = entry.count;
  }

  // Occupancy history: last 6 months occupied vs total beds.
  // Counts only stays overlapping each month so checkouts stop contributing
  // after their moveOutDate instead of forward-filling indefinitely.
  const tenantsForStatsHistory = await Tenant.find({}).select('moveInDate moveOutDate').lean();
  const occupancyByMonth = new Map<string, number>();
  for (const t of tenantsForStatsHistory) {
    for (const m of last6Months) {
      if (isTenantActiveInMonth(t.moveInDate, t.moveOutDate, m)) {
        occupancyByMonth.set(m, (occupancyByMonth.get(m) ?? 0) + 1);
      }
    }
  }
  const occupancyHistory = last6Months.map((month) => ({
    month,
    occupied: occupancyByMonth.get(month) ?? 0,
    total: totalBeds,
  }));

  // Service health history: last 14 days of status changes
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const recentServiceChanges = await ServiceStatus.find({
    lastUpdatedAt: { $gte: fourteenDaysAgo },
  })
    .sort({ lastUpdatedAt: -1 } as Record<string, 1 | -1>)
    .limit(20)
    .populate('floor', 'label')
    .lean();

  const serviceHistory = recentServiceChanges.map((s) => {
    const doc = s as unknown as Record<string, unknown>;
    const floor = (doc.floorId ?? doc.floor) as Record<string, unknown> | undefined;
    const floorLabel = floor?.label ?? 'Unknown floor';
    const status = String(doc.status ?? 'unknown');
    const serviceType = String(doc.serviceType ?? 'unknown').replace(/_/g, ' ');
    return {
      id: String(doc._id ?? ''),
      date: doc.lastUpdatedAt ?? doc.updatedAt ?? new Date().toISOString(),
      title: `${serviceType} — ${status}`,
      description: `${floorLabel}: Service status changed to ${status}`,
      status: status === 'operational' ? 'success' : status === 'degraded' ? 'warning' : 'danger',
    };
  });

  return c.json({
    success: true,
    data: {
      occupancy: {
        totalRooms,
        totalBeds,
        occupiedBeds,
        vacancyRate: Math.round(vacancyRate * 100) / 100,
      },
      revenue: { collected: revenueCollected, expected: revenueExpected, month: currentMonth },
      complaints: {
        open: complaintStatusMap.open,
        inProgress: complaintStatusMap.in_progress,
        resolved: complaintStatusMap.resolved,
        dismissed: complaintStatusMap.dismissed,
      },
      complaintSla,
      services: {
        operational: serviceStatusMap.operational,
        degraded: serviceStatusMap.degraded,
        down: serviceStatusMap.down,
      },
      enquiries: {
        pending: pendingEnquiries,
        contacted: contactedEnquiries,
        newThisWeek: newThisWeekEnquiries,
      },
      pendingVerifications,
      recent: { complaints: recentComplaints, enquiries: recentEnquiries },
      revenueHistory,
      occupancyHistory,
      mealFeedbackTrend,
      amenityHealth,
      complaintsByCategory,
      paymentFunnel,
      complaintHeatmap,
      serviceHistory,
      roomOccupancyMatrix,
    },
  });
});

export default dashboard;
