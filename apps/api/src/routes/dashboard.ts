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
import { Notification } from '../models/notification.js';
import { Tenant } from '../models/tenant.js';

const dashboard = new Hono();

// ── Helpers ─────────────────────────────────────────────

function getMonthString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ── GET /dashboard/badges ────────────────────────────────
dashboard.get('/badges', authGuard, adminOnly, async (c) => {
  const [unreadNotifications, openComplaints, pendingEnquiries] = await Promise.all([
    Notification.countDocuments({ readBy: { $size: 0 } } as Record<string, unknown>),
    Complaint.countDocuments({ status: 'open' } as Record<string, unknown>),
    Enquiry.countDocuments({ status: 'new' } as Record<string, unknown>),
  ]);

  return c.json({
    success: true,
    data: {
      unreadNotifications,
      openComplaints,
      pendingEnquiries,
    },
  });
});

// ── GET /dashboard/occupancy-history ──────────────────────
dashboard.get('/occupancy-history', authGuard, adminOnly, async (c) => {
  const now = new Date();
  const last6Months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6Months.push(getMonthString(d));
  }

  const allRooms = (await Room.find({ isActive: true }).lean()) as Array<{
    beds?: Array<{ isOccupied: boolean }>;
  }>;
  const totalBeds = allRooms.reduce((sum, r) => sum + (r.beds?.length ?? 0), 0);

  const activeTenants = await Tenant.find({ isActive: true }).select('moveInDate').lean();
  const occupancyByMonth = new Map<string, number>();
  for (const t of activeTenants) {
    if (t.moveInDate) {
      const month = getMonthString(new Date(String(t.moveInDate)));
      for (const m of last6Months) {
        if (m >= month) {
          occupancyByMonth.set(m, (occupancyByMonth.get(m) ?? 0) + 1);
        }
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
  const currentMonth = getMonthString(now);

  // --- Occupancy ---
  type RoomDoc = { beds?: Array<{ isOccupied: boolean }>; length?: number };
  const allActiveRooms: RoomDoc[] = (await Room.find({ isActive: true }).lean()) as RoomDoc[];
  const totalRooms = allActiveRooms.length;
  const totalBeds = allActiveRooms.reduce((sum: number, r: RoomDoc) => sum + (r.beds?.length ?? 0), 0);
  const occupiedBeds = allActiveRooms.reduce(
    (sum: number, r: RoomDoc) => sum + (r.beds?.filter((b: { isOccupied: boolean }) => b.isOccupied).length ?? 0),
    0,
  );

  const [
    paymentAgg,
    invoiceAgg,
    complaintsByStatus,
    servicesByStatus,
    pendingEnquiries,
    recentComplaints,
    recentEnquiries,
  ] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'paid', month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Invoice.aggregate([
      { $match: { month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ServiceStatus.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Enquiry.countDocuments({ status: 'new' } as Record<string, unknown>),
    Complaint.find()
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .limit(5)
      .populate({ path: 'tenantId', populate: { path: 'userId' } })
      .lean(),
    Enquiry.find()
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .limit(5)
      .lean(),
  ]);

  // Build complaint status counts map
  const complaintStatusMap: Record<string, number> = {
    open: 0, in_progress: 0, resolved: 0, dismissed: 0,
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

  const amenityHealth: Record<string, { operational: number; degraded: number; down: number; total: number }> = {};
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
    last6Months.push(getMonthString(d));
  }

  const [revenueHistoryCollected, revenueHistoryExpected] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'paid', month: { $in: last6Months } } },
      { $group: { _id: '$month', total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Invoice.aggregate([
      { $match: { month: { $in: last6Months } } },
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
    last14Days.push(getDateString(d));
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
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])) as Array<{ _id: string; count: number }>;

  const complaintHeatmap: Record<string, number> = {};
  for (const entry of complaintDailyCounts) {
    complaintHeatmap[entry._id] = entry.count;
  }

  // Occupancy history: last 6 months occupied vs total beds
  const activeTenantsForHistory = await Tenant.find({ isActive: true }).select('moveInDate').lean();
  const occupancyByMonth = new Map<string, number>();
  for (const t of activeTenantsForHistory) {
    if (t.moveInDate) {
      const month = getMonthString(new Date(String(t.moveInDate)));
      for (const m of last6Months) {
        if (m >= month) {
          occupancyByMonth.set(m, (occupancyByMonth.get(m) ?? 0) + 1);
        }
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
      occupancy: { totalRooms, occupiedBeds, vacancyRate: Math.round(vacancyRate * 100) / 100 },
      revenue: { collected: revenueCollected, expected: revenueExpected, month: currentMonth },
      complaints: {
        open: complaintStatusMap.open,
        inProgress: complaintStatusMap.in_progress,
        resolved: complaintStatusMap.resolved,
        dismissed: complaintStatusMap.dismissed,
      },
      services: {
        operational: serviceStatusMap.operational,
        degraded: serviceStatusMap.degraded,
        down: serviceStatusMap.down,
      },
      enquiries: { pending: pendingEnquiries },
      recent: { complaints: recentComplaints, enquiries: recentEnquiries },
      revenueHistory,
      occupancyHistory,
      mealFeedbackTrend,
      amenityHealth,
      complaintsByCategory,
      paymentFunnel,
      complaintHeatmap,
      serviceHistory,
    },
  });
});

export default dashboard;
