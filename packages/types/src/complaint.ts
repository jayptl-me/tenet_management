export type IComplaintCategory =
  | 'wifi'
  | 'water'
  | 'electricity'
  | 'food_quality'
  | 'cleaning_room'
  | 'cleaning_washroom'
  | 'washing_machine'
  | 'fridge'
  | 'lights'
  | 'noise'
  | 'other';

export type IComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export type IComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export interface IComplaint {
  id: string;
  tenantId: string;
  roomId: string;
  category: IComplaintCategory;
  title: string;
  description: string;
  photos: string[];
  priority: IComplaintPriority;
  status: IComplaintStatus;
  adminNotes?: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IComplaintCreate {
  roomId: string;
  category: IComplaintCategory;
  title: string;
  description: string;
  photos?: string[];
  priority?: IComplaintPriority;
}

export interface IComplaintStatusUpdate {
  status: IComplaintStatus;
  adminNotes?: string;
}
