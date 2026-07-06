export type IElectricityBillStatus = 'draft' | 'finalized' | 'distributed';

export interface IRoomReading {
  roomId: string;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  amount: number;
}

export interface IElectricityBill {
  id: string;
  month: string;
  totalBillAmount: number;
  billImageUrl?: string;
  roomEntries: IRoomReading[];
  status: IElectricityBillStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
