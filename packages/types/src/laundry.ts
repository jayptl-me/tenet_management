// ── Laundry ────────────────────────────────────────────
// Mirrors apps/api LaundrySlot model (tenant booking slots).
// Prior fiction (floor/machine grid status) removed -- code is truth.

export type LaundrySlotStatus = 'booked' | 'confirmed' | 'completed' | 'cancelled';

export interface ILaundrySlot {
  id: string;
  tenantId: string;
  /** YYYY-MM-DD */
  slotDate: string;
  slotTime: string;
  items?: number;
  status: LaundrySlotStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Populated on list/detail */
  tenant?: {
    id?: string;
    user?: { name?: string; email?: string; phone?: string };
    room?: { roomNumber?: string };
  };
}

export interface ILaundrySlotCreate {
  tenantId: string;
  slotDate: string;
  slotTime: string;
  items?: number;
  notes?: string;
  status?: LaundrySlotStatus;
}

export interface ILaundrySlotUpdate {
  slotDate?: string;
  slotTime?: string;
  items?: number;
  notes?: string;
  status?: LaundrySlotStatus;
}
