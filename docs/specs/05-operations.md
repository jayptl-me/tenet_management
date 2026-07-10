# 05 — Operations (Complaints, Services, Assets)

## Complaint Model (`apps/api/src/models/complaint.ts`)

| Field       | Type              | Constraints                                                                                                                               |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| tenantId    | ObjectId → Tenant | Required                                                                                                                                  |
| roomId      | ObjectId → Room   | Required                                                                                                                                  |
| category    | String            | enum: `wifi` `water` `electricity` `food_quality` `cleaning_room` `cleaning_washroom` `washing_machine` `fridge` `lights` `noise` `other` |
| title       | String            | 5-200 chars, trim                                                                                                                         |
| description | String            | Max 2000 chars, trim                                                                                                                      |
| photos      | String[]          | URLs                                                                                                                                      |
| priority    | String            | enum: `low` `medium` `high` `urgent`, default medium                                                                                      |
| status      | String            | enum: `open` `in_progress` `resolved` `dismissed`, default open                                                                           |
| adminNotes  | String            | Trim                                                                                                                                      |
| resolvedAt  | Date              | null until resolved                                                                                                                       |

**Virtuals**: `tenant`, `room`
**Indexes**: `{tenantId}`, `{roomId}`, `{status}`, `{category}`, `{priority}`, `{status, priority}`

### API Routes

| Method | Path                   | Description                                              |
| ------ | ---------------------- | -------------------------------------------------------- |
| GET    | /complaints            | List with status filter                                  |
| GET    | /complaints/:id        | Detail with tenant+room                                  |
| POST   | /complaints            | Create                                                   |
| PUT    | /complaints/:id/status | Status change only (open→in_progress→resolved→dismissed) |
| DELETE | /complaints/:id        | Delete                                                   |

### Frontend Pages

#### /complaints (List) — DUAL VIEW

**Table View**:

- `PageHeader` (with "New Complaint" button)
- Status filter dropdown
- `DataTable` columns: Title, Tenant, Category, Severity (danger/warning/info badge), Status, Actions (TableActions)
- Mobile card: title + status, tenant + severity, action buttons

**Kanban View** (killer feature):

- Toggle switch: Table | Kanban
- 4 columns using `@dnd-kit/core`: `open`, `in_progress`, `resolved`, `dismissed`
- Each column: header with count badge, droppable zone
- Cards: title, description (2-line clamp), tenant name · room, date, priority badge
- **Drag-and-drop**: `onDragEnd` → optimistic status update → `PUT /complaints/:id/status` → revert on failure
- `DragOverlay`: translucent card follows cursor during drag
- Loading state: spinner during kanban fetch (loads all complaints, limit=200)

#### /complaints/:id (Detail)

- Complaint info card: Category, Priority, Status, Created date
- Tenant + Room info
- Description block
- Admin Notes (editable)
- Actions: Edit, status change buttons

#### /complaints/:id/edit

- Category, Title, Description, Priority select, Status select
- Admin Notes textarea

#### /complaints/new

- Same form as edit, plus tenant select, room auto-resolved from tenant
- Pre-fill support: `?category=X&floorId=X` for floor service issue reporting

## ServiceStatus Model (`apps/api/src/models/serviceStatus.ts`)

| Field         | Type             | Constraints                           |
| ------------- | ---------------- | ------------------------------------- |
| floorId       | ObjectId → Floor | Required                              |
| serviceType   | String           | Lowercase alphanumeric, trim          |
| status        | String           | enum: `operational` `degraded` `down` |
| lastUpdatedBy | ObjectId → User  | Required                              |
| lastUpdatedAt | Date             | Default now                           |
| note          | String           | Max 500, trim                         |

**Unique compound index**: `{ floorId, serviceType }`
**Virtual**: `floor`

### API Routes

| Method | Path          | Description                                   |
| ------ | ------------- | --------------------------------------------- |
| GET    | /services     | List with status filter                       |
| GET    | /services/:id | Detail                                        |
| POST   | /services     | Create (floorId + serviceType must be unique) |
| PUT    | /services/:id | Update status, note, reset lastUpdatedAt      |
| DELETE | /services/:id | Delete                                        |

### Frontend Pages

#### /services (List)

- Status filter dropdown
- Columns: Service (dynamic icon from AppConfig `amenityDefinitions` + label), Floor, Status badge, Last Updated, Updated By, Note, Actions (TableActions)
- Open complaint count badge: inline red pill showing open complaints for that service type
- Dynamic icons: resolves `amenityDefinitions[].icon` → lucide-react icon via ICON_MAP (wifi/Zap/Droplets/Thermometer/Shirt/Sparkles/BedSingle/ScrollText/MoonStar/Fan/Refrigerator/Wrench)

#### /services/:id (Detail)

- 3 StatCards: Floor, Status (color-coded), Open Complaints count
- Service Info card: Type, Status badge, Floor, Last Updated
- Last Updated By card: Name, Timestamp
- Open Complaints warning card (if > 0) with red variant
- Notes card
- Actions: Edit Service

#### /services/:id/edit (Edit)

- Floor select (ResourceSelect)
- Service type select (fixed list: WiFi/Water Supply/Power/AC/Laundry/Cleaning/Security/Elevator/Parking/Other)
- Status select (Operational/Degraded/Down)
- Note textarea

#### /services/new (Create)

- Same form as edit

## Asset Model (`apps/api/src/models/asset.ts`)

| Field             | Type   | Constraints                                                        |
| ----------------- | ------ | ------------------------------------------------------------------ |
| name              | String | Max 120, trim                                                      |
| category          | String | enum: `furniture` `appliance` `electronics` `cleaning` `other`     |
| location          | String | Max 160, trim                                                      |
| quantity          | Number | Min 0, default 1                                                   |
| lowStockThreshold | Number | Min 0, default 0                                                   |
| status            | String | enum: `available` `in_use` `under_maintenance` `damaged` `retired` |
| purchasedDate     | Date   | Nullable                                                           |
| lastServicedDate  | Date   | Nullable                                                           |
| nextServiceDate   | Date   | Nullable                                                           |
| notes             | String | Max 500                                                            |

**Index**: `{category, status}`, `{nextServiceDate}`

### Frontend Pages

#### /assets (List)

- DataTable with category/status filters
- Columns: Name, Category badge, Location, Quantity, Status badge, Actions (TableActions)

#### /assets/:id (Detail)

- Stats: Quantity, Status, Location
- Dates: Purchased, Last Serviced, Next Service
- Notes

#### /assets/:id/edit + /assets/new

- Category select, location, quantity, threshold, status, date fields
