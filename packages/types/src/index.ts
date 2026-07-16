// ── Common ─────────────────────────────────────────────
export type {
  IPaginationParams,
  IPaginatedResponse,
  IApiSuccess,
  IApiError,
  IApiResponse,
  MonthString,
  INR,
  IAddress,
  ISocialLinks,
} from './common';

// ── Tokens (has runtime export) ────────────────────────
export type { IBrandTokens, StatusVariant } from './tokens';
export { DEFAULT_BRAND_TOKENS, STATUS_COLOR_MAP } from './tokens';

// ── User ───────────────────────────────────────────────
export type {
  IUserRole,
  IUser,
  IUserCreate,
  IUserWithTokens,
  ILoginRequest,
  IChangePasswordRequest,
} from './user';

// ── Floor ──────────────────────────────────────────────
export type { AmenityCount, IFloor, IFloorCreate } from './floor';

// ── Room ───────────────────────────────────────────────
export type { SharingType, IBed, IRoom, IRoomCreate, IRoomWithOccupants } from './room';

// ── Tenant ─────────────────────────────────────────────
export type {
  ITenantDocuments,
  IEmergencyContact,
  ITenant,
  ITenantCreate,
  ITenantTransfer,
} from './tenant';

// ── Payment ────────────────────────────────────────────
export type {
  IPaymentStatus,
  IPaymentType,
  IPaymentMethod,
  IPayment,
  IOfflinePaymentCreate,
  IPaymentUpdate,
  IPaymentQrResponse,
  IPaymentUtrSubmit,
  IPaymentListItem,
} from './payment';

// ── Invoice ────────────────────────────────────────────
export type {
  IInvoiceStatus,
  IInvoiceLineItem,
  IInvoice,
  IInvoiceUpdate,
  IInvoiceGenerateSingle,
  IInvoiceListItem,
} from './invoice';

// ── Electricity ────────────────────────────────────────
export type { IElectricityBillStatus, IRoomReading, IElectricityBill } from './electricity';

// ── Complaint ──────────────────────────────────────────
export type {
  IComplaintCategory,
  IComplaintPriority,
  IComplaintStatus,
  IComplaint,
  IComplaintCreate,
  IComplaintStatusUpdate,
} from './complaint';

// ── Service ────────────────────────────────────────────
export type {
  IServiceType,
  IServiceStatus,
  IServiceStatusDoc,
  IServiceStatusUpdate,
} from './service';

// ── Meal ───────────────────────────────────────────────
export type {
  MealType,
  MealFeedbackStatus,
  MealFeedbackCategory,
  IMealFeedback,
  IMealFeedbackCreate,
  IAdminMealFeedbackCreate,
  IMealFeedbackSummaryRow,
  IMealFeedbackSummary,
} from './meal';

// ── Menu ───────────────────────────────────────────────
export type { IMenuItem, IDailyMenu, IDailyMenuCreate } from './menu';

// ── Notification ───────────────────────────────────────
export type { INotificationType, INotification, INotificationCreate } from './notification';

// ── Enquiry ────────────────────────────────────────────
export type { IEnquiryStatus, IEnquiry, IEnquiryCreate } from './enquiry';

// ── AppConfig ──────────────────────────────────────────
export type {
  AmenityCategory,
  AmenityDefinition,
  ThemePreset,
  ThemeMode,
  ThemeSettings,
  ITestimonial,
  IFeatureFlags,
  IAppConfig,
  IAppConfigPublic,
  IAppConfigUpdate,
} from './appConfig';

// ── Dashboard ──────────────────────────────────────────
export type {
  IDashboardOccupancyStats,
  IDashboardRevenueStats,
  IDashboardComplaintStats,
  IDashboardServiceStats,
  IDashboardEnquiryStats,
  IRevenueHistoryPoint,
  IOccupancyHistoryPoint,
  IMealFeedbackTrendPoint,
  IServiceHistoryEvent,
  IComplaintByCategory,
  IPaymentFunnelStage,
  IAmenityHealthBreakdown,
  IDashboardComplaintRecent,
  IDashboardEnquiryRecent,
  IDashboardRecent,
  IDashboardStats,
} from './dashboard';

// ── Visitor ────────────────────────────────────────────
export type { IVisitor, IVisitorRegister } from './visitor';

// ── Laundry ────────────────────────────────────────────
export type {
  LaundrySlotStatus,
  ILaundrySlot,
  ILaundrySlotCreate,
  ILaundrySlotUpdate,
} from './laundry';

// ── Notice ─────────────────────────────────────────────
export type { NoticeTargetType, INoticePost, INoticePostCreate } from './notice';

// ── Audit ──────────────────────────────────────────────
export type { IAuditAction, IAuditLog } from './audit';

// ── Export ─────────────────────────────────────────────
export type { IExportFormat, IExportRequest } from './export';

// ── Attendance ─────────────────────────────────────────
export type {
  AttendanceStatus,
  AttendanceMethod,
  LeaveStatus,
  IAttendanceRecord,
  ILeaveApplication,
  ILeaveApplicationCreate,
} from './attendance';

// ── SSE ────────────────────────────────────────────────
export type { SSEEventType, SSEMessage } from './sse';

// ── Asset ──────────────────────────────────────────────
export type { AssetCategory, AssetStatus, IAsset, IAssetCreate, IAssetUpdate } from './asset';

// ── Guardian ───────────────────────────────────────────
export type {
  GuardianRelation,
  IGuardian,
  IGuardianCreate,
  IGuardianWardSummary,
} from './guardian';
