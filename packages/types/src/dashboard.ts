export interface IDashboardOccupancyStats {
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacancyRate: number;
}

export interface IDashboardRevenueStats {
  collected: number;
  expected: number;
  month: string;
}

export interface IDashboardComplaintStats {
  open: number;
  inProgress: number;
  resolved: number;
  dismissed: number;
}

export interface IDashboardServiceStats {
  operational: number;
  degraded: number;
  down: number;
}

export interface IDashboardEnquiryStats {
  pending: number;
  contacted?: number;
  newThisWeek?: number;
}

export interface IRevenueHistoryPoint {
  month: string;
  collected: number;
  expected: number;
}

export interface IOccupancyHistoryPoint {
  month: string;
  occupied: number;
  total: number;
}

export interface IMealFeedbackTrendPoint {
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface IServiceHistoryEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  status: 'success' | 'warning' | 'danger';
}

export interface IComplaintByCategory {
  _id: string;
  count: number;
}

export interface IPaymentFunnelStage {
  count: number;
  totalAmount: number;
}

export interface IAmenityHealthBreakdown {
  operational: number;
  degraded: number;
  down: number;
  total: number;
}

export interface IDashboardComplaintRecent {
  _id: string;
  title: string;
  status: string;
  category?: string;
  tenantId?: { userId?: { name: string } };
  createdAt: string;
}

export interface IDashboardEnquiryRecent {
  _id: string;
  name: string;
  phone: string;
  status: string;
  createdAt: string;
}

export interface IDashboardRecent {
  complaints: IDashboardComplaintRecent[];
  enquiries: IDashboardEnquiryRecent[];
}

export interface IComplaintSlaMetrics {
  aging: {
    under24h: number;
    between24And48h: number;
    over48h: number;
  };
  priority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  avgResolutionHours: number | null;
  slaComplianceRate: number;
}

export interface IDashboardStats {
  occupancy: IDashboardOccupancyStats;
  revenue: IDashboardRevenueStats;
  complaints: IDashboardComplaintStats;
  complaintSla?: IComplaintSlaMetrics;
  services: IDashboardServiceStats;
  enquiries: IDashboardEnquiryStats;
  recent: IDashboardRecent;
  revenueHistory: IRevenueHistoryPoint[];
  occupancyHistory?: IOccupancyHistoryPoint[];
  mealFeedbackTrend: IMealFeedbackTrendPoint[];
  complaintsByCategory: IComplaintByCategory[];
  paymentFunnel: Record<string, IPaymentFunnelStage>;
  amenityHealth: Record<string, IAmenityHealthBreakdown>;
  complaintHeatmap: Record<string, number>;
  serviceHistory?: IServiceHistoryEvent[];
}
