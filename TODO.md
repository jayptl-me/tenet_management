# Admin Panel Redesign — Full Implementation Plan

> **Status**: Phase 1 Complete | **Last Updated**: 2026-07-08

---

## Phase 0: Audit ✅ Complete

- [x] Full codebase audit — frontend pages, backend models, API routes, components, theme system
- [x] Identified 18 areas needing work across 4 phases
- [x] Verified relational wiring: Tenant→Room→Floor, Room→Beds, Guardian→Tenant

---

## Phase 1: Critical Fixes ✅ Complete

### Block 1A: Invoice Tenant Selector

- [x] Replace raw `Input` with `ResourceSelect` in invoices/new (tenant search with name + room + rent)
- [x] Auto-fill monthly rent when tenant is selected
- [x] Line-item breakdown with auto-calculated total
- [x] Invoice edit page: Tenant info card with name/room/bed, auto-total, 3-column line items
- [x] Files: `invoices/new/page.tsx`, `invoices/[id]/edit/page.tsx`

### Block 1B: Tenant Full CRUD

- [x] New tenant page: Emergency contact fields (name, phone, relation)
- [x] New tenant page: Room ResourceSelect with floor label + sharing type + rent subtext
- [x] New tenant page: Bed validation — filters beds by room sharing type, marks occupied
- [x] New tenant page: Auto-fills monthly rent from selected room
- [x] Edit tenant page: Room/bed change with ResourceSelect
- [x] Edit tenant page: Emergency contact editing
- [x] Edit tenant page: Document upload (Aadhaar + Photo) via DocumentUpload component
- [x] Edit tenant page: Move-in date field added
- [x] Files: `tenants/new/page.tsx`, `tenants/[id]/edit/page.tsx`

### Block 1C: Floor Detail Room Listing

- [x] Floor detail: Room sub-table with columns (Room #, Sharing, Rent, Occupancy, Status)
- [x] Each room row clickable → navigates to room detail
- [x] Occupancy color coding: green (0%), yellow (partial), red (100%)
- [x] Empty state when no rooms on floor
- [x] Floor list: Added pagination + search input
- [x] Files: `floors/[id]/page.tsx`, `floors/page.tsx`

### Block 1D: Token Consistency (Deferred to Phase 3)

- [ ] 78 files have hardcoded `text-surface-*`, `bg-surface-*`, `font-display`, `font-body`
- [ ] Non-breaking — works with default theme, only affects theme switching
- [ ] Deferred to Phase 3 (Polish) as a sed-based batch fix

---

## Phase 2: Functional Deepening (Pending)

### Block 2A: Electricity Room Picker

- [ ] Replace manual room entry with dynamic room multi-select
- [ ] Add real-time unit calculation
- [ ] Files: `electricity/new/page.tsx`, `electricity/[id]/edit/page.tsx`

### Block 2B: Guardians Filters

- [ ] Add tenant relation filter, relation type filter
- [ ] File: `guardians/page.tsx`

### Block 2C: Services Page Audit

- [ ] Verify CRUD end-to-end
- [ ] Files: `services/`, ServiceStatusIndicator, FloorServiceGrid

### Block 2D: Export Page Verification

- [ ] Verify CSV/Excel export routes
- [ ] File: `export/`

---

## Phase 3: Polish & Micro-interactions (Pending)

### Block 3A: Token Consistency (Phase 1D continued)

- [ ] Batch replace `text-surface-900` → `text-[color:var(--color-text-primary)]` across 78 files
- [ ] Replace `font-display` → `font-[family:var(--font-display)]`
- [ ] Replace `border-surface-200` → `border-[color:var(--border-color)]`

### Block 3B: Empty States & Error Boundaries

- [ ] Verify all list pages have `<EmptyState>`
- [ ] Add error boundaries for critical pages

---

## Phase 4: Data Visualization (Pending)

- [ ] Verify dashboard charts work with live data

## Phase 5: Final Verification (Pending)

- [ ] Full CRUD smoke test
- [ ] Mobile responsive check
- [ ] All 4 themes in light + dark modes

---

## Verification Results (Phase 1)

- ✅ `tsc --noEmit`: 0 errors
- ✅ `bun run build`: All routes compiled (70+ routes)
- ✅ All 4 files modified compile correctly
