/** Service type is now dynamic — validated against AppConfig.amenityDefinitions at route level. */
export type IServiceType = string;

export type IServiceStatus = 'operational' | 'degraded' | 'down';

export interface IServiceStatusDoc {
  id: string;
  floorId: string;
  serviceType: IServiceType;
  status: IServiceStatus;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  note?: string;
  openComplaintCount?: number;
  updatedAt: string;
}

export interface IServiceStatusUpdate {
  status: IServiceStatus;
  note?: string;
}

export interface IServiceCreate {
  floorId: string;
  serviceType: string;
  status?: IServiceStatus;
  note?: string;
}
