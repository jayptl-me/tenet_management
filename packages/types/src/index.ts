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
} from './common.js';

// ── Tokens (has runtime export) ────────────────────────
export type { IBrandTokens, StatusVariant } from './tokens.js';
export { DEFAULT_BRAND_TOKENS, STATUS_COLOR_MAP } from './tokens.js';

// ── User ───────────────────────────────────────────────
export type {
  IUserRole,
  IUser,
  IUserCreate,
  IUserWithTokens,
  ILoginRequest,
  IChangePasswordRequest,
} from './user.js';

// ── Floor ──────────────────────────────────────────────
export type { AmenityCount, IFloor, IFloorCreate } from './floor.js';

// ── Room ───────────────────────────────────────────────
export type { SharingType, IBed, IRoom, IRoomCreate, IRoomWithOccupants } from './room.js';

// ── Tenant ─────────────────────────────────────────────
export type {
  ITenantDocuments,
  IEmergencyContact,
  ITenant,
  ITenantCreate,
  ITenantTransfer,
} from './tenant.js';

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
} from './payment.js';

// ── Invoice ────────────────────────────────────────────
export type {
  IInvoiceStatus,
  IInvoiceLineItem,
  IInvoice,
  IInvoiceUpdate,
  IInvoiceGenerateSingle,
  IInvoiceListItem,
} from './invoice.js';

// ── Electricity ────────────────────────────────────────
export type { IElectricityBillStatus, IRoomReading, IElectricityBill } from './electricity.js';

// ── Complaint ──────────────────────────────────────────
export type {
  IComplaintCategory,
  IComplaintPriority,
  IComplaintStatus,
  IComplaint,
  IComplaintCreate,
  IComplaintStatusUpdate,
} from './complaint.js';

// ── Service ────────────────────────────────────────────
export type {
  IServiceType,
  IServiceStatus,
  IServiceStatusDoc,
  IServiceStatusUpdate,
} from './service.js';

// ── Meal ───────────────────────────────────────────────
export type { MealType, IMealFeedback, IMealFeedbackCreate, IMealFeedbackSummary } from './meal.js';

// ── Menu ───────────────────────────────────────────────
export type { IMenuItem, IDailyMenu } from './menu.js';

// ── Notification ───────────────────────────────────────
export type { INotificationType, INotification, INotificationCreate } from './notification.js';

// ── Enquiry ────────────────────────────────────────────
export type { IEnquiryStatus, IEnquiry, IEnquiryCreate } from './enquiry.js';

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
} from './appConfig.js';

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
} from './dashboard.js';

// ── Visitor ────────────────────────────────────────────
export type { IVisitor, IVisitorRegister } from './visitor.js';

// ── Laundry ────────────────────────────────────────────
export type {
  TimeSlot,
  MachineNumber,
  LaundrySlotStatus,
  ILaundrySlot,
  ILaundryBooking,
} from './laundry.js';

// ── Notice ─────────────────────────────────────────────
export type { NoticeTargetType, INoticePost, INoticePostCreate } from './notice.js';

// ── Audit ──────────────────────────────────────────────
export type { IAuditAction, IAuditLog } from './audit.js';

// ── Export ─────────────────────────────────────────────
export type { IExportFormat, IExportRequest } from './export.js';

// ── Attendance ─────────────────────────────────────────
export type {
  AttendanceStatus,
  AttendanceMethod,
  LeaveStatus,
  IAttendanceRecord,
  ILeaveApplication,
  ILeaveApplicationCreate,
} from './attendance.js';

// ── SSE ────────────────────────────────────────────────
export type { SSEEventType, SSEMessage } from './sse.js';

// ── Asset ──────────────────────────────────────────────
export type { AssetCategory, AssetStatus, IAsset, IAssetCreate, IAssetUpdate } from './asset.js';

// ── Guardian ───────────────────────────────────────────
export type {
  GuardianRelation,
  IGuardian,
  IGuardianCreate,
  IGuardianWardSummary,
} from './guardian.js';
