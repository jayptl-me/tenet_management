# 04 — Finance (Payments, Invoices, Electricity Bills)

## Models

### Invoice (`apps/api/src/models/invoice.ts`)

| Field             | Type              | Constraints                                                                 |
| ----------------- | ----------------- | --------------------------------------------------------------------------- |
| invoiceNumber     | String            | Unique, `INV-YYYYMM-NNN` format                                             |
| tenantId          | ObjectId → Tenant | Required                                                                    |
| month             | String            | `YYYY-MM` format                                                            |
| generatedAt       | Date              | Default now                                                                 |
| lineItems[]       | Array             | `{ description, amount }`                                                   |
| rentAmount        | Number            | Min 0                                                                       |
| electricityAmount | Number            | Default 0, min 0                                                            |
| otherCharges      | Number            | Default 0, min 0                                                            |
| totalAmount       | Number            | **Auto-calculated** pre-save: rentAmount + electricityAmount + otherCharges |
| dueDate           | Date              | Defaults to 5th of billing month                                            |
| status            | String            | enum: `draft` `sent` `paid` `partial` `overdue` `cancelled`                 |

**Virtual**: `tenant` (populates Tenant)
**Unique compound index**: `{ tenantId, month }` — prevents duplicate invoices per tenant-month
**Pre-save hook**: `totalAmount = rentAmount + electricityAmount + otherCharges`

### Payment (`apps/api/src/models/payment.ts`)

| Field         | Type               | Constraints                                                         |
| ------------- | ------------------ | ------------------------------------------------------------------- |
| tenantId      | ObjectId → Tenant  | Required                                                            |
| invoiceId     | ObjectId → Invoice | Required                                                            |
| amount        | Number             | Min 0, required                                                     |
| type          | String             | enum: `rent` `electricity` `deposit` `laundry` `other`              |
| method        | String             | enum: `upi` `cash` `bank_transfer` `other`                          |
| status        | String             | enum: `pending` `pending_verification` `paid` `overdue` `cancelled` |
| month         | String             | `YYYY-MM`                                                           |
| dueDate       | Date               | Required                                                            |
| paidAt        | Date               | null until paid                                                     |
| utrNumber     | String             | Unique sparse, uppercase, 6-22 alphanumeric                         |
| verifiedBy    | ObjectId → User    | null until verified                                                 |
| screenshotUrl | String             | URL to payment proof screenshot                                     |
| notes         | String             | Max 500, trim                                                       |

**Virtuals**: `tenant`, `invoice`
**Indexes**: `{tenantId}`, `{invoiceId}`, `{month}`, `{status}`, `{dueDate}`, `{tenantId, month}`

### ElectricityBill (`apps/api/src/models/electricityBill.ts`)

| Field           | Type   | Constraints                                                                                     |
| --------------- | ------ | ----------------------------------------------------------------------------------------------- |
| month           | String | Unique, `YYYY-MM`                                                                               |
| totalBillAmount | Number | Min 0                                                                                           |
| billImageUrl    | String | Optional URL                                                                                    |
| roomEntries[]   | Array  | `{ roomId, previousReading, currentReading, unitsConsumed (auto), ratePerUnit, amount (auto) }` |
| status          | String | enum: `draft` `finalized` `distributed`                                                         |
| notes           | String | Max 500                                                                                         |

**Pre-save hook**: For each room entry: `unitsConsumed = max(0, currentReading - previousReading)`, `amount = unitsConsumed * ratePerUnit`
**Validation**: Must have at least one room entry

## API Routes

### Invoices

| Method | Path              | Description                                                        |
| ------ | ----------------- | ------------------------------------------------------------------ |
| GET    | /invoices         | List — filters: `tenantId`, `status`, `month`, `limit`, `page`     |
| GET    | /invoices/:id     | Detail — populated with tenant+user+room, includes payment history |
| POST   | /invoices         | Generate single invoice from template                              |
| PUT    | /invoices/:id     | Edit amounts + status (draft/sent/overdue/cancelled only)          |
| DELETE | /invoices/:id     | Delete invoice                                                     |
| GET    | /invoices/:id/pdf | Generate PDF via React PDF template                                |

### Payments

| Method | Path                 | Description                                             |
| ------ | -------------------- | ------------------------------------------------------- |
| GET    | /payments            | List — filters: `method`, `type`, `status`, pagination  |
| GET    | /payments/:id        | Detail with tenant info, invoice reference, screenshot  |
| POST   | /payments/offline    | Record cash/bank_transfer payment linked to invoice     |
| POST   | /payments/:id/verify | Admin approves/rejects pending_verification UPI payment |

**Offline Payment Flow**: Select tenant → select invoice (filtered to unpaid) → pre-fill amount from invoice balance → set method (cash/bank_transfer/other) → set paidAt datetime → create payment → update invoice status

**UPI Verification Flow**: Tenant pays via UPI app → submits UTR+screenshot → payment status = `pending_verification` → admin reviews → approve (status→paid, updates invoice) or reject (status→cancelled)

### Electricity Bills

| Method | Path                        | Description                                                     |
| ------ | --------------------------- | --------------------------------------------------------------- |
| GET    | /electricity                | List — filter: `status`, pagination                             |
| GET    | /electricity/:id            | Detail with room entries table                                  |
| POST   | /electricity                | Create bill with room entries                                   |
| PUT    | /electricity/:id            | Edit — only allowed when status=`draft`                         |
| DELETE | /electricity/:id            | Delete bill                                                     |
| POST   | /electricity/:id/finalize   | Lock readings, set status=`finalized`                           |
| POST   | /electricity/:id/distribute | Add electricity charges to each tenant's invoice for that month |

**Distribute Flow**: For each room entry → find tenant occupying that room → create/update invoice with electricityAmount → set invoice status to `sent`

## Frontend Pages

### /invoices (List)

- Filters: status dropdown (draft/sent/partial/paid/overdue/cancelled)
- Columns: Invoice # (mono font), Tenant, Room, Month, Amount, Status, Actions (TableActions)
- Mobile card: invoice number + status, tenant + month + amount, action buttons
- Empty: FileText icon + "Generate Invoice" action

### /invoices/:id (Detail)

- 4 StatCards: Total Amount, Paid, Balance (color-coded), Due Date
- Payment Progress: DonutChart (paid vs balance) + text breakdown
- Breakdown boxes: Rent (brand), Electricity (warning), Other (neutral)
- Line Items table (if present): Description, Amount, Total footer
- Payment History table (from `payments[]`): Amount, Method, UTR, Date, Status
- Payment Timeline: Timeline component with payment events
- Tenant Info card: Name, Room, Floor
- Actions: Download PDF, Share via WhatsApp (with invoice details + PDF link), Edit
- Notes card

### /invoices/:id/edit (Edit)

- Tenant read-only display card (name, room, bed)
- Line items: Rent Amount, Electricity, Other Charges — 3 number inputs
- Auto-calculated total (displays in real-time via `useWatch`)
- Status select (draft/sent/overdue/cancelled) — hidden if invoice is paid/partial
- Warning banner if payment-driven status

### /invoices/new (Create)

- Tenant select → pre-fills monthly rent, generates for selected month
- Similar line item inputs

### /payments (List)

- Filters: Method, Type, Status (3 dropdowns)
- Columns: Tenant, Room, Amount, Method, Type, Status, Date, Actions (TableActions)
- Empty: Receipt icon + "Record Payment" action

### /payments/:id (Detail)

- Large amount display centered
- 3 StatCards: Amount, Method (capitalized), Status
- Payment Info card: Method, Category, Status badge, Transaction Date
- Tenant Info card: Name, Room, Created date
- Invoice Reference card (if linked)
- Notes card
- Payment Screenshot (if screenshotUrl, with error fallback)
- Actions: Approve/Reject (only for `pending_verification`), Share via WhatsApp
- Recent Activity: Timeline with creation + status events

### /payments/new (Create)

- Tenant select (ResourceSelect with tenant name + room)
- Invoice select (filtered to payable invoices for selected tenant, shows invoiceNumber · month · amount · status)
- Balance display: remaining balance from selected invoice
- Amount input (pre-filled to balance)
- Payment Method select (cash/bank_transfer/other)
- Paid At datetime-local input (defaults to now)
- Notes textarea

### /electricity (List)

- Filter: status dropdown (draft/finalized/distributed)
- Columns: Month, Total Amount, Rooms count, Status, Notes (truncated), Actions (TableActions)
- Mobile card: month + status, amount + rooms, action buttons

### /electricity/:id (Detail)

- 4 StatCards: Total Bill (brand), Rooms count, Total Units, Room Total
- Room Entries table: Room (clickable link), Previous, Current, Units, Rate, Amount
- Notes card
- Workflow buttons: Finalize (draft), Distribute (finalized), Edit (draft)
- Action feedback banners: success/error messages

### /electricity/:id/edit

- Only accessible when status=`draft`
- Room entry editor

### /electricity/new

- Room-by-room reading input form
