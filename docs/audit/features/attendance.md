# Attendance -- Gap Analysis

**Priority:** P0

## API

- POST check-in, check-out, manual
- GET list, today, my, :id
- DELETE :id
- **No PUT**

## FE

- New: POST attendance/manual -- OK if payload matches
- Edit: PUT attendance/:id -- **404 always**

## Flag

attendanceEnabled default **false** but routes unguarded and admin pages present.

## Fixes

- [ ] Add PUT for admin correction fields (checkIn/checkOut/status/notes) OR remove edit UI
- [ ] Enforce attendanceEnabled
- [ ] 11000 already handled on check-in path -- keep

## Acceptance

- [ ] Manual create works
- [ ] Edit either works or is removed from TableActions
