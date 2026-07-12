# Floors -- Gap Analysis

**Priority:** P2

## Status

CRUD complete: GET list/id, POST, PUT, DELETE. 11000 handled.

## Gaps

- [ ] DELETE dependency: ensure rooms blocked or cascade policy documented
- [ ] totalRooms desync when rooms soft-deleted (see rooms + occupancy)
- [ ] Native Select design only
- [ ] FormPage/StatusBadge patterns -- verify list uses full stack

## Acceptance

- [ ] Cannot delete floor with active rooms if product requires (confirm current DELETE behavior in floors.ts when remediating)
