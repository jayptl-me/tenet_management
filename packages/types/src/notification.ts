export type INotificationType =
  | 'payment_reminder'
  | 'payment_verified'
  | 'complaint_update'
  | 'announcement'
  | 'service_update'
  | 'electricity_bill'
  | 'welcome'
  | 'emergency'
  | 'meal_feedback';

export interface INotification {
  id: string;
  targetType: 'all' | 'individual' | 'room' | 'floor';
  targetIds: string[];
  title: string;
  body: string;
  type: INotificationType;
  data?: Record<string, string>;
  /** Permanent recipient set for history after mark-read (F1). */
  recipientUserIds: string[];
  unreadBy: string[];
  /** Present on list responses for the authenticated user (F2). */
  isRead?: boolean;
  sentAt: string;
  createdAt: string;
}

export interface INotificationCreate {
  targetType: 'all' | 'individual' | 'room' | 'floor';
  targetIds?: string[];
  title: string;
  body: string;
  type: INotificationType;
  data?: Record<string, string>;
  sendPush?: boolean;
}
