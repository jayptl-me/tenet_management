export interface ITenantDocuments {
  aadhaarUrl?: string;
  photoUrl?: string;
}

export interface IEmergencyContact {
  name?: string;
  phone?: string;
  relation?: string;
}

export interface ITenant {
  id: string;
  userId: string;
  roomId: string;
  bedId: string;
  moveInDate: string;
  moveOutDate: string | null;
  depositPaid: number;
  monthlyRent: number;
  isActive: boolean;
  documents: ITenantDocuments;
  emergencyContact: IEmergencyContact;
  createdAt: string;
  updatedAt: string;
}

export interface ITenantCreate {
  userId: string;
  roomId: string;
  bedId: string;
  moveInDate: string;
  depositPaid: number;
  monthlyRent: number;
  documents?: ITenantDocuments;
  emergencyContact?: IEmergencyContact;
}

export interface ITenantTransfer {
  tenantId: string;
  newRoomId: string;
  newBedId: string;
  effectiveDate: string;
  reason?: string;
}
