# Design System Modernization — SaaS, Neumorphic & Glass Themes

> **Status**: In Progress  
> **Last Updated**: 2026-07-08

---

## Phase 1: Surface Color Modernization (Parallel — 3 Sub-Agents)

### Agent 1: `saas-surface`
- [ ] Shift SaaS light surface scale 50-200 to cooler neutral (remove warm zinc undertone)
- [ ] Increase dark mode surface contrast (50/100/200 steps more distinct)
- [ ] Add missing interaction tokens to SaaS dark block (`--transition-duration`, `--transition-easing`, `--hover-lift`, `--active-press-scale`)
- [ ] Add `--shadow-tooltip` to SaaS dark (already in light)
- [ ] File: `apps/web/src/themes/saas.css`

### Agent 2: `neumorphic-surface`
- [ ] Shift Neumorphic light surface 50-100 from lavender-gray to cooler stone-gray
- [ ] Warm up Neumorphic dark base (50-200 warmer, more contrast)
- [ ] Fix dark mode shadow pairs (replace near-black #0a0b11 with visible dark-surface colors)
- [ ] Add missing `--shadow-input` token to dark mode (light has it)
- [ ] Add `--tooltip-*` tokens to dark
- [ ] File: `apps/web/src/themes/neumorphic.css`

### Agent 3: `glass-surface`
- [ ] Reduce glass opacity in light mode (more transparency = more glass effect)
- [ ] Add blue-tinted glass border in dark mode for luminous edge
- [ ] Increase dark surface contrast between 50/100/200 steps
- [ ] Add `--glass-bg-hover` to dark mode (light has it)
- [ ] File: `apps/web/src/themes/soft-ui.css`

---

## Phase 2: Component Interaction Audit (Agent 4)

- [ ] DataTable: Add lateral hover nudge, mobile card style tokens
- [ ] StatCard: Add border highlight on hover (currently no visual change on hover)
- [ ] Button: Verify hover/active transitions use correct durations per variant
- [ ] Input/Select: Add background hover state (currently only border changes)
- [ ] StatusBadge: Add subtle shadow for raised feel
- [ ] ConfirmModal: Gradient overlay fade instead of snap
- [ ] Toast: Verify glass compatibility in all themes
- [ ] File: Multiple files in `apps/web/src/components/ui/`

---

## Phase 3: Depth Layering System

- [ ] Add `--depth-*` tokens (level-0 through level-4) to globals.css
- [ ] Add interaction speed tokens (`--duration-press`, `--duration-hover`, `--duration-surface`, `--duration-page`) to globals.css
- [ ] Document depth layer mapping in all 3 theme CSS files

---

## Phase 4: Verification

- [ ] `bun run build` passes with zero errors
- [ ] Dev server renders all themes correctly in light + dark
- [ ] All components: DataTable, StatCard, Button, Input, Select, Toast, StatusBadge, ConfirmModal, Modals
- [ ] Charts render with correct theme colors
- [ ] Sidebar, header, page shell render with correct surfaces
