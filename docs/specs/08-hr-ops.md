# 08 — HR & Operations (Attendance, Leaves)

## AttendanceRecord Model (`apps/api/src/models/attendanceRecord.ts`)

| Field      | Type              | Constraints                                        |
| ---------- | ----------------- | -------------------------------------------------- |
| tenantId   | ObjectId → Tenant | Required                                           |
| date       | String            | `YYYY-MM-DD`                                       |
| checkIn    | Date              | Nullable                                           |
| checkOut   | Date              | Nullable                                           |
| status     | String            | enum: `present` `absent` `on_leave` `not_returned` |
| method     | String            | enum: `manual` `qr` `app`                          |
| recordedBy | ObjectId → User   | Nullable                                           |
| notes      | String            | Max 500                                            |

**Unique compound index**: `{ tenantId, date }` — one record per tenant per day

### API Routes

- `GET /attendance` — filters: date, tenantId, status
- `POST /attendance` — manual check-in/check-out
- `PUT /attendance/:id` — update status, notes
- `DELETE /attendance/:id`

### Frontend Pages

- `/attendance` — list with date picker filter, status badges
- `/attendance/:id`, `/attendance/:id/edit`, `/attendance/new`

## LeaveApplication Model (`apps/api/src/models/leaveApplication.ts`)

| Field      | Type              | Constraints                           |
| ---------- | ----------------- | ------------------------------------- |
| tenantId   | ObjectId → Tenant | Required                              |
| fromDate   | String            | `YYYY-MM-DD`                          |
| toDate     | String            | `YYYY-MM-DD`                          |
| reason     | String            | Max 500, required                     |
| status     | String            | enum: `pending` `approved` `rejected` |
| approvedBy | ObjectId → User   | Nullable                              |
| approvedAt | Date              | Nullable                              |
| adminNotes | String            | Max 500                               |

**Indexes**: `{tenantId, fromDate: -1}`, `{status, createdAt: -1}`

### API Routes

- `GET /leaves` — search by tenant name, status filter
- `GET /leaves/:id` — detail with approve/reject actions
- `POST /leaves` — submit application
- `PUT /leaves/:id` — approve/reject + adminNotes
- `DELETE /leaves/:id`

### Frontend Pages

#### /leaves (List)

- Search by tenant name, filter by status (Pending/Approved/Rejected/Cancelled)
- Columns: Tenant, Room, Period (from→to), Reason (truncated), Status, Actions (TableActions)
- Mobile card: tenant name + status, period, action buttons

#### /leaves/:id (Detail)

- Tenant info, date range, reason, status
- **Approve/Reject buttons**: update status to approved/rejected with adminNotes
- Admin notes field

#### /leaves/:id/edit, /leaves/new

**Feature flag**: `attendanceEnabled` controls visibility of both Attendance and Leaves in sidebar.
