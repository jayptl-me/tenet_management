# Attendance -- Feature Audit (Superseded)

Superseded by: attendance_audit_pass1_20260907-232349.md (source-verified pass 1, 2026-09-07 UTC).

| Surface                                                 | Roles    | Status                              |
| ------------------------------------------------------- | -------- | ----------------------------------- |
| Admin attendance list (/attendance)                     | admin    | WORKING WITH GAPS (see pass 1 file) |
| Admin manual marking (/attendance/new)                  | admin    | WORKING WITH GAPS (see pass 1 file) |
| Admin record detail (/attendance/[id])                  | admin    | WORKING WITH GAPS (see pass 1 file) |
| Admin record edit (/attendance/[id]/edit)               | admin    | WORKING WITH GAPS (see pass 1 file) |
| Tenant self check-in/out + history (/tenant/attendance) | tenant   | WORKING WITH GAPS (see pass 1 file) |
| Guardian ward attendance history (/guardian/attendance) | guardian | WORKING WITH GAPS (see pass 1 file) |

## Open gaps

| ID         | Severity | Gap                                                                                                           | Paths                                                          |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| ATT-LIST   | P2       | Admin list surface works with gaps: bulk mark panel and print roster missing (see pass 1 record)              | apps/web/src/app/(admin)/attendance/page.tsx                   |
| ATT-DETAIL | P3       | Record detail surface works with gaps: day prev/next navigation missing (see pass 1 record)                   | apps/web/src/app/(admin)/attendance/[id]/page.tsx              |
| ATT-TENANT | P2       | Tenant self surface works with gaps: no month calendar or history date filters in Flutter (see pass 1 record) | mobile/lib/features/tenant/presentation/attendance_screen.dart |

## Closed

| Claim                                                                      | Live status                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Manual marking surface documented as WORKING WITH GAPS in the base listing | CLOSED - 2026-09-08 addendum verified rich form (3 FormSections, icons, duration preview, clash check); no rebuild needed |
| Record edit surface documented as WORKING WITH GAPS in the base listing    | CLOSED - 2026-09-08 addendum: parseApiError plus date validation applied; out/in duration guard present                   |
