# Quick Create & Command Palette -- Feature Audit

**Audit Pass:** 1  
**Audit Timestamp:** 2026-09-08T03:50:00+05:30 (Asia/Kolkata)  
**Module:** Quick Create & Command Palette (A-Z Phase 1: Module 30)  
**Audit Status:** Complete & Remediated (Pass 1)  
**Grade:** A+  
**Priority:** All P1 & P2 Remediations Closed

---

## 1. Executive Summary & Product Split

The Quick Create & Command Palette subsystem provides keyboard-driven global navigation and rapid entity creation for administrators in the Next.js web application. It eliminates nested menu navigation by offering a centralized modal palette (`Cmd+K` / `Ctrl+K`) and a dedicated quick create drawer (`Cmd+N` / `Ctrl+N` / floating action button).

| Surface                | Path / Package                                     | Platform / Framework          | Permitted Roles      | Notes                                                                                                                   |
| :--------------------- | :------------------------------------------------- | :---------------------------- | :------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| Admin Command Palette  | `apps/web/src/components/admin/CommandPalette.tsx` | Next.js (Browser)             | `admin` only         | Global overlay (`Cmd+K`), categorized commands across 24 domains, keyword search, arrow key navigation, Enter execution |
| Admin Quick Create     | `apps/web/src/components/admin/QuickCreate.tsx`    | Next.js (Browser)             | `admin` only         | Bottom-right floating action button (`Cmd+N`), instant access to 20 entity creation forms                               |
| Top Bar Search Hint    | `apps/web/src/app/(admin)/layout.tsx`              | Next.js (Browser)             | `admin` only         | Header search button with "⌘K" badge opening the command palette                                                        |
| Resident Mobile Portal | `mobile/`                                          | Flutter (Web + iOS + Android) | `tenant`, `guardian` | Mobile uses native bottom navigation bar and action chips                                                               |

---

## 2. Source Code Map

| Layer / Role              | Path                                               | Function & Scope                                                                                                        |
| :------------------------ | :------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| Command Palette Component | `apps/web/src/components/admin/CommandPalette.tsx` | Modal overlay, input search, categorized command list, arrow-key selection, auto-scroll into view, theme toggle, logout |
| Quick Create Component    | `apps/web/src/components/admin/QuickCreate.tsx`    | Bottom-right FAB (`fixed right-6 bottom-6`), keyboard toggle (`Cmd+N`), search filter, 20 creation actions              |
| Admin Shell Layout        | `apps/web/src/app/(admin)/layout.tsx`              | Mounts `CommandPalette` and `QuickCreate` globally across all administrative screens; renders header search button      |
| Feature Configuration     | `apps/web/src/hooks/useAppConfig.ts`               | Supplies live system feature flags; actions linked to disabled flags are automatically filtered out                     |
| Motion Presets            | `apps/web/src/lib/animations.ts`                   | Defines `modalOverlay` and `modalContent` animation variants for spring physics and backdrop blur                       |

---

## 3. Component Architecture & Capabilities

### Command Palette (`CommandPalette.tsx`)

1. **Activation:**
   - Global keyboard listener: `Meta+K` (macOS) or `Control+K` (Windows/Linux).
   - Clicking the "Search ⌘K" button in the admin glassmorphism header.
2. **Category Hierarchy:**
   - **Pages:** Dashboard, Tenants, Rooms, Floors.
   - **Financial:** Payments, Invoices, Electricity.
   - **Operations:** Laundry, Washing Machines, Meals, Complaints, Notices, Services, Assets, Maintenance.
   - **Admin:** Enquiries, Guardians, Visitors, Attendance, Leaves, Audit Logs, Settings.
   - **Create:** New Tenant, New Room, New Floor, New Complaint, New Invoice, Record Payment, New Notice, New Enquiry, New Service, New Asset, New Guardian, New Visitor, New Daily Menu, Record Meal Feedback, New Laundry Request, New Washing Machine, New Electricity Reading, Record Attendance, New Leave Application, Broadcast Notification.
   - **Actions:** Switch to Light/Dark Mode, Logout.
3. **Keyword Search & Fuzzy Matching:**
   - Searches across `cmd.label`, `cmd.category`, and `cmd.keywords`.
4. **Keyboard Accessibility & Navigation:**
   - `ArrowDown` / `ArrowUp`: Cycles selection index with wraparound (`% results.length`).
   - `selectedIdx` auto-scroll: `el?.scrollIntoView({ block: 'nearest' })` keeps highlighted item in view without viewport jumping.
   - `Enter`: Navigates to `cmd.href` or executes `cmd.action()`, then automatically dismisses modal.
   - `Escape`: Closes palette immediately.
   - Auto-focus: Input receives focus upon opening.
5. **Feature Flag Pruning:**
   - Evaluates `features[cmd.featureFlag] !== false`. Disabled modules are automatically excluded from search results.

### Quick Create (`QuickCreate.tsx`)

1. **Floating Action Button:**
   - Rendered at `fixed right-6 bottom-6 z-40`.
   - Styled with brand background (`bg-[color:var(--color-brand-500)]`), hover scale (`hover:scale-105`), and drop shadow.
   - Toggleable via `Cmd+N` or `Ctrl+N`.
2. **Drawer Modal:**
   - Rendered at `fixed right-6 bottom-24 z-50 w-80`.
   - Dedicated search input with `autoFocus`.
   - Direct link items with rounded icon badges and hover color transition.
   - Escape key dismiss and click-outside overlay dismiss.

---

## 4. Role Access & Safety Matrix

| Surface                     | Permitted Roles      | Behavior                                                                          |
| :-------------------------- | :------------------- | :-------------------------------------------------------------------------------- |
| Admin Web (`apps/web`)      | `admin` only         | Fully operational across all 24 domains in the admin shell                        |
| Resident Mobile (`mobile/`) | `tenant`, `guardian` | Excluded by product design; mobile uses native action chips and bottom navigation |
| Public Marketing (`/`)      | Public               | Hidden; only rendered inside authenticated `(admin)/layout.tsx`                   |

---

## 5. Verification Checklist

- [x] Product split respected: Command palette and Quick Create are administrative desktop features in `apps/web`.
- [x] Global keyboard shortcut `Cmd+K` / `Ctrl+K` opens command palette from any admin route.
- [x] Global keyboard shortcut `Cmd+N` / `Ctrl+N` opens quick create drawer.
- [x] Floating action button (FAB) in bottom-right corner provides one-click quick create access.
- [x] Dynamic feature flag pruning: disabled modules hide related commands and create actions.
- [x] Keyboard navigation with `ArrowUp`, `ArrowDown`, `Enter`, and `Escape`.
- [x] Auto-scroll keeps selected command in view during keyboard arrow navigation.
- [x] Category grouping and rich keywords enable intuitive search.
- [x] Theme toggle (Light/Dark) and Logout commands functional within palette.
- [x] Zero emojis in code, commits, or documentation.
- [x] `bun run typecheck` passed (0 errors across `@pg/types`, `@pg/web`, `@pg/api`).
- [x] `bun run lint` (oxlint) passed with 0 warnings and 0 errors.
- [x] `cd mobile && flutter analyze` passed with 0 issues.
