export interface IFloor {
  id: string;
  floorNumber: number;
  label: string;
  totalRooms: number;
  amenities: {
    washingMachines: number;
    fridges: number;
  };
  createdAt: string;
}

export interface IFloorCreate {
  floorNumber: number;
  label: string;
  totalRooms: number;
  amenities: {
    washingMachines: number;
    fridges: number;
  };
}
