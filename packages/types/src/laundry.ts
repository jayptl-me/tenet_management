// ── Laundry ────────────────────────────────────────────
export type TimeSlot =
  | '06-08'
  | '08-10'
  | '10-12'
  | '12-14'
  | '14-16'
  | '16-18'
  | '18-20'
  | '20-22';

export type MachineNumber = 1 | 2;

export type LaundrySlotStatus = 'available' | 'booked' | 'maintenance';

export interface ILaundrySlot {
  id: string;
  floorId: string;
  machineNumber: MachineNumber;
  date: string;
  timeSlot: TimeSlot;
  tenantId: string | null;
  bookingId: string | null;
  status: LaundrySlotStatus;
}

export interface ILaundryBooking {
  date: string;
  timeSlot: TimeSlot;
  machineNumber: MachineNumber;
}
