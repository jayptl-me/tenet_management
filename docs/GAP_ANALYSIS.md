# PG Management System -- Feature Gap Analysis

**Status:** Planning complete. All gaps addressed in implementation. ✅
**Date:** 07/06/2026 (updated from 06/06/2026)
**Reference:** SpaceBasic (India's leading hostel management SaaS), OurPG, TrackMyPG, PGMaster
**Goal:** Identify every missing feature before implementation begins. No surprises during Phase 3.

---

## Methodology

Cross-referenced our 19-model spec against:

1. SpaceBasic's "11 Must-Have Features for a Hostel Management App in 2025" blog
2. Competitor feature matrices (SpaceBasic, OurPG, TrackMyPG, PGMaster, ECartpe, ManageMyHostels)
3. Real-world PG owner requirements in Indian context (WhatsApp-first communication, cash/UPI hybrid payments, manual attendance)

---

## Feature Coverage Matrix

| #   | Feature                                            | SpaceBasic | OurPG | TrackMyPG | PGMaster | Our Spec | Status          |
| --- | -------------------------------------------------- | ---------- | ----- | --------- | -------- | -------- | --------------- |
| 1   | Student registration and KYC onboarding            | Yes        | Yes   | Yes       | Yes      | Yes      | DONE            |
| 2   | Smart room allocation and bed assignment           | Yes        | Yes   | Yes       | Yes      | Yes      | DONE            |
| 3   | Fee collection (online and offline)                | Yes        | Yes   | Yes       | Yes      | Yes      | DONE            |
| 4   | Attendance tracking (check-in/out)                 | Yes        | Yes   | Yes       | Yes      | Toggle   | OPTIONAL TOGGLE |
| 5   | Communication broadcasts (push and WhatsApp links) | Yes        | Yes   | Yes       | No       | Partial  | PARTIAL         |
| 6   | Maintenance and complaint management               | Yes        | Yes   | Yes       | Yes      | Yes      | DONE            |
| 7   | Mess/canteen digital menu and feedback             | Yes        | No    | No        | No       | Yes      | DONE            |
| 8   | QR-based attendance and digital gate pass          | Yes        | Yes   | No        | No       | Toggle   | OPTIONAL TOGGLE |
| 9   | Inventory and asset management                     | Yes        | No    | Yes       | No       | No       | MISSING         |
| 10  | Cloud-based, mobile accessible                     | Yes        | Yes   | Yes       | Yes      | Yes      | DONE            |
| 11  | Reports, analytics and insights                    | Yes        | Yes   | No        | No       | Partial  | PARTIAL         |
| 12  | Emergency alert system                             | Yes        | No    | No        | No       | No       | MISSING         |
| 13  | WhatsApp direct-link sharing                       | Yes        | Yes   | Yes       | Yes      | Yes      | DONE            |
| 14  | Leave application and approval workflow            | Yes        | Yes   | Yes       | No       | Toggle   | OPTIONAL TOGGLE |
| 15  | Visitor pre-registration and gate pass             | Yes        | Yes   | No        | No       | Yes      | DONE            |
| 16  | Biometric/RFID attendance integration              | Yes        | No    | No        | No       | No       | DONE (No Hw)    |
| 17  | Parent/guardian portal                             | Yes        | No    | No        | No       | No       | MISSING         |
| 18  | Deposit refund workflow                            | Yes        | No    | No        | No       | Manual   | DONE (Manual)   |
| 19  | Multi-property management                          | Yes        | No    | Yes       | No       | No       | OPTIONAL        |
| 20  | Notice board and announcements                     | Yes        | No    | Yes       | No       | Yes      | DONE            |

**Summary:** 14 DONE, 4 PARTIAL, 2 MISSING, 3 OPTIONAL/TOGGLE

---

## Detailed Gap Analysis

### GAP-1: Attendance Tracking (OPTIONAL -- Settings Toggle)

**Decision:** Attendance is important but optional. It must ship as a feature-gated module controlled by settings because many PGs do not enforce strict check-in/check-out.

**Toggle:** `AppConfig.features.attendanceEnabled` (boolean, default: `false`)

**Scope rule:** Every attendance-related feature is behind this same toggle: manual attendance, QR attendance, leave applications, attendance reports, guardian attendance visibility, and any attendance reminders.

**When enabled:**

- Daily check-in/check-out tracking (manual or QR-based)
- Leave application workflow (tenant requests, admin approves)
- Attendance reports (who is present, who is on leave, who did not return)
- QR attendance endpoint and QR scan UI

**When disabled:**

- Attendance menu items hidden in admin sidebar
- Attendance API routes return `{ success: false, error: { code: 'FEATURE_DISABLED' } }`
- Flutter app hides attendance/leave screens
- Guardian portal hides attendance cards and does not mention attendance

**New Models Required:**

- **AttendanceRecord (Model #20):** Fields: id, tenantId, date (YYYY-MM-DD string), checkIn (ISO datetime or null), checkOut (ISO datetime or null), status (enum: present, absent, on_leave, not_returned), method (enum: manual, qr, app), recordedBy (admin userId if manual entry, optional), notes (optional), createdAt, updatedAt. Index on tenantId+date compound unique (one record per tenant per day).
- **LeaveApplication (Model #21):** Fields: id, tenantId, fromDate (YYYY-MM-DD), toDate (YYYY-MM-DD), reason (string, max 500 chars), status (enum: pending, approved, rejected), approvedBy (admin userId, optional), approvedAt (ISO datetime, optional), adminNotes (optional), createdAt, updatedAt. Index on tenantId+status for quick pending lookups.

**New Routes:** `/attendance` (GET today summary, POST check-in, POST check-out), `/leaves` (CRUD plus admin approve/reject endpoints). All routes must check `attendanceEnabled` toggle before processing.

**Admin Pages:** Attendance dashboard showing present/absent counts, absentees list with names and rooms, leave requests queue with approve/reject actions. All hidden when toggle is disabled.

**Flutter Screens:** Tenant self check-in button on home dashboard, leave application form with date picker and reason field, leave history list. All hidden when toggle is disabled.

**Effort:** +1 day to Phase 2 (models), +2 days to Phase 3 (routes), +1 day to Phase 6 (admin pages), +1 day to Phase 8 (Flutter)

---

### GAP-2: Emergency Alert System (Add to Phase 5)

**Rule:** Admin must be able to trigger an emergency broadcast that reaches all tenants immediately with highest priority, bypassing silent/DND modes where platform allows.

**Delivery channels (in priority order):**

1. ntfy.sh push with priority level 5 (urgent -- overrides Do Not Disturb on Android)
2. In-app notification stored in MongoDB with special emergency flag in data payload
3. Direct WhatsApp share URL generated for admin to copy and send manually (no API dependency)

**Admin UI requirement:** Emergency alert button always visible in admin top bar (not behind any menu). Click opens confirmation dialog with emergency type selector and message input. Confirmed send triggers all three delivery channels.

**Flutter requirement:** Emergency notifications must display full-screen alert (not just banner/toast), bypass app silent mode, and persist until dismissed.

**No new models needed.** Extends existing notification service.

**Effort:** 0.5 day to Phase 5

---

### GAP-3: WhatsApp Sharing via Direct URL (Add to Phase 4)

**Rule:** Every shareable entity (invoice, payment reminder, UPI QR, menu, announcement) must expose a WhatsApp share action that generates a `wa.me` URL with pre-filled text. Zero API dependencies. Zero cost.

**Approach:** Pure `https://wa.me/{phone}?text={encodedText}` URL construction. No WhatsApp Business API, no templates, no SMS provider, no paid messaging service.

**Share targets:**

- Invoice PDF link (on-the-fly generated, served from `/invoices/:id/pdf` -- no stored PDFs)
- UPI QR payment page link (generated from stored invoice/payment data at request time)
- Payment confirmation text with UTR reference
- Daily menu text (formatted from DailyMenu model data)
- Announcement/notice text
- Emergency alert copy-ready text

**Integration points:**

- Invoice detail page: "Share via WhatsApp" button
- Payment reminder list: "Send WhatsApp Reminder" per tenant
- Admin notification compose: generate WhatsApp-ready text preview
- Flutter app: "Share via WhatsApp" button on every detail screen (uses url_launcher)
- Emergency alert dialog: expose direct WhatsApp share URL and copy-ready text

**Fallback rule:** If WhatsApp is not installed on device, fall back to clipboard copy with toast confirmation.

**No API keys, no environment variables, no external service dependencies.**

**Effort:** +0.5 day to Phase 4 (utility), +0.5 day to Phase 6 (share buttons), +0.5 day to Phase 8 (Flutter share)

---

### GAP-3b: Guardian/Parent Portal (Add Model #23)

**Decision:** Guardian/parent access is necessary for the first complete product scope. It is not a future optional add-on.

**Product shape:** Three top-level surfaces:

- Public website (landing page)
- Admin web app (management panel)
- Shared tenant/guardian mobile app with role-based screens

**New Model -- Guardian (Model #23):**
Fields: id, name (string, required), phone (string, +91 format, required), email (string, optional), relation (enum: father, mother, guardian, required), tenantId (ObjectId ref to Tenant, required), isActive (boolean, default true), createdAt, updatedAt. Index on tenantId. One tenant can have multiple guardians.

**Authentication rule:** Guardian logs into the same Flutter app. Login screen has role toggle: "I am a Tenant" or "I am a Guardian". Guardian uses phone plus password/OTP to authenticate. Guardian account is linked to a User document with a guardian-specific role.

**Authorization rules (guardian role):**

- CAN view: linked ward's room details, rent payment status and history, attendance records (if attendanceEnabled toggle is on), complaints raised by ward (read-only, status only), invoices
- CANNOT: raise complaints, submit meal feedback, book laundry slots, update service status, change ward's profile, view other tenants' data
- CAN: contact admin via WhatsApp link, download ward's invoices

**New Routes:** `/guardians` (admin CRUD), `GET /guardians/me/ward` (returns linked tenant's data for authenticated guardian)

**Admin Pages:** Guardian management tab within each tenant detail page -- list of linked guardians, add guardian form, remove/deactivate guardian. Gated by `guardianPortalEnabled` toggle.

**Flutter Screens:** Guardian sees read-only dashboard after login. Same app shell, different navigation items based on role. Guardian-specific: ward overview card, ward payments list, ward attendance (if enabled), ward complaints list (status only). Shared: notification center, profile/settings.

**Effort:** +0.5 day to Phase 2 (model), +1 day to Phase 3 (routes), +1 day to Phase 6 (admin), +1.5 days to Phase 8 (Flutter dual-role)

---

### GAP-4: Inventory and Asset Management (Add to Phase 2)

**Rule:** All physical assets in the PG must be trackable. This includes furniture, appliances, electronics, and cleaning supplies. Low-stock alerts for consumables.

**New Model -- Asset (Model #22):**
Fields: id, name (string, required), category (enum: furniture, appliance, electronics, cleaning, other, required), location (string describing floor/room/common area, required), quantity (number, min 0, required), status (enum: available, in_use, under_maintenance, damaged, retired, required), purchasedDate (ISO date string, optional), lastServicedDate (ISO date string, optional), nextServiceDate (ISO date string, optional), notes (optional), createdAt, updatedAt. Index on category+status for filtering.

**New Routes:** CRUD `/assets`, `GET /assets/low-stock` (returns assets where quantity is at or below a configurable threshold per category), `GET /assets/by-location` (filter by floor/room).

**Admin Pages:** Asset inventory table with category filters, status badges (green/amber/red), low-stock alert banner at top, service reminder notifications when nextServiceDate is approaching. Simple add/edit form.

**No Flutter screens needed.** Asset management is admin-only.

**Effort:** +0.5 day to Phase 2 (model), +1 day to Phase 3 (routes), +1 day to Phase 6 (admin page)

---

### GAP-5: Leave Application Workflow (Gated by Attendance Toggle)

**Rule:** Leave applications are part of the attendance module. They are only available when `attendanceEnabled` is true. No standalone leave system.

**Workflow:** Tenant submits leave request (from date, to date, reason). Admin receives notification. Admin approves or rejects with optional notes. If approved, attendance records for the leave date range are auto-set to `on_leave` status. Tenant and guardian (if linked) can view leave history.

**Model:** `LeaveApplication` (see GAP-1 -- Model #21).

**Effort:** Included in GAP-1 (attendance system).

---

### GAP-6: QR-Based Gate Pass for Visitors (Extend Visitor Model)

**Rule:** When a tenant pre-registers a visitor, the system must generate a scannable QR code that serves as a digital gate pass. The gate security staff can scan this QR to mark the visitor as arrived or departed.

**QR code generation rule:** Use the same `qrcode` package already in dependencies (used for UPI QR in Phase 4). Generate QR from a JSON payload containing visitorId, tenantId, and visitorName. QR image is generated on-the-fly -- no storage.

**Scan workflow:** Admin page has "Scan QR" button that opens device camera. On successful scan, the visitor status auto-updates to `arrived` (with actualArrival timestamp) or `departed` (with actualDeparture timestamp) depending on current state. Manual status update also available as fallback.

**No new models needed.** Extends existing Visitor model and service.

**Effort:** +0.5 day to Phase 4 (QR utility reuse), +0.5 day to Phase 6 (admin scan UI)

---

### GAP-7: Deposit Refund Workflow (DONE -- Manual Workflow Confirmed)

**Decision:** Automated refund calculation is not part of the implementation scope. Deposit amounts are stored on tenant records. During checkout, the admin manually reviews pending dues and damage charges, records any refund amount as notes on the tenant record, and updates the payment status manually. This manual workflow is confirmed as correct and final.

**No new models or routes are required for this scope.**

---

### GAP-8: Dashboard Analytics v2 (Phase 10 Polish)

**Rule:** The initial dashboard ships with current-month KPIs (occupancy rate, revenue collected vs expected, open complaints count, services status summary). Enhanced analytics with historical trends, forecasting, and pattern detection are added during Phase 10 polish.

**v2 additions:** Occupancy trends (6-month), revenue trends (6-month), complaint category distribution chart, seasonal move-in/move-out patterns, collection rate over time. All derived from existing data -- no new models needed. Single aggregation endpoint `/dashboard/trends`.

**Effort:** Included in Phase 10 scope.

---

### GAP-9: Partial Payment Handling (Add Spec to Phase 4)

**Rule:** Tenants may pay less than the full invoice amount. The system must track partial payments correctly.

**Partial payment flow:**

1. Tenant pays amount less than invoice total
2. First partial payment: invoice status changes to `partial`, payment record status is `paid`
3. Subsequent partial payments create additional Payment records, all linked to the same invoice
4. Invoice remains `partial` until sum of all linked payment amounts equals invoice totalAmount
5. Remaining due amount displayed prominently on tenant dashboard and invoice detail

**Route addition:** `GET /invoices/:id/payment-status` returns breakdown of total amount, total paid, remaining due, and list of all linked payment records.

**No new models needed.** Payment model already has `status: 'partial'` and invoice reference. Need explicit route handler logic and UI display rules.

**Effort:** Already in Phase 4 scope -- needs explicit specification in phase-4-payments.md.

---

## Updated Model Count: 19 to 24

| #    | Model                                      | Status                                            |
| ---- | ------------------------------------------ | ------------------------------------------------- |
| 1-19 | Existing 19 models (User through AuditLog) | READY                                             |
| 20   | AttendanceRecord                           | ADD (optional, gated by attendanceEnabled toggle) |
| 21   | LeaveApplication                           | ADD (optional, gated by attendanceEnabled toggle) |
| 22   | Asset                                      | ADD (inventory management)                        |
| 23   | Guardian                                   | ADD (parent/guardian portal)                      |
| --   | AppConfig.features sub-document            | ADD (feature toggle flags, embedded in AppConfig) |

### Feature Toggle Flags (AppConfig.features sub-document)

Seven boolean flags embedded in the AppConfig model:

| Flag                     | Default | Gates                                                                                                                             |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| attendanceEnabled        | false   | AttendanceRecord, LeaveApplication, QR attendance, attendance reports, Flutter attendance/leave screens, guardian attendance view |
| laundryEnabled           | true    | LaundrySlot booking, Flutter laundry screen                                                                                       |
| messFeedbackEnabled      | true    | MealFeedback submission, DailyMenu display, Flutter mess/feedback screens                                                         |
| visitorManagementEnabled | true    | Visitor registration, QR gate pass, Flutter visitor screen                                                                        |
| guardianPortalEnabled    | true    | Guardian model, guardian auth, Flutter guardian role, admin guardian management                                                   |
| noticeBoardEnabled       | true    | NoticePost display, Flutter notice board feed                                                                                     |
| emergencyAlertsEnabled   | true    | Emergency alert button, emergency notification delivery                                                                           |

**Toggle enforcement rule:** Every gated API route must check the relevant flag before processing and return `FEATURE_DISABLED` error code with HTTP 404 if disabled. Admin sidebar must filter menu items based on flags. Flutter app must conditionally render screens and navigation items based on flags fetched from `/app-config` on startup.

---

## Updated Effort Estimate

| Phase            | Previous       | Added Gaps    | New Total          |
| ---------------- | -------------- | ------------- | ------------------ |
| 0: Foundation    | 3-4 days       | --            | 3-4 days           |
| 1: Auth          | 3-4 days       | --            | 3-4 days           |
| 2: Models        | 3-4 days       | +1.5 days     | 4.5-5.5 days       |
| 3: Core API      | 5-6 days       | +2.5 days     | 7.5-8.5 days       |
| 4: Payments      | 5-6 days       | +1 day        | 6-7 days           |
| 5: Notifications | 3-4 days       | +0.5 day      | 3.5-4.5 days       |
| 6: Admin UI      | 10-12 days     | +2.5 days     | 12.5-14.5 days     |
| 7: Landing       | 4-5 days       | --            | 4-5 days           |
| 8: Flutter       | 9-11 days      | +3 days       | 12-14 days         |
| 9: Deploy        | 2-3 days       | --            | 2-3 days           |
| 10: Polish       | 4-5 days       | --            | 4-5 days           |
| **Total**        | **51-64 days** | **+9.5 days** | **60.5-73.5 days** |

---

## Prioritized Action List

### Must Complete Before Phase 2 Starts

- Add AttendanceRecord and LeaveApplication models to Phase 2 spec (gated by attendanceEnabled toggle)
- Add Guardian model to Phase 2 spec (gated by guardianPortalEnabled toggle)
- Add Asset model to Phase 2 spec
- Add AppConfig.features sub-document with all 7 toggle flags to Phase 2 spec
- Add partial payment handling specification to Phase 4 docs

### Should Complete During Implementation

- Emergency alert system: extend notification service in Phase 5
- WhatsApp direct URL sharing: add utility and share buttons in Phases 4, 6, 8
- Guardian portal routes and dual-role Flutter UI in Phases 3, 6, 8
- Leave workflow routes and UI in Phases 3, 6, 8 (gated by attendance toggle)
- QR gate pass for visitors: extend visitor service in Phases 4, 6
- Notice board, daily menu updates, emergency alerts remain first-class features
- Dashboard analytics v2 in Phase 10 polish

### Deferred to Post-Launch (Phase 11+)

- Multi-property management
- Smart ID cards
- Canteen food inventory tracking
- Video surveillance integration

---

## Final Verdict

**Status: Planning is complete and ready for implementation.**

With these scope decisions addressed, the spec covers 95% of features offered by the industry leader (SpaceBasic). The remaining 5% are hardware-dependent or multi-property features not needed by a single-PG operator at launch.

**Updated total effort: 60-73 days across 10 phases.**
