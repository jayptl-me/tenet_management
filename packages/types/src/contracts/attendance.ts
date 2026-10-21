import type { ModuleContract } from './module';

/**
 * The attendance contract.
 *
 * Every anchor below was read out of source on 2026-10-21, before and after the depth rebuild of
 * the four admin screens (2026-10-21, wave 6):
 *
 * - the model: apps/api/src/models/attendanceRecord.ts
 * - the routes: apps/api/src/routes/attendance.ts
 * - the leave side effect that writes the leave days: apps/api/src/routes/leaves.ts:28-79
 * - the leave approval that triggers it: apps/api/src/routes/leaves.ts:649-650
 * - the roster the day board is read against: apps/api/src/routes/tenants.ts:391-483
 * - the write trail: apps/api/src/routes/audit.ts:13-52
 * - the portal half: mobile/lib/features/tenant/presentation/attendance_screen.dart
 * - the admin screens: apps/web/src/app/(admin)/attendance
 *
 * THE GRID, in full. One record is one resident on one day, and it holds exactly one of these
 * four states:
 *
 *   present       the resident was on site; the gate or the office wrote it
 *   absent        the office wrote the resident down as not on site
 *   on_leave      an approved leave covered the day, or the office wrote it by hand
 *   not_returned  the resident never came back, and nobody closed the day
 *
 * There is no ladder here: a record does not move from absent to present on its own. The office
 * corrects it with a write, and the write is what the truth contract below describes. The shared
 * lifecycle vocabulary carries no attendance domain, so this module declares a grid and the
 * screens show a grid of days, not a progression.
 *
 * A day is not a state. A day is a set of residents, and the day is complete when every active
 * resident holds a record for it. The server holds no list of the residents who are missing, so
 * the day board reads that list from two server answers: the roster of the active residents and
 * the records of the day.
 */
export const ATTENDANCE_CONTRACT: ModuleContract = {
  canonicalLoop: {
    operatorIsDoing:
      'closing the day: finding the residents nobody marked, the records that disagree with themselves, and the days nobody rostered, and closing them from where the office stands',
    doneLooksLike:
      'every active resident holds a record for the day that says present, absent, on_leave or not_returned, no record of the day contradicts its own times, and every day of the last fortnight holds at least one record',
    primaryAction: 'Mark the residents who have no record for the day',
  },
  stateMachine: {
    domain: 'attendance',
    model: 'attendanceRecord',
    kind: 'grid',
    statuses: [
      {
        // The resident was on site.
        status: 'present',
        enteredBy: {
          method: 'POST',
          path: '/attendance/check-in',
          condition:
            'the resident scans at the gate or checks in from the app: the server writes the record for its own business day with status=present, the server clock as the check-in, the method that was used (qr, app or manual) and the admin who did it when an admin did it (apps/api/src/routes/attendance.ts:86-167). The check-in window is 5am to 11pm in the PG timezone (apps/api/src/routes/attendance.ts:120-133). A second scan for the same resident and day is refused with ALREADY_RECORDED.',
        },
        dwell: 1,
        dwellUnit: 'days',
      },
      {
        // The office wrote the resident down as not on site.
        status: 'absent',
        enteredBy: {
          method: 'POST',
          path: '/attendance/manual',
          condition:
            'an admin marks a resident absent for a day by hand: the server writes the record with the status the admin chose, the optional check-in and check-out times, the notes and the admin who recorded it, and writes a create entry in the audit log (apps/api/src/routes/attendance.ts:232-291). No automatic rule ever writes absent.',
        },
        dwell: 1,
        dwellUnit: 'days',
      },
      {
        // An approved leave covered the day.
        status: 'on_leave',
        enteredBy: {
          method: 'PUT',
          path: '/leaves/:id/approve',
          condition:
            'approving a leave marks every day of the range as on_leave with method=manual, the note "Leave approved" and the admin who approved it, and never overwrites a day the resident was actually on site (a day that is present and carries a check-in) (apps/api/src/routes/leaves.ts:28-79, :649-650). The office can also write an on_leave record by hand through POST /attendance/manual.',
        },
        dwell: 1,
        dwellUnit: 'days',
      },
      {
        // The resident never came back and nobody closed the day.
        status: 'not_returned',
        enteredBy: {
          method: 'PUT',
          path: '/attendance/:id',
          condition:
            'an admin corrects a record and sets the status to not_returned: the server writes the status, the day, the two times and the note, and writes an update entry in the audit log (apps/api/src/routes/attendance.ts:650-704). No cron and no automatic rule writes not_returned; the state exists because the model allows it (apps/api/src/models/attendanceRecord.ts:39).',
        },
        dwell: 1,
        dwellUnit: 'days',
      },
    ],
  },
  truthContract: [
    {
      action: 'Mark one resident for one day by hand',
      operatorBelieves:
        'the record is written for that resident on that day, and the resident knows they were written down',
      serverCommits:
        'POST /attendance/manual writes one record for the resident and the day, with the status the admin chose, the optional check-in and check-out times, the notes and the admin who recorded it, and it writes a create entry in the audit log (apps/api/src/routes/attendance.ts:232-291). It refuses a second record for the same resident and day with ALREADY_RECORDED, and the unique index on that pair is what refuses it (apps/api/src/models/attendanceRecord.ts:74). It sends no message: there is no notification on this path, so the resident sees the row in their portal history the next time they open the app.',
      mismatchSurfacedAt:
        'the day board of /attendance shows the record for that day and the resident history on the record page shows it as well; the resident is not told',
      provenance: {
        auditAction: 'create',
        screen: '/attendance/new',
        actor: 'admin',
      },
      stuckStateMeans:
        'the resident was written down without a note and without a message, so nobody can explain the mark to them later',
      runbook3am:
        'open /attendance?date=<day>, look at the residents nobody marked, and write the note on the record that is missing',
    },
    {
      action: 'Mark the whole day in one go',
      operatorBelieves:
        'one action marks everyone who has no record for the day, and nobody else is touched',
      serverCommits:
        'there is no bulk endpoint on the attendance route, so the page writes one record per resident through the same POST /attendance/manual the single mark uses, one request per resident (apps/api/src/routes/attendance.ts:232-291). Every answer is reported: a record the server refuses (ALREADY_RECORDED) is counted as refused and is never overwritten, and any other refusal is counted as failed with the server message. Each write adds a create entry in the audit log. No message reaches any resident.',
      mismatchSurfacedAt:
        'the page reports the number of records written, the number refused and the number failed, with the reason of every resident that did not get a record',
      provenance: {
        auditAction: 'create',
        screen: '/attendance',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office believes the day was closed and a resident was left out: the refused and failed rows of the report name who',
      runbook3am:
        'open /attendance?date=<day>, read the refused and failed residents of the last bulk mark, and mark them by hand',
    },
    {
      action: 'Correct a record',
      operatorBelieves:
        'the mark of that day is corrected, the resident is told, and what the resident owes for that day moves',
      serverCommits:
        'PUT /attendance/:id rewrites the day, the status, the two times and the note of that one record, and writes an update entry in the audit log with the tenant, the day and the status (apps/api/src/routes/attendance.ts:650-704). It refuses nothing else: a move to a day that already holds a record of the same resident is caught by the unique index, and the admin screen checks for it before the write. It moves no money: nothing in the server reads an attendance mark when it raises a bill, and the bill is raised from the rent on the resident record (apps/api/src/services/invoice.service.ts:97). It sends no message.',
      mismatchSurfacedAt:
        'the record page shows the corrected mark, and the day board names a record that still disagrees with its own times',
      provenance: {
        auditAction: 'update',
        screen: '/attendance/[id]/edit',
        actor: 'admin',
      },
      stuckStateMeans:
        'the mark says the resident never came back while the record carries their sign-in, so nobody can say what happened that night',
      runbook3am:
        'open /attendance?date=<day>, read the records that disagree with themselves, and correct the one that is wrong',
    },
    {
      action: 'Delete a record',
      operatorBelieves: 'the day is back to what it was before the record was written',
      serverCommits:
        'DELETE /attendance/:id removes the row and writes a delete entry in the audit log with the tenant and the day (apps/api/src/routes/attendance.ts:708-730). The day, the month calendar and the resident history all lose the day at once. It sends no message.',
      mismatchSurfacedAt:
        'the day board counts the residents nobody marked again, and the resident history on the portal loses the day at the next load',
      provenance: {
        auditAction: 'delete',
        screen: '/attendance/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the office deleted the record of a day that was marked on purpose, and the day is now a day nobody marked',
      runbook3am:
        'open /attendance?date=<day> and mark the residents the deletion left without a record',
    },
    {
      action: 'Read the day: who has no record, who came back, which days were never rostered',
      operatorBelieves:
        'the list of the residents nobody marked is the list of the residents the office has to close',
      serverCommits:
        'the server holds no endpoint for that list. GET /attendance?date=<day> returns the records of the day (the whole set has to be walked, because the server clamps a page to 100 rows, apps/api/src/lib/routeUtils.ts:16), GET /tenants?isActive=true returns the roster of the active residents, and GET /attendance/summary?fromDate=<day>&toDate=<day> returns the counts of the day and of every other day of the window (apps/api/src/routes/attendance.ts:296-402, :493-561; apps/api/src/routes/tenants.ts:391-483). The list of the residents nobody marked is the roster minus the residents the day holds a record of, so it is read from those answers and not invented. The server own board on GET /attendance/today counts the same thing as active residents minus the records of the day (apps/api/src/routes/attendance.ts:405-436), which is a smaller number when a record of a resident who has since checked out is in the set.',
      mismatchSurfacedAt:
        'the band of /attendance names the day in view, the number of records the server holds for it and the number of residents nobody marked, and the board under it names the residents',
      provenance: {
        screen: '/attendance',
        actor: 'admin',
      },
      stuckStateMeans:
        'the day board says a resident has no record while the server holds one for them under another day, so the office marks the same resident twice',
      runbook3am:
        'open /attendance, read the day in the address bar, and compare the residents nobody marked with the records the server holds for that day',
    },
    {
      action: 'Read the history of one resident',
      operatorBelieves:
        'the history shows what the days of this resident mean: the absences, the days they did not come back, the leave days and the days nobody marked',
      serverCommits:
        'GET /attendance?tenantId=<id>&fromDate=<day>&toDate=<day> returns the records of that resident in the window (apps/api/src/routes/attendance.ts:296-402), and GET /tenants/:id returns the stay the window sits in (apps/api/src/routes/tenants.ts:486-502). The window is the ninety days up to the day of the record, starting at the move-in date of the resident when the server holds one, so the days before the resident arrived are not counted as days nobody marked. The pattern the page shows (the absences, the leave days, the days that were never closed, the days with no record) is read out of those rows; the server counts no pattern of its own. A day marked not_returned that carries a check-in or a check-out is a record that disagrees with its own times, and the server keeps the status and the times apart (apps/api/src/models/attendanceRecord.ts:31-43).',
      mismatchSurfacedAt:
        'the record page shows the pattern of the resident next to the record itself, and names every day that needs a correction',
      provenance: {
        screen: '/attendance/[id]',
        actor: 'admin',
      },
      stuckStateMeans:
        'the resident history shows a month of days and the office cannot say which of them are absences and which are days nobody marked',
      runbook3am:
        'open the record of the resident, read the pattern over the window, and correct the days that disagree with themselves',
    },
    {
      action: 'The resident checks in at the gate',
      operatorBelieves:
        'the resident is on site, the board shows them, and the day will be closed when they leave',
      serverCommits:
        'POST /attendance/check-in writes the record for the server business day with status=present, the server clock as the check-in and the method that was used (qr, app or manual); a check-out stamps the check-out and keeps the status present (apps/api/src/routes/attendance.ts:86-167, :170-229). The check-in window is 5am to 11pm in the PG timezone. A second check-in for the same resident and day is refused with ALREADY_RECORDED. The resident sees their own history in the portal (mobile/lib/features/tenant/presentation/attendance_screen.dart); no message is sent, the record is only there when they load the app.',
      mismatchSurfacedAt:
        'the day board shows the resident as present for that day, and the resident history shows the same row',
      provenance: {
        screen: '/attendance',
        actor: 'tenant',
      },
      stuckStateMeans:
        'the record says present and carries no check-in, so the resident shows as on site but nobody can say when they came',
      runbook3am:
        'open /attendance?date=<day> and look at the records of that day that carry no check-in time',
    },
  ],
  layout: {
    archetype: 'calendar',
    grammarTokens: [
      'DataTable',
      'PageBand',
      'StatusTabs',
      'FilterChips',
      'StatusBadge',
      'EmptyState',
      'PageHeader',
      'DetailCard',
      'AttendanceMonthCalendar',
      'AttendanceRangeFilter',
      'FormPage',
      'FormCard',
      'ConfirmModal',
      'ErrorBanner',
    ],
    mustNotLookLike:
      'a roster of people: an attendance cell is a resident on a day, and the shape of the answer is a grid of days',
    ownNumber:
      'the residents who have no record for the day in view, counted against the roster of the active residents of the building',
  },
  nextBestAction: {
    perStatus: {
      present: {
        label: 'Read the record',
        target: '/attendance/[id]',
        enabledWhen: 'the record of the resident on that day holds the status present',
      },
      absent: {
        label: 'Explain the absence',
        target: '/attendance/[id]',
        enabledWhen: 'the record of the resident on that day holds the status absent',
      },
      on_leave: {
        label: 'Read the leave',
        target: '/leaves',
        enabledWhen: 'the record of the resident on that day holds the status on_leave',
      },
      not_returned: {
        label: 'Find out what happened',
        target: '/attendance/[id]',
        enabledWhen: 'the record of the resident on that day holds the status not_returned',
      },
    },
    perEmptyState: {
      no_record_at_all: {
        label: 'Mark the first resident',
        target: '/attendance/new',
      },
      nobody_marked: {
        label: 'Mark the day',
        target: '/attendance',
      },
      day_never_rostered: {
        label: 'Open the day',
        target: '/attendance',
      },
      resident_without_history: {
        label: 'Open the day board',
        target: '/attendance',
      },
    },
  },
};
