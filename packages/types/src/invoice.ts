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
  /**
   * Server-computed settled part of this invoice: the sum of every PAID
   * payment row, NOT capped at totalAmount. It can be larger than
   * totalAmount when the invoice was over-collected, so the invoice view can
   * never under-report what the payments ledger shows. Only the API may set
   * it: clients must never derive it from the gross total.
   */
  paidAmount?: number;
  /**
   * Server-computed amount still due on this invoice: max(0, totalAmount -
   * paidAmount). Never negative. `null` when the server could not compute it
   * (the invoice total is not known): an unknown balance is OUTSTANDING,
   * never zero, and must never be read as a settled invoice. Only the API may
   * set it: clients must never derive it from the gross total.
   */
  balance?: number | null;
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

/**
 * Populated list row shape returned by GET /invoices.
 * Includes the server-computed `paidAmount` and `balance` fields.
 */
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
