// ── Attendance ─────────────────────────────────────────
export type AttendanceStatus = 'present' | 'absent' | 'on_leave' | 'not_returned';

export type AttendanceMethod = 'manual' | 'qr' | 'app';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

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

export interface IAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  onLeave: number;
  notReturned: number;
}

export interface IAttendanceTodayResponse {
  date: string;
  summary: IAttendanceSummary;
  records: IAttendancePopulatedRecord[];
}

export interface IAttendanceDayCounts {
  present: number;
  absent: number;
  on_leave: number;
  not_returned: number;
  total: number;
}

export interface IAttendanceSummaryResponse {
  fromDate: string;
  toDate: string;
  tenantId: string | null;
  days: Record<string, IAttendanceDayCounts>;
}

export interface IAttendanceRangeQuery {
  fromDate?: string;
  toDate?: string;
  status?: AttendanceStatus | '';
  method?: AttendanceMethod | '';
  tenantId?: string;
}

export interface IAttendanceCheckInRequest {
  tenantId: string;
  method?: AttendanceMethod;
}

export interface IAttendanceCheckOutRequest {
  tenantId: string;
}

export interface IAttendanceManualCreate {
  tenantId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  method?: AttendanceMethod;
  notes?: string;
}

export interface IAttendanceUpdate {
  date?: string;
  status?: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
}

export interface IAttendancePopulatedRecord {
  _id?: string;
  id?: string;
  tenantId?: string;
  tenant?: {
    _id: string;
    user?: {
      _id: string;
      name: string;
      email?: string;
      phone?: string;
    } | null;
    room?: {
      _id: string;
      roomNumber: string;
    } | null;
  } | null;
  date: string;
  status: AttendanceStatus;
  method?: AttendanceMethod;
  checkIn?: string | null;
  checkOut?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  recordedBy?:
    | {
        _id: string;
        name: string;
      }
    | string
    | null;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
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
  tenantId?: string;
  fromDate: string;
  toDate: string;
  reason: string;
}
