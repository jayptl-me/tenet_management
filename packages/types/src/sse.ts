/** Events pushed over the admin SSE channel */
export type SSEEventType =
  | 'new_complaint'
  | 'complaint_updated'
  | 'payment_received'
  | 'payment_verified'
  | 'new_enquiry'
  | 'notification_created'
  | 'tenant_checkin'
  | 'tenant_checkout'
  | 'meal_feedback_submitted'
  | 'emergency_alert'
  | 'service_update';

export interface SSEMessage {
  event: SSEEventType;
  data: unknown;
  timestamp: string;
}
