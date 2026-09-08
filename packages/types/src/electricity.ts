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
  computedRoomTotal?: number;
  variance?: number;
  varianceReason?: string;
  billImageUrl?: string;
  /** Cloudinary public id for the uploaded bill image (null when URL-only). */
  billImagePublicId?: string | null;
  roomEntries: IRoomReading[];
  status: IElectricityBillStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IElectricityBillCreate {
  month: string;
  totalBillAmount: number;
  billImageUrl?: string;
  varianceReason?: string;
  roomEntries: Array<{
    roomId: string;
    previousReading: number;
    currentReading: number;
    ratePerUnit: number;
  }>;
  notes?: string;
}

export interface IElectricityBillUpdate {
  month?: string;
  totalBillAmount?: number;
  billImageUrl?: string;
  varianceReason?: string;
  roomEntries?: Array<{
    roomId: string;
    previousReading: number;
    currentReading: number;
    ratePerUnit: number;
  }>;
  notes?: string;
}
