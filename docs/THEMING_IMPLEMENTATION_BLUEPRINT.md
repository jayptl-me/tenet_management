# Multi-Theme Design System — Production Implementation Blueprint

> **Status:** PHASES A-D COMPLETE — Phase E (testing) + Phase F (runtime verification) remain
> **Date:** 08/06/2026
> **Build:** ✅ `bun run build` exits 0 for all 36 routes
> **Total var() token references:** 458 across codebase
> **Goal:** Production-grade, adaptive multi-theme system with zero runtime cost and full customizability
> **Tech:** Tailwind CSS v4 `@theme` (non-inline) + CSS custom properties + `data-theme` attribute cascade
> **Estimated total effort:** 30-42 hours across 5 phases

---

## Critical Pre-Implementation Requirements

### ⚠️ MANDATORY: Fix `@theme inline` → `@theme` Before Any Tokenization

| Current (BROKEN)                                | Required (CORRECT)                                         |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `@theme inline { --color-brand-500: #f59e0b; }` | `@theme { --color-brand-500: var(--color-brand-500); }`    |
| Tailwind emits: `background-color: #f59e0b`     | Tailwind emits: `background-color: var(--color-brand-500)` |
| `data-theme` cascade has ZERO effect            | CSS cascade overrides at runtime                           |

**This is a hard blocker.** If you tokenize components without fixing this first, the entire theming system will silently fail. Every theme preset will render identically.

**Fix action:** In `apps/web/src/app/globals.css`, split the current `@theme inline` block into:

1. `@theme { ... }` — for ALL theme-able tokens (colors, radii, fonts, shadows, borders, spacing)
2. `@theme inline { ... }` — ONLY for animation keyframes (never change per theme)

---

## Complete Hardcoded Value Catalog

Every single hardcoded Tailwind class, CSS property, and inline style found across all 56 page/component files. These must be replaced with token references.

### Category 1: Border Width + Color

| Pattern                         | Occurrence Count                                                                      | Token                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `border-3 border-black`         | 50+ (most cards, inputs, buttons, tables, sidebar, stat cards, badges, charts, forms) | `border-[length:var(--bw-strong)] border-[color:var(--border-color)]`             |
| `border-2 border-black`         | 30+ (smaller elements, icon containers, trend badges, feature cards, buttons)         | `border-[length:var(--bw-default)] border-[color:var(--border-color)]`            |
| `border-r-3 border-black`       | 1 (sidebar)                                                                           | `border-r-[length:var(--bw-strong)] border-r-[color:var(--border-color)]`         |
| `border-b-3 border-black`       | 10+ (header, table headers, sidebar top/bottom, navbar, hero)                         | `border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)]`         |
| `border-l-brand-500`            | 4 (StatCard accent)                                                                   | `border-l-[color:var(--color-brand-500)]`                                         |
| `border-t-3 border-black`       | 4 (footer, mobile nav, settings save bar)                                             | `border-t-[length:var(--bw-strong)] border-t-[color:var(--border-color)]`         |
| `border-b-2 border-surface-200` | Many (table rows, notification items, settings panels)                                | `border-b-[length:var(--bw-default)] border-b-[color:var(--border-subtle-color)]` |
| `border-l-brand-*`              | 4 (StatCard variants)                                                                 | `border-l-[color:var(--color-brand-500)]` / success/warning/danger                |

**Components affected:** Button (all 5 variants), Input, Select, StatCard (all 4 variants), StatusBadge (all 5 variants), DataTable (table + pagination), Sidebar (all states), NotificationBell, admin layout header, landing page (navbar, features cards, about card, enquiry form, footer), login page

### Category 2: Shadows

| Pattern                                | Occurrence Count                                                                                                  | Token                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `shadow-brutal` (4px 4px 0 black)      | 40+ (all cards, sidebar, modals, stat cards, login card, feature cards, about card, enquiry form, wakeup overlay) | `shadow-[var(--shadow-card)]`                          |
| `shadow-brutal-sm` (2px 2px 0 black)   | 25+ (active nav items, pressed buttons, notification bell, settings tabs, sidebar active)                         | `shadow-[var(--shadow-button)]`                        |
| `shadow-brutal:hover:shadow-brutal-sm` | 10+ (hover on feature cards, stat cards with onClick)                                                             | Hover state: `hover:shadow-[var(--shadow-card-hover)]` |

**Custom utility classes `shadow-brutal` and `shadow-brutal-sm` must be removed from globals.css and replaced with CSS custom property references.**

### Category 3: Border Radius

| Pattern             | Occurrence Count                                                                                | Token                                       |
| ------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `rounded-md`        | 30+ (buttons, inputs, selects, pagination controls, sidebar nav items, icon containers, badges) | Maps to `--radius-md` (already in `@theme`) |
| `rounded-lg`        | 25+ (cards, forms, modal sections, stat cards, settings panels, chart containers)               | Maps to `--radius-lg` (already in `@theme`) |
| `rounded-xl`        | 5+ (login card, notification dropdown, settings tab bar, wakeup overlay)                        | Maps to `--radius-xl`                       |
| `rounded-full`      | 10+ (badges, notification count, spinners, decorative dots)                                     | Maps to `--radius-full`                     |
| `rounded-[4,4,0,0]` | 2 (Recharts Bar radius prop)                                                                    | Theme-conditional: SaaS=2px, Neumorphic=6px |

**Note:** `rounded-md`, `rounded-lg` etc. already reference Tailwind tokens which map to CSS vars in `@theme`. The token values in `@theme` already reference `var(--radius-md)`, so radius switching works automatically once the `@theme` block is fixed.

### Category 4: Transitions & Animation Duration

| Pattern                       | Occurrence Count                                                     | Token                                                                                  |
| ----------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `transition-all duration-150` | 35+ (buttons, sidebar items, stat cards, feature cards)              | `transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]` |
| `transition-colors`           | 15+ (nav links, notification items, table rows, tab buttons, inputs) | No token needed (color transitions work across themes)                                 |
| `animate-pulse`               | 3 (loading spinners, shimmer)                                        | No token needed                                                                        |
| `animate-spin`                | 5 (loading indicators)                                               | No token needed                                                                        |

### Category 5: Hover/Active Transform Effects (Theme-Conditional)

| Pattern                                             | Occurrence Count                                                                   | Behavior Per Theme                                                                                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hover:translate-x-[1px] hover:translate-y-[1px]`   | 30+ (buttons, sidebar active items, feature cards, stat cards)                     | **Brutalist:** translate(1px, 1px) press effect. **Neumorphic:** shadow swap only (no translate). **Soft UI:** translateY(-2px) lift effect. **SaaS:** background color change only (no translate). |
| `active:scale-[0.97]`                               | 5+ (notification bell, login button, all Button primary/secondary/danger variants) | **Conditional:** Brutalist only. Neumorphic/Soft UI/SaaS: none or reduced to 0.99.                                                                                                                  |
| `active:translate-x-[1px] active:translate-y-[1px]` | 15+ (all Button variants except ghost, StatCard onClick)                           | **Brutalist:** keep. **Other themes:** remove active translate, use different press feedback per theme.                                                                                             |
| `hover:shadow-brutal-sm`                            | 10+ (feature cards, stat cards)                                                    | **Brutalist:** smaller shadow on hover. **Neumorphic:** shadow swap on hover. **Soft UI:** softer deeper shadow + lift. **SaaS:** subtle shadow increase.                                           |

**THIS IS THE HARDEST MIGRATION.** These effects are not simple value swaps — they are entirely different CSS behaviors per theme. Approach:

- Brutalist: `translateX(1px) translateY(1px) + smaller shadow` (current)
- Neumorphic: `swap box-shadow from raised to inset` (completely different CSS)
- Soft UI: `translateY(-2px) + deeper softer shadow` (different transform)
- SaaS: `background-color shift only, no transform`

**Solution:** Each component exports a theme-conditional className via a utility:

```typescript
// apps/web/src/lib/theme-behaviors.ts
export const hoverPressEffect =
  'hover:translate-y-[var(--hover-lift)] hover:shadow-[var(--shadow-card-hover)]';
export const activePressEffect =
  'active:scale-[var(--active-press-scale)] active:translate-x-[var(--active-press-x)] active:translate-y-[var(--active-press-y)] active:shadow-[var(--shadow-button-pressed)]';
```

Where theme CSS files define:

```css
[data-theme='brutalist'] {
  --hover-lift: translateX(1px) translateY(1px);
  --active-press-scale: 0.97;
  --active-press-x: 1px;
  --active-press-y: 1px;
}
[data-theme='neumorphic'] {
  --hover-lift: none;
  --active-press-scale: 0.98;
  --active-press-x: 0px;
  --active-press-y: 0px;
}
[data-theme='soft-ui'] {
  --hover-lift: translateY(-2px);
  --active-press-scale: 0.98;
  --active-press-x: 0px;
  --active-press-y: 0px;
}
[data-theme='saas'] {
  --hover-lift: none;
  --active-press-scale: 1;
  --active-press-x: 0px;
  --active-press-y: 0px;
}
```

### Category 6: Font Families

| Pattern                   | Occurrence Count                                                         | Token                                                       |
| ------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `font-display`            | 100+ (all headings, button text, sidebar nav, stat values, badges, tabs) | Already maps to `var(--font-display)` — works across themes |
| `font-sans` / `font-body` | 60+ (all body text, table cells, input text, notifications)              | Already maps to `var(--font-body)` — works across themes    |
| `font-mono`               | 8+ (notification count, timestamps, UTR numbers)                         | Already maps to `var(--font-mono)` — works across themes    |

**Font switching is already handled** by the `@theme` block if we update font families per theme:

```css
[data-theme='brutalist'] {
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
[data-theme='neumorphic'] {
  --font-display: 'Poppins', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'Fira Code', monospace;
}
[data-theme='soft-ui'] {
  --font-display: 'Plus Jakarta Sans', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}
[data-theme='saas'] {
  --font-display: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

**Font loading:** All 6 font families must be loaded via Google Fonts `@import` in globals.css with `font-display: swap`. Loading them all upfront (not dynamically per theme) is the recommended approach — fonts are cached after first load and the total additional weight (~200KB) is acceptable.

### Category 7: Color References (Already Tokenized)

`bg-brand-500`, `bg-surface-50`, `text-surface-900`, `text-brand-100`, etc. — all already reference `@theme` tokens. Once `@theme` (non-inline) emits `var(--color-brand-500)`, these work automatically across themes.

### Category 8: Static Values (No Token Needed)

- `z-50`, `z-40`, `z-30` (z-index layering)
- `w-fit`, `w-full`, `max-w-*`, `min-w-*` (layout widths)
- `grid-cols-*`, `flex`, `flex-col`, `gap-*` (layout)
- `px-*`, `py-*`, `p-*` (padding — could be tokenized for spacing scale but not theme-critical)
- `text-sm`, `text-lg`, `text-xl` (font sizes — could be tokenized but consistent across themes)
- `overflow-hidden`, `overflow-x-auto`, `truncate`, `line-clamp-*` (text behavior)
- `animate-*` (animations — in `@theme inline`, never change)

### Category 9: Recharts Theme-Specific Values

Chart colors are hardcoded in dashboard page.tsx and need tokenization:

- Bar fills: `fill="#F59E0B"` (brand-500), `fill="#A8A29E"` (surface-400)
- Line colors: `stroke="#F59E0B"`, `stroke="#84CC16"`, `stroke="#6366F1"`
- Grid lines: `stroke="#e0e0e0"`
- Tooltip border: `border: '2px solid #000'`
- Tooltip border-radius: `borderRadius: 8`

**Solution:** Pass CSS custom property values to Recharts via `useTheme()` hook or direct `var()` references in style props.

---

## Exact File-by-File Migration Plan

### Phase A: Token Foundation (4-6 hours)

#### A.1: Fix globals.css — `@theme inline` → `@theme` + `@theme inline`

**File:** `apps/web/src/app/globals.css`

Changes:

1. Replace entire `@theme inline` block with split `@theme` + `@theme inline` blocks
2. Add `:root` default token definitions
3. Remove `.shadow-brutal` and `.shadow-brutal-sm` custom utilities (replaced by CSS vars)
4. Remove `.border-3` custom utility (replaced by `border-[length:var(--bw-strong)]`)
5. Add Google Fonts imports for all 6 font families

**Exact output:** See [Appendix A: Complete globals.css](#appendix-a-complete-globalscss)

#### A.2: Create Theme CSS Files

**Files to create:** `apps/web/src/themes/brutalist.css`, `apps/web/src/themes/neumorphic.css`, `apps/web/src/themes/soft-ui.css`, `apps/web/src/themes/saas.css`

Each file defines ALL custom properties under `[data-theme="X"]` selector. See [Appendix B: Complete Theme CSS](#appendix-b-theme-css-files).

#### A.3: Create Theme Types

**File to create:** `apps/web/src/themes/types.ts`

```typescript
export type ThemePreset = 'brutalist' | 'neumorphic' | 'soft-ui' | 'saas' | 'custom';

export interface ThemeSettings {
  preset: ThemePreset;
  customTokens?: Partial<Record<string, string>>; // overrides
  brandColor?: string; // hex — generates 11-step scale
  fonts?: {
    display?: string;
    body?: string;
    mono?: string;
  };
}
```

#### A.4: Create ThemeProvider

**File to create:** `apps/web/src/themes/ThemeProvider.tsx`

Reads theme from AppConfig API on mount, sets `data-theme` attribute on `<html>`, applies custom overrides as inline styles on `<html>`.

#### A.5: Wire ThemeProvider in Root Layout

**File to modify:** `apps/web/src/app/layout.tsx`

- Wrap children with `<ThemeProvider>`
- Remove `geistSans` and `geistMono` variables (replaced by theme fonts)
- Update `<html>` className

#### A.6: Create Theme Behaviors Utility

**File to create:** `apps/web/src/lib/theme-behaviors.ts`

Exports theme-conditional class strings for hover/active effects (see Category 5 above).

#### A.7: Create useTheme Hook

**File to create:** `apps/web/src/hooks/useTheme.ts`

Returns current theme settings, preset name, and helper to resolve token values for inline styles (like Recharts colors).

---

### Phase B: Component Tokenization (6-8 hours)

#### B.1: Button (Hardest — highest impact)

**File to modify:** `apps/web/src/components/ui/Button.tsx`

Changes:

- Replace `border-3 border-black` with `border-[length:var(--bw-strong)] border-[color:var(--border-color)]`
- Replace `shadow-brutal` with `shadow-[var(--shadow-button)]`
- Replace `shadow-brutal-sm` with `shadow-[var(--shadow-button-pressed)]`
- Replace `rounded-md` with `rounded-[var(--radius-md)]` (already works via `@theme` radius tokens)
- Replace `transition-all duration-150` with `transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]`
- Replace `hover:translate-x-[1px] hover:translate-y-[1px]` with `hover:translate-[var(--hover-lift)]`
- Replace `active:translate-x-[1px] active:translate-y-[1px] active:shadow-brutal-sm` with `active:scale-[var(--active-press-scale)] active:translate-x-[var(--active-press-x)] active:translate-y-[var(--active-press-y)] active:shadow-[var(--shadow-button-pressed)]`
- Ghost variant border: `border-transparent` → `border-[length:var(--bw-strong)] border-transparent`
- Focus ring: `focus-visible:ring-3 focus-visible:ring-black` → `focus-visible:ring-[length:var(--bw-strong)] focus-visible:ring-[color:var(--border-color)]`

**All 5 variants × 4 sizes × active/hover/focus/disabled states must work across all 4 themes.**

#### B.2: Input

**File to modify:** `apps/web/src/components/ui/Input.tsx`

Changes:

- `border-3 border-black` → `border-[length:var(--bw-strong)] border-[color:var(--border-color)]`
- `rounded-md` → `rounded-[var(--radius-md)]`
- `focus:ring-3 focus:ring-brand-500` → `focus:ring-[length:var(--bw-strong)] focus:ring-[color:var(--color-brand-500)]`
- Error border: `border-danger-500` → `border-[color:var(--color-danger-500)]`
- Disabled: `bg-surface-100` → `bg-[color:var(--color-surface-100)]`
- Font: `font-sans` → `font-[family:var(--font-body)]`

#### B.3: Select

**File to modify:** `apps/web/src/components/ui/Select.tsx`

Same changes as Input above.

#### B.4: StatusBadge

**File to modify:** `apps/web/src/components/ui/StatusBadge.tsx`

Changes:

- `border-2` → `border-[length:var(--bw-default)]` (neumorphic: 0px border)
- `rounded-full` → `rounded-[var(--radius-full)]`
- Border colors per variant: `border-success-300` etc. → `border-[color:var(--color-success-300)]`

**Neumorphic special case:** No borders. `--bw-default: 0px` and transparent border color will handle this.

#### B.5: StatCard

**File to modify:** `apps/web/src/components/ui/StatCard.tsx`

Changes:

- `border-3 border-black` → tokenized borders
- `shadow-brutal` → `shadow-[var(--shadow-card)]`
- `rounded-lg` → `rounded-[var(--radius-lg)]`
- Accent left borders per variant → already `border-l-success-500` etc. (works via `@theme` color tokens)
- Hover effects: `hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-brutal-sm` → `hover:translate-[var(--hover-lift)] hover:shadow-[var(--shadow-card-hover)]`
- Icon container: `border-2 border-black` → tokenized
- Trend badge: `border-2` + theme colors → tokenized

#### B.6: DataTable

**File to modify:** `apps/web/src/components/ui/DataTable.tsx`

Changes:

- Table container: `border-3 border-black rounded-lg` → tokenized
- Table header: `border-b-3 border-black` → tokenized
- Table rows: `border-b-2 border-surface-200` → tokenized border + color
- Row hover: `hover:bg-brand-50` → `hover:bg-[color:var(--color-brand-50)]`
- Pagination select: `border-2 border-black rounded-md` → tokenized
- Pagination buttons: use Button component (already tokenized)
- Search input: uses Input component (already tokenized)
- Loading skeleton: `bg-surface-200` → `bg-[color:var(--color-surface-200)]`

#### B.7: Sidebar

**File to modify:** `apps/web/src/components/admin/Sidebar.tsx`

Changes:

- Container: `border-r-3 border-black` → tokenized
- Brand section: `border-b-3 border-black` → tokenized
- Nav items (active): `border-black bg-brand-500 text-white shadow-brutal-sm` → tokenized borders + background + shadow
- Nav items (inactive): `hover:bg-surface-100 hover:border-black` → tokenized
- Footer: `border-t-3 border-black` → tokenized
- Logout button: `hover:bg-danger-100 hover:border-danger-300` → tokenized
- Mobile hamburger: `border-3 border-black bg-white shadow-brutal` → tokenized
- Width: `w-64` → `w-[var(--sidebar-width)]` (240-280px per theme)

#### B.8: NotificationBell

**File to modify:** `apps/web/src/components/admin/NotificationBell.tsx`

Changes:

- Bell button: `border-2 border-black shadow-brutal-sm rounded-lg` → tokenized
- Badge: `border-2 border-black bg-danger-500 shadow-brutal-sm rounded-full` → tokenized
- Dropdown: `border-3 border-black shadow-brutal rounded-xl` → tokenized
- Dropdown header: `border-b-2 border-surface-200` → tokenized
- Notification items: `border-b border-surface-100` → tokenized
- Type badges: `rounded-full` + theme colors → tokenized
- Footer: `border-t-2 border-surface-200` → tokenized

---

### Phase C: Page Tokenization (12-16 hours)

All 56 page files. The pattern is consistent — every page uses the same set of hardcoded classes:

- `border-3 border-black` on section cards → tokenized borders
- `shadow-brutal` on cards → tokenized shadow
- `rounded-lg` on cards → already works via `@theme` radius tokens
- `rounded-md` on inner elements → already works
- `text-*` and `bg-*` → already works via `@theme` color tokens
- `font-display`/`font-sans`/`font-mono` → already works via `@theme` font tokens
- `transition-all duration-150` → tokenized duration/easing

**Batch strategy:** Replace all hardcoded patterns with token references across all files in groups of 10.

#### Batch C1: Dashboard + Layouts (5 files)

- `apps/web/src/app/(admin)/dashboard/page.tsx`
- `apps/web/src/app/(admin)/layout.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx` (landing)
- `apps/web/src/app/login/page.tsx`

#### Batch C2: List Pages — Floors, Rooms, Tenants (5 files)

- `apps/web/src/app/(admin)/floors/page.tsx`
- `apps/web/src/app/(admin)/rooms/page.tsx`
- `apps/web/src/app/(admin)/tenants/page.tsx`
- `apps/web/src/app/(admin)/floors/[id]/page.tsx`
- `apps/web/src/app/(admin)/rooms/[id]/page.tsx`

#### Batch C3: List Pages — Payments, Invoices, Electricity (5 files)

- `apps/web/src/app/(admin)/payments/page.tsx`
- `apps/web/src/app/(admin)/invoices/page.tsx`
- `apps/web/src/app/(admin)/electricity/page.tsx`
- `apps/web/src/app/(admin)/payments/[id]/page.tsx`
- `apps/web/src/app/(admin)/invoices/[id]/page.tsx`

#### Batch C4: List Pages — Complaints, Enquiries, Meals, Menus, Services (5 files)

- `apps/web/src/app/(admin)/complaints/page.tsx`
- `apps/web/src/app/(admin)/enquiries/page.tsx`
- `apps/web/src/app/(admin)/meals/page.tsx`
- `apps/web/src/app/(admin)/menus/page.tsx`
- `apps/web/src/app/(admin)/services/page.tsx`

#### Batch C5: List Pages — Notifications, Notices, Visitors, Guardians, Assets (5 files)

- `apps/web/src/app/(admin)/notifications/page.tsx`
- `apps/web/src/app/(admin)/notices/page.tsx`
- `apps/web/src/app/(admin)/visitors/page.tsx`
- `apps/web/src/app/(admin)/guardians/page.tsx`
- `apps/web/src/app/(admin)/assets/page.tsx`

#### Batch C6: List Pages — Attendance, Leaves + Settings (4 files)

- `apps/web/src/app/(admin)/attendance/page.tsx`
- `apps/web/src/app/(admin)/leaves/page.tsx`
- `apps/web/src/app/(admin)/settings/page.tsx`
- `apps/web/src/components/shared/ServerWakeupOverlay.tsx`

#### Batch C7: Detail Pages — Floors, Rooms, Tenants, Payments (5 files)

- `apps/web/src/app/(admin)/tenants/[id]/page.tsx`
- `apps/web/src/app/(admin)/tenants/new/page.tsx`
- `apps/web/src/app/(admin)/floors/new/page.tsx`
- `apps/web/src/app/(admin)/rooms/new/page.tsx`
- `apps/web/src/app/(admin)/payments/new/page.tsx`

#### Batch C8: Detail Pages — Invoices, Electricity, Complaints, Enquiries (5 files)

- `apps/web/src/app/(admin)/electricity/[id]/page.tsx`
- `apps/web/src/app/(admin)/complaints/[id]/page.tsx`
- `apps/web/src/app/(admin)/enquiries/[id]/page.tsx`
- `apps/web/src/app/(admin)/invoices/new/page.tsx`
- `apps/web/src/app/(admin)/electricity/new/page.tsx`

#### Batch C9: Detail Pages — Meals, Menus, Notices, Visitors (5 files)

- `apps/web/src/app/(admin)/meals/[id]/page.tsx`
- `apps/web/src/app/(admin)/menus/[id]/page.tsx`
- `apps/web/src/app/(admin)/notices/[id]/page.tsx`
- `apps/web/src/app/(admin)/visitors/[id]/page.tsx`
- `apps/web/src/app/(admin)/guardians/[id]/page.tsx`

#### Batch C10: Detail Pages — Guardians, Assets, Attendance, Leaves (5 files)

- `apps/web/src/app/(admin)/assets/[id]/page.tsx`
- `apps/web/src/app/(admin)/attendance/[id]/page.tsx`
- `apps/web/src/app/(admin)/leaves/[id]/page.tsx`
- `apps/web/src/app/(admin)/assets/new/page.tsx`
- `apps/web/src/app/(admin)/guardians/new/page.tsx`

#### Batch C11: Remaining Detail Pages (5 files)

- `apps/web/src/app/(admin)/attendance/new/page.tsx`
- `apps/web/src/app/(admin)/leaves/new/page.tsx`
- `apps/web/src/app/(admin)/visitors/new/page.tsx`
- `apps/web/src/app/(admin)/notices/new/page.tsx`
- `apps/web/src/app/(admin)/menus/new/page.tsx`

#### Batch C12: Remaining Detail Pages (2 files)

- `apps/web/src/app/(admin)/meals/new/page.tsx`
- `apps/web/src/app/(admin)/complaints/new/page.tsx`

---

### Phase D: Settings Integration (4-6 hours)

#### D.1: Add "Appearance" Tab to Settings

**File to modify:** `apps/web/src/app/(admin)/settings/page.tsx`

Add 8th tab "Appearance" with:

- Theme preset selector dropdown (Brutalist / Neumorphic / Soft UI / SaaS / Custom)
- Custom brand color picker (color input + live 11-step scale preview)
- Font selectors for display/body/mono (dropdown with Google Fonts options)
- Border style: width slider (0-4px), color picker
- Shadow preset dropdown (brutalist/neumorphic/soft/saas/custom)
- Radius preset dropdown (sharp/comfortable/round/pill)
- Live preview panel showing sample components (Button, Input, StatCard, StatusBadge, DataTable) in selected theme
- "Reset to Preset Defaults" button

#### D.2: Extend AppConfig Type

**File to modify:** `packages/types/src/appConfig.ts`

Add `theme: ThemeSettings` field to `IAppConfig` interface.

#### D.3: API Integration

- `PUT /api/v1/app-config` already exists — extend to accept theme settings
- `GET /api/v1/app-config` returns theme settings → ThemeProvider reads on mount

---

### Phase E: Testing & Polish (4-6 hours)

#### E.1: CSS Build Output Verification

```bash
bun run build
# Verify output CSS contains var(--color-brand-500) NOT #f59e0b
grep "var(--color-brand-500)" apps/web/out/_next/static/css/*.css
```

#### E.2: Visual Regression (Manual)

Open each page in all 4 themes. Verify:

- [ ] Brutalist: 3px black borders, chunky shadows, press-down effects
- [ ] Neumorphic: 0px borders, duotone shadows, inset inputs, raised cards
- [ ] Soft UI: 1px light borders, glass cards with backdrop blur, hover lift
- [ ] SaaS: 1px gray borders, tight shadows, compact padding, hover bg shift

#### E.3: Responsive Testing

All 4 themes × all 4 breakpoints (sm:640, md:768, lg:1024, xl:1280):

- [ ] Sidebar: hamburger on mobile, full on desktop
- [ ] DataTable: horizontal scroll on mobile
- [ ] StatCards: 1-col mobile, 2-col tablet, 4-col desktop
- [ ] Forms: single column mobile, multi-column desktop

#### E.4: Cross-Browser

- [ ] Chrome: all themes work
- [ ] Firefox: var() references resolve correctly
- [ ] Safari: backdrop-filter for glass theme works

#### E.5: Performance

- [ ] Theme switch: <50ms (CSS cascade, no JS re-render)
- [ ] No layout shift on theme switch
- [ ] Fonts load with swap — no invisible text

#### E.6: Edge Cases

- [ ] Custom brand color with neumorphic preset: works correctly
- [ ] Theme persistence after page reload: theme restored from AppConfig
- [ ] Multiple admin users: theme settings are global per PG (not per user)
- [ ] Browser with no JS: default theme renders (brutalist)
- [ ] `@theme` block values cascade correctly: 6-layer cascade verified

---

## CSS Token Inventory (Complete)

Every CSS custom property defined, with defaults and per-theme overrides.

### Color Tokens (11-step scale per color family)

```
--color-brand-50  through --color-brand-950   (11 values)
--color-surface-50 through --color-surface-950 (11 values)
--color-danger-50  through --color-danger-900  (9 values)
--color-success-50 through --color-success-900 (9 values)
--color-warning-50 through --color-warning-900 (9 values)
```

### Border Tokens

```
--bw-default: 1px → 3px (brutalist), 0px (neumorphic), 1px (soft ui), 1px (saas)
--bw-strong: 3px → 3px (brutalist), 0px (neumorphic), 1px (soft ui), 1px (saas)
--border-color: #000 (brutalist), transparent (neumorphic), rgba(255,255,255,0.3) (soft ui), #e5e7eb (saas)
--border-style: solid (all themes)
```

### Radius Tokens

```
--radius-sm: 4px / 12px / 8px / 6px
--radius-md: 8px / 16px / 12px / 8px
--radius-lg: 12px / 24px / 20px / 10px
--radius-xl: 16px / 28px / 24px / 12px
--radius-full: 9999px (all themes)
```

### Shadow Tokens

```
--shadow-card: 4px 4px 0 #000 (brutalist) / 8px 8px 16px #d1d3d9, -8px -8px 16px #fff (neumorphic) / 0 8px 32px rgba(0,0,0,0.08) (soft ui) / 0 1px 3px rgba(0,0,0,0.1) (saas)
--shadow-card-hover: 2px 2px 0 #000 / inset 4px 4px 8px #d1d3d9, inset -4px -4px 8px #fff / 0 12px 40px rgba(0,0,0,0.12) / 0 2px 6px rgba(0,0,0,0.15)
--shadow-button: 2px 2px 0 #000 / 6px 6px 12px #d1d3d9, -6px -6px 12px #fff / 0 4px 12px rgba(0,0,0,0.06) / 0 1px 2px rgba(0,0,0,0.05)
--shadow-button-pressed: none / inset 3px 3px 6px #d1d3d9, inset -3px -3px 6px #fff / 0 1px 4px rgba(0,0,0,0.04) / none
--shadow-dropdown: 3px 3px 0 #000 / 12px 12px 24px #d1d3d9, -12px -12px 24px #fff / 0 16px 48px rgba(0,0,0,0.12) / 0 4px 12px rgba(0,0,0,0.1)
--shadow-modal: 6px 6px 0 rgba(0,0,0,0.5) / 20px 20px 40px rgba(0,0,0,0.2) / 0 24px 64px rgba(0,0,0,0.16) / 0 20px 60px rgba(0,0,0,0.15)
```

### Typography Tokens

```
--font-display: 'Syne' / 'Poppins' / 'Plus Jakarta Sans' / 'Inter'
--font-body: 'DM Sans' / 'Inter' / 'Inter' / 'Inter'
--font-mono: 'JetBrains Mono' / 'Fira Code' / 'IBM Plex Mono' / 'JetBrains Mono'
```

### Transition Tokens

```
--transition-duration: 150ms / 300ms / 250ms / 200ms
--transition-easing: ease-out / ease-in-out / cubic-bezier(0.4,0,0.2,1) / ease
```

### Layout Tokens

```
--sidebar-width: 256px / 280px / 272px / 240px
--header-height: 60px (all themes)
```

### Behavior Tokens (for hover/active effects)

```
--hover-lift: translateX(1px) translateY(1px) / none / translateY(-2px) / none
--active-press-scale: 0.97 / 0.98 / 0.98 / 1
--active-press-x: 1px / 0px / 0px / 0px
--active-press-y: 1px / 0px / 0px / 0px
```

---

## Font Loading Strategy

All fonts loaded via Google Fonts in globals.css `@import`:

```css
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
```

All fonts use `font-display: swap` via the `&display=swap` query parameter. This prevents FOIT (Flash of Invisible Text).

---

## Theme Persistence Strategy

1. Admin selects theme in Settings → Appearance tab
2. Settings saved to AppConfig via `PUT /api/v1/app-config`
3. `ThemeProvider` reads `appConfig.theme` on mount and sets `data-theme="{preset}"` on `<html>`
4. Custom overrides applied as inline styles on `<html>` (highest CSS specificity)
5. Persisted in MongoDB → survives server restarts
6. All users see the same theme (global PG brand, not per-user)

---

## Color Palette Generation (Custom Brand Color)

When user provides a custom brand color hex in Settings:

1. Frontend sends hex to API
2. API generates 11-step scale using chroma-js (already installed in `apps/api`)
3. API returns `{ "50": "#...", "100": "#...", ..., "950": "#..." }`
4. Frontend applies as `--color-brand-*` CSS vars
5. All components using `bg-brand-500`, `text-brand-700`, etc. automatically reflect new brand color

**Alternative:** Generate on frontend using a small pure-JS function if chroma-js is too heavy for the API.

---

## Appendix A: Complete globals.css

```css
/* ── Fonts (all 6 families, display:swap) ─────────────── */
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

@import 'tailwindcss';

/* ── Import Theme CSS Files ──────────────────────────── */
@import '../themes/brutalist.css';
@import '../themes/neumorphic.css';
@import '../themes/soft-ui.css';
@import '../themes/saas.css';

/* ── Default Token Values (when no data-theme is set) ──── */
:root {
  --color-brand-50: #fffbeb;
  --color-brand-100: #fef3c7;
  --color-brand-200: #fde68a;
  --color-brand-300: #fcd34d;
  --color-brand-400: #fbbf24;
  --color-brand-500: #f59e0b;
  --color-brand-600: #d97706;
  --color-brand-700: #b45309;
  --color-brand-800: #92400e;
  --color-brand-900: #78350f;
  --color-brand-950: #451a03;

  --color-surface-50: #fafaf9;
  --color-surface-100: #f5f5f4;
  --color-surface-200: #e7e5e4;
  --color-surface-300: #d6d3d1;
  --color-surface-400: #a8a29e;
  --color-surface-500: #78716c;
  --color-surface-600: #57534e;
  --color-surface-700: #44403c;
  --color-surface-800: #292524;
  --color-surface-900: #1c1917;
  --color-surface-950: #0c0a09;

  --color-danger-50: #fef2f2;
  --color-danger-100: #fee2e2;
  --color-danger-200: #fecaca;
  --color-danger-300: #fca5a5;
  --color-danger-400: #f87171;
  --color-danger-500: #ef4444;
  --color-danger-600: #dc2626;
  --color-danger-700: #b91c1c;
  --color-danger-800: #991b1b;
  --color-danger-900: #7f1d1d;

  --color-success-50: #f0fdf4;
  --color-success-100: #dcfce7;
  --color-success-200: #bbf7d0;
  --color-success-300: #86efac;
  --color-success-400: #4ade80;
  --color-success-500: #22c55e;
  --color-success-600: #16a34a;
  --color-success-700: #15803d;
  --color-success-800: #166534;
  --color-success-900: #14532d;

  --color-warning-50: #fffbeb;
  --color-warning-100: #fef3c7;
  --color-warning-200: #fde68a;
  --color-warning-300: #fcd34d;
  --color-warning-400: #fbbf24;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  --color-warning-700: #b45309;
  --color-warning-800: #92400e;
  --color-warning-900: #78350f;

  /* Border */
  --bw-default: 2px;
  --bw-strong: 3px;
  --border-color: #000;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadow */
  --shadow-card: 4px 4px 0 0 #000;
  --shadow-card-hover: 2px 2px 0 0 #000;
  --shadow-button: 2px 2px 0 0 #000;
  --shadow-button-pressed: none;
  --shadow-dropdown: 3px 3px 0 0 #000;
  --shadow-modal: 6px 6px 0 0 rgba(0, 0, 0, 0.5);

  /* Typography */
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Transition */
  --transition-duration: 150ms;
  --transition-easing: ease-out;

  /* Layout */
  --sidebar-width: 256px;
  --header-height: 60px;

  /* Behaviors */
  --hover-lift: translateX(1px) translateY(1px);
  --active-press-scale: 0.97;
  --active-press-x: 1px;
  --active-press-y: 1px;
}

/* ── Theme-Able Tokens (use @theme, NOT @theme inline) ── */
@theme {
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-mono: var(--font-mono);

  --color-brand-50: var(--color-brand-50);
  --color-brand-100: var(--color-brand-100);
  --color-brand-200: var(--color-brand-200);
  --color-brand-300: var(--color-brand-300);
  --color-brand-400: var(--color-brand-400);
  --color-brand-500: var(--color-brand-500);
  --color-brand-600: var(--color-brand-600);
  --color-brand-700: var(--color-brand-700);
  --color-brand-800: var(--color-brand-800);
  --color-brand-900: var(--color-brand-900);
  --color-brand-950: var(--color-brand-950);

  --color-surface-50: var(--color-surface-50);
  --color-surface-100: var(--color-surface-100);
  --color-surface-200: var(--color-surface-200);
  --color-surface-300: var(--color-surface-300);
  --color-surface-400: var(--color-surface-400);
  --color-surface-500: var(--color-surface-500);
  --color-surface-600: var(--color-surface-600);
  --color-surface-700: var(--color-surface-700);
  --color-surface-800: var(--color-surface-800);
  --color-surface-900: var(--color-surface-900);
  --color-surface-950: var(--color-surface-950);

  --color-danger-50: var(--color-danger-50);
  --color-danger-100: var(--color-danger-100);
  --color-danger-200: var(--color-danger-200);
  --color-danger-300: var(--color-danger-300);
  --color-danger-400: var(--color-danger-400);
  --color-danger-500: var(--color-danger-500);
  --color-danger-600: var(--color-danger-600);
  --color-danger-700: var(--color-danger-700);
  --color-danger-800: var(--color-danger-800);
  --color-danger-900: var(--color-danger-900);

  --color-success-50: var(--color-success-50);
  --color-success-100: var(--color-success-100);
  --color-success-200: var(--color-success-200);
  --color-success-300: var(--color-success-300);
  --color-success-400: var(--color-success-400);
  --color-success-500: var(--color-success-500);
  --color-success-600: var(--color-success-600);
  --color-success-700: var(--color-success-700);
  --color-success-800: var(--color-success-800);
  --color-success-900: var(--color-success-900);

  --color-warning-50: var(--color-warning-50);
  --color-warning-100: var(--color-warning-100);
  --color-warning-200: var(--color-warning-200);
  --color-warning-300: var(--color-warning-300);
  --color-warning-400: var(--color-warning-400);
  --color-warning-500: var(--color-warning-500);
  --color-warning-600: var(--color-warning-600);
  --color-warning-700: var(--color-warning-700);
  --color-warning-800: var(--color-warning-800);
  --color-warning-900: var(--color-warning-900);

  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
  --radius-full: var(--radius-full);
}

/* ── Static Tokens (use @theme inline — never change) ───── */
@theme inline {
  --animate-fade-in-up: fade-in-up 400ms ease-out both;
  --animate-shimmer: shimmer 2s infinite;
  --animate-slide-in-left: slide-in-left 250ms ease-out both;
  --animate-slide-in-right: slide-in-right 250ms ease-out both;
}

/* ── Keyframes ────────────────────────────────────────── */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
@keyframes slide-in-left {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* ── Base ──────────────────────────────────────────────── */
body {
  font-family: var(--font-body);
  background: var(--color-surface-50);
  color: var(--color-surface-900);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## Appendix B: Theme CSS Files

### Example: brutalist.css (complete)

```css
[data-theme='brutalist'] {
  /* Colors — warm amber */
  --color-brand-50: #fffbeb;
  --color-brand-100: #fef3c7;
  --color-brand-200: #fde68a;
  --color-brand-300: #fcd34d;
  --color-brand-400: #fbbf24;
  --color-brand-500: #f59e0b;
  --color-brand-600: #d97706;
  --color-brand-700: #b45309;
  --color-brand-800: #92400e;
  --color-brand-900: #78350f;
  --color-brand-950: #451a03;

  --color-surface-50: #fafaf9;
  --color-surface-100: #f5f5f4;
  --color-surface-200: #e7e5e4;
  --color-surface-300: #d6d3d1;
  --color-surface-400: #a8a29e;
  --color-surface-500: #78716c;
  --color-surface-600: #57534e;
  --color-surface-700: #44403c;
  --color-surface-800: #292524;
  --color-surface-900: #1c1917;
  --color-surface-950: #0c0a09;

  /* Border */
  --bw-default: 2px;
  --bw-strong: 3px;
  --border-color: #000;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadow */
  --shadow-card: 4px 4px 0 0 #000;
  --shadow-card-hover: 2px 2px 0 0 #000;
  --shadow-button: 2px 2px 0 0 #000;
  --shadow-button-pressed: none;
  --shadow-dropdown: 3px 3px 0 0 #000;
  --shadow-modal: 6px 6px 0 0 rgba(0, 0, 0, 0.5);

  /* Typography */
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Transition */
  --transition-duration: 150ms;
  --transition-easing: ease-out;

  /* Layout */
  --sidebar-width: 256px;
  --header-height: 60px;

  /* Behaviors */
  --hover-lift: translateX(1px) translateY(1px);
  --active-press-scale: 0.97;
  --active-press-x: 1px;
  --active-press-y: 1px;
}
```

_(Similar complete CSS for neumorphic.css, soft-ui.css, saas.css — see THEMING_ARCHITECTURE.md Section 2 for exact values.)_

---

## Implementation Order (Strict)

Do NOT skip steps. Do NOT reorder. Each step depends on the previous.

1. ✅ Research complete — this document
2. Create `apps/web/src/themes/` directory
3. Create `brutalist.css`, `neumorphic.css`, `soft-ui.css`, `saas.css` (Phase A.2)
4. Create `types.ts`, `ThemeProvider.tsx` (Phase A.3, A.4)
5. Update `globals.css` — fix `@theme inline` → `@theme`, add font imports, remove custom utilities (Phase A.1)
6. Wire `ThemeProvider` in `layout.tsx` (Phase A.5)
7. Create `theme-behaviors.ts` utility (Phase A.6)
8. Create `useTheme.ts` hook (Phase A.7)
9. Verify `bun run build` succeeds with new CSS
10. Verify `var(--color-brand-500)` in output CSS (NOT hex values)
11. Test `data-theme` switching in browser → confirm colors change
12. Tokenize Button (Phase B.1)
13. Tokenize Input (Phase B.2)
14. Tokenize Select (Phase B.3)
15. Tokenize StatusBadge (Phase B.4)
16. Tokenize StatCard (Phase B.5)
17. Tokenize DataTable (Phase B.6)
18. Tokenize Sidebar (Phase B.7)
19. Tokenize NotificationBell (Phase B.8)
20. Tokenize all 56 page files (Phase C, 12 batches)
21. Add "Appearance" tab to Settings (Phase D.1)
22. Extend AppConfig type (Phase D.2)
23. Test full flow: Settings → select theme → see changes → reload → theme persists
24. Visual regression all 4 themes (Phase E.2)
25. Responsive testing (Phase E.3)
26. Cross-browser testing (Phase E.4)
27. Performance verification (Phase E.5)
28. Edge case testing (Phase E.6)
29. `bun run typecheck` passes
30. `bun run build` succeeds
31. **Done** — production-ready multi-theme system

---

_Document version 2.0 — Production Implementation Blueprint_
_Last updated: 07/06/2026 — Full audit complete, all 56 source files cataloged_
