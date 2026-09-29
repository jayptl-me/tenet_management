export type GovIdType = 'aadhaar' | 'passport' | 'voter_id' | 'driving_license';

export interface ITenantDocuments {
  idType?: GovIdType;
  idNumberMasked?: string;
  idUrl?: string;
  idPublicId?: string;
  photoUrl?: string;
  photoPublicId?: string;
  isVerified?: boolean;
  verifiedAt?: string;
  consentGiven?: boolean;
  consentTimestamp?: string;
  // Backward compatibility fields
  aadhaarUrl?: string;
  aadhaarPublicId?: string;
}

export interface IEmergencyContact {
  name?: string;
  phone?: string;
  relation?: string;
}

export interface ILocalReference {
  name?: string;
  phone?: string;
  address?: string;
  relation?: string;
}

export interface IVerificationProfile {
  fatherOrSpouseName?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  identificationMark?: string;
  permanentAddress?: {
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    policeStation?: string;
  };
  occupation?: {
    category?: 'salaried' | 'student' | 'business' | 'other';
    organizationName?: string;
    officeAddress?: string;
    idNumber?: string;
    contactPhone?: string;
  };
  localReferences?: ILocalReference[];
  stayPurpose?: string;
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
  verificationProfile?: IVerificationProfile;
  createdAt: string;
  updatedAt: string;
}

export interface ITenantCreate {
  name: string;
  email: string;
  phone: string;
  roomId: string;
  bedId: string;
  moveInDate: string;
  depositPaid: number;
  monthlyRent: number;
  documents?: ITenantDocuments;
  emergencyContact?: IEmergencyContact;
  verificationProfile?: IVerificationProfile;
}

export interface ITenantTransfer {
  tenantId: string;
  newRoomId: string;
  newBedId: string;
  effectiveDate: string;
  reason?: string;
}

export interface ITenantCreateResponse extends ITenant {
  temporaryPassword?: string;
}
