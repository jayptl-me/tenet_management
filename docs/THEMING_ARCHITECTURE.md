# Theming Architecture — Multi-Theme Design System

> **Status:** IMPLEMENTED — Phases A-D complete, 458 var() token references across codebase
> **Last updated:** 08/06/2026
> **Build:** ✅ `bun run build` exits 0 for all 36 routes
> **Scope:** Every component, every page, responsive for all screen sizes
> **Goal:** Brand-adaptable UI with 4 preset themes + full CSS custom property override system
>
> **Tech stack verified (07/06/2026):**
>
> - **Tailwind CSS v4** with `@tailwindcss/postcss` plugin (via postcss.config.mjs)
> - **`@theme` (NOT `@theme inline`)** blocks in globals.css — CRITICAL: `@theme inline` bakes hex values into utilities; `@theme` (without inline) emits `var(--token)` references that cascade can override
> - **`@custom-variant`** supports `data-theme` attribute selectors (per official docs)
> - **Fonts loaded:** Syne (display), DM Sans (body), JetBrains Mono (mono) via Google Fonts
> - **React 19.2.4**, **Next.js 16.2.7**, **ky** for API calls, **zustand** for state
> - **CSS-only cascade approach confirmed viable** — Tailwind v4 `@theme` (non-inline) emits `var(--color-brand-500)` references; CSS custom properties cascade on `data-theme` attribute; utilities resolve at runtime
>
> **⚠️ CRITICAL: `@theme` vs `@theme inline` — THE KEY ARCHITECTURAL DECISION**
>
> The current `globals.css` uses `@theme inline`. This **must be changed to `@theme`** (non-inline) for multi-theme to function. Here's why:
>
> | Directive                                       | What Tailwind emits for `bg-brand-500`      | Override-able via data-theme?                                     |
> | ----------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
> | `@theme inline { --color-brand-500: #f59e0b; }` | `background-color: #f59e0b;`                | **No.** Hex is baked into utility. `data-theme` override ignored. |
> | `@theme { --color-brand-500: #f59e0b; }`        | `background-color: var(--color-brand-500);` | **Yes.** CSS var resolves at runtime, cascade wins.               |
>
> **This is the single most important finding of this research.** The THEMING_ARCHITECTURE.md originally documented `@theme inline` as the approach, which would cause ALL theme switching to silently fail because utilities would contain hardcoded hex values. The fix is to use `@theme` (non-inline) for all tokens that need to flip across themes, keeping `@theme inline` only for fixed/structure-only tokens (like `--animate-*` keyframes).
>
> **Research sources:**
>
> - Forrest Miller (2026): "The `@theme` vs `@theme inline` gotcha that broke my contrast tests" — dev.to — confirmed `@theme inline` bakes hex values, `@theme` emits `var()` references
> - Tailwind CSS official docs: `@theme` variables are registered as design tokens and produce `var(--token)` in utilities; `@theme inline` does not register variables globally
> - Stack Overflow #79705933: "Should I use @theme or @theme inline" — confirmed inline values are inlined in utilities, not overridable
> - GitHub tailwindlabs/tailwindcss#17826: "Use of @theme and @theme inline" — confirmed `@theme` emits `var()` references, inline inlines values

---

## 1. Architecture Overview

### 1.1 Design Tokens Layer (CSS Custom Properties)

All visual properties flow through CSS custom properties on `:root`. Components never use hardcoded values — they reference tokens. Theme switching toggles `data-theme` attribute on `<html>`, which redefines all token values via CSS cascade. **Zero runtime cost, zero re-renders.**

```html
<html data-theme="brutalist">
  → brutalist tokens active
  <html data-theme="neumorphic">
    → neumorphic tokens active
    <html data-theme="glassmorphic">
      → glassmorphism tokens active
      <html data-theme="saas">
        → SaaS/enterprise tokens active
        <html data-theme="custom">
          → user-custom tokens (from settings)
        </html>
      </html>
    </html>
  </html>
</html>
```

Tailwind v4 `@theme inline` references CSS vars:

```css
@theme inline {
  --color-brand-500: var(--brand-500);
  --color-surface-50: var(--surface-50);
  /* All utilities resolve to var(--token) at runtime */
}
```

Tailwind v4 dark mode variant for theme-aware dark mode:

```css
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

This means each theme can have a dark mode by setting `data-theme="brutalist-dark"` etc., or we use a separate `data-dark` toggle.

### 1.2 Token Categories

| Category       | Tokens                                                                                                     | Affects                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Colors**     | `--color-brand-*`, `--color-surface-*`, `--color-danger-*`, `--color-success-*`, `--color-warning-*`       | Backgrounds, text, accents, badges, borders    |
| **Typography** | `--font-display`, `--font-body`, `--font-mono`, `--font-size-*`, `--font-weight-*`, `--letter-spacing-*`   | All text, headings, labels                     |
| **Spacing**    | `--space-section`, `--space-card-padding`, `--space-element-gap`, `--page-max-width`                       | Layout gaps, card padding, section margins     |
| **Borders**    | `--border-width-default`, `--border-width-strong`, `--border-color`, `--border-radius-*`, `--border-style` | All borders, card edges, inputs                |
| **Shadows**    | `--shadow-card`, `--shadow-button`, `--shadow-button-hover`, `--shadow-dropdown`, `--shadow-modal`         | Hierarchy, depth, elevation                    |
| **Animations** | `--transition-duration`, `--transition-timing`, `--hover-lift`                                             | Button clicks, page transitions, hover effects |
| **Layout**     | `--sidebar-width`, `--header-height`, `--content-max-width`                                                | Structural layout                              |

---

## 2. The Four Theme Presets

### 2.1 Theme: Brutalist (current default)

**Philosophy:** Raw, honest, bold. Heavy borders, flat solid colors, chunky shadows, no gradients. Expressive chunky typography. Zero subtlety.

| Token Category   | Values                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Brand Colors** | Warm amber: `#f59e0b` through `#78350f`                                            |
| **Surface**      | Warm whites: `#fafaf9` through `#1c1917`                                           |
| **Borders**      | `border-width: 3px`, `border-color: #000`, `border-radius: 4-8-12px`               |
| **Shadows**      | `box-shadow: 4px 4px 0 0 #000` (cards), `2px 2px 0 0 #000` (buttons)               |
| **Typography**   | Display: `Syne` (chunky, wide), Body: `DM Sans`, Mono: `JetBrains Mono`            |
| **Font Scale**   | Display: 2rem/2.5rem/3rem, Body: 0.875rem/1rem, Labels: 0.75rem uppercase tracking |
| **Layout**       | Sidebar: 256px, Card padding: 24px, Section gap: 24px                              |
| **Transitions**  | 150ms ease-out, active: `translate(1px, 1px)` press effect                         |
| **Radius**       | sm: 4px, md: 8px, lg: 12px                                                         |

**Key visual markers:**

- All containers have `border: 3px solid black`
- Cards: `shadow-brutal` (4px 4px 0 black)
- Buttons: press down on click
- Bold uppercase labels with tracking
- No gradients anywhere
- Flat solid color badges
- Icon containers have borders

---

### 2.2 Theme: Neumorphic

**Philosophy:** Soft, extruded, tactile. Elements appear to push out from or sink into the background. Monochromatic surfaces with light/dark shadow pairs. No hard borders.

| Token Category   | Values                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Brand Colors** | Soft blue-purple: `#7c8aff` through `#3b2f6e`                                                                                           |
| **Surface**      | Pale lavender grays: `#edeef2` through `#2a2a3d`                                                                                        |
| **Borders**      | `border-width: 0px` (borderless), `border-radius: 16-20-24px` (pillowy)                                                                 |
| **Shadows**      | `box-shadow: 8px 8px 16px #d1d3d9, -8px -8px 16px #ffffff` (raised), `inset 4px 4px 8px #d1d3d9, inset -4px -4px 8px #ffffff` (pressed) |
| **Typography**   | Display: `Poppins` (rounded geometric), Body: `Inter` (clean), Mono: `Fira Code`                                                        |
| **Font Scale**   | Display: 1.75rem/2.25rem/2.75rem, Body: 0.875rem/1rem, Labels: 0.8125rem normal                                                         |
| **Layout**       | Sidebar: 280px, Card padding: 28px, Section gap: 28px                                                                                   |
| **Transitions**  | 300ms ease-in-out, active: shadow swap (raised→inset)                                                                                   |
| **Radius**       | sm: 12px, md: 16px, lg: 24px, full for pills                                                                                            |

**Key visual markers:**

- NO borders on any element
- Background matches surface color exactly (no contrast border)
- Paired light/dark shadows create the extrusion illusion
- Inputs are inset (pressed-in appearance)
- Cards float above background via shadow pairs
- Buttons have raised shadows, swap to inset on click
- Badges use soft background + same-color text (no border)
- Icon containers are soft circles with paired shadows
- Drop shadows are always duotone (light + dark)

**Dark mode adaptation:**

- Surface: dark gray-purple
- Shadows: `4px 4px 8px #1a1a2e, -4px -4px 8px #3a3a5e`

---

### 2.3 Theme: Soft UI (Glassmorphism-adjacent)

**Philosophy:** Ethereal, translucent, luminous. Frosted glass panels with subtle colored glows. Light, airy, modern. Backgrounds have soft gradient washes.

| Token Category   | Values                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **Brand Colors** | Vibrant teal-cyan: `#06b6d4` through `#164e63`                                                   |
| **Surface**      | Cool whites with blue undertones: `#f8fafc` through `#0f172a`                                    |
| **Borders**      | `border-width: 1px`, `border-color: rgba(255,255,255,0.3)`, `border-radius: 12-16-20px`          |
| **Shadows**      | `box-shadow: 0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)` — soft, far, multi-layered |
| **Backdrop**     | `backdrop-filter: blur(16px) saturate(180%)`, `background: rgba(255,255,255,0.7)`                |
| **Typography**   | Display: `Plus Jakarta Sans` (modern geometric), Body: `Inter`, Mono: `IBM Plex Mono`            |
| **Font Scale**   | Display: 1.875rem/2.375rem/3rem, Body: 0.9375rem/1rem, Labels: 0.8125rem medium                  |
| **Layout**       | Sidebar: 272px, Card padding: 24px, Section gap: 32px                                            |
| **Transitions**  | 250ms cubic-bezier(0.4, 0, 0.2, 1), hover: `translateY(-2px)` lift                               |
| **Radius**       | sm: 8px, md: 12px, lg: 20px, full for avatar/chips                                               |

**Key visual markers:**

- Glass cards: white with transparency + backdrop blur
- Subtle gradient backgrounds (e.g., `linear-gradient(135deg, #f8fafc, #e2e8f0)`)
- Thin, light borders (1px, rgba white)
- Cards lift on hover (translateY -2px)
- Soft, far-reaching drop shadows (multiple layers)
- Colors have a luminous, saturated quality
- Badges are soft pills with subtle glow
- Icon containers: frosted glass circles
- Input backgrounds are white with slight transparency

---

### 2.4 Theme: SaaS/Enterprise

**Philosophy:** Professional, clean, efficient. Subtle hierarchy through spacing and typography weight, not heavy decoration. Minimal borders, refined shadows. Works at scale.

| Token Category   | Values                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------ |
| **Brand Colors** | Professional indigo: `#6366f1` through `#312e81`                                           |
| **Surface**      | Neutral cool grays: `#fafafa` through `#171717`                                            |
| **Borders**      | `border-width: 1px`, `border-color: #e5e7eb`, `border-radius: 6-8-10px`                    |
| **Shadows**      | `box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)` — tight, close, subtle |
| **Typography**   | Display: `Inter` (system-grade), Body: `Inter`, Mono: `JetBrains Mono`                     |
| **Font Scale**   | Display: 1.5rem/1.75rem/2.25rem, Body: 0.875rem/1rem, Labels: 0.75rem medium               |
| **Layout**       | Sidebar: 240px, Card padding: 20px, Section gap: 20px                                      |
| **Transitions**  | 200ms ease, hover: subtle background color shift                                           |
| **Radius**       | sm: 6px, md: 8px, lg: 10px (tight, professional)                                           |

**Key visual markers:**

- Thin 1px borders in gray-200/300
- Tight, close shadows (1-2px offset, low opacity)
- Hover states: background color shift only (no lift)
- Dense layout — less padding, compact tables
- Clean separators (1px lines)
- Professional sans-serif throughout
- Subtle background stripes on tables
- Badges: flat, compact, no shadow
- Inputs: light gray border, blue focus ring
- No decorative elements — function over form

---

## 3. Full Token Reference (All Categories)

### 3.1 Color Tokens (per theme)

Each theme defines a complete 11-step color scale for brand, surface, danger, success, and warning.

```css
/* Brutalist */
--color-brand-50: #fffbeb; /* lightest */
--color-brand-100: #fef3c7;
--color-brand-200: #fde68a;
--color-brand-300: #fcd34d;
--color-brand-400: #fbbf24;
--color-brand-500: #f59e0b; /* primary */
--color-brand-600: #d97706;
--color-brand-700: #b45309;
--color-brand-800: #92400e;
--color-brand-900: #78350f;
--color-brand-950: #451a03; /* darkest */

/* Neumorphic */
--color-brand-50: #f0f1ff;
--color-brand-100: #dde0ff;
--color-brand-200: #bcc1ff;
--color-brand-300: #9ba2ff;
--color-brand-400: #7c8aff;
--color-brand-500: #5c6bff; /* primary */
--color-brand-600: #4956cc;
--color-brand-700: #374199;
--color-brand-800: #252c66;
--color-brand-900: #1a1f4d;
--color-brand-950: #3b2f6e;

/* Soft UI */
--color-brand-50: #ecfeff;
--color-brand-100: #cffafe;
--color-brand-200: #a5f3fc;
--color-brand-300: #67e8f9;
--color-brand-400: #22d3ee;
--color-brand-500: #06b6d4; /* primary */
--color-brand-600: #0891b2;
--color-brand-700: #0e7490;
--color-brand-800: #155e75;
--color-brand-900: #164e63;
--color-brand-950: #083344;

/* SaaS */
--color-brand-50: #eef2ff;
--color-brand-100: #e0e7ff;
--color-brand-200: #c7d2fe;
--color-brand-300: #a5b4fc;
--color-brand-400: #818cf8;
--color-brand-500: #6366f1; /* primary */
--color-brand-600: #4f46e5;
--color-brand-700: #4338ca;
--color-brand-800: #3730a3;
--color-brand-900: #312e81;
--color-brand-950: #1e1b4b;
```

### 3.2 Surface Color Tokens (per theme)

```css
/* Brutalist — warm stone */
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

/* Neumorphic — lavender gray */
--color-surface-50: #edeef2;
--color-surface-100: #e4e5ea;
--color-surface-200: #d1d3d9;
--color-surface-300: #b8bac2;
--color-surface-400: #9a9ca6;
--color-surface-500: #7d7f8a;
--color-surface-600: #636570;
--color-surface-700: #4a4c55;
--color-surface-800: #33343d;
--color-surface-900: #2a2a3d;
--color-surface-950: #1a1a2e;

/* Soft UI — cool slate */
--color-surface-50: #f8fafc;
--color-surface-100: #f1f5f9;
--color-surface-200: #e2e8f0;
--color-surface-300: #cbd5e1;
--color-surface-400: #94a3b8;
--color-surface-500: #64748b;
--color-surface-600: #475569;
--color-surface-700: #334155;
--color-surface-800: #1e293b;
--color-surface-900: #0f172a;
--color-surface-950: #020617;

/* SaaS — neutral gray */
--color-surface-50: #fafafa;
--color-surface-100: #f5f5f5;
--color-surface-200: #e5e5e5;
--color-surface-300: #d4d4d4;
--color-surface-400: #a3a3a3;
--color-surface-500: #737373;
--color-surface-600: #525252;
--color-surface-700: #404040;
--color-surface-800: #262626;
--color-surface-900: #171717;
--color-surface-950: #0a0a0a;
```

### 3.3 Typography Tokens

```css
/* Theme-specific */
--font-display: var per theme;
--font-body: var per theme;
--font-mono: var per theme;

--font-size-display-lg: var per theme; /* page titles */
--font-size-display-md: var per theme; /* card titles */
--font-size-display-sm: var per theme; /* section headers */
--font-size-body: var per theme; /* main content */
--font-size-body-sm: var per theme; /* secondary text */
--font-size-label: var per theme; /* labels, badges */
--font-size-mono: var per theme; /* code, IDs */

--font-weight-display: var per theme;
--font-weight-body-bold: var per theme;
--font-weight-body: var per theme;

--letter-spacing-label: var per theme; /* label tracking */
--letter-spacing-display: var per theme;

/* Font imports per theme */
/* Brutalist: Syne + DM Sans + JetBrains Mono */
/* Neumorphic: Poppins + Inter + Fira Code */
/* Soft UI: Plus Jakarta Sans + Inter + IBM Plex Mono */
/* SaaS: Inter + Inter + JetBrains Mono */
```

### 3.4 Border Tokens

```css
--border-width-default: /* 0-3px depending on theme */;
--border-width-strong: /* card/chunky borders */;
--border-color: /* theme surface-300 or black */;
--border-style: /* solid */;

--radius-sm: /* tag/badge */;
--radius-md: /* cards, inputs, buttons */;
--radius-lg: /* modals, large cards */;
--radius-xl: /* hero sections */;
--radius-full: /* pills, avatars */;
```

### 3.5 Shadow Tokens

```css
--shadow-card: /* main card elevation */;
--shadow-card-hover: /* card on hover */;
--shadow-button: /* default button */;
--shadow-button-hover: /* button hover/press */;
--shadow-dropdown: /* menus, popovers */;
--shadow-modal: /* modal overlay */;
--shadow-input: /* inset for inputs (neumorphic) */;
```

### 3.6 Spacing & Layout Tokens

```css
--page-max-width: /* 1200px-1400px */;
--sidebar-width: /* 240-280px */;
--header-height: /* 56-64px */;

--space-section-gap: /* between major sections */;
--space-card-padding: /* inside cards */;
--space-card-gap: /* between grid cards */;
--space-element-gap: /* between inline elements */;
--space-form-gap: /* between form fields */;

--transition-duration: /* 150-300ms */;
--transition-easing: /* ease-out / cubic-bezier */;

--hover-lift: /* translateY on hover (0 or -2px) */;
--active-press: /* translate on click (0 or 1px) */;
```

---

## 4. Component-Level Theme Strategy

### 4.1 Component Token Mapping

Each UI component maps to specific tokens. Here's the mapping for every component:

#### Button

| Property             | Token                                                         |
| -------------------- | ------------------------------------------------------------- |
| background (primary) | `--color-brand-500`                                           |
| background hover     | `--color-brand-600`                                           |
| text color           | `white` or `--color-surface-900`                              |
| border               | `--border-width-strong solid --border-color`                  |
| shadow               | `--shadow-button`                                             |
| shadow hover/active  | `--shadow-button-hover`                                       |
| border-radius        | `--radius-md`                                                 |
| font                 | `--font-display`, `--font-size-body`, `--font-weight-display` |
| padding              | responsive to `--space-*`                                     |
| hover transform      | `translateY(--hover-lift)`                                    |
| active transform     | `translateX(--active-press) translateY(--active-press)`       |
| transition           | `--transition-duration --transition-easing`                   |

#### Input

| Property      | Token                                         |
| ------------- | --------------------------------------------- |
| background    | white or `--color-surface-50`                 |
| border        | `--border-width-default solid --border-color` |
| border focus  | `--color-brand-500`                           |
| border error  | `--color-danger-500`                          |
| border-radius | `--radius-md`                                 |
| padding       | `0.625rem 1rem` (relative to scale)           |
| font          | `--font-body`, `--font-size-body`             |

#### Select

Same as Input with dropdown shadow: `--shadow-dropdown`.

#### StatCard

| Property       | Token                                                           |
| -------------- | --------------------------------------------------------------- |
| background     | white                                                           |
| border         | `--border-width-strong solid --border-color`                    |
| shadow         | `--shadow-card`                                                 |
| border-radius  | `--radius-lg`                                                   |
| padding        | `--space-card-padding`                                          |
| accent border  | `--color-brand-500`, success, warning, danger                   |
| title font     | `--font-display`, `--font-size-label`, `--letter-spacing-label` |
| value font     | `--font-display`, `--font-size-display-lg`                      |
| trend badge    | custom with border and background                               |
| icon container | bordered box with `--radius-sm`                                 |

#### StatusBadge

| Property      | Token                                            |
| ------------- | ------------------------------------------------ |
| background    | theme color at 100 lightness                     |
| text          | theme color at 700-800                           |
| border        | theme color at 300 (or no border for neumorphic) |
| border-radius | `--radius-full`                                  |
| padding       | 2px 10px                                         |
| font          | `--font-display`, `--font-size-label`, bold      |

#### DataTable

| Property      | Token                                                           |
| ------------- | --------------------------------------------------------------- |
| border        | `--border-width-strong solid --border-color`                    |
| border-radius | `--radius-lg`                                                   |
| shadow        | `--shadow-card`                                                 |
| header bg     | `--color-surface-100`                                           |
| header font   | `--font-display`, `--font-size-label`, `--letter-spacing-label` |
| row border    | `--color-surface-200`                                           |
| row hover     | `--color-brand-50`                                              |
| cell padding  | responsive                                                      |
| cell font     | `--font-body`, `--font-size-body-sm`                            |

#### Sidebar

| Property        | Token                                                               |
| --------------- | ------------------------------------------------------------------- |
| width           | `--sidebar-width`                                                   |
| background      | white                                                               |
| border-right    | `--border-width-strong solid --border-color` (brutalist) or none    |
| nav item active | `--color-brand-500`                                                 |
| nav item hover  | `--color-surface-100`                                               |
| nav item font   | `--font-body`, `--font-size-body-sm`, `--font-weight-body-bold`     |
| brand font      | `--font-display`, `--font-size-display-sm`, `--font-weight-display` |

#### Top Header Bar

| Property      | Token                                        |
| ------------- | -------------------------------------------- |
| height        | `--header-height`                            |
| border-bottom | `--border-width-strong solid --border-color` |
| background    | white                                        |

#### Dashboard Charts (Recharts)

| Property       | Token                                                             |
| -------------- | ----------------------------------------------------------------- |
| bar fills      | `--color-brand-500`, `--color-surface-400`                        |
| line colors    | `--color-brand-500`, `--color-success-500`, `--color-warning-500` |
| grid lines     | `--color-surface-200`                                             |
| tooltip border | `--border-width-strong solid --border-color`                      |
| tooltip shadow | `--shadow-dropdown`                                               |

#### Modals/Dialogs

| Property      | Token                                        |
| ------------- | -------------------------------------------- |
| overlay       | `rgba(0,0,0,0.5)` with backdrop blur (soft)  |
| dialog bg     | white                                        |
| border        | `--border-width-strong solid --border-color` |
| shadow        | `--shadow-modal`                             |
| border-radius | `--radius-lg`                                |

#### Complaints Kanban

| Property      | Token                                        |
| ------------- | -------------------------------------------- |
| column bg     | white                                        |
| column border | `--border-width-strong solid --border-color` |
| column shadow | `--shadow-card`                              |
| column header | themed bg with border-bottom                 |
| card bg       | `--color-surface-50`                         |
| card border   | `--border-width-strong solid --border-color` |
| card shadow   | `--shadow-button`                            |
| card dragging | opacity 0.5 + rotation                       |
| drag overlay  | `--shadow-card`                              |

#### Notification Bell Dropdown

| Property      | Token                                        |
| ------------- | -------------------------------------------- |
| dropdown bg   | white                                        |
| border        | `--border-width-strong solid --border-color` |
| shadow        | `--shadow-dropdown`                          |
| border-radius | `--radius-lg`                                |

#### Settings Tabs

| Property       | Token                                        |
| -------------- | -------------------------------------------- |
| tab bar bg     | `--color-surface-200`                        |
| tab bar border | `--border-width-strong solid --border-color` |
| active tab     | white bg with `--shadow-button`              |
| inactive tab   | transparent                                  |

---

## 5. Page-by-Page Responsive & Theme Strategy

Each page must be re-examined for:

1. Tokenized hardcoded values
2. Responsive layout at 4 breakpoints
3. Theme-specific behavior differences

### 5.1 Dashboard Page

**Components:** StatCard grid, Revenue bar chart, Meal feedback line chart, Recent complaints list, Recent enquiries list

**Theme differences:**

- Brutalist: Bold chart grid lines, solid bar fills, chunky tooltip borders
- Neumorphic: No chart grid lines, soft pastel bar fills, rounded tooltip
- Soft UI: Subtle grid, gradient bar fills with glow, glass tooltip
- SaaS: Minimal grid, tight bars, compact tooltip

**Responsive:**

- Mobile (<640px): 1-col stat cards, charts at full width with reduced height (200px), recent lists stacked
- Tablet (640-1024px): 2-col stat cards, charts at full width, 2-col recent
- Desktop (1024-1280px): 3-col stat cards, charts side-by-side, side-by-side recent
- Wide (>1280px): same as desktop, centered with max-width

### 5.2 Tenants/Rooms/Floors/Assets/Guardians List Pages

**Components:** Page header + action button, search input, filter selects, DataTable

**Theme differences:**

- Brutalist: Full-width bordered table, alternating row bg
- Neumorphic: Borderless table with soft row shadows, raised header
- Soft UI: Subtle table with thin separators, frosted header
- SaaS: Compact table with minimal borders, dense rows

**Responsive:**

- Mobile: filters stack vertically, table scrolls horizontally, simplified columns
- Tablet: filters side-by-side, full table
- Desktop: full layout

### 5.3 Detail Pages (Tenant/[id], Room/[id], etc.)

**Components:** Back button, page header with status badge, info cards (grid), detail sections

**Theme differences:**

- Brutalist: Bordered cards, solid badges, chunky shadows
- Neumorphic: Raised cards without borders, soft status pills
- Soft UI: Glass cards with subtle glow, frosted badges
- SaaS: Clean cards with subtle shadow, flat badges

**Responsive:**

- Mobile: 1-col card grid, full-width cards
- Tablet: 2-col card grid
- Desktop: 3-4 col card grid

### 5.4 Create Pages (New/[item])

**Components:** Back button, form in bordered card, zod form fields, cancel/save buttons

**Theme differences:**

- Brutalist: Bold bordered form card, heavy input borders
- Neumorphic: Shadow-only form card, inset inputs
- Soft UI: Glass form card, subtle input borders
- SaaS: Clean form card, minimal input styling

**Responsive:**

- Mobile: form fields stack single column
- Tablet: 2-col field grid
- Desktop: max-width centered form, 2-3 col grid

### 5.5 Enquiry Detail (with status update form)

**Components:** Detail cards, status update form at bottom

Same theme + responsive as other detail pages, plus inline form.

### 5.6 Leave Detail (with approve/reject actions)

**Components:** Detail cards, action buttons section

Theme differences for approve/reject buttons map to success/danger tokens.

### 5.7 Complaints List (Table + Kanban)

**Components:** View toggle, Table/Kanban view, drag-and-drop

**Theme differences:**

- Kanban columns adapt border/shadow per theme
- Drag overlay adapts shadow
- Kanban cards adapt to button/card tokens

**Responsive:**

- Mobile: 1 kanban column (horizontal scroll), simplified table
- Tablet: 2 kanban columns
- Desktop: 4 kanban columns

### 5.8 Notifications Page (Compose + History)

**Components:** Tab bar, compose form, history list with filters

**Responsive:**

- Mobile: compose form single column, history full width
- Desktop: compose form max-width centered

### 5.9 Services Page

**Components:** Table with service icons, status badges

**Responsive:**

- Mobile: horizontal scroll table
- Desktop: full table

### 5.10 Settings Page (7 tabs)

**Components:** Tab bar, dynamic tab content, save button

**Theme differences:**

- Color pickers show live preview swatches
- Feature toggles adapt to toggle-style per theme

**Responsive:**

- Mobile: tabs scroll horizontally, single-col fields
- Desktop: multi-col fields where appropriate

### 5.11 Menus Detail (Breakfast/Lunch/Dinner Cards)

**Components:** Three meal cards with icons

**Theme differences:**

- Brutalist: Bordered cards with icon in bordered box
- Neumorphic: Raised cards, icon in soft circle
- Soft UI: Glass cards with gradient accents
- SaaS: Clean cards with subtle icon treatment

**Responsive:**

- Mobile: 1-col (stacked meal cards)
- Tablet: 2-col
- Desktop: 3-col

### 5.12 Visitor Detail (Timeline + Info)

**Components:** Visitor info, tenant info, timeline grid, notes

**Responsive:**

- Mobile: timeline 1-col
- Desktop: timeline 4-col

---

## 6. Implementation Architecture

### 6.1 File Structure

```
apps/web/src/
├── themes/
│   ├── index.ts                    # Theme registry, types, context
│   ├── tokens.ts                   # Token type definitions
│   ├── brutalist.css               # Brutalist CSS custom properties
│   ├── neumorphic.css              # Neumorphic CSS custom properties
│   ├── soft-ui.css                 # Soft UI CSS custom properties
│   ├── saas.css                    # SaaS CSS custom properties
│   ├── fonts.ts                    # Font loading per theme
│   └── ThemeProvider.tsx           # React context provider
├── app/
│   ├── globals.css                 # Base + theme import orchestration
│   └── layout.tsx                  # Wrap with ThemeProvider
├── components/
│   ├── ui/                         # Token-aware components (existing, modified)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── StatCard.tsx
│   │   ├── StatusBadge.tsx
│   │   └── DataTable.tsx
│   └── admin/
│       ├── Sidebar.tsx             # Token-aware
│       └── NotificationBell.tsx    # Token-aware
└── hooks/
    └── useTheme.ts                 # Theme access hook
```

### 6.2 Theme Application Strategy

**Option A: CSS-only (Recommended for this project)**

- Import all theme CSS files in `globals.css`
- Each theme file defines `:root.theme-{name}` selectors
- Toggle `data-theme="{name}"` on `<html>` element
- All tokens cascade automatically — zero React re-renders
- Components reference tokens via Tailwind `@theme` or `var()`

**Why CSS-only:**

- Zero runtime cost — pure CSS cascade
- No prop drilling — any component anywhere gets correct tokens
- Works with SSR — no hydration mismatches
- User custom theme: write CSS vars directly to `<html style="...">`

### 6.3 Tailwind v4 Integration — The Correct Approach

**⚠️ CRITICAL: Use `@theme` (NOT `@theme inline`) for all tokens that need to flip across themes.**

The approach has two layers:

**Layer 1: Theme CSS files define values for shared property names (uses `:root[data-theme="X"]`):**

```css
/* brutalist.css */
:root[data-theme='brutalist'] {
  --color-brand-500: #f59e0b;
  --color-brand-600: #d97706;
  --color-surface-50: #fafaf9;
  --border-width-strong: 3px;
  --border-color: #000;
  --radius-md: 8px;
  --shadow-card: 4px 4px 0 0 #000;
  --shadow-button: 2px 2px 0 0 #000;
  --transition-duration: 150ms;
  --transition-easing: ease-out;
  --hover-lift: translate(1px, 1px);
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  /* ... all tokens for brutalist */
}

/* neumorphic.css */
:root[data-theme='neumorphic'] {
  --color-brand-500: #5c6bff;
  --color-brand-600: #4956cc;
  --color-surface-50: #edeef2;
  --border-width-strong: 0px;
  --border-color: transparent;
  --radius-md: 16px;
  --shadow-card: 8px 8px 16px #d1d3d9, -8px -8px 16px #fff;
  --shadow-button: 6px 6px 12px #d1d3d9, -6px -6px 12px #fff;
  --transition-duration: 300ms;
  --transition-easing: ease-in-out;
  --hover-lift: none; /* neumorphic uses shadow swap, not lift */
  --font-display: 'Poppins', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'Fira Code', monospace;
  /* ... all tokens for neumorphic */
}

/* ... soft-ui.css, saas.css follow same pattern */
```

**Layer 2: globals.css maps shared property names to Tailwind utility names using `@theme` (NOT `@theme inline`):**

```css
@import './themes/brutalist.css';
@import './themes/neumorphic.css';
@import './themes/soft-ui.css';
@import './themes/saas.css';

/* ⚠️ Use @theme (non-inline) so Tailwind emits var(--color-brand-500) instead of #f59e0b */
@theme {
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
  /* ... all surface, danger, success, warning colors ... */

  /* Typography — these CAN use @theme inline since they're always var references */
  --font-display: var(--font-display, 'Syne');
  --font-body: var(--font-body, 'DM Sans');
  --font-mono: var(--font-mono, 'JetBrains Mono');

  /* Layout tokens that change per theme */
  --radius-sm: var(--radius-sm, 4px);
  --radius-md: var(--radius-md, 8px);
  --radius-lg: var(--radius-lg, 12px);
  --radius-xl: var(--radius-xl, 16px);
  --radius-full: var(--radius-full, 9999px);
}

/* @theme inline is ONLY for truly static values (never change per theme):
   keyframes, animations that don't reference theme tokens */
@theme inline {
  --animate-fade-in-up: fade-in-up 400ms ease-out both;
  --animate-shimmer: shimmer 2s infinite;
  --animate-slide-in-left: slide-in-left 250ms ease-out both;
  --animate-slide-in-right: slide-in-right 250ms ease-out both;
}
```

**How the cascade works (6 layers, highest specificity wins):**

```
@theme block          →  default values (var(--color-brand-500))
:root                →  fallback defaults (the current inline values)
[data-theme="brutalist"] →  brutalist tokens
[data-theme="neumorphic"] →  neumorphic tokens
[data-theme="soft-ui"] →  soft UI tokens
[data-theme="saas"]  →  saas tokens
<html style="--color-brand-500: {custom}"> →  user custom overrides (highest priority)
```

**Why this approach works:**

1. Each theme file defines the SAME property names (e.g., `--color-brand-500`) with DIFFERENT values
2. `@theme` (non-inline) registers these as Tailwind design tokens with `var(--color-brand-500)` references
3. When `data-theme` changes on `<html>`, the CSS cascade instantly redefines all property values
4. Tailwind utilities like `bg-brand-500` resolve to `background-color: var(--color-brand-500)` which picks up the new value
5. Components don't re-render — it's pure CSS cascade

**What `@theme inline` is still used for:**

- Animation keyframes (`--animate-*`) — these are static, never change per theme
- Any token that MUST be constant across all themes

**How this differs from the original (incorrect) approach:**

- ❌ Old: `@theme inline` everywhere → hex values baked into utilities → theme switching silently fails

### 6.4 Component Migration Plan

For each component, we:

1. Identify all hardcoded values (colors, borders, shadows, fonts, transitions)
2. Replace with token references (`var(--token-name)`)
3. Add theme-specific CSS in theme files for complex cases (neumorphic shadows, glass effects)
4. Test across all 4 themes

**Priority order:**

1. Base tokens (colors, borders, shadows, typography) — in globals.css + theme files
2. Button component — most used
3. Input, Select — form foundations
4. StatusBadge — used everywhere
5. DataTable — complex, used on every list page
6. StatCard — dashboard
7. Sidebar — navigation
8. All pages — replace hardcoded classes

### 6.5 Hardcoded Values to Replace

Current codebase has these hardcoded patterns that need tokenization:

| Hardcoded Pattern                                 | Token to Use                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `border-3 border-black`                           | `border-[length:var(--border-width-strong)] border-[color:var(--border-color)]` |
| `shadow-brutal`                                   | `shadow-[var(--shadow-card)]`                                                   |
| `shadow-brutal-sm`                                | `shadow-[var(--shadow-button)]`                                                 |
| `rounded-md`                                      | theme-radius-md class                                                           |
| `rounded-lg`                                      | theme-radius-lg class                                                           |
| `bg-brand-500`                                    | stays same (maps to var)                                                        |
| `text-surface-900`                                | stays same (maps to var)                                                        |
| `font-display`                                    | stays same (maps to var)                                                        |
| `font-sans` / `font-body`                         | stays same                                                                      |
| `font-bold` / `font-semibold`                     | stays same                                                                      |
| `transition-all duration-150`                     | `transition-all duration-[var(--transition-duration)]`                          |
| `hover:translate-x-[1px] hover:translate-y-[1px]` | conditional per theme                                                           |
| `active:scale-[0.97]`                             | conditional per theme                                                           |

### 6.6 Settings Page Integration

The existing Settings page already has:

- `primaryColor` and `primaryColorDark` fields
- Feature toggles

Extend with:

- **Theme selector**: dropdown with 4 presets + "Custom"
- **Custom color pickers**: for brand-500, brand-600, surface-50 through surface-900
- **Custom font selector**: display font, body font
- **Border style**: width slider, color picker
- **Shadow style**: preset dropdown (brutalist/neumorphic/soft/saas/custom)
- **Preview panel**: live preview of current theme on sample components
- **Save**: writes to `app-config` → persisted in DB → applied on load
- **Reset to preset**: reset all custom tokens to selected preset defaults

### 6.7 User Flow

1. Admin visits Settings → "Appearance" tab (new 8th tab)
2. Selects theme preset from dropdown (Brutalist / Neumorphic / Soft UI / SaaS)
3. Sees live preview of their PG brand colors applied in selected theme
4. Optionally tweaks individual tokens (brand color, border radius, shadow style)
5. Saves → `PUT /api/v1/app-config` with theme object
6. `ThemeProvider` reads `appConfig.theme` → applies `data-theme="{name}"` attribute
7. All components instantly re-style via CSS cascade

---

## 7. Responsive Breakpoints & Grid Strategy

### 7.1 Breakpoints

```css
/* Tailwind defaults — no change needed */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet portrait */
lg: 1024px  /* Tablet landscape / small desktop */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

### 7.2 Responsive Patterns Per Page Type

**List Pages** (Tenants, Rooms, Floors, etc.):

```
Mobile:  [Search] [Filters stacked] [Table horizontal scroll]
Tablet:  [Search | Filters row] [Full table]
Desktop: [Search | Filters row | Action button] [Full table with all columns]
```

**Detail Pages**:

```
Mobile:  [Back] [Title + badge] [1-col cards]
Tablet:  [Back | Title + badge] [2-col cards]
Desktop: [Back | Title + badge] [3-col cards grid]
```

**Create Pages**:

```
Mobile:  [Back] [Title] [1-col form fields] [Cancel | Save]
Desktop: [Back | Title] [Max-width centered form 2-col grid]
```

**Dashboard**:

```
Mobile:  [1-col stats] [1 chart full width] [recent stacked]
Tablet:  [2-col stats] [1 chart] [2-col recent]
Desktop: [3-4 col stats] [2 charts side by side] [2-col recent]
```

### 7.3 Mobile Sidebar

Current mobile sidebar (overlay with hamburger) works for all themes. No change needed to the mechanism — only the visual tokens applied to the sidebar content.

---

## 8. Color Palette Generation for Custom Brand Colors

When a user provides their brand color (e.g., hex `#7c3aed`), we need to generate a full 11-step scale (50-950). Use chroma-js or a simple algorithm:

```typescript
// Algorithm: Take base color, generate shades by adjusting lightness
function generateScale(baseHex: string): Record<string, string> {
  // 50: 95% lightness (near white tint)
  // 100: 90%
  // 200: 80%
  // 300: 65%
  // 400: 45%
  // 500: base color
  // 600: darken 10%
  // 700: darken 20%
  // 800: darken 30%
  // 900: darken 40%
  // 950: darken 50%
}
```

We can use `chroma-js` (lightweight, 13kb) or implement in pure JS with HSL manipulation.

---

## 9. Implementation Order (When We Execute)

### Phase A: Foundation (Token System)

1. Create `themes/` directory with token types
2. Create 4 theme CSS files with all tokens defined
3. Update `globals.css` to import themes and map to Tailwind `@theme`
4. Create `ThemeProvider.tsx` with context
5. Add `theme` field to `IAppConfig` type

### Phase B: Component Migration

1. Tokenize Button (hardest — many variants)
2. Tokenize Input, Select
3. Tokenize StatusBadge
4. Tokenize StatCard
5. Tokenize DataTable
6. Tokenize Sidebar
7. Tokenize NotificationBell

### Phase C: Page Migration

1. Dashboard (recharts + stat cards + recent lists)
2. All list pages (17 pages — consistent pattern, can batch)
3. All detail pages (15 pages — consistent pattern)
4. All create pages (14 pages — consistent pattern)
5. Settings page (add Appearance tab)
6. Landing page (public-facing)

### Phase D: Settings Integration

1. Add "Appearance" tab to settings
2. Theme preset selector
3. Custom brand color picker + scale generator
4. Live preview panel
5. Font selector
6. Border/shadow preset selector
7. Persist to app-config API

### Phase E: Testing & Polish

1. Visual regression: screenshot each page in each theme
2. Responsive testing at all 4 breakpoints
3. Dark mode variants for neumorphic + SaaS
4. Performance: verify CSS-only approach has zero runtime cost
5. Cross-browser: Chrome, Firefox, Safari

---

## 10. Open Questions & Decisions Needed

1. **Dark mode**: Should each theme have a light + dark variant? Or is dark mode a separate toggle?
   - Recommendation: Each theme defines both light and dark tokens. Toggle via `prefers-color-scheme` media query or manual toggle.

2. **Font loading**: Should we load all 4 theme fonts upfront (performance hit) or dynamically?
   - Recommendation: Load all fonts with `font-display: swap` and `preload` for the default theme. Dynamic loading adds complexity with minimal gain — fonts are cached after first load.

3. **Custom theme persistence**: Should custom themes be user-specific (per admin user) or global (per PG)?
   - Recommendation: Global per PG (stored in app-config). One brand identity per PG.

4. **Landing page**: Should the public landing page also theme? Or always use one preset?
   - Recommendation: Landing page uses the same theme system — brand consistency.

5. **Tailwind v4 limitations**: Can we dynamically redefine `@theme` values?
   - Tailwind v4 `@theme` is build-time. We use CSS custom properties as the runtime layer, with `@theme` referencing the vars. This works because CSS vars cascade.

---

## 11. Estimated Effort

| Phase         | Files   | Estimated Hours |
| ------------- | ------- | --------------- |
| A: Foundation | 8       | 4-6             |
| B: Components | 7       | 6-8             |
| C: Pages      | 50+     | 12-16           |
| D: Settings   | 2       | 4-6             |
| E: Testing    | all     | 4-6             |
| **Total**     | **~70** | **30-42 hours** |

This is a significant engineering effort. The CSS-only cascade approach means components don't need conditional rendering — the theme switch is instant and free.

---

_Last updated: 07/06/2026_
_Status: Planning complete — awaiting approval to implement_
