export interface AmenityCount {
  amenityKey: string;
  count: number;
}

export interface IFloor {
  id: string;
  floorNumber: number;
  label: string;
  totalRooms: number;
  amenityCounts: AmenityCount[];
  /** @deprecated Use amenityCounts instead */
  amenities?: {
    washingMachines: number;
    fridges: number;
  };
  createdAt: string;
}

export interface IFloorCreate {
  floorNumber: number;
  label: string;
  totalRooms: number;
  amenityCounts?: AmenityCount[];
}
