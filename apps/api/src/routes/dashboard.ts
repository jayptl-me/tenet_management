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

const dashboard = new Hono();

// ── Helper: format month string ──────────────────────────
function getMonthString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ── GET /dashboard/stats ────────────────────────────────
dashboard.get('/stats', authGuard, adminOnly, async (c) => {
  const now = new Date();
  const currentMonth = getMonthString(now);

  // --- Occupancy: sum occupied beds across all active rooms ---
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
    // Revenue: sum of paid payments for current month
    Payment.aggregate([
      { $match: { status: 'paid', month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    // Expected revenue: sum of invoice totals for current month
    Invoice.aggregate([
      { $match: { month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),

    // Complaints count by status
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),

    // Services count by status
    ServiceStatus.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),

    // Pending enquiries
    Enquiry.countDocuments({ status: 'new' } as Record<string, unknown>),

    // Recent 5 complaints, populated with tenant -> user
    Complaint.find()
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .limit(5)
      .populate({
        path: 'tenantId',
        populate: { path: 'userId' },
      })
      .lean(),

    // Recent 5 enquiries
    Enquiry.find()
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .limit(5)
      .lean(),
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

  // Extract revenue totals from aggregation results
  const revenueCollected = (paymentAgg as Array<{ _id: null; total: number }>)[0]?.total ?? 0;
  const revenueExpected = (invoiceAgg as Array<{ _id: null; total: number }>)[0]?.total ?? 0;

  // Vacancy rate
  const vacancyRate = totalBeds > 0 ? ((totalBeds - occupiedBeds) / totalBeds) * 100 : 0;

  // ── Revenue history: last 6 months ──────────────────
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

  // ── Meal feedback trend: last 14 days ──────────────
  const last14Days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    last14Days.push(getDateString(d));
  }

  const mealTrendRows = (await MealFeedback.aggregate([
    { $match: { date: { $in: last14Days } } },
    {
      $group: {
        _id: { date: '$date', mealType: '$mealType' },
        avgRating: { $avg: '$rating' },
      },
    },
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

  return c.json({
    success: true,
    data: {
      occupancy: {
        totalRooms,
        occupiedBeds,
        vacancyRate: Math.round(vacancyRate * 100) / 100,
      },
      revenue: {
        collected: revenueCollected,
        expected: revenueExpected,
        month: currentMonth,
      },
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
      enquiries: {
        pending: pendingEnquiries,
      },
      recent: {
        complaints: recentComplaints,
        enquiries: recentEnquiries,
      },
      revenueHistory,
      mealFeedbackTrend,
    },
  });
});

export default dashboard;
