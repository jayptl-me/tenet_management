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
  status: IInvoiceStatus;
  createdAt: string;
}
