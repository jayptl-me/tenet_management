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

/** Admin offline payment body — POST /payments/offline */
export interface IOfflinePaymentCreate {
  tenantId: string;
  invoiceId: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'other';
  paidAt: string;
  notes?: string;
}

export interface IPaymentUpdate {
  amount?: number;
  method?: IPaymentMethod;
  type?: IPaymentType;
  status?: IPaymentStatus;
  notes?: string;
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

/** Populated list row shape returned by GET /payments */
export interface IPaymentListItem extends Omit<IPayment, 'tenantId' | 'invoiceId'> {
  tenantId: {
    id?: string;
    _id?: string;
    userId?: { name?: string; email?: string; phone?: string };
    roomId?: { roomNumber?: string; floorId?: string };
  } | string;
  invoiceId: {
    id?: string;
    _id?: string;
    invoiceNumber?: string;
    month?: string;
    totalAmount?: number;
    status?: string;
  } | string;
}
