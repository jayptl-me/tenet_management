// ── Attendance ─────────────────────────────────────────
export type AttendanceStatus = 'present' | 'absent' | 'on_leave' | 'not_returned';

export type AttendanceMethod = 'manual' | 'qr' | 'app';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface IAttendanceRecord {
  id: string;
  tenantId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  method: AttendanceMethod;
  recordedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface ILeaveApplication {
  id: string;
  tenantId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: string;
  adminNotes?: string;
  createdAt: string;
}

export interface ILeaveApplicationCreate {
  fromDate: string;
  toDate: string;
  reason: string;
}
