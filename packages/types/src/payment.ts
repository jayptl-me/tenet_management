export type IPaymentStatus = 'pending' | 'pending_verification' | 'paid' | 'overdue' | 'cancelled';

export type IPaymentType = 'rent' | 'electricity' | 'deposit' | 'laundry' | 'other';

export type IPaymentMethod = 'upi' | 'cash' | 'bank_transfer' | 'other';

export interface IPayment {
  id: string;
  tenantId: string;
  invoiceId: string;
  amount: number;
  type: IPaymentType;
  method: IPaymentMethod;
  status: IPaymentStatus;
  month: string;
  dueDate: string;
  paidAt: string | null;
  utrNumber?: string;
  verifiedBy?: string;
  screenshotUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface IPaymentQrResponse {
  qrDataUrl: string;
  upiDeepLink: string;
  amount: number;
  upiId: string;
  payeeName: string;
  invoiceNumber: string;
  transactionRef: string;
}

export interface IPaymentUtrSubmit {
  invoiceId: string;
  utrNumber: string;
}
