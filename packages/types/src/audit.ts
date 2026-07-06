// ── Audit Log ──────────────────────────────────────────
export type IAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'payment_verify'
  | 'complaint_status_change'
  | 'tenant_checkout'
  | 'tenant_transfer'
  | 'settings_change'
  | 'notification_send'
  | 'visitor_approve'
  | 'export';

export interface IAuditLog {
  id: string;
  userId: string;
  action: IAuditAction;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}
