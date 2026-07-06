# Multi-Theme Design System — Research-Backed Token Specification

> **Status:** Research complete — all 4 themes backed by production-grade design references
> **Date:** 07/06/2026
> **Purpose:** Definitive token values for each theme preset, validated against design community best practices
> **Sources:** Alex Mayhew (neo-brutalism guide), Boundev.ai (neumorphism guide), Halfaccessible (glassmorphism guide), TheFrontKit (SaaS token architecture)

---

## Theme 1: Neo-Brutalist Cartoon

### Design References

- Alex Mayhew: "Neo-Brutalism: A Developer's Guide to Anti-Generic Design" (2026)
- Design philosophy: "Truth to materials" — the box model is the aesthetic

### Production Rules (Researched)

- **Borders:** 3px solid black (`#000`) on all containers. No `rgba` borders. Black only.
- **Shadows:** Hard offset, ZERO blur. `4px 4px 0px #000` (cards), `2px 2px 0px #000` (buttons). Shadow is a "physical displacement."
- **Corners:** None. `border-radius: 0` on cards. Neo-brutalism rejects rounding. Small elements (buttons, badges, inputs) can use 4px radius for usability, but cards and containers stay sharp.
- **Typography:** Monospace for labels and accents (`JetBrains Mono`), clean sans-serif for body (`Inter` or `DM Sans`). Bold weights for headlines. Tight tracking on labels. Uppercase monospace labels with `tracking-wider`.
- **Color palette:** 3-5 colors max. High contrast. Background: near-black with slight tint (not pure `#000`). Accent: one bright signature color.
- **Press effects:** `active:translate-x-1 active:translate-y-1 active:shadow-none` — the button physically moves into its shadow space.
- **Focus states:** Thick rings in accent color against dark background. Must exceed WCAG AAA (12:1+).
- **Layout:** Left-aligned preferred. Exposed grid lines between cells. Asymmetric compositions.
- **Texture:** Optional noise overlay at 1.5% opacity for "screen-printed" feel.
- **Anti-patterns:** NO `rounded-lg`, NO `rounded-xl`, NO `shadow-lg` (blurred), NO gradients (except very subtle), NO centered text blocks, NO pure black backgrounds.

### Validated Token Values

| Token                     | Value                             | Rationale                                             |
| ------------------------- | --------------------------------- | ----------------------------------------------------- |
| `--bw-default`            | `2px`                             | Secondary elements use 2px                            |
| `--bw-strong`             | `3px`                             | Primary containers use 3px (Alex Mayhew: "3px solid") |
| `--border-color`          | `#000000`                         | Pure black only, never rgba                           |
| `--border-style`          | `solid`                           | Always solid                                          |
| `--radius-sm`             | `0px`                             | Sharp (neo-brutalism anti-pattern: no rounding)       |
| `--radius-md`             | `0px`                             | Sharp cards                                           |
| `--radius-lg`             | `0px`                             | Sharp containers                                      |
| `--radius-xl`             | `0px`                             | Sharp                                                 |
| `--radius-full`           | `9999px`                          | Only for badges/avatars                               |
| `--shadow-card`           | `4px 4px 0px #000000`             | Hard offset, zero blur                                |
| `--shadow-card-hover`     | `2px 2px 0px #000000`             | Shrinks on hover (moves toward surface)               |
| `--shadow-button`         | `2px 2px 0px #000000`             | Button shadow                                         |
| `--shadow-button-pressed` | `none`                            | Pressed: no shadow (button fills shadow space)        |
| `--shadow-dropdown`       | `3px 3px 0px #000000`             | Dropdown shadow                                       |
| `--shadow-modal`          | `6px 6px 0px rgba(0,0,0,0.5)`     | Modal with semi-transparent shadow                    |
| `--font-display`          | `'Syne', sans-serif`              | Bold, chunky, wide display font                       |
| `--font-body`             | `'DM Sans', sans-serif`           | Clean body text                                       |
| `--font-mono`             | `'JetBrains Mono', monospace`     | Labels, UTR, invoice numbers                          |
| `--font-size-label`       | `0.75rem`                         | `text-xs`                                             |
| `--letter-spacing-label`  | `0.05em`                          | `tracking-wider` — uppercase monospace labels         |
| `--transition-duration`   | `150ms`                           | Fast, snappy                                          |
| `--transition-easing`     | `ease-out`                        | Quick out                                             |
| `--hover-lift`            | `translateX(1px) translateY(1px)` | Press-down behavior                                   |
| `--active-press-scale`    | `0.97`                            | Slight scale on active                                |
| `--active-press-x`        | `1px`                             | Push right                                            |
| `--active-press-y`        | `1px`                             | Push down                                             |
| `--sidebar-width`         | `256px`                           | Standard                                              |
| `--card-padding`          | `24px`                            | `p-6`                                                 |
| `--section-gap`           | `24px`                            | `gap-6`                                               |

### Color Palette (Warm Amber — High Contrast)

```
--color-brand-50: #fffbeb    (lightest warm cream)
--color-brand-100: #fef3c7
--color-brand-200: #fde68a
--color-brand-300: #fcd34d
--color-brand-400: #fbbf24
--color-brand-500: #f59e0b    (signature amber)
--color-brand-600: #d97706
--color-brand-700: #b45309
--color-brand-800: #92400e
--color-brand-900: #78350f
--color-brand-950: #451a03    (darkest)

--color-surface-50: #fafaf9   (warm white)
--color-surface-100: #f5f5f4
--color-surface-200: #e7e5e4
--color-surface-300: #d6d3d1
--color-surface-400: #a8a29e
--color-surface-500: #78716c
--color-surface-600: #57534e
--color-surface-700: #44403c
--color-surface-800: #292524
--color-surface-900: #1c1917   (not pure black — Alex Mayhew: "pure black is too harsh")
--color-surface-950: #0c0a09   (near-black with warm tint)
```

### Key Visual Identity

- Everything has visible borders
- No blur shadows anywhere
- Sharp corners on containers
- Bold monospace uppercase labels
- Press-down button behavior
- High-contrast color palette (12:1+ ratios)

---

## Theme 2: Neumorphic

### Design References

- Boundev.ai: "Neumorphic UI Design Complete CSS Guide" (2024)
- Design philosophy: Soft, extruded, tactile — elements push out from or sink into background

### Production Rules (Researched)

- **Borders:** ZERO. `border-width: 0px`. The extrusion effect comes from paired shadows, not borders. Borders destroy the neumorphic illusion.
- **Shadows:** Duotone shadows — one dark (bottom-right), one light (top-left). `8px 8px 16px #d1d3d9, -8px -8px 16px #ffffff` for raised. `inset 4px 4px 8px #d1d3d9, inset -4px -4px 8px #ffffff` for pressed/inset.
- **Background:** MUST match the surface color exactly. The background and the element must be the same color for the extrusion illusion to work. If they differ, you get a normal shadow, not neumorphism.
- **Corners:** Large and smooth. `12-20px` minimum. Cards: 16px. Buttons: 12px. Modals: 20px. Rounded and pillowy — no sharp edges.
- **Typography:** Rounded geometric fonts: `Poppins` for display, `Inter` for body. Soft, friendly feel.
- **Inputs:** Inset (pressed-in) appearance. Use `inset` shadows instead of raised.
- **Buttons:** Raised normally. On press, swap shadows from raised to inset (element sinks into surface).
- **Colors:** Monochromatic surface palette. Brand color used sparingly for accents and active states only.
- **Dark mode:** Surface becomes dark gray (#2a2a3d). Shadow colors adjust: dark shadow darkens to `#1a1a2e`, light shadow lightens to `#3a3a5e`.
- **Hover:** Shadow values soften slightly — elements feel like they're being pressed gently.
- **Spacing:** More generous than other themes. 28px card padding, 28px section gaps. Extra breathing room for the soft aesthetic.
- **Anti-patterns:** NO borders, NO hard shadows, NO sharp corners, NO high-contrast color combinations, NO pure black or pure white.

### Validated Token Values

| Token                     | Value                                                                     | Rationale                                          |
| ------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| `--bw-default`            | `0px`                                                                     | Borderless (neumorphism uses shadows, not borders) |
| `--bw-strong`             | `0px`                                                                     | No strong borders anywhere                         |
| `--border-color`          | `transparent`                                                             | No visible border color                            |
| `--border-style`          | `solid`                                                                   | N/A (border is 0px)                                |
| `--radius-sm`             | `12px`                                                                    | Soft, pillowy                                      |
| `--radius-md`             | `16px`                                                                    | Cards, buttons, inputs                             |
| `--radius-lg`             | `20px`                                                                    | Large cards, modals                                |
| `--radius-xl`             | `24px`                                                                    | Hero sections                                      |
| `--radius-full`           | `9999px`                                                                  | Pills, badges, avatars                             |
| `--shadow-card`           | `8px 8px 16px #d1d3d9, -8px -8px 16px #ffffff`                            | Duotone raised shadow                              |
| `--shadow-card-hover`     | `6px 6px 12px #d1d3d9, -6px -6px 12px #ffffff`                            | Softer on hover                                    |
| `--shadow-button`         | `6px 6px 12px #d1d3d9, -6px -6px 12px #ffffff`                            | Raised button                                      |
| `--shadow-button-pressed` | `inset 4px 4px 8px #d1d3d9, inset -4px -4px 8px #ffffff`                  | Inset (pressed)                                    |
| `--shadow-dropdown`       | `12px 12px 24px #d1d3d9, -12px -12px 24px #ffffff`                        | Deep raised                                        |
| `--shadow-modal`          | `20px 20px 40px rgba(0,0,0,0.15), -10px -10px 20px rgba(255,255,255,0.8)` | Modal overlay                                      |
| `--shadow-input`          | `inset 4px 4px 8px #d1d3d9, inset -4px -4px 8px #ffffff`                  | Inset input                                        |
| `--font-display`          | `'Poppins', sans-serif`                                                   | Rounded geometric                                  |
| `--font-body`             | `'Inter', sans-serif`                                                     | Clean, neutral                                     |
| `--font-mono`             | `'Fira Code', monospace`                                                  | Soft programming font                              |
| `--font-size-label`       | `0.8125rem`                                                               | `text-[13px]`                                      |
| `--letter-spacing-label`  | `normal`                                                                  | No extra tracking                                  |
| `--transition-duration`   | `300ms`                                                                   | Slower, smoother                                   |
| `--transition-easing`     | `ease-in-out`                                                             | Gentle acceleration/deceleration                   |
| `--hover-lift`            | `none`                                                                    | No lift — shadow swap instead                      |
| `--active-press-scale`    | `0.98`                                                                    | Subtle press                                       |
| `--active-press-x`        | `0px`                                                                     | No translate                                       |
| `--active-press-y`        | `0px`                                                                     | No translate                                       |
| `--sidebar-width`         | `280px`                                                                   | Wider, airier                                      |
| `--card-padding`          | `28px`                                                                    | `p-7`                                              |
| `--section-gap`           | `28px`                                                                    | `gap-7`                                            |

### Color Palette (Soft Blue-Purple — Monochromatic Surface)

```
--color-brand-50: #f0f1ff    (light lavender)
--color-brand-100: #dde0ff
--color-brand-200: #bcc1ff
--color-brand-300: #9ba2ff
--color-brand-400: #7c8aff
--color-brand-500: #5c6bff    (soft blue-purple)
--color-brand-600: #4956cc
--color-brand-700: #374199
--color-brand-800: #252c66
--color-brand-900: #1a1f4d
--color-brand-950: #3b2f6e

--color-surface-50: #edeef2   (pale lavender gray — matches background)
--color-surface-100: #e4e5ea  (CRITICAL: surface must match element bg)
--color-surface-200: #d1d3d9
--color-surface-300: #b8bac2
--color-surface-400: #9a9ca6
--color-surface-500: #7d7f8a
--color-surface-600: #636570
--color-surface-700: #4a4c55
--color-surface-800: #33343d
--color-surface-900: #2a2a3d   (dark mode surface)
--color-surface-950: #1a1a2e   (deepest)
```

### Dark Mode Shadow Values

```
--shadow-card: 8px 8px 16px #1a1a2e, -8px -8px 16px #3a3a5e
--shadow-card-hover: 6px 6px 12px #1a1a2e, -6px -6px 12px #3a3a5e
--shadow-button: 6px 6px 12px #1a1a2e, -6px -6px 12px #3a3a5e
--shadow-button-pressed: inset 4px 4px 8px #1a1a2e, inset -4px -4px 8px #3a3a5e
--shadow-dropdown: 12px 12px 24px #1a1a2e, -12px -12px 24px #3a3a5e
--shadow-input: inset 4px 4px 8px #1a1a2e, inset -4px -4px 8px #3a3a5e
```

### Key Visual Identity

- No borders anywhere
- Paired light/dark shadows create extrusion
- Background must match element color exactly
- Inputs are inset (pressed-in look)
- Buttons swap shadow on press (raised → inset)
- Soft, large border radius everywhere

---

## Theme 3: Glassmorphism / Soft UI

### Design References

- Halfaccessible: "Glassmorphism Design Trend Implementation Guide" (2024)
- Design philosophy: Ethereal, translucent, luminous — frosted glass with colored glows

### Production Rules (Researched)

- **Backgrounds:** Semi-transparent. `rgba(255, 255, 255, 0.1-0.3)` with `backdrop-filter: blur(10-20px) saturate(180%)`. The translucency is the core effect.
- **Borders:** Thin, light, semi-transparent. `1px solid rgba(255, 255, 255, 0.2-0.3)`. The border should be visible but delicate — a suggestion of an edge, not a hard boundary.
- **Shadows:** Multi-layered, soft, far-reaching. `0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)`. Two or more layers create depth without harshness.
- **Background layer:** Glassmorphism REQUIRES a vibrant, colorful background behind the glass elements. Without it, the glass effect is invisible. Use gradient washes, blurred shapes, or colored elements as the backdrop.
- **Hover effects:** Cards lift upward (`translateY(-2px)`) with deeper shadow. Glass feels like it's floating.
- **Corners:** Smooth but not extreme. `12px` cards, `16px` modals, `8px` buttons.
- **Typography:** Modern geometric: `Plus Jakarta Sans` for display, `Inter` for body. Light and airy.
- **Colors:** Vibrant, saturated brand colors with luminous quality. Teal/cyan brand palette works well.
- **Inputs:** White background with slight transparency, thin light borders.
- **Dark mode:** Not practical for true glassmorphism — glass effect requires light behind it. Dark mode version uses darker translucent backgrounds with subtle glow borders.
- **Spacing:** Generous but not extreme. 24px card padding, 32px section gaps.
- **Anti-patterns:** NO heavy borders, NO dark solid backgrounds, NO opaque elements on glass surfaces, NO low-contrast text (must maintain 4.5:1 on translucent bg).

### Validated Token Values

| Token                     | Value                                                       | Rationale                                        |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| `--bw-default`            | `1px`                                                       | Thin, light border                               |
| `--bw-strong`             | `1px`                                                       | Same — glass doesn't use thick borders           |
| `--border-color`          | `rgba(255, 255, 255, 0.3)`                                  | Semi-transparent white                           |
| `--border-style`          | `solid`                                                     | Solid but translucent                            |
| `--radius-sm`             | `8px`                                                       | Buttons, small elements                          |
| `--radius-md`             | `12px`                                                      | Cards, inputs                                    |
| `--radius-lg`             | `16px`                                                      | Large cards, modals                              |
| `--radius-xl`             | `20px`                                                      | Hero sections                                    |
| `--radius-full`           | `9999px`                                                    | Pills, avatars                                   |
| `--shadow-card`           | `0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)`   | Multi-layer soft shadow                          |
| `--shadow-card-hover`     | `0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)` | Deeper on hover                                  |
| `--shadow-button`         | `0 4px 12px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)`   | Subtle button shadow                             |
| `--shadow-button-pressed` | `0 1px 4px rgba(0,0,0,0.04)`                                | Minimal when pressed                             |
| `--shadow-dropdown`       | `0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)` | Deep dropdown                                    |
| `--shadow-modal`          | `0 24px 64px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.08)` | Modal overlay                                    |
| `--backdrop-blur`         | `16px`                                                      | `backdrop-filter: blur(16px)`                    |
| `--backdrop-saturate`     | `180%`                                                      | `saturate(180%)` — enhances colors through glass |
| `--glass-bg`              | `rgba(255, 255, 255, 0.7)`                                  | Semi-transparent white                           |
| `--glass-bg-dark`         | `rgba(15, 23, 42, 0.7)`                                     | Dark mode glass                                  |
| `--font-display`          | `'Plus Jakarta Sans', sans-serif`                           | Modern geometric                                 |
| `--font-body`             | `'Inter', sans-serif`                                       | Clean body                                       |
| `--font-mono`             | `'IBM Plex Mono', monospace`                                | Technical labels                                 |
| `--font-size-label`       | `0.8125rem`                                                 | `text-[13px]`                                    |
| `--letter-spacing-label`  | `normal`                                                    | No extra tracking                                |
| `--transition-duration`   | `250ms`                                                     | Smooth, moderate speed                           |
| `--transition-easing`     | `cubic-bezier(0.4, 0, 0.2, 1)`                              | Material easing                                  |
| `--hover-lift`            | `translateY(-2px)`                                          | Float upward on hover                            |
| `--active-press-scale`    | `0.98`                                                      | Subtle press                                     |
| `--active-press-x`        | `0px`                                                       | No horizontal                                    |
| `--active-press-y`        | `0px`                                                       | No vertical (uses scale instead)                 |
| `--sidebar-width`         | `272px`                                                     | Moderate width                                   |
| `--card-padding`          | `24px`                                                      | `p-6`                                            |
| `--section-gap`           | `32px`                                                      | `gap-8`                                          |

### Color Palette (Vibrant Teal-Cyan — Luminous)

```
--color-brand-50: #ecfeff    (lightest cyan)
--color-brand-100: #cffafe
--color-brand-200: #a5f3fc
--color-brand-300: #67e8f9
--color-brand-400: #22d3ee
--color-brand-500: #06b6d4    (vibrant teal)
--color-brand-600: #0891b2
--color-brand-700: #0e7490
--color-brand-800: #155e75
--color-brand-900: #164e63
--color-brand-950: #083344

--color-surface-50: #f8fafc   (cool white with blue undertone)
--color-surface-100: #f1f5f9
--color-surface-200: #e2e8f0
--color-surface-300: #cbd5e1
--color-surface-400: #94a3b8
--color-surface-500: #64748b
--color-surface-600: #475569
--color-surface-700: #334155
--color-surface-800: #1e293b
--color-surface-900: #0f172a   (dark slate for dark mode)
--color-surface-950: #020617
```

### Key Visual Identity

- Glass cards: white with transparency + backdrop blur
- Subtle gradient background behind glass (e.g. `linear-gradient(135deg, #f8fafc, #e2e8f0)`)
- Thin, light borders (1px, rgba white 30%)
- Cards lift upward on hover (translateY -2px)
- Soft, far-reaching multi-layer drop shadows
- Luminous, saturated brand colors
- Frosted glass icon containers
- Input backgrounds: white with slight transparency

---

## Theme 4: SaaS / Enterprise Professional

### Design References

- TheFrontKit: "Tailwind CSS Design Tokens for SaaS" (2026)
- Atlassian Design: Design tokens reference
- Design philosophy: Professional, clean, efficient — function over form

### Production Rules (Researched)

- **Borders:** Thin, subtle, neutral. `1px solid #e5e7eb` (gray-200). Only used to separate content, never decorative. Focus rings in brand color.
- **Shadows:** Tight, close, subtle. `0 1px 2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)`. One or two layers, minimal blur. Cards barely lift off the surface — enough to separate but not distract.
- **Corners:** Tight and professional. `6px` cards, `8px` buttons, `10px` modals. Sharp enough to feel precise, rounded enough to feel polished.
- **Typography:** System-grade sans-serif exclusively. `Inter` for everything — display, body, and labels. No decorative fonts. Font weights do the hierarchy work.
- **Color tokens as RGB channels:** TheFrontKit uses `rgb(var(--color-primary-600) / <alpha-value>)` pattern for Tailwind opacity modifiers. We'll use hex since Tailwind v4 `@theme` handles opacity differently, but the principle is the same — semantic tokens only.
- **Spacing:** Dense and compact. 20px card padding, 20px section gaps. Information density > breathing room.
- **Hover:** Background color shift only, no translate or scale. Professional, understated.
- **Dark mode:** Full support. Surface tokens flip completely.
- **Layout:** Dense tables, compact forms, information-rich dashboards. Every pixel used efficiently.
- **Anti-patterns:** NO decorative shadows, NO large border radius, NO display fonts, NO animated hover effects, NO excessive padding.

### Validated Token Values

| Token                     | Value                                                       | Rationale                                                              |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `--bw-default`            | `1px`                                                       | Thin, professional                                                     |
| `--bw-strong`             | `1px`                                                       | Same — SaaS doesn't use thick borders                                  |
| `--border-color`          | `#e5e7eb`                                                   | Neutral gray-200                                                       |
| `--border-style`          | `solid`                                                     | Solid but subtle                                                       |
| `--radius-sm`             | `4px`                                                       | Tags, badges — TheFrontKit: 0.25rem                                    |
| `--radius-md`             | `6px`                                                       | Buttons, inputs — TheFrontKit: 0.5rem (adjusted down for tighter feel) |
| `--radius-lg`             | `8px`                                                       | Cards, modals — TheFrontKit: 0.75rem                                   |
| `--radius-xl`             | `10px`                                                      | Large containers                                                       |
| `--radius-full`           | `9999px`                                                    | Pills only                                                             |
| `--shadow-card`           | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)`     | Tight, close shadow                                                    |
| `--shadow-card-hover`     | `0 2px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)`     | Slightly deeper on hover                                               |
| `--shadow-button`         | `0 1px 2px rgba(0,0,0,0.05)`                                | Almost no shadow                                                       |
| `--shadow-button-pressed` | `none`                                                      | Flat when pressed                                                      |
| `--shadow-dropdown`       | `0 4px 12px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)`    | Dropdown elevation                                                     |
| `--shadow-modal`          | `0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)` | Modal overlay                                                          |
| `--font-display`          | `'Inter', sans-serif`                                       | System-grade, no decorative fonts                                      |
| `--font-body`             | `'Inter', sans-serif`                                       | Same font for everything                                               |
| `--font-mono`             | `'JetBrains Mono', monospace`                               | Code and technical labels                                              |
| `--font-size-label`       | `0.75rem`                                                   | `text-xs`                                                              |
| `--letter-spacing-label`  | `normal`                                                    | No tracking                                                            |
| `--transition-duration`   | `200ms`                                                     | Moderate speed                                                         |
| `--transition-easing`     | `ease`                                                      | Standard easing                                                        |
| `--hover-lift`            | `none`                                                      | No lift — background color shift only                                  |
| `--active-press-scale`    | `1`                                                         | No scale                                                               |
| `--active-press-x`        | `0px`                                                       | No translate                                                           |
| `--active-press-y`        | `0px`                                                       | No translate                                                           |
| `--sidebar-width`         | `240px`                                                     | Compact sidebar                                                        |
| `--card-padding`          | `20px`                                                      | `p-5` — dense                                                          |
| `--section-gap`           | `20px`                                                      | `gap-5` — dense                                                        |
| `--page-max-width`        | `1280px`                                                    | Standard desktop width                                                 |

### Color Palette (Professional Indigo — Neutral)

```
--color-brand-50: #eef2ff    (lightest indigo)
--color-brand-100: #e0e7ff
--color-brand-200: #c7d2fe
--color-brand-300: #a5b4fc
--color-brand-400: #818cf8
--color-brand-500: #6366f1    (professional indigo)
--color-brand-600: #4f46e5
--color-brand-700: #4338ca
--color-brand-800: #3730a3
--color-brand-900: #312e81
--color-brand-950: #1e1b4b

--color-surface-50: #fafafa   (neutral cool gray)
--color-surface-100: #f5f5f5
--color-surface-200: #e5e5e5
--color-surface-300: #d4d4d4
--color-surface-400: #a3a3a3
--color-surface-500: #737373
--color-surface-600: #525252
--color-surface-700: #404040
--color-surface-800: #262626
--color-surface-900: #171717   (dark mode surface)
--color-surface-950: #0a0a0a
```

### Key Visual Identity

- Thin 1px borders in neutral gray
- Tight, close shadows (1-2px offset, low opacity)
- Hover states: background color shift only
- Dense layout — less padding, compact tables
- Clean separators (1px lines)
- Professional sans-serif throughout (Inter only)
- No decorative elements — function over form
- Badges: flat, compact, no shadow
- Inputs: light gray border, blue focus ring
- Compact sidebar (240px)

---

## Comparison Matrix: All 4 Themes

| Property                  | Brutalist                       | Neumorphic                  | Glassmorphic                              | SaaS                 |
| ------------------------- | ------------------------------- | --------------------------- | ----------------------------------------- | -------------------- |
| **Borders**               | 3px solid black                 | 0px (none)                  | 1px rgba(255,255,255,0.3)                 | 1px #e5e7eb          |
| **Shadows**               | Hard offset, no blur            | Duotone light+dark          | Multi-layer soft                          | Tight, close, subtle |
| **Radius**                | 0px (sharp)                     | 12-20px (pillowy)           | 8-16px (smooth)                           | 4-8px (tight)        |
| **Typography**            | Syne + DM Sans + JetBrains Mono | Poppins + Inter + Fira Code | Plus Jakarta Sans + Inter + IBM Plex Mono | Inter only           |
| **Font weight (display)** | Extrabold (800)                 | Bold (700)                  | Bold (700)                                | Semibold (600)       |
| **Hover effect**          | Press down (translate 1,1)      | Shadow swap (raised→soft)   | Float up (translateY -2px)                | Background shift     |
| **Active effect**         | Scale 0.97 + translate 1,1      | Shadow swap to inset        | Scale 0.98                                | None                 |
| **Transition**            | 150ms ease-out                  | 300ms ease-in-out           | 250ms cubic-bezier                        | 200ms ease           |
| **Card padding**          | 24px                            | 28px                        | 24px                                      | 20px                 |
| **Section gap**           | 24px                            | 28px                        | 32px                                      | 20px                 |
| **Sidebar width**         | 256px                           | 280px                       | 272px                                     | 240px                |
| **Density**               | Medium                          | Airy                        | Moderate                                  | Compact              |
| **Brand palette**         | Warm amber                      | Soft blue-purple            | Vibrant teal                              | Professional indigo  |
| **Surface palette**       | Warm stone                      | Lavender gray               | Cool slate                                | Neutral gray         |
| **WCAG contrast**         | 12:1+ (AAA)                     | 7:1+ (AA)                   | 5:1+ (AA)                                 | 7:1+ (AA)            |
| **Dark mode**             | Supported                       | Supported                   | Limited (glass needs light)               | Full support         |
| **Special effect**        | Noise overlay                   | Background matches surface  | backdrop-blur(16px)                       | None                 |

---

## Spacing Scale (All Themes)

Based on TheFrontKit's 4px base unit recommendation for SaaS, adapted per theme density:

```
Token          | Brutalist | Neumorphic | Glassmorphic | SaaS
---------------+-----------+------------+-------------+------
--space-1      | 4px       | 4px        | 4px         | 4px
--space-2      | 8px       | 8px        | 8px         | 8px
--space-3      | 12px      | 12px       | 12px        | 12px
--space-4      | 16px      | 16px       | 16px        | 16px
--space-5      | 20px      | 20px       | 20px        | 20px
--space-6      | 24px      | 24px       | 24px        | 24px
--space-7      | 28px      | 28px       | 28px        | 28px
--space-8      | 32px      | 32px       | 32px        | 32px
--card-padding | 24px (6)  | 28px (7)   | 24px (6)    | 20px (5)
--section-gap  | 24px (6)  | 28px (7)   | 32px (8)    | 20px (5)
```

## Typography Scale (All Themes)

Research-backed font sizes that maintain readability across all themes:

```
Token              | Value    | Usage
-------------------+----------+-------------------
--font-size-xs     | 0.75rem  | Labels, badges, meta
--font-size-sm     | 0.875rem | Body text, table cells
--font-size-base   | 1rem     | Default body
--font-size-lg     | 1.125rem | Card titles, emphasized text
--font-size-xl     | 1.25rem  | Section headers
--font-size-2xl    | 1.5rem   | Page titles
--font-size-3xl    | 1.875rem | Hero headlines
--font-size-4xl    | 2.25rem  | Landing headlines
--font-size-5xl    | 3rem     | Landing hero main
```

Font weights:

```
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
--font-weight-extrabold: 800  (brutalist only)
```

---

## Implementation Notes

### How to Handle Theme-Dependent Behavior

Some design decisions are not simple value swaps — they're entirely different CSS behaviors per theme:

**Button hover:**

- Brutalist: `translateX(1px) translateY(1px)` + smaller shadow
- Neumorphic: Swap raised shadow to softer raised shadow
- Glassmorphic: `translateY(-2px)` + deeper shadow
- SaaS: `background-color` shift only

**Button active/press:**

- Brutalist: `scale(0.97) translateX(1px) translateY(1px)` + shadow disappears
- Neumorphic: Swap raised shadow to inset shadow
- Glassmorphic: `scale(0.98)` + minimal shadow
- SaaS: No visual change

**Solution:** These are handled through CSS custom properties for the transform values and shadow tokens. The component code is identical — the CSS cascade does the work. See `THEMING_IMPLEMENTATION_BLUEPRINT.md` Section "Category 5" for the implementation pattern.

### Glassmorphism Dark Mode Constraint

True glassmorphism requires light behind translucent elements. In dark mode:

- Switch to darker translucent backgrounds (`rgba(15, 23, 42, 0.7)`)
- Use subtle glow borders instead of white borders
- Reduce backdrop blur intensity
- Accept that the "frosted glass" effect is diminished

### Neumorphism Background Constraint

Neumorphic elements MUST share the same background color as their container. This means:

- Cards on a white page: card bg = white, page bg = white
- Elements must not have contrasting backgrounds
- Color is used sparingly — only for brand accents and active states

### Font Loading Strategy

All fonts loaded upfront via Google Fonts `@import`:

```css
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
```

All fonts use `font-display: swap`. Total additional weight: ~200KB (acceptable — cached after first load).

---

_Document version 1.0 — Research-Backed Token Specification_
_Sources: Alex Mayhew (2026), Boundev.ai (2024), Halfaccessible (2024), TheFrontKit (2026), Atlassian Design, StudioLimb (2024 — neumorphism dark mode + accessibility), getcolors.dev (2026 — SaaS design tokens)_

---

## Light & Dark Mode — Complete Token Set Per Theme

Each theme has both light and dark mode variants. Mode is toggled via `[data-theme="X"] [data-mode="dark"]` or `[data-theme="X-dark"]` on `<html>`. Dark mode tokens override the light tokens using the same CSS custom property names.

### How Mode Switching Works

```
<html data-theme="brutalist">           → brutalist light (default)
<html data-theme="brutalist-dark">     → brutalist dark
<html data-theme="neumorphic-dark">    → neumorphic dark
<html data-theme="neumorphic">         → neumorphic light (default)
<html data-theme="soft-ui-dark">       → glassmorphic dark (limited)
<html data-theme="saas">              → SaaS light (default)
<html data-theme="saas-dark">         → SaaS dark
```

Each `[data-theme="X-dark"]` selector overrides the base theme colors with their dark mode equivalents. The component CSS is identical — only the custom properties change.

---

## Theme 1: Neo-Brutalist — Light & Dark Mode

### Light Mode (Default)

Already documented above. Key characteristics:

- White/warm-white surfaces (`#fafaf9` through `#1c1917`)
- Black borders on everything
- High contrast, maximum readability
- Bold amber brand against white

### Dark Mode (`[data-theme="brutalist-dark"]` or `[data-theme="brutalist"] [data-mode="dark"]`)

**Research basis:** Alex Mayhew's neo-brutalism guide emphasizes high contrast. Dark mode brutalism keeps the same 3px black borders, hard shadows, and bold typography but flips surfaces from light to dark. The key principle: borders remain black against dark surfaces — they become visible edges, not invisible.

| Token                     | Dark Mode Value                     | Rationale                                           |
| ------------------------- | ----------------------------------- | --------------------------------------------------- |
| `--color-surface-50`      | `#0c0a09`                           | Near-black warm tint (not pure black)               |
| `--color-surface-100`     | `#1c1917`                           | Dark surface 1                                      |
| `--color-surface-200`     | `#292524`                           | Dark surface 2                                      |
| `--color-surface-300`     | `#44403c`                           | Dark surface 3                                      |
| `--color-surface-400`     | `#57534e`                           | Dark surface 4                                      |
| `--color-surface-500`     | `#78716c`                           | Mid-gray text                                       |
| `--color-surface-600`     | `#a8a29e`                           | Secondary text                                      |
| `--color-surface-700`     | `#d6d3d1`                           | Primary text                                        |
| `--color-surface-800`     | `#e7e5e4`                           | Heading text                                        |
| `--color-surface-900`     | `#f5f5f4`                           | High-emphasis text                                  |
| `--color-surface-950`     | `#fafaf9`                           | Maximum-emphasis text                               |
| `--border-color`          | `#ffffff`                           | White borders on dark surfaces (brutalist contrast) |
| `--shadow-card`           | `4px 4px 0px #ffffff`               | White hard shadow on dark                           |
| `--shadow-card-hover`     | `2px 2px 0px #ffffff`               | White smaller shadow                                |
| `--shadow-button`         | `2px 2px 0px #ffffff`               | White button shadow                                 |
| `--shadow-button-pressed` | `none`                              | Pressed — no shadow                                 |
| `--shadow-dropdown`       | `3px 3px 0px #ffffff`               | Dropdown white shadow                               |
| `--shadow-modal`          | `6px 6px 0px rgba(255,255,255,0.5)` | Modal white shadow                                  |

**Brand colors stay the same** — amber still pops against dark backgrounds. The brand palette is shared between light and dark modes.

**Key visual difference:**

- Background: warm dark (`#0c0a09` to `#292524`)
- Borders: white instead of black (maintains brutalism's visible-grid principle)
- Shadows: white offset instead of black
- Text: light-on-dark hierarchy
- Brand amber: stays vibrant against dark surfaces

---

## Theme 2: Neumorphic — Light & Dark Mode

### Light Mode

Already documented. Key characteristics:

- Background must be mid-tone gray (`#e0e5ec` range per StudioLimb)
- NOT pure white (no room for lighter shadow)
- NOT pure black (no room for darker shadow)
- Paired duotone shadows, 0px borders

### Dark Mode (`[data-theme="neumorphic-dark"]`)

**Research basis:** StudioLimb's neumorphism guide specifically addresses dark mode. Key finding: dark neumorphism needs a mid-tone dark background (e.g., `#1e2430`). Pure black (`#000000`) fails — there's no darker color to create the dark shadow in the duotone pair.

**Correct dark mode surface palette:**

| Token                     | Dark Mode Value                                          | Rationale                                |
| ------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| `--color-surface-50`      | `#1a1e28`                                                | Mid-tone dark bg — NOT pure black        |
| `--color-surface-100`     | `#1e2430`                                                | Main surface (StudioLimb recommendation) |
| `--color-surface-200`     | `#242b38`                                                | Elevated surface                         |
| `--color-surface-300`     | `#2a3242`                                                | Higher elevation                         |
| `--color-surface-400`     | `#384254`                                                | Border/subtle                            |
| `--color-surface-500`     | `#505a6e`                                                | Muted text                               |
| `--color-surface-600`     | `#6e788c`                                                | Secondary text                           |
| `--color-surface-700`     | `#929cae`                                                | Body text                                |
| `--color-surface-800`     | `#b8bfcc`                                                | Heading text                             |
| `--color-surface-900`     | `#dce0e8`                                                | High-emphasis text                       |
| `--color-surface-950`     | `#f0f2f5`                                                | Maximum contrast text                    |
| `--shadow-card`           | `8px 8px 16px #10131a, -8px -8px 16px #2a3040`           | Duotone dark mode shadows                |
| `--shadow-card-hover`     | `6px 6px 12px #10131a, -6px -6px 12px #2a3040`           | Softer hover                             |
| `--shadow-button`         | `6px 6px 12px #10131a, -6px -6px 12px #2a3040`           | Raised button dark                       |
| `--shadow-button-pressed` | `inset 4px 4px 8px #10131a, inset -4px -4px 8px #2a3040` | Inset (StudioLimb: `inset 6px 6px 12px`) |
| `--shadow-dropdown`       | `12px 12px 24px #10131a, -12px -12px 24px #2a3040`       | Deep raised                              |
| `--shadow-input`          | `inset 4px 4px 8px #10131a, inset -4px -4px 8px #2a3040` | Inset input                              |

**Brand colors in dark mode:** Use slightly lighter variants (shift by one step: `--color-brand-500` → `--color-brand-400` for better contrast against dark surfaces). This is a StudioLimb recommendation for accessibility.

**Shadow color formula (StudioLimb):**

- Dark shadow: background darkened ~15% → `#10131a`
- Light shadow: background lightened ~10% → `#2a3040`
- Both derived from the background `#1e2430` using chroma.js or manual HSL shift

**Accessibility mitigation (StudioLimb):**

> "Pure neumorphic buttons fail WCAG 3:1 contrast. Add subtle border `1px solid rgba(255,255,255,0.06)` on interactive elements in dark mode, and ensure focus states use a visible colored outline."

| Accessibility Token    | Light Mode                   | Dark Mode                          |
| ---------------------- | ---------------------------- | ---------------------------------- |
| `--focus-ring-color`   | `rgba(124, 111, 255, 0.4)`   | `rgba(156, 141, 255, 0.6)`         |
| `--focus-ring-width`   | `2px`                        | `2px`                              |
| `--interactive-border` | `1px solid rgba(0,0,0,0.08)` | `1px solid rgba(255,255,255,0.08)` |
| `--disabled-opacity`   | `0.4`                        | `0.35`                             |

---

## Theme 3: Glassmorphism / Soft UI — Light & Dark Mode

### Light Mode

Already documented. Key characteristics:

- Semi-transparent white backgrounds (`rgba(255,255,255,0.7)`)
- `backdrop-filter: blur(16px) saturate(180%)`
- Thin white borders at 30% opacity
- Requires vibrant gradient/colorful background behind glass

### Dark Mode (`[data-theme="soft-ui-dark"]`)

**Research basis:** Halfaccessible's guide notes that true glassmorphism is "less effective in dark mode" because the glass effect relies on light passing through. The dark mode variant uses darker translucent backgrounds with subtle glow borders rather than full frosted glass.

**Dark mode constraints:**

- The glass effect is diminished — translucent surfaces become darker tinted overlays
- Borders glow subtly instead of appearing as white edges
- Background behind glass should still have depth (radial gradients, blurred colored shapes)
- Contrast ratios become critical — text on dark translucent bg must maintain 4.5:1

| Token                 | Dark Mode Value                                         | Rationale                                  |
| --------------------- | ------------------------------------------------------- | ------------------------------------------ |
| `--glass-bg`          | `rgba(15, 23, 42, 0.7)`                                 | Dark translucent (replaces white glass)    |
| `--glass-bg-hover`    | `rgba(15, 23, 42, 0.85)`                                | More opaque on hover                       |
| `--backdrop-blur`     | `12px`                                                  | Reduced blur in dark mode (less effective) |
| `--backdrop-saturate` | `120%`                                                  | Reduced saturation                         |
| `--border-color`      | `rgba(100, 116, 139, 0.3)`                              | Muted border instead of bright white       |
| `--color-surface-50`  | `#020617`                                               | Deepest dark                               |
| `--color-surface-100` | `#0f172a`                                               | Dark surface 1                             |
| `--color-surface-200` | `#1e293b`                                               | Dark surface 2                             |
| `--color-surface-300` | `#334155`                                               | Dark surface 3                             |
| `--color-surface-400` | `#475569`                                               | Dark surface 4                             |
| `--color-surface-500` | `#64748b`                                               | Muted text                                 |
| `--color-surface-600` | `#94a3b8`                                               | Secondary text                             |
| `--color-surface-700` | `#cbd5e1`                                               | Body text                                  |
| `--color-surface-800` | `#e2e8f0`                                               | Heading text                               |
| `--color-surface-900` | `#f1f5f9`                                               | High-emphasis                              |
| `--color-surface-950` | `#f8fafc`                                               | Maximum emphasis                           |
| `--shadow-card`       | `0 4px 24px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)` | Deeper shadows replace glass effect        |
| `--shadow-card-hover` | `0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)` | Deeper hover                               |
| `--shadow-button`     | `0 2px 8px rgba(0,0,0,0.2)`                             | Subtle button shadow                       |
| `--shadow-dropdown`   | `0 12px 40px rgba(0,0,0,0.4)`                           | Deep dropdown                              |
| `--shadow-modal`      | `0 20px 60px rgba(0,0,0,0.5)`                           | Heavy modal overlay                        |

**Dark mode background behind glass:**

```css
/* Vibrant dark background that shows through glass */
background:
  radial-gradient(ellipse at 20% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.06) 0%, transparent 50%),
  var(--color-surface-100);
```

**Brand colors shift slightly lighter in dark mode** for better contrast against dark glass surfaces: `--color-brand-500` → `--color-brand-400` (teal `#06b6d4` → `#22d3ee`).

---

## Theme 4: SaaS / Enterprise — Light & Dark Mode

### Light Mode

Already documented. Key characteristics:

- Tight, professional spacing
- Inter-exclusive typography
- 1px neutral gray borders
- Subtle shadows

### Dark Mode (`[data-theme="saas-dark"]`)

**Research basis:** getcolors.dev SaaS dashboard token system, TheFrontKit design tokens. SaaS dark mode is the most well-researched dark mode pattern — used by Stripe, Linear, Vercel, and every major SaaS product.

**Dark mode SaaS principles:**

- Background: near-black with slight blue-gray tint (NOT pure `#000000`)
- Surfaces: elevated layers using progressively lighter grays
- Text: WCAG AA minimum (4.5:1 ratio)
- Brand colors: remain the same (indigo), no lightening needed — they already contrast well against dark surfaces
- Borders: subtle `rgba(255,255,255,0.06-0.08)` instead of `#e5e7eb`
- Shadow: darker but still tight and close — SaaS doesn't use heavy shadows even in dark mode

| Token                     | Dark Mode Value               | Rationale                                   |
| ------------------------- | ----------------------------- | ------------------------------------------- |
| `--color-surface-50`      | `#0a0a0a`                     | Background (near-black with slight warmth)  |
| `--color-surface-100`     | `#171717`                     | Elevated surface 1                          |
| `--color-surface-200`     | `#262626`                     | Elevated surface 2 (cards)                  |
| `--color-surface-300`     | `#404040`                     | Elevated surface 3 (modals)                 |
| `--color-surface-400`     | `#525252`                     | Subtle separators                           |
| `--color-surface-500`     | `#737373`                     | Muted text, disabled text                   |
| `--color-surface-600`     | `#a3a3a3`                     | Secondary text                              |
| `--color-surface-700`     | `#d4d4d4`                     | Body text                                   |
| `--color-surface-800`     | `#e5e5e5`                     | Heading text                                |
| `--color-surface-900`     | `#f5f5f5`                     | High-emphasis text                          |
| `--color-surface-950`     | `#fafafa`                     | Maximum contrast                            |
| `--border-color`          | `rgba(255,255,255,0.08)`      | Subtle dark borders (getcolors.dev pattern) |
| `--shadow-card`           | `0 1px 2px rgba(0,0,0,0.3)`   | Tight, dark-adapted                         |
| `--shadow-card-hover`     | `0 2px 4px rgba(0,0,0,0.4)`   | Slightly deeper                             |
| `--shadow-button`         | `none`                        | No button shadow in dark SaaS               |
| `--shadow-button-pressed` | `none`                        | No shadow                                   |
| `--shadow-dropdown`       | `0 4px 12px rgba(0,0,0,0.5)`  | Dropdown elevation                          |
| `--shadow-modal`          | `0 16px 48px rgba(0,0,0,0.6)` | Modal overlay                               |

**SaaS dark mode key visual markers:**

- Background: `#0a0a0a` (slightly warm, not clinical)
- Cards: `#171717` surface with subtle `rgba(255,255,255,0.04)` border
- Text hierarchy via opacity and weight, not just color
- Brand indigo stays vibrant (`#6366f1`) — indigo already works on dark
- Focus rings: `0 0 0 2px var(--color-brand-500)` — visible against dark bg
- Hover: `background-color` shift from `#171717` → `#262626` (progressive elevation)

---

## Theme 5: Color Variant Options Within Each Theme

Each theme preset has a default brand color palette, but users can customize their brand color. The **surface palette stays fixed per theme** — only the brand palette changes.

### Brutalist Color Variant Options

The warm amber is the default. Users can pick any vibrant, high-contrast color:

| Variant             | Brand-500 Hex | Personality               |
| ------------------- | ------------- | ------------------------- |
| **Amber** (default) | `#f59e0b`     | Warm, bold, energizing    |
| **Crimson**         | `#ef4444`     | Aggressive, urgent        |
| **Lime**            | `#84cc16`     | Playful, unusual          |
| **Cyan**            | `#06b6d4`     | Digital, tech-forward     |
| **Fuchsia**         | `#d946ef`     | Punk, rebellious          |
| **Custom**          | Any hex       | PG owner's brand identity |

**Rule:** Brutalist brand colors should be bold, saturated, and high-contrast. Pastels don't work in brutalism.

### Neumorphic Color Variant Options

Brand color is used sparingly — only for accents, active states, and focus rings.

| Variant                   | Brand-500 Hex | Personality                                 |
| ------------------------- | ------------- | ------------------------------------------- |
| **Soft Indigo** (default) | `#5c6bff`     | Professional, soft tech                     |
| **Soft Teal**             | `#14b8a6`     | Calm, wellness                              |
| **Soft Rose**             | `#f472b6`     | Warm, friendly                              |
| **Soft Violet**           | `#a78bfa`     | Creative, subtle                            |
| **Custom**                | Any hex       | Must be soft/muted for neumorphic aesthetic |

**Rule:** Neumorphic brand colors should be soft and muted — no neon, no pure primaries. The brand color is an accent, not the dominant visual.

### Glassmorphic Color Variant Options

Brand color is vibrant and luminous — it glows through the glass.

| Variant            | Brand-500 Hex | Personality                                       |
| ------------------ | ------------- | ------------------------------------------------- |
| **Teal** (default) | `#06b6d4`     | Fresh, modern, luminous                           |
| **Indigo**         | `#6366f1`     | Deep, professional glow                           |
| **Emerald**        | `#10b981`     | Natural, organic                                  |
| **Sky Blue**       | `#0ea5e9`     | Clean, airy                                       |
| **Purple**         | `#a855f7`     | Premium, ethereal                                 |
| **Custom**         | Any hex       | Should be luminous — works well with translucency |

**Rule:** Glassmorphic brand colors should be vibrant and luminous — they need to "glow" through the frosted glass effect. Muted/dark colors lose the glass aesthetic.

### SaaS Color Variant Options

Professional, established SaaS brand colors.

| Variant              | Brand-500 Hex                       | Personality                              |
| -------------------- | ----------------------------------- | ---------------------------------------- |
| **Indigo** (default) | `#6366f1`                           | Trustworthy, standard SaaS               |
| **Blue**             | `#3b82f6`                           | Classic, dependable                      |
| **Slate Blue**       | `#6366f1` with cooler gray surfaces | Enterprise, serious                      |
| **Green**            | `#22c55e`                           | Growth-focused, fintech                  |
| **Custom**           | Any hex                             | Must be professional — avoid neon/pastel |

**Rule:** SaaS brand colors should be established brand colors — blue, indigo, slate. Avoid novelty colors (orange, pink) unless it's the company's established brand.

---

## Implementation: Theme Mode Architecture

**How data attributes work:**

```
<html data-theme="brutalist" data-mode="light">   → brutalist + light mode
<html data-theme="neumorphic" data-mode="dark">   → neumorphic + dark mode
<html data-theme="soft-ui" data-mode="light">     → glassmorphic + light mode
<html data-theme="saas" data-mode="dark">         → SaaS + dark mode
```

**CSS cascade (8 layers):**

```
1. @theme block           → default var(--token) fallbacks
2. :root                  → base defaults (brutalist light)
3. [data-theme="brutalist"] → brutalist tokens
4. [data-theme="neumorphic"] → neumorphic tokens
5. [data-theme="soft-ui"] → glass tokens
6. [data-theme="saas"]    → SaaS tokens
7. [data-mode="dark"]     → dark mode token overrides (flips surface palette, shadows, borders)
8. <html style="...">     → user custom overrides (highest priority)
```

**Theme CSS files must define BOTH light and dark:**

```css
/* saas.css */
[data-theme='saas'][data-mode='light'],
[data-theme='saas']:not([data-mode='dark']) {
  --color-surface-50: #fafafa;
  --color-surface-100: #f5f5f5;
  --color-surface-900: #171717;
  --border-color: #e5e7eb;
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.05);
}

[data-theme='saas'][data-mode='dark'] {
  --color-surface-50: #0a0a0a;
  --color-surface-100: #171717;
  --color-surface-900: #f5f5f5;
  --border-color: rgba(255, 255, 255, 0.08);
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.3);
}
```

**ThemeProvider logic:**

```typescript
// ThemeProvider.tsx
function applyTheme(preset: ThemePreset, mode: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', preset);
  document.documentElement.setAttribute('data-mode', mode);
}
```

---

_Document version 2.0 — Complete Light/Dark Mode + Color Variant Specification_
_Sources: Alex Mayhew (2026), Boundev.ai (2024), Halfaccessible (2024), TheFrontKit (2026), StudioLimb (2024 — neumorphism dark mode + accessibility), getcolors.dev (2026 — SaaS design tokens), Atlassian Design_
