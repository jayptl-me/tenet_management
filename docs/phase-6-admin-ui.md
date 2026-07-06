# Phase 6: Admin Panel Frontend

**Status:** ✅ COMPLETE (07/06/2026)
**Goal:** Complete admin panel with sidebar shell, dashboard, settings-driven feature toggles, payments, attendance, guardians, assets, menu, notice board, emergency alerts, and all core admin pages. Responsive, animated with Motion, all UI states covered.
**Estimated:** 12.5-14.5 days
**Actual Output:** 51 page.tsx files across 18 modules + 6 shared UI components + admin shell (sidebar, notification bell, SSE)
**Depends On:** Phase 5 (notifications — admin uses SSE/in-app notifications)
**Package Manager:** bun

---

## Reality vs Original Plan

The original Phase 6 spec estimated ~20 pages across 14 modules. The actual implementation delivered **36 admin page routes across 18 modules**, all with consistent cartoon-brutalist design, Motion animations (fadeInUp, staggerChildren, slideIn), and full 4-state UI coverage (loading skeleton, empty state with CTA, error state with retry, success data).

### All Pages Delivered

| Module        | Pages  | Routes                                                                               |
| ------------- | ------ | ------------------------------------------------------------------------------------ |
| Dashboard     | 1      | `/dashboard` — KPI cards + Recharts + recent lists                                   |
| Floors        | 2      | `/floors` — list + detail                                                            |
| Rooms         | 2      | `/rooms` — list + detail                                                             |
| Tenants       | 3      | `/tenants` — list + detail + create                                                  |
| Payments      | 2      | `/payments` — list + detail (UTR verification)                                       |
| Invoices      | 2      | `/invoices` — list + detail (PDF streaming)                                          |
| Electricity   | 2      | `/electricity` — list + detail (readings input)                                      |
| Complaints    | 2      | `/complaints` — list (table + kanban toggle) + detail                                |
| Enquiries     | 2      | `/enquiries` — list + detail                                                         |
| Meals         | 1      | `/meals` — feedback dashboard with charts                                            |
| Menus         | 2      | `/menus` — list + detail (date picker + meal cards)                                  |
| Services      | 2      | `/services` — list + detail (floor tabs + status grid)                               |
| Notifications | 2      | `/notifications` — compose + history                                                 |
| Notices       | 2      | `/notices` — list + create                                                           |
| Visitors      | 2      | `/visitors` — list (gate register) + detail (timeline)                               |
| Guardians     | 2      | `/guardians` — list + detail (linked to tenants)                                     |
| Assets        | 2      | `/assets` — list (inventory + low-stock) + detail                                    |
| Leaves        | 2      | `/leaves` — list (approve/reject queue) + detail                                     |
| Attendance    | 2      | `/attendance` — dashboard (present/absent/leave) + detail                            |
| Settings      | 1      | `/settings` — 7 tabs (General, Contact, UPI, Pricing, Amenities, Branding, Features) |
| **Total**     | **36** |                                                                                      |

Plus: Login page (1), Landing page (1), public layout, admin layout with auth guard.

### Shared UI Components Built

| Component     | File                            | Features                                                                                                         |
| ------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Button`      | `components/ui/Button.tsx`      | 5 variants (primary/secondary/danger/ghost/outline), 4 sizes (sm/md/lg/icon), loading spinner                    |
| `Input`       | `components/ui/Input.tsx`       | label, error message, helper text, focus ring, disabled state                                                    |
| `Select`      | `components/ui/Select.tsx`      | label, error, disabled                                                                                           |
| `StatCard`    | `components/ui/StatCard.tsx`    | icon, title, value (prefix/suffix), subtitle, trend indicator, skeleton variant, danger/warning/success variants |
| `StatusBadge` | `components/ui/StatusBadge.tsx` | colored pill per status type (paid/pending/overdue/active/inactive/etc.)                                         |
| `DataTable`   | `components/ui/DataTable.tsx`   | sortable columns, search input, pagination controls, loading skeleton rows, empty state                          |

### Admin Shell

| Component          | Features                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Sidebar`          | 19 nav items + Settings + Logout, feature-flag gating (attendance/leaves/guardians), mobile hamburger overlay, active state highlight with brand color |
| `NotificationBell` | Unread count badge, dropdown with recent notifications, SSE-powered updates                                                                            |
| SSE Provider       | Auto-reconnect EventSource, query cache invalidation on events, toast notifications                                                                    |

---

## Current Hardcoded Brutalist Styles

All components and pages currently use these hardcoded Tailwind patterns. The **[THEMING_ARCHITECTURE.md](./THEMING_ARCHITECTURE.md)** plan will replace every one of these with CSS custom property references:

| Hardcoded Pattern                                     | Usage                                     | Will Become                                                                            |
| ----------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `border-3 border-black`                               | Every card, input, button, table, sidebar | `border-[length:var(--bw-strong)] border-[color:var(--border-color)]`                  |
| `shadow-brutal` (4px 4px 0 black)                     | Cards, sidebar, modals                    | `box-shadow: var(--shadow-card)`                                                       |
| `shadow-brutal-sm` (2px 2px 0 black)                  | Active buttons, pressed states            | `box-shadow: var(--shadow-button)`                                                     |
| `rounded-md` / `rounded-lg`                           | Every component                           | Theme-specific via `var(--radius-md)` / `var(--radius-lg)`                             |
| `transition-all duration-150`                         | Buttons, links, sidebar items             | `transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]` |
| `hover:translate-x-[1px] hover:translate-y-[1px]`     | Brutalist press effect on buttons         | Conditional per theme (none for neumorphic/SaaS)                                       |
| `active:scale-[0.97]`                                 | Button active state                       | Conditional per theme                                                                  |
| `font-display` / `font-body`                          | Headings / body text                      | Already token-based via `@theme` (no change needed)                                    |
| `bg-brand-500` / `bg-surface-50` / `text-surface-900` | All color usage                           | Already token-based via `@theme` (no change needed — colors are already CSS vars)      |

---

## Architecture Decisions

| Decision          | Choice                                                                                           | Rationale                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Shell layout      | Collapsible sidebar + top bar + main content area                                                | Standard admin pattern, responsive via Tailwind breakpoints            |
| Nav               | Array-driven config with Lucide icons and dynamic badges                                         | Centralized route definition, type-safe                                |
| Data fetching     | TanStack Query hooks (one hook file per resource)                                                | Cache invalidation, loading/error states, type safety                  |
| Shared components | `components/admin/` with DataTable, StatCard, StatusBadge, PriorityBadge, PageHeader, EmptyState | Consistent patterns across all pages                                   |
| Animations        | Motion (Framer Motion) with shared variant library                                               | Consistent micro-interactions, `fadeIn`, `fadeInUp`, `staggerChildren` |
| Forms             | React Hook Form + Zod resolver + shadcn/ui inputs                                                | Validation, accessibility, consistent styling                          |
| Tables            | Custom DataTable with sortable columns, pagination, row selection                                | Reusable, accessible, mobile card view alternative                     |

---

## Sidebar Nav Items (19 total)

```typescript
(Dashboard,
  Tenants,
  Rooms,
  Floors,
  Payments,
  Invoices,
  Electricity,
  Complaints,
  Enquiries,
  Meals,
  Menus,
  Services,
  Notifications,
  Notices,
  Visitors,
  Guardians(feature - flagged),
  Assets(feature - flagged),
  Leaves(feature - flagged),
  Attendance(feature - flagged) + Settings + Logout);
```

Feature-flagged items are gated by AppConfig.features toggles and hidden from sidebar + routes return 404 `FEATURE_DISABLED` when off.

---

## Verification Checklist

- [x] Admin sidebar renders all nav items with correct icons
- [x] Sidebar collapses on mobile (hamburger overlay)
- [x] Active nav item highlighted with brand color + shadow
- [x] Dashboard KPIs display correct values from API
- [x] Dashboard charts render with Recharts
- [x] Loading state: skeleton shimmer on all cards/tables
- [x] Empty state: every list page with no data → CTA message
- [x] Error state: API failure → error message + retry button
- [x] All create/edit dialogs open, validate, submit
- [x] DataTable pagination works (prev/next, page numbers)
- [x] DataTable sorting works (click column headers)
- [x] DataTable search filters rows
- [x] Complaints kanban: drag card to new column → status updates
- [x] Feature toggles hide/show attendance, leave, guardian screens correctly
- [x] WhatsApp share buttons use direct URLs only (no API keys)
- [x] Visible UI copy contains no emoji
- [x] Notification bell badge updates via SSE
- [x] Mobile responsive: tables collapse, forms stack, sidebar overlays
- [x] `bun run build` succeeds (Next.js static export)
- [x] `bun run typecheck` passes (zero errors)

---

## Theming Migration Path

When the multi-theme system (THEMING_ARCHITECTURE.md) is implemented, each page/component will be tokenized in this priority order:

### Prerequisites (Must Complete First)

1. **Switch globals.css from `@theme inline` to `@theme` (non-inline)** — CRITICAL: `@theme inline` bakes hex values into utilities, making `data-theme` cascade impossible. All theme-able tokens (colors, borders, shadows, radii, typography) MUST use `@theme` (non-inline) to emit `var(--token)` references. Only animation keyframes stay in `@theme inline`.
2. **Create 4 theme CSS files** (`brutalist.css`, `neumorphic.css`, `soft-ui.css`, `saas.css`) — each defines the same set of CSS custom properties with different values under `[data-theme="X"]` selectors.
3. **Create ThemeProvider.tsx** — reads theme setting from AppConfig/toggles, sets `data-theme` attribute on `<html>`.
4. **Add theme types** — extend AppConfig with theme preset + custom tokens.

### Component Migration Order

1. **Base tokens** — theme CSS files + globals.css update (Phase A: 4-6 hours)
2. **Button** — most used component, hardest migration (5 variants × 4 sizes × all interactive states). Border width, shadow, border-radius, hover/active transforms all become conditional per theme. (Phase B: 6-8 hours total)
3. **Input, Select** — form foundations
4. **StatusBadge** — used on every list and detail page
5. **DataTable** — used on every list page (17 pages)
6. **StatCard** — dashboard foundation
7. **Sidebar** — navigation
8. **NotificationBell** — notifications dropdown
9. **All pages** — replace hardcoded Tailwind classes with token references (Phase C: 12-16 hours)

### Settings Integration (Phase D: 4-6 hours)

10. **Add "Appearance" tab (8th tab)** to Settings page with:
    - Theme preset selector (brutalist/neumorphic/soft-ui/saas/custom)
    - Custom brand color picker with live 11-step scale preview
    - Font selector (display/body/mono per theme)
    - Border style settings
    - Shadow style preset selector
    - Live preview panel showing sample components in selected theme

### Testing (Phase E: 4-6 hours)

11. **Visual regression** — screenshot each page in all 4 themes
12. **Responsive testing** at all 4 breakpoints per theme
13. **CSS built output verification** — confirm `var(--color-brand-500)` in utilities, not hex values
14. **Cross-browser testing** — Chrome, Firefox, Safari

Estimated total effort for theming: **30-42 hours** (all 5 phases, ~70 files).
Estimated effort for Phase 6 component migration specifically: **6-8 hours** (out of 30-42 total).
