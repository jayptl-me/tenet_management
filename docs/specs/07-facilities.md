# 07 — Facilities (Daily Menus, Meal Feedback, Laundry Slots)

## DailyMenu Model (`apps/api/src/models/dailyMenu.ts`)

| Field             | Type   | Constraints                         |
| ----------------- | ------ | ----------------------------------- |
| date              | String | Unique, `YYYY-MM-DD`                |
| meals.breakfast[] | Array  | `{ name, description?, category? }` |
| meals.lunch[]     | Array  | `{ name, description?, category? }` |
| meals.dinner[]    | Array  | `{ name, description?, category? }` |

### API Routes

| Method | Path       | Description            |
| ------ | ---------- | ---------------------- |
| GET    | /menus     | List with date filter  |
| GET    | /menus/:id | Single day menu        |
| POST   | /menus     | Create menu for a date |
| PUT    | /menus/:id | Update menu items      |
| DELETE | /menus/:id | Delete menu            |

### Frontend Pages

- `/menus` — list with date filter, shows meal summary
- `/menus/:id` — breakfast/lunch/dinner sections with items
- `/menus/:id/edit`, `/menus/new` — add/remove items per meal

## MealFeedback Model (`apps/api/src/models/mealFeedback.ts`)

| Field      | Type              | Constraints                                 |
| ---------- | ----------------- | ------------------------------------------- |
| tenantId   | ObjectId → Tenant | Required                                    |
| date       | String            | `YYYY-MM-DD`                                |
| mealType   | String            | enum: `breakfast` `lunch` `dinner`          |
| rating     | Number            | 1-5                                         |
| status     | String            | enum: `submitted` `acknowledged` `actioned` |
| comment    | String            | Max 500                                     |
| categories | String[]          | Tags                                        |

**Unique compound index**: `{ tenantId, date, mealType }` — one rating per meal per tenant per day
**Virtual**: `tenant`

### API Routes

| Method | Path           | Description                                              |
| ------ | -------------- | -------------------------------------------------------- |
| GET    | /meals         | List — filters: `date`, `tenantId`, `mealType`, `rating` |
| GET    | /meals/summary | Aggregated averages by date range                        |
| POST   | /meals         | Submit feedback                                          |
| PUT    | /meals/:id     | Update status/comment                                    |
| DELETE | /meals/:id     | Delete                                                   |

### Frontend Pages

- `/meals` — list with date/meal/rating filters
- `/meals/:id` — detail with star rating, comment, categories
- `/meals/:id/edit`, `/meals/new`

**Dashboard Integration**: Meal feedback trend line chart (breakfast/lunch/dinner over 14 days) + star rating cards on dashboard.

**Feature flag**: `messFeedbackEnabled` controls sidebar visibility.

## LaundrySlot Model (`apps/api/src/models/laundrySlot.ts`)

| Field    | Type              | Constraints                                        |
| -------- | ----------------- | -------------------------------------------------- |
| tenantId | ObjectId → Tenant | Required                                           |
| slotDate | String            | `YYYY-MM-DD`                                       |
| slotTime | String            | Time slot identifier                               |
| items    | Number            | Min 1, default 1                                   |
| status   | String            | enum: `booked` `confirmed` `completed` `cancelled` |
| notes    | String            | Max 300                                            |

**Unique compound index**: `{ tenantId, slotDate, slotTime }` — prevents double-booking
**Virtual**: `tenant`

### API Routes

| Method | Path               | Description                               |
| ------ | ------------------ | ----------------------------------------- |
| GET    | /laundry-slots     | List with status filter                   |
| GET    | /laundry-slots/:id | Detail                                    |
| POST   | /laundry-slots     | Book slot                                 |
| PUT    | /laundry-slots/:id | Update status (complete, cancel, confirm) |
| DELETE | /laundry-slots/:id | Delete                                    |

### Frontend Pages

#### /laundry (List)

- Status filter dropdown
- Columns: Tenant (with room sub-label), Date, Time, Items, Status, Actions
- **Inline actions**: Complete (CheckCircle) and Cancel (XCircle) buttons for `booked`/`confirmed` statuses
- Mobile card: name + status, date + time + items, action buttons (view/edit)

#### /laundry/:id (Detail), /laundry/:id/edit, /laundry/new

**Feature flag**: `laundryEnabled` controls sidebar visibility.
