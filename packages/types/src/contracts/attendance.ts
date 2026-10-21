import type { ModuleContract } from './module';

/**
 * The attendance contract.
 *
 * Every anchor below was read out of source on 2026-10-21:
 *
 * - statuses: apps/api/src/models/attendanceRecord.ts:39
 * - routes: apps/api/src/routes/attendance.ts
 * - the leave side effect that marks the days: apps/api/src/routes/leaves.ts:33-79
 * - the admin screens: apps/web/src/app/(admin)/attendance
 *
 * One record per resident per day. The gate writes present, the office writes
 * the rest by hand, and an approved leave marks the days as on_leave.
 */
export const ATTENDANCE_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'closing the day: seeing who came back tonight, who did not, and who is on an approved leave',
    doneLooksLike:
      'every resident has a record for today that says present, absent, on_leave or not_returned, and the day total matches the head count',
    primaryAction: 'Mark a resident present or absent for the day',
  },
  stateMachine: {
    domain: 'attendance',
    model: 'attendanceRecord',
    kind: 'grid',
    statuses: [
      {
        // The resident scanned in at the gate.
        status: 'present',
        enteredBy: {
          method: 'POST',
          path: '/attendance/check-in',
          condition:
            'the resident scans at the gate and the record is written with status=present, the check-in timestamp from the server clock and the method (qr, app or manual) (apps/api/src/routes/attendance.ts:86-167). A check-out stamps checkOut and keeps the status present',
        },
        // The record is keyed by one date, so it is closed when the day ends.
        dwell: 1,
        dwellUnit: 'days',
      },
      {
        // The office wrote the resident down.
        status: 'absent',
        enteredBy: {
          method: 'POST',
          path: '/attendance/manual',
          condition:
            'an admin marks a resident absent for a date by hand; no automatic rule ever writes absent (apps/api/src/routes/attendance.ts:231-289)',
        },
      },
      {
        // An approved leave covered the day.
        status: 'on_leave',
        enteredBy: {
          method: 'PUT',
          path: '/leaves/:id/approve',
          condition:
            'approving a leave marks every day of the range as on_leave with method=manual and the note Leave approved, and never overwrites a day the resident was actually on site (apps/api/src/routes/leaves.ts:33-79)',
        },
      },
      {
        // Nobody knows whether the resident came back.
        status: 'not_returned',
        enteredBy: {
          method: 'PUT',
          path: '/attendance/:id',
          condition:
            'an admin edits the record by hand; no cron and no automatic rule writes not_returned, it only exists because the model allows it (apps/api/src/models/attendanceRecord.ts:39, apps/api/src/routes/attendance.ts:665)',
        },
      },
    ],
  },
  truthContract: [
    {
      action: 'The resident checks in at the gate',
      operatorBelieves: 'the board shows the resident as present for today',
      serverCommits:
        'POST /attendance/check-in writes the record with status=present, the server clock as checkIn, the method that was used and recordedBy when an admin does it. A second scan for the same tenant and date is refused by the unique index (ALREADY_RECORDED) (apps/api/src/routes/attendance.ts:86-167).',
      mismatchSurfacedAt:
        'the today board and the month calendar; the resident sees the same record in the portal',
      provenance: {
        screen: '/attendance',
        actor: 'tenant',
      },
      stuckStateMeans:
        'the record exists with no check-in time, so the resident shows as present but nobody can say when they came',
      runbook3am:
        'open /attendance, switch to the day view and look at the records without a check-in time',
    },
    {
      action: 'An admin marks a resident absent by hand',
      operatorBelieves: 'the resident knows they were written down as absent',
      serverCommits:
        'POST /attendance/manual writes the record with the status the admin chose, the optional check-in and check-out times, the notes and recordedBy, and writes a create audit log entry (apps/api/src/routes/attendance.ts:231-289). It sends no notification: the resident sees the changed row on the next portal load.',
      mismatchSurfacedAt:
        'the month calendar shows the changed cell; the resident sees it on the next portal load',
      provenance: {
        auditAction: 'create',
        screen: '/attendance/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the resident was written down absent without a note, so nobody can explain it later',
      runbook3am: 'open /attendance, filter by status=absent, and write the note on the record',
    },
  ],
  layout: {
    archetype: 'calendar',
    grammarTokens: [
      'DataTable',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'TodayAttendanceBoard',
      'AttendanceMonthCalendar',
      'AttendanceRangeFilter',
    ],
    mustNotLookLike:
      'a roster of people: an attendance cell is a resident on a day, and the shape of the answer is a grid of days',
    ownNumber: 'residents not checked in today',
  },
  nextBestAction: {
    perStatus: {
      present: {
        label: 'Read the record',
        target: '/attendance/[id]',
      },
      absent: {
        label: 'Explain the absence',
        target: '/attendance/[id]',
      },
      on_leave: {
        label: 'Read the leave',
        target: '/leaves',
      },
      not_returned: {
        label: 'Find out what happened',
        target: '/attendance/[id]',
      },
    },
    perEmptyState: {
      attendance: {
        label: 'Mark a resident by hand',
        target: '/attendance/new',
      },
      today: {
        label: 'Open the today board',
        target: '/attendance',
      },
    },
  },
};
