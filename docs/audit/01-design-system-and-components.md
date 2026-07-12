# Design System and Component Quality

**Updated:** 2026-07-12  
**Priority theme:** **`saas`** (default). Also supports brutalist, neumorphic, soft-ui, custom via Appearance settings.

---

## Defaults

| Item | Value |
|------|--------|
| Default preset | `saas` |
| Default mode | `light` |
| Bootstrap | `apps/web/src/app/layout.tsx` `data-theme="saas"` |
| Provider | `apps/web/src/themes/ThemeProvider.tsx` |
| Field fragments | `apps/web/src/lib/field-styles.ts` |
| Brand scale | `apps/web/src/lib/colorScale.ts` |

All design systems resolve through **CSS variables** (`--color-text-primary`, `--color-card-bg`, `--border-color`, brand steps, success/danger/warning).

---

## Token compliance

### Admin domain pages

- Prefer `text-[color:var(--color-text-primary)]`, `bg-[color:var(--color-card-bg)]`, etc.
- Grep 2026-07-12: **zero** `text-gray-*` / `bg-slate-*` / raw `bg-white` under `apps/web/src/app/(admin)/`.

### Known residual hardcodes (fix when touched)

| Area | Issue | Fix |
|------|-------|-----|
| `reset-password/page.tsx` | May still use green/red Tailwind | success/danger tokens |
| Tenant checkout overlay | `bg-black/40` ad-hoc | ConfirmModal / DuesCheckoutDialog |
| Flutter portal | `Colors.black54`, fixed red banners | Theme extension / ColorScheme |

---

## Shared controls status

| Component | Status | Notes |
|-----------|--------|-------|
| Input / Textarea / Checkbox / Switch | OK | field-styles |
| **Select** | **OK** | Radix themed + hidden native for RHF |
| **ResourceSelect** | **OK** | wraps SearchableSelect |
| SearchableSelect | OK | gold standard listbox |
| DataTable | OK | ensure page-size uses themed Select |
| StatusBadge + statusToVariant | OK | all statuses should map |
| FormPage / FormCard / FormSection / FormActions | OK | required on new/edit |
| PageHeader + TableActions + mobileCardRenderer | OK | list standard |
| ConfirmModal | OK | prefer over ad-hoc overlays |
| DetailCard / EmptyState / ErrorBanner | OK | |

### Still weak / inconsistent

| Area | Gap |
|------|-----|
| Payments list | missing mobileCardRenderer |
| Notifications | custom history; not DataTable |
| Meals edit rating | raw number input; stars non-interactive |
| Menus item rows | raw inputs not shared Input |
| Visitors filter | wrong enum options (data bug, not chrome) |
| Settings | monolith tabs not FormPage-shaped |
| AppearanceTab | verify selects are themed (not native) |

---

## Agent rules (enforce on every UI PR)

1. **No new** hardcoded palette utilities (`gray-900`, `blue-500`, etc.).
2. **No new** native `<select>` for domain fields -- use Select / SearchableSelect / ResourceSelect.
3. Status always via `StatusBadge` + `statusToVariant`.
4. Forms always FormPage stack.
5. Lists always PageHeader + DataTable + TableActions; add mobileCardRenderer.
6. Prefer composing existing ui/ components; extract reusable domain bars when copy-pasting lifecycle buttons.
7. Admin only under `apps/web`; residents under `mobile/`.
8. Default visual target for screenshots / polish: **saas + light**, then verify dark mode.

---

## Custom SaaS components backlog

Build once under `apps/web/src/components/ui/` unless domain-specific.

| Component | Priority | Consumers | Spec |
|-----------|----------|-----------|------|
| **TempCredentialsDialog** | P0 | Tenant/guardian create | Show password once, copy button, confirm understood |
| **OccupancyBedPicker** | P0 | Tenant new/edit | Load room beds; disable occupied; keep current |
| **TenantStatusControl** | P0 | Tenant detail | Checkout + Reinstate only |
| **DuesCheckoutDialog** | P1 | Tenant detail | Dues fetch + disable confirm when blocked + API codes |
| **VisitorLifecycleActions** | P1 | Visitors detail/list | expected->arrive, arrived->depart, cancelled->re-approve, cancel |
| **StatusFilterSelect** | P0 | Visitors then all lists | Options from closed enum array only |
| **FeedbackSummaryStrip** | P1 | Meals list | KPI cards from summary API |
| **StarRating** | P1 | Meals, settings testimonials pattern | Interactive or readonly prop |
| **CategoryChipSelect** | P1 | Meals FE + Flutter mirror | fixed enum chips |
| **WeekMenuPlanner** | P2 | Menus | 7-day grid |
| **MenuMealItemsEditor** | P2 | Menus new/edit | shared B/L/D rows with Input |
| **PendingVerificationQueue** | P1 | Payments | filter pending_verification |
| **LowStockBanner** | P2 | Assets | low-stock endpoint |
| **TodayAttendanceBoard** | P2 | Attendance | today endpoint |
| **NotificationHistoryTable** | P1 | Notifications | DataTable parity |
| **PortalProfileHeader** | P1 | Flutter | room/rent/status |

---

## Gold-standard patterns (copy these)

- List: `tenants/page.tsx`, `complaints/page.tsx` (kanban extra)
- Form: `tenants/new/page.tsx`, `guardians/new` (temp password pattern for credentials)
- Detail hub: `tenants/[id]/page.tsx`
- Lifecycle detail: `visitors/[id]/page.tsx`, `leaves/[id]/page.tsx`, `electricity/[id]/page.tsx`
- Select: `components/ui/Select.tsx`
- Resource: `components/ui/ResourceSelect.tsx`

---

## Acceptance for design pass

- [ ] Zero new native domain selects
- [ ] Zero new gray/slate hardcodes on admin pages
- [ ] Visual check **saas** light + dark for any new component
- [ ] mobileCardRenderer on every new list
- [ ] Shared lifecycle/status filters used where enums exist
- [ ] Flutter changes do not invent a second admin-like Next tree
