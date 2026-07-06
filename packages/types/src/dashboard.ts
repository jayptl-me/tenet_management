export interface IOccupancyStats {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
}

export interface IRevenueStats {
  currentMonthCollected: number;
  currentMonthPending: number;
  currentMonthTotal: number;
}

export interface IComplaintStats {
  open: number;
  inProgress: number;
  urgent: number;
}

export interface IServiceStats {
  operational: number;
  degraded: number;
  down: number;
}

export interface IEnquiryStats {
  newToday: number;
  total: number;
}

export interface IRevenueHistoryPoint {
  month: string;
  collected: number;
  expected: number;
}

export interface IMealFeedbackTrendPoint {
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface IDashboardStats {
  occupancy: IOccupancyStats;
  revenue: IRevenueStats;
  complaints: IComplaintStats;
  services: IServiceStats;
  enquiries: IEnquiryStats;
  revenueHistory: IRevenueHistoryPoint[];
  mealFeedbackTrend: IMealFeedbackTrendPoint[];
}
