# 03 — Room & Floor Management

## Models

### Floor (`apps/api/src/models/floor.ts`)

| Field           | Type   | Constraints                                                          |
| --------------- | ------ | -------------------------------------------------------------------- |
| floorNumber     | Number | Unique, integer, min 0                                               |
| label           | String | Trim, max 50, required                                               |
| totalRooms      | Number | 1-50, required                                                       |
| amenityCounts[] | Array  | Each: `{ amenityKey: string (lowercase alphanumeric), count: 0-10 }` |
| amenities       | Object | **Deprecated** — washingMachines, fridges (use amenityCounts)        |

**Index**: `{ 'amenityCounts.amenityKey': 1 }`

### Room (`apps/api/src/models/room.ts`)

| Field           | Type             | Constraints                                                             |
| --------------- | ---------------- | ----------------------------------------------------------------------- |
| roomNumber      | String           | Unique, uppercase, max 20, trim                                         |
| floorId         | ObjectId → Floor | Required                                                                |
| sharingType     | Number           | enum: 2, 3, 4                                                           |
| monthlyRent     | Number           | 1000-50000, required                                                    |
| isActive        | Boolean          | Default true                                                            |
| description     | String           | Max 500, trim                                                           |
| photos          | String[]         | URLs                                                                    |
| beds[]          | IBedSubdoc[]     | `{ bedId (A/B/C/D), isOccupied: boolean, tenantId: ObjectId → Tenant }` |
| roomAmenities[] | Array            | `{ amenityKey: string, status: 'operational'/'degraded'/'down' }`       |
| occupancyCount  | Number           | Auto-derived from beds.filter(isOccupied).length                        |

**Virtuals**: `floor` (populates Floor)
**Indexes**: `{floorId}`, `{sharingType}`, `{isActive}`, `{'beds.isOccupied'}`, `{'roomAmenities.amenityKey'}`

#### Bed Validation

The beds array has a custom validator: `beds.length === sharingType`. This means:

- 2-sharing room must have exactly 2 beds (A, B)
- 3-sharing room must have exactly 3 beds (A, B, C)
- 4-sharing room must have exactly 4 beds (A, B, C, D)

#### Static Method: `Room.generateBeds(sharingType)`

Generates the correct beds array for a given sharing type, all marked `isOccupied: false, tenantId: null`.

### CRITICAL: Sharing Type Change Bug (FIXED)

**The bug**: When editing a room's `sharingType`, the old PUT handler used `findByIdAndUpdate` with the partial body, which overwrote `sharingType` without regenerating the beds array. This caused the Mongoose validator to fail: `beds.length !== sharingType`.

**The fix** (in `apps/api/src/routes/rooms.ts`, PUT handler):

```typescript
function rebuildBedsForSharingType(existingBeds, newSharingType) {
  // 1. Collect occupied beds
  // 2. Generate slots for new sharing type (A, B, C, D)
  // 3. Map occupied beds to their slots
  // 4. Fill remaining slots with empty beds
  // 5. If occupied beds > newSharingType → throw BEDS_OCCUPIED_ON_DOWNSIZE
  // 6. Preserve any orphan occupied beds (guard against data corruption)
  // 7. Truncate to exact sharingType length
  return rebuiltBeds;
}
```

**Downsize safety**: Changing from 4-sharing to 2-sharing while 3 beds are occupied is rejected with an actionable error message: `"Cannot change sharing type from 4 to 2: 3 bed(s) are still occupied. Check out tenants first."`

## API Routes

### GET /floors — List

- Paginated, searchable by label (`?search=`)
- Response: `{ success, data: Floor[], meta: { total, page, limit, totalPages } }`

### POST /floors — Create

- Body: `label`, `floorNumber` (integer), `totalRooms` (1-50), `amenityCounts[]`

### PUT /floors/:id — Update

- Partial update: label, floorNumber, totalRooms, amenityCounts

### DELETE /floors/:id

- Deletes floor document

### GET /rooms — List

- **Filters**: `floorId`, `sharingType` (2/3/4), `isActive`, `roomNumber` (regex search)
- **Sort**: `?sort=-createdAt&order=desc`
- Populates `floor`
- Response: `{ success, data: Room[], meta }`

### GET /rooms/available — Vacant Beds

- Returns rooms where `isActive: true` AND at least one bed has `isOccupied: false`
- Populates `floor`

### GET /rooms/:id — Single Room with Tenant Names

1. Load room with populated `floor`
2. For each occupied bed, collect tenantIds → batch-query Tenant with populated `userId` (name field)
3. Build `tenantNameMap: Map<tenantId, userName>`
4. Attach `tenantName` to each bed object
5. Returns full room with resolved tenant names on beds

### POST /rooms — Create

1. Validates floor exists via `Floor.findById(floorId)`
2. Generates beds array from `sharingType` via `Room.generateBeds()`
3. Creates room with `Room.create({ ...body, beds })`
4. Handles duplicate `roomNumber` (11000 error → conflict response)

### PUT /rooms/:id — Update (**CRITICAL**)

1. If `floorId` changed → validate new floor exists
2. **If `sharingType` changed:**
   - Load existing room from DB
   - Call `rebuildBedsForSharingType()` with existing beds + new sharing type
   - If downsizing would orphan tenants → return 409 conflict
   - Apply all body fields to the loaded room document
   - Save with `room.save()` (triggers validators + occupancyCount update)
   - Return populated room
3. **If no sharingType change**: standard `findByIdAndUpdate` with `runValidators: true`

### DELETE /rooms/:id

- Checks for active tenants: `Tenant.countDocuments({ roomId: id, isActive: true })`
- If > 0 → 409 conflict: `"Cannot delete room: N active tenant(s) still occupy this room."`
- Soft-delete: `Room.findByIdAndUpdate(id, { isActive: false })`

## Data Integrity Rules

### Room ↔ Tenant Bed Consistency

Every tenant operation MUST maintain bed state:

- **Create tenant**: marks bed occupied, sets tenantId
- **Transfer tenant**: frees old bed in old room, reserves new bed in new room
- **Checkout tenant**: frees bed, sets tenantId=null
- **Delete tenant**: frees bed, sets tenantId=null
- **Edit tenant bed swap**: frees old bed, reserves new bed (within same room)

### Occupancy Count

`occupancyCount` is recalculated in pre-save hook when beds are modified: `this.occupancyCount = this.beds.filter(b => b.isOccupied).length`

### N+1 Protection

Room GET /:id batch-loads tenant names in a single query using `$in` operator, not individual queries per bed.

## Frontend Pages

### /floors (List)

- `PageHeader`, search input with search icon
- `DataTable` columns: Floor (label), Floor #, Rooms (totalRooms), Services (FloorServiceGrid inline, compact), Actions (TableActions)
- Mobile card: label + floor badge, room count, action buttons

### /floors/:id (Detail)

- 4 StatCards: Label, Floor Number, Total Rooms, Created date
- Service Health card: `FloorServiceGrid` with report-issue links (navigates to complaints/new with pre-filled category + floorId)
- Amenities card: grid of `{count} {label}` boxes (if amenityCounts present)
- Rooms table: Room #, Sharing, Rent, Occupancy (color-coded: full=red, partial=warning, empty=success), Status badge
  - Each row clickable → navigates to `/rooms/:id`
  - Empty state: "Add Room" button with pre-filled floorId
- Description card (if present)

### /floors/:id/edit (Edit)

- Floor details: Label, Floor Number (integer), Total Rooms
- Per-floor amenity counts: dynamically rendered from AppConfig amenity definitions where `isPerFloor: true`

### /floors/new (Create)

- Same form as edit
- Amenity counts default to 0

### /rooms (List)

- Filters: search by room number, sharing type dropdown, status dropdown
- `DataTable` columns: Room (number), Floor, Type (sharing), Rent, Beds (available/total), Services (ServiceStatusIndicator compact), Status, Actions (TableActions)
- Mobile card: room number + status, floor + sharing + rent, action buttons

### /rooms/:id (Detail)

- Floor link: clickable label navigates to floor detail
- 4 StatCards: Monthly Rent, Total Beds, Available, Occupancy%
- Bed Occupancy: DonutChart (occupied vs available) + text breakdown
- Current Tenants table: Bed ID (mono), Tenant Name, Status (Occupied badge) — only if occupied beds exist
- Bed Allocations: grid of bed cards — green border for available, gray border for occupied (shows tenant name)
- Floor Details card: Label, Floor #
- Room Amenities Status: StackedBarChart (operational/degraded/down)
- Notes card (if description present)
- Photos grid (if photos present)

### /rooms/:id/edit (Edit)

- Room details: Room Number, Floor select, Sharing type select, Monthly Rent
- Description textarea
- Active checkbox (inactive rooms hidden from new tenant assignment)
- Amenity status: 3-column grid of status selects (Operational/Degraded/Down) from AppConfig room amenity definitions

### /rooms/new (Create)

- Same form as edit
- Floor select via ResourceSelect
- Sharing type → auto-generates correct bed count
- Amenity definitions from AppConfig (`amenityDefinitions` filtered to `isPerFloor: false`)
- Defaults to operational

## Components

### ServiceStatusIndicator

- `apps/web/src/components/ui/ServiceStatusIndicator.tsx`
- Props: `floorId`, `compact` boolean
- Fetches `GET /services?floorId=X` → renders colored dots (green/yellow/red) per service type
- Compact mode: small inline dots

### FloorServiceGrid

- `apps/web/src/components/ui/FloorServiceGrid.tsx`
- Props: `floorId`, `floorLabel`, `onReportIssue` callback
- Full grid: service icons + labels + status dots + "Report Issue" link per service
- Links generate pre-filled complaint URLs
