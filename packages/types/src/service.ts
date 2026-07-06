export type IServiceType =
  | 'wifi'
  | 'washing_machine_1'
  | 'washing_machine_2'
  | 'fridge'
  | 'water_supply'
  | 'electricity';

export type IServiceStatus = 'operational' | 'degraded' | 'down';

export interface IServiceStatusDoc {
  id: string;
  floorId: string;
  serviceType: IServiceType;
  status: IServiceStatus;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  note?: string;
  updatedAt: string;
}

export interface IServiceStatusUpdate {
  status: IServiceStatus;
  note?: string;
}
