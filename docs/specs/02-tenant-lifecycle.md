# 02 — Tenant Lifecycle & Guardian Management

## Models

### User (`apps/api/src/models/user.ts`)

| Field        | Type    | Constraints                                      |
| ------------ | ------- | ------------------------------------------------ |
| name         | String  | 2-100 chars, trim                                |
| email        | String  | Unique, lowercase, email regex                   |
| phone        | String  | Unique, `+91XXXXXXXXXX` format                   |
| passwordHash | String  | bcrypt 12 rounds, `select: false`                |
| role         | String  | enum: `admin` `tenant` `guardian`                |
| ntfyTopic    | String  | Unique UUID, `select: false`, push notifications |
| isActive     | Boolean | Default true                                     |
| profilePhoto | String  | URL                                              |
| tenantId     | String  | Soft reference to Tenant                         |
| guardianId   | String  | Soft reference to Guardian                       |

### Tenant (`apps/api/src/models/tenant.ts`)

| Field                     | Type            | Constraints             |
| ------------------------- | --------------- | ----------------------- |
| userId                    | ObjectId → User | Unique (1:1), required  |
| roomId                    | ObjectId → Room | Required                |
| bedId                     | String          | enum: A/B/C/D, required |
| moveInDate                | Date            | ISO 8601, required      |
| moveOutDate               | Date            | null until checkout     |
| depositPaid               | Number          | 0—∞, min 0              |
| monthlyRent               | Number          | 1000—50000, required    |
| isActive                  | Boolean         | Default true            |
| documents.aadhaarUrl      | String          | Cloudinary URL          |
| documents.photoUrl        | String          | Cloudinary URL          |
| emergencyContact.name     | String          | Trim, max 100           |
| emergencyContact.phone    | String          | `+91XXXXXXXXXX`         |
| emergencyContact.relation | String          | Trim, max 50            |

**Virtuals**: `user` (populates User), `room` (populates Room)
**Indexes**: `{roomId, bedId, isActive}`, `{moveInDate: -1}`

### Guardian (`apps/api/src/models/guardian.ts`)

| Field    | Type              | Constraints                        |
| -------- | ----------------- | ---------------------------------- |
| userId   | ObjectId → User   | Unique (1:1), required             |
| tenantId | ObjectId → Tenant | Required                           |
| name     | String            | 1-100 chars, trim                  |
| phone    | String            | `+91XXXXXXXXXX`                    |
| email    | String            | Trim, lowercase                    |
| relation | String            | enum: father/mother/guardian/other |
| isActive | Boolean           | Default true                       |

**Indexes**: `{tenantId, isActive}`, `{phone}`

## API Routes

### POST /tenants — Create Tenant

1. Validate body via Zod: `name`, `email`, `phone` (+91 format), `roomId`, `bedId`, `moveInDate` (ISO 8601), `monthlyRent` (1000-50000), optional `depositPaid`, `emergencyContact`, `aadhaarUrl`, `photoUrl`
2. Start Mongoose session + transaction
3. Find Room by `roomId` → validate exists + isActive
4. Find bed in room.beds by `bedId` → validate exists + not occupied
5. Create User with auto-generated password, role=tenant
6. Create Tenant document
7. Update Room: mark bed `isOccupied=true`, set `tenantId`, recalculate `occupancyCount`
8. Update User: set `tenantId` reference
9. Commit transaction
10. Return 201 with created tenant

### GET /tenants — List (paginated)

**Filters**: `isActive` (true/false), `roomId`, `floorId` (resolves to room IDs), `search` (by user name regex via User collection)
**Sort**: `-createdAt` default, querystring `sort` + `order`
**Response**: `{ success, data: Tenant[], meta: { total, page, limit, totalPages } }`
**Populates**: `user`, `room`

### GET /tenants/:id — Single Tenant

- Populates `user`, `room`
- Role check: if `user.role === 'tenant'`, verify the tenant's userId matches the requesting user's sub
- Returns 403 if tenant tries to access another tenant's data

### PUT /tenants/:id — Update Tenant

1. Accepts partial body: `monthlyRent`, `depositPaid`, `isActive`, `bedId`, `roomId`, `moveInDate`, `emergencyContact`, `user` (nested: name/email/phone)
2. **Room transfer** (if `roomId` differs):
   - Load old room → find old bed → free it (isOccupied=false, tenantId=null) → save old room
   - Load new room → validate exists + isActive → find target bed → validate not occupied by other → reserve it (isOccupied=true, tenantId=this) → save new room
   - Update tenant.roomId + tenant.bedId
3. **Same-room bed swap** (if only `bedId` differs):
   - Free old bed → validate new bed not occupied by other → reserve new bed → save room
4. Update user fields if provided in `body.user`
5. Save tenant
6. Return populated tenant

### POST /tenants/:id/checkout — Checkout

1. Start Mongoose session + transaction
2. Set `moveOutDate = new Date()`, `isActive = false`
3. Find Room → free bed → recalculate occupancyCount
4. Set User `isActive = false`
5. Commit, return updated tenant

### DELETE /tenants/:id — Delete

1. Start session + transaction
2. Free bed in Room
3. Deactivate User (isActive=false)
4. Delete Tenant document
5. Commit

### GET /tenants/:id/dues — Checkout Dues Summary

- Aggregates: unpaid invoices (sent/partial/overdue), pending payments, electricity dues from invoice line items, deposit held
- Returns: `{ totalDue, unpaidInvoices[], electricityDues, depositHeld, pendingPayments, checkedOut }`

### GET /tenants/:id/activity — Activity Timeline

- Aggregates 5 event sources sorted by date desc:
  1. Move-in/checkout dates from Tenant
  2. Payments (method, amount, status) from Payment
  3. Complaints (title, status) from Complaint
  4. Leave applications (fromDate→toDate, status) from LeaveApplication (if attendance enabled)
  5. Notifications (announcements/welcome targeted to tenant or all) from Notification
- Returns `{ success, data: events[] }`

### POST /tenants/:id/documents — KYC Upload

- Requires Cloudinary config (graceful degradation with ServiceUnavailableError)
- Accepts `multipart/form-data`: `file` + `docType` (aadhaar/photo)
- Validates: file type (JPEG/PNG/WebP/PDF), max 5MB
- Uploads to Cloudinary → stores `secure_url` in `tenant.documents.aadhaarUrl` or `photoUrl`
- Returns uploaded URL

### Guardian CRUD

- `POST /guardians` — creates Guardian + User (role=guardian)
- `GET /guardians` — paginated, searchable by name
- `GET /guardians/:id` — populated with tenant info
- `PUT /guardians/:id` — update name/phone/email/relation/flags
- `DELETE /guardians/:id` — delete guardian

## Frontend Pages

### /tenants (List)

- `PageHeader` with "Add Tenant" button
- Search by name, filter by status (Active/Checked Out)
- `DataTable` with columns: Name, Room (with bed), Contact (email + phone stacked), Rent, Status (StatusBadge), Actions (TableActions)
- Mobile card renderer: name + status, room + rent, action buttons
- ConfirmModal for delete

### /tenants/:id (Detail)

- `FormPage` with tenant name + bed/room as description, active/inactive badge, Edit button
- 4 StatCards: Monthly Rent, Deposit, Move-in Date, Move-out Date
- Contact `DetailCard`: Email + Phone
- Room `DetailCard`: Room Number, Floor, Bed ID (mono font)
- Emergency Contact `DetailCard` (if present): Name, Phone, Relation
- Documents `DetailCard`: DocumentUpload for aadhaar + photo
- Actions `DetailCard`: WhatsApp button (generates URL from tenant phone), Copy Info, Check Out (only if active)
- Checkout modal: loads dues via `GET /tenants/:id/dues` → shows total due, unpaid invoices list, electricity dues, deposit held → Confirm Checkout
- Activity Timeline: `TenantActivityTimeline` component
- Payment history: fetches `GET /tenants/:id/payments`

### /tenants/:id/edit (Edit)

- Personal info: Name, Phone, Email, Status (active/checked_out)
- Room assignment: ResourceSelect (rooms), bed Select (filtered by room's sharing type, occupied beds disabled except current)
- Financial details: Monthly Rent, Deposit Paid, Move-in Date
- Emergency contact: Name, Phone (10 digits), Relation select
- Documents: DocumentUpload for aadhaar + photo

### /tenants/new (Create)

- Same form structure as edit but for creation
- Room selection triggers bed availability filtering
- Auto-fills monthlyRent from selected room
- Pre-fill support via query params: `?name=X&phone=X&email=X&source=enquiry&enquiryId=X`

### /guardians (List)

- PageHeader, search by name, DataTable
- Columns: Name, Phone, Relation, Tenant, Emergency (Yes/No badge), Status, Actions (TableActions)

### /guardians/:id (Detail)

- Personal info + Status & Linked Info cards
- Shows linked tenant with room number
- "View Tenant" button navigates to tenant detail
- Notes section

### /guardians/:id/edit (Edit)

- Tenant select (ResourceSelect)
- Name, Phone, Email, Relation (father/mother/guardian/brother/sister/spouse/friend/other)
- Flags: Emergency Contact checkbox, Active checkbox

### /guardians/new (Create)

- Same form structure as edit for creation

## WhatsApp Integration

- `apps/web/src/lib/whatsapp.ts` — `generateWhatsAppUrl(phone, message)` → `https://wa.me/91XXXXXXXXXX?text=...`
- Used in: tenant detail, payment detail, invoice detail
- Copy to clipboard: `copyToClipboard(text)` utility
