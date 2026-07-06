export type IEnquiryStatus = 'new' | 'contacted' | 'converted' | 'lost';

export interface IEnquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  preferredSharing: '2' | '3' | '4' | 'single';
  message?: string;
  status: IEnquiryStatus;
  source: 'landing_page' | 'referral' | 'other';
  createdAt: string;
}

export interface IEnquiryCreate {
  name: string;
  phone: string;
  email?: string;
  preferredSharing: '2' | '3' | '4' | 'single';
  message?: string;
}
