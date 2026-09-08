export type IEnquiryStatus = 'new' | 'contacted' | 'converted' | 'lost';

export type IEnquirySource = 'landing_page' | 'referral' | 'walk_in' | 'phone_call' | 'other';

export type IPreferredSharing = '2' | '3' | '4' | 'single';

export interface IEnquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  preferredSharing: IPreferredSharing;
  message?: string;
  status: IEnquiryStatus;
  source: IEnquirySource;
  notes?: string;
  convertedTenantId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface IEnquiryCreate {
  name: string;
  phone: string;
  email?: string;
  preferredSharing: IPreferredSharing;
  message?: string;
  source?: IEnquirySource;
  notes?: string;
}

export interface IEnquiryStats {
  byStatus: Record<IEnquiryStatus, number>;
  bySource: Record<IEnquirySource, number>;
  total: number;
  conversionRate: number;
}
