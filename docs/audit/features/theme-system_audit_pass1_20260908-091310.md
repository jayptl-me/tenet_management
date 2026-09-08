# Theme System - Audit Pass 1

Module: theme-system (cross-cutting: 5 presets x light/dark + settings Appearance tab)
Scope: admin web only (Flutter has its own Material theme, untouched)
Source verified: 2026-09-08 UTC
Access rule: theme selection = admin only via settings; applied panel-wide via data-theme/data-mode

## 1. Selected Module

theme-system (preset token coverage, dead token references, custom preset, Appearance tab UX).

## 2. Admin vs End-User Access Map

### 2.1 Admin (apps/web, role admin only)

| Surface              | Route / File                                                        | Status            |
| -------------------- | ------------------------------------------------------------------- | ----------------- |
| Appearance tab       | settings/page.tsx #appearance -> components/admin/AppearanceTab.tsx | WORKING WITH GAPS |
| Header mode toggle   | components/admin/DarkModeToggle.tsx (hooks/useTheme.ts)             | WORKING           |
| Provider bootstrap   | themes/ThemeProvider.tsx + lib/colorScale.ts                        | WORKING           |

### 2.2 End-User (mobile)

| Screen | Route | Status    |
| ------ | ----- | --------- |
| none   | none  | BY DESIGN |

## 3. Token Coverage Audit (per preset x mode, script-verified against 153 used vars)

| Preset     | Light before | Dark before | After                          |
| ---------- | ------------ | ----------- | ------------------------------ |
| saas       | WORKING      | WORKING     | WORKING (reference, untouched) |
| brutalist  | DEGRADED (SaaS shadow/glass/spacing leaks; dark leaked layout/fonts) | DEGRADED | WORKING (idiom tokens completed) |
| neumorphic | DEGRADED (SaaS leaks; light missing tooltip) | DEGRADED | WORKING (idiom tokens completed) |
| soft-ui    | DEGRADED (SaaS leaks; missing glass aliases; light missing tooltip) | DEGRADED | WORKING (idiom tokens completed) |
| custom     | BROKEN (zero CSS rules; dark unstyled) | BROKEN | WORKING (new custom.css base) |

## 4. Dead Token References Fixed

| Token                                              | Usage sites                                                                 | Fix                                              | Status  |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ | ------- |
| --color-input-bg                                   | payments/page.tsx search input (transparent bg)                             | -> --color-field-bg                              | WORKING |
| --color-primary-50 / --color-primary-600           | floors/[id] icon tile, Select check icon (uncolored)                        | -> --color-brand-100 / --color-brand-600         | WORKING |
| --color-surface (bare)                             | floors/[id] hover state (no-op)                                             | -> --color-field-bg-hover                        | WORKING |
| --color-surface-0                                  | audit-logs modal surface (transparent)                                      | -> --color-card-bg                               | WORKING |
| --radix-select-trigger-width                       | Select popper min-width                                                     | NO CHANGE (live Radix-provided var, verified)    | WORKING |
| --token                                            | globals.css comment only                                                    | NO CHANGE (not a real reference)                 | WORKING |

## 5. Missing Custom Components (were missing, now built)

| Component         | File                       | Status  |
| ----------------- | -------------------------- | ------- |
| custom.css preset | themes/custom.css (teal base, light+dark, full coverage) | WORKING |

## 6. Appearance Tab UX Gaps Fixed

| Gap                                                              | Fix                                                                 | Status  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ------- |
| Preset/mode clicks applied only on Save (pick blind)             | Instant applyThemeToDOM on click; Save persists to server           | WORKING |
| Text-only preset cards                                           | Identity swatches + idiom shadow/radius sample per preset           | WORKING |
| Preview panel hand-rolled fake controls (drift risk)             | Real Button/Input/StatusBadge/StatCard rendered live                | WORKING |
| Brand input stale after async config load                        | useEffect resync on theme.brandColor                                | WORKING |
| Scale preview was opacity illusion                               | Real generateColorScale 11-step output                              | WORKING |
| Invalid hex applied to live DOM                                  | Hex validated before apply                                          | WORKING |

## 7. Buttons Inventory (theme scope)

| Location        | Buttons                                  | Status  |
| --------------- | ---------------------------------------- | ------- |
| Preset cards    | 5 preset selectors (aria-pressed)        | WORKING |
| Mode toggle     | Light / Dark (aria-pressed)              | WORKING |
| Preview panel   | Primary / Secondary (real components)    | WORKING |

## 8. SVG Inventory (theme scope)

| Location      | SVG              | Status        |
| ------------- | ---------------- | ------------- |
| AppearanceTab | lucide only (PaintBucket, Monitor, Moon, Sun, Check) | WORKING |
| Custom SVG    | none required    | NO CUSTOM SVG |

## 9. Scripted Layouts Inventory (theme scope)

| Layout                              | Location       | Status  |
| ----------------------------------- | -------------- | ------- |
| Preset grid + mode + brand + fonts + preview sections | AppearanceTab | WORKING |

## 10. Cross-Cutting Dependencies

| Concern       | Status                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| API           | no change (theme persists via existing app-config PUT)                 |
| DB            | no change (AppConfig.theme shape unchanged)                            |
| Flutter       | no change                                                              |
| Sidebar       | no change (consumes tokens only)                                       |
| Cascade order | globals @import order kept (custom.css last); data-theme specificity intact |

## 11. Out of Scope for This Pass

1. OKLCH migration (hex scales retained; perceptual uniformity deferred).
2. Per-preset font pairing redesign (presets keep existing fonts).
3. Landing page (/) theme polish (public surface, separate pass).

## 12. Pass 1 Fixes Applied

| Fix                                                                 | Files                                                        | Status  |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | ------- |
| Idiom-complete shadow/glass/spacing/transition/focus/collapsed tokens (light+dark) | themes/brutalist.css, neumorphic.css, soft-ui.css | WORKING |
| Brutalist dark repeated typography/layout/behavior (was SaaS-leaked) | themes/brutalist.css                                        | WORKING |
| Neumorphic/soft-ui light tooltip blocks; direct shadow-tooltip refs | themes/neumorphic.css, soft-ui.css                           | WORKING |
| Custom preset base (teal, light+dark) + import wiring               | themes/custom.css, app/globals.css                           | WORKING |
| Dead token refs replaced with semantic tokens                       | audit-logs/payments/floors pages, Select.tsx                 | WORKING |
| Instant-apply + swatches + real preview + stale-state + real scale  | components/admin/AppearanceTab.tsx                           | WORKING |
| Codebase index preset list                                          | .sixthrules + .claude mirrors                                | WORKING |

Verification: bun run lint clean; bun run typecheck clean across types/web/api; no tests executed; no emojis; portal boundaries respected.
