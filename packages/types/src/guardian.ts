// ── Guardian ───────────────────────────────────────────
export type GuardianRelation = 'father' | 'mother' | 'guardian' | 'other';

export interface IGuardian {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  relation: GuardianRelation;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IGuardianCreate {
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  relation: GuardianRelation;
  tenantId: string;
}

export interface IGuardianWardSummary {
  tenantName: string;
  roomNumber: string;
  floorLabel: string;
  rentStatus: string;
  attendanceStatus?: string;
}
