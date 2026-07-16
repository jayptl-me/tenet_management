export type SharingType = 2 | 3 | 4;

export interface RoomAmenityStatus {
  amenityKey: string;
  status: 'operational' | 'degraded' | 'down';
}

export interface IBed {
  bedId: 'A' | 'B' | 'C' | 'D';
  isOccupied: boolean;
  tenantId: string | null;
}

export interface IRoom {
  id: string;
  roomNumber: string;
  floorId: string;
  floorLabel?: string;
  floorNumber?: number;
  sharingType: SharingType;
  monthlyRent: number;
  isActive: boolean;
  description?: string;
  photos: string[];
  beds: IBed[];
  occupancyCount: number;
  /** Non-per-floor amenity statuses (isPerFloor=false defs). */
  roomAmenities?: RoomAmenityStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface IRoomCreate {
  roomNumber: string;
  floorId: string;
  sharingType: SharingType;
  monthlyRent: number;
  description?: string;
  photos?: string[];
  roomAmenities?: RoomAmenityStatus[];
}

export interface IRoomWithOccupants {
  id: string;
  roomNumber: string;
  floorId: string;
  floorLabel?: string;
  floorNumber?: number;
  sharingType: SharingType;
  monthlyRent: number;
  isActive: boolean;
  description?: string;
  photos: string[];
  beds: IBed[];
  occupancyCount: number;
  createdAt: string;
  updatedAt: string;
  tenants?: Array<{
    id: string;
    name: string;
    bedId: string;
    moveInDate: string;
  }>;
}
