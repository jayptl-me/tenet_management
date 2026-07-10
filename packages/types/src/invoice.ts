export type IInvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';

export interface IInvoiceLineItem {
  description: string;
  amount: number;
}

export interface IInvoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  month: string;
  generatedAt: string;
  lineItems: IInvoiceLineItem[];
  rentAmount: number;
  electricityAmount: number;
  otherCharges: number;
  totalAmount: number;
  /** ISO date string; 5th of billing month by default. May be null on legacy docs. */
  dueDate: string | null;
  status: IInvoiceStatus;
  createdAt: string;
}

export interface IInvoiceUpdate {
  rentAmount?: number;
  electricityAmount?: number;
  otherCharges?: number;
  lineItems?: IInvoiceLineItem[];
  status?: 'draft' | 'sent' | 'overdue' | 'cancelled';
  dueDate?: string;
}

export interface IInvoiceGenerateSingle {
  tenantId: string;
  month: string;
}

/** Populated list row shape returned by GET /invoices */
export interface IInvoiceListItem extends Omit<IInvoice, 'tenantId'> {
  tenantId:
    | {
        id?: string;
        _id?: string;
        userId?: { name?: string; email?: string; phone?: string };
        roomId?: { roomNumber?: string; floorId?: string };
      }
    | string;
}
