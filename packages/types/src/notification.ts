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
  unreadBy: string[];
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
