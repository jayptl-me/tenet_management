# 06 — Engagement (Notices, Notifications, Enquiries, Visitors)

## Notices (`apps/api/src/models/noticePost.ts`)

| Field      | Type            | Constraints                |
| ---------- | --------------- | -------------------------- |
| title      | String          | 3-200 chars, trim          |
| content    | String          | Max 5000 chars, trim       |
| pinned     | Boolean         | Default false              |
| authorId   | ObjectId → User | Required                   |
| targetType | String          | enum: `all` `floor` `room` |
| targetIds  | String[]        | IDs of floors/rooms        |

**Virtual**: `author` (populates User)
**Indexes**: `{pinned: -1, createdAt: -1}`, `{targetType}`

### API Routes

| Method | Path         | Description                                 |
| ------ | ------------ | ------------------------------------------- |
| GET    | /notices     | List — pinned sort, priority filter, search |
| GET    | /notices/:id | Detail                                      |
| POST   | /notices     | Create notice                               |
| PUT    | /notices/:id | Update                                      |
| DELETE | /notices/:id | Delete                                      |

### Frontend Pages

#### /notices (List)

- Search by title, filter by priority (Emergency/High/Medium/Low)
- Columns: Title, Content (truncated), Priority (colored badge), Status (Published/Draft), Actions (TableActions)
- Mobile card: title + priority, status + date, action buttons

#### /notices/:id (Detail), /notices/:id/edit, /notices/new

## Notifications (`apps/api/src/models/notification.ts`)

| Field      | Type               | Constraints                                                                                                                                             |
| ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| targetType | String             | enum: `all` `individual` `room` `floor`                                                                                                                 |
| targetIds  | String[]           | IDs of target entities                                                                                                                                  |
| title      | String             | Max 200, trim                                                                                                                                           |
| body       | String             | Max 2000, trim                                                                                                                                          |
| type       | String             | enum: `payment_reminder` `payment_verified` `complaint_update` `announcement` `service_update` `electricity_bill` `welcome` `emergency` `meal_feedback` |
| data       | Map<string,string> | Additional metadata                                                                                                                                     |
| unreadBy   | ObjectId[] → User  | Users who haven't read yet                                                                                                                              |
| sentAt     | Date               | Default now                                                                                                                                             |

**Indexes**: `{createdAt: -1}`, `{type}`, `{targetType}`, `{unreadBy}`

### API Routes

| Method | Path                        | Description                                      |
| ------ | --------------------------- | ------------------------------------------------ |
| GET    | /notifications              | List with unread filter                          |
| GET    | /notifications/unread-count | Count of unread (used by NotificationBell badge) |
| POST   | /notifications              | Send notification                                |
| PUT    | /notifications/:id/read     | Mark as read (removes user from unreadBy)        |

### Frontend Pages

- `/notifications` — list with read/unread states
- `/notifications/:id` — detail with mark-as-read
- `/notifications/new` — send form (target type, individual/room/floor/all, type select, title, body)

### NotificationBell Component

- Shows bell icon with unread count badge
- Dropdown: recent notifications list, "View All" link
- Badge count from `useSidebarBadges` hook

## Enquiries (`apps/api/src/models/enquiry.ts`)

| Field            | Type   | Constraints                                |
| ---------------- | ------ | ------------------------------------------ |
| name             | String | Max 100, trim                              |
| phone            | String | `+91XXXXXXXXXX`                            |
| email            | String | Trim, lowercase                            |
| preferredSharing | String | enum: `2` `3` `4` `single`                 |
| message          | String | Max 1000, trim                             |
| status           | String | enum: `new` `contacted` `converted` `lost` |
| source           | String | enum: `landing_page` `referral` `other`    |

**Indexes**: `{status}`, `{createdAt: -1}`

### API Routes

| Method | Path                  | Description             |
| ------ | --------------------- | ----------------------- |
| GET    | /enquiries            | List with status filter |
| GET    | /enquiries/:id        | Detail                  |
| POST   | /enquiries            | Create                  |
| PUT    | /enquiries/:id/status | Status change           |

### Frontend Pages

#### /enquiries (List)

- Status filter dropdown
- Columns: Name, Phone, Email, Source, Status, Date, Actions (TableActions)
- Mobile card: name + status, phone + source + date, action buttons

#### /enquiries/:id (Detail)

- 3 StatCards: Phone, Source, Status
- Enquiry Details card: Name, Phone, Email, Source, Status badge, Follow-up Date
- Message block (if present)
- Source & Info card
- **Update Status form**: inline select + Save Changes button
- **Convert to Tenant** button → `router.push(/tenants/new?name=X&phone=X&email=X&source=enquiry&enquiryId=X)`

## Visitors (`apps/api/src/models/visitor.ts`)

| Field           | Type              | Constraints                                       |
| --------------- | ----------------- | ------------------------------------------------- |
| tenantId        | ObjectId → Tenant | Required                                          |
| visitorName     | String            | Max 100, trim                                     |
| visitorPhone    | String            | `+91XXXXXXXXXX`                                   |
| purpose         | String            | Max 200, trim                                     |
| expectedArrival | Date              | Required                                          |
| actualArrival   | Date              | Nullable                                          |
| actualDeparture | Date              | Nullable                                          |
| status          | String            | enum: `expected` `arrived` `departed` `cancelled` |
| approvedBy      | ObjectId → User   | Nullable                                          |

**Indexes**: `{tenantId, expectedArrival: -1}`, `{status}`, `{expectedArrival}`

### API Routes

| Method | Path          | Description                 |
| ------ | ------------- | --------------------------- |
| GET    | /visitors     | List with status filter     |
| GET    | /visitors/:id | Detail                      |
| POST   | /visitors     | Register                    |
| PUT    | /visitors/:id | Update (check-in/check-out) |
| DELETE | /visitors/:id | Delete                      |

### Frontend Pages

#### /visitors (List)

- Status filter
- Columns: Visitor, Phone, Purpose, Tenant, Check In, Check Out, Status, Actions (TableActions)
- Mobile card: name + status, purpose + tenant, action buttons

#### /visitors/:id (Detail), /visitors/:id/edit, /visitors/new

- Tenant select, visitor name/phone, purpose, expected arrival datetime, status

## useSidebarBadges Hook

- `apps/web/src/hooks/useSidebarBadges.ts`
- Fetches: `GET /dashboard/badges` (returns `{ openComplaints, pendingEnquiries, unreadNotifications }`)
- Returns aggregate counts → mapped to sidebar nav items:
  - `/complaints` → openComplaints
  - `/enquiries` → pendingEnquiries
  - `/notifications` → unreadNotifications

## Feature Flags

All engagement features controlled via `AppConfig.features`:

- `noticeBoardEnabled` → gates `/notices` in sidebar
- `visitorManagementEnabled` → gates `/visitors` in sidebar
