# 01 — Core Architecture

## Monorepo Structure

```
tenet_pg_management/
├── packages/types/          # Shared TypeScript types (API + admin web)
├── apps/api/                # Backend — Bun + Hono + Mongoose
│   └── src/
│       ├── index.ts         # Hono entry, CORS, route mounting
│       ├── lib/cors-origins.ts  # Multi-client CORS (admin + Flutter)
│       ├── models/ routes/ middleware/ services/ jobs/
├── apps/web/                # ADMIN ONLY — Next.js 16 + React 19 + Tailwind v4
│   └── src/app/(admin)/     # Admin CRUD surfaces
│   └── src/app/login/       # Admin login (rejects tenant/guardian)
├── mobile/                  # Flutter portals — tenant / guardian / visitor desk
│   └── lib/core/            # Dio, router, env (API_BASE_URL)
│   └── lib/features/        # auth, tenant, guardian, visitor
└── docs/
    ├── PORTAL_CONNECTIVITY.md  # Multi-client connectivity (agents MUST read)
    ├── audit/                  # Gap matrix
    └── specs/                  # Domain reference
```

**Portal rule:** Resident UIs are Flutter-only. Do not add `apps/web` tenant/guardian App Router trees.

See [docs/PORTAL_CONNECTIVITY.md](../PORTAL_CONNECTIVITY.md) for CORS, auth roles, and API base URLs.


## Auth Flow

### JWT Token System

- **Access token**: Short-lived (15 min), signed with HS256, contains `sub` (userId), `role`, `iat`, `exp`
- **Refresh token**: Longer-lived (24h), stored in memory + localStorage, used to obtain new access token silently
- **Token storage**: Zustand `authStore` with `persist` middleware → localStorage
- **Login**: `POST /auth/login` → validates email/password (bcrypt compare) → returns `accessToken` + `refreshToken` + `user` object
- **Refresh**: `POST /auth/refresh` → validates refresh token → issues new access + refresh token pair
- **Logout**: Clears localStorage, redirects to `/login`

### Middleware Chain

1. `requestId` — attaches UUID to every request
2. `cors` — multi-client allowlist via `lib/cors-origins.ts` (`FRONTEND_URL`, `PORTAL_URL`, localhost in dev)
3. `security` — security headers
4. `rateLimiter` — mutation rate limiting
5. `authGuard` — validates JWT from `Authorization: Bearer <token>` header, decodes payload, attaches `user` to Hono context
6. `adminOnly` / `tenantOnly` / feature flags — role and AppConfig gates
7. `errorHandler` — catches all errors, formats as `{ success: false, error: { code, message } }`

### Clients

| Client | Package | Roles |
|--------|---------|-------|
| Admin web | `apps/web` | admin |
| Flutter portal | `mobile/` | tenant, guardian (+ visitor desk for tenants) |

### Ky Wrapper (Frontend)

- `apps/web/src/lib/api.ts` — `ky.create()` instance
- `beforeRequest` hook: reads access token from localStorage `pg-auth-storage` → attaches `Authorization` header
- `afterResponse` hook: on 401 response → attempts silent refresh via `POST /auth/refresh` → retries original request with new token → on failure, clears storage and redirects to `/login`
- Request tracking: proxy wraps all HTTP methods → calls `useApiLoadingStore.incrementRequests()` / `decrementRequests()` for global loading state

## Design Token System

### Theming Architecture

4 theme presets defined in `apps/web/src/themes/`:

- **saas.css** — 97 CSS custom properties (light + dark), Linear/Vercel-inspired. **Primary theme.**
- **brutalist.css** — Bold outlines, flat colors, chunky typography
- **neumorphic.css** — Soft embossed/debossed shadows
- **soft-ui.css** — Pastel, minimal gradients

### SaaS Theme (saas.css)

#### Color Scales (6 semantic scales × 10 steps each)

| Scale               | Light               | Dark               | Usage                               |
| ------------------- | ------------------- | ------------------ | ----------------------------------- |
| `--color-brand-*`   | Indigo 50-950       | Indigo (inverted)  | Primary actions, links, focus rings |
| `--color-success-*` | Emerald 50-900      | Emerald (inverted) | Paid, operational, active           |
| `--color-warning-*` | Amber 50-900        | Amber (inverted)   | Pending, degraded, in_progress      |
| `--color-danger-*`  | Red 50-900          | Red (inverted)     | Overdue, open, critical, down       |
| `--color-info-*`    | Blue 50-900         | Blue (inverted)    | Info, sent, contacted               |
| `--color-neutral-*` | True gray 50-900    | Same               | Neutral, draft, muted states        |
| `--color-accent-*`  | Fuchsia 50-900      | Fuchsia (inverted) | Accent, highlights                  |
| `--color-surface-*` | Cool neutral 50-950 | True dark 50-950   | Cards, fields, backgrounds          |

#### Typography

- `--font-display`: Inter (headings)
- `--font-body`: Inter (body text)
- `--font-mono`: JetBrains Mono (tabular data, invoice numbers)
- Scale: xs(12px) → sm(13px) → base(15px) → lg(17px) → xl(20px) → 2xl(24px) → 3xl(30px) → 4xl(36px)

#### Radii

- `--radius-xs`: 4px, `--radius-sm`: 6px, `--radius-md`: 8px, `--radius-lg`: 12px, `--radius-xl`: 16px, `--radius-2xl`: 20px, `--radius-full`: 9999px

#### Shadows (8-level system)

- `--shadow-xs` through `--shadow-2xl`, plus semantic aliases: `--shadow-card`, `--shadow-card-hover`, `--shadow-button`, `--shadow-button-pressed`, `--shadow-dropdown`, `--shadow-modal`, `--shadow-tooltip`

#### Glass Morphism

- `--glass-bg`: `rgba(255,255,255,0.72)` (light), `rgba(24,24,27,0.72)` (dark)
- `--glass-blur`: `blur(16px)`
- Used in: AdminLayout top bar, checkout modal backdrop

#### Charts / Data-Viz

- `--chart-grid`, `--chart-axis`, `--chart-label`, `--chart-bar`, `--chart-track`, `--chart-tooltip-bg`
- `--chart-heatmap-0` through `--chart-heatmap-4` (solid color-mix ramp, no transparent overlays)
- Danger and success variants: `--chart-heatmap-danger-*`, `--chart-heatmap-success-*`

#### Interaction Tokens

- `--duration-press`: 80ms, `--duration-hover`: 120ms, `--duration-surface`: 200ms, `--duration-page`: 300ms
- `--hover-lift`: `translateY(-1px)`, `--active-press-scale`: 0.98
- `--focus-ring-color`: brand-500, `--focus-ring-width`: 2px

### StatusBadge + STATUS_COLOR_MAP

- `packages/types/src/tokens.ts` exports `STATUS_COLOR_MAP` — 100+ entries mapping every domain status string to one of 5 semantic variants: `'success' | 'warning' | 'danger' | 'info' | 'neutral'`
- `apps/web/src/components/ui/StatusBadge.tsx` renders pills with variant-specific colors using CSS variable references
- `statusToVariant()` helper resolves any status string through the map + legacy aliases

### globals.css @theme Bridge

- Uses `@theme { }` (NOT `@theme inline`) to declare Tailwind utility classes from CSS variables
- This allows the CSS cascade to re-theme all utilities when `data-theme` or `data-mode` attributes change
- Keyframes (`fade-in-up`, `shimmer`, `slide-in-left`, `slide-in-right`) use `@theme inline` since animations never change across themes

## UI Component Library (42 Components)

### Admin Shell (9)

| Component            | Purpose                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| Sidebar              | Collapsible nav with sections, pinned items, search, feature flags, mobile overlay |
| Breadcrumbs          | Auto-generated from URL path                                                       |
| CommandPalette       | Cmd+K modal — search pages, toggle theme, logout                                   |
| QuickCreate          | FAB button + Cmd+N modal → quick-create links for all entity types                 |
| DarkModeToggle       | Sun/moon toggle, syncs with theme context                                          |
| NotificationBell     | Dropdown with unread notifications, badge count                                    |
| EmergencyAlertButton | One-click emergency notification send                                              |
| GlobalLoadingBar     | Top-of-page 2px shimmer bar wired to useApiLoadingStore                            |
| AppProviders         | Next-themes ThemeProvider + React Query + Toaster wrapper                          |

### UI Primitives (33)

| Component              | Purpose                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Button                 | 6 variants (primary, secondary, outline, ghost, glass, danger), 4 sizes, loading state                                          |
| Input                  | Themed with leftIcon, error state, label, hint                                                                                  |
| Select                 | Native select themed, label support                                                                                             |
| SearchableSelect       | Searchable dropdown with async options                                                                                          |
| Textarea               | Themed textarea with label/error                                                                                                |
| Checkbox               | Themed checkbox with label/description                                                                                          |
| Switch                 | Radix toggle switch themed                                                                                                      |
| DataTable              | Full-featured: columns, sorting headers, pagination, loading skeleton, empty state, mobile card renderer, controlled pagination |
| PageHeader             | Title + description + action button, standardized across all list pages                                                         |
| PageShell              | Page-level wrapper with max-width                                                                                               |
| FormPage               | Detail/edit page wrapper — title, description, backHref, badge, actions, error, isLoading, maxWidth                             |
| FormCard               | Form wrapper with onSubmit, footer slot                                                                                         |
| FormSection            | Section within a form — title, description, icon, divided border                                                                |
| FormActions            | Submit/cancel button bar with loading state                                                                                     |
| FormGrid               | Responsive grid for form fields (cols: 1-4)                                                                                     |
| StatusBadge            | Semantic status pill — 5 variants, 100+ status mappings                                                                         |
| StatCard               | KPI card — value, icon, trend indicator, delta, color variant, onClick                                                          |
| Surface                | `<section>` wrapper with variant (card/nested/flat), padding control                                                            |
| ConfirmModal           | Delete confirmation with loading state                                                                                          |
| Toast                  | Sonner-based toast notifications                                                                                                |
| Skeleton               | Loading skeleton with variants (table, card, detail, dashboard)                                                                 |
| EmptyState             | Icon + title + description + action button                                                                                      |
| ErrorBanner            | Red banner with message                                                                                                         |
| ErrorState             | Full-page error with retry button                                                                                               |
| DetailCard             | Section on detail pages — title, icon, variant (default/warning/danger)                                                         |
| DetailList / DetailRow | Label-value pairs inside DetailCard                                                                                             |
| ResourceSelect         | Async searchable select for FK references (tenant, room, floor)                                                                 |
| DateRangePicker        | Date range selection                                                                                                            |
| DocumentUpload         | Drag-and-drop KYC upload (aadhaar, photo) with Cloudinary                                                                       |
| Timeline               | Vertical timeline for activity feeds                                                                                            |
| TableActions           | Standardized view/edit/delete icon buttons with stopPropagation                                                                 |
| ServiceStatusIndicator | Compact floor service health dots                                                                                               |
| FloorServiceGrid       | Per-floor service health grid with report-issue links                                                                           |
| TenantActivityTimeline | Tenant-specific activity feed                                                                                                   |

### Charts (10)

| Component       | Library    | Purpose                                                |
| --------------- | ---------- | ------------------------------------------------------ |
| LineChart       | Recharts   | Time-series trends (revenue, occupancy, meal feedback) |
| DonutChart      | Recharts   | Category breakdowns (complaints, payment progress)     |
| GaugeChart      | Recharts   | Radial gauges (service health, complaint resolution)   |
| StackedBarChart | Recharts   | Stacked bars (amenity health)                          |
| FunnelChart     | Recharts   | Funnel visualization (payment pipeline)                |
| HeatmapCalendar | Custom SVG | Activity heatmap (complaints by day)                   |
| Sparkline       | Custom SVG | Mini trend lines in stat cards                         |
| ThemeChart      | Wrapper    | Applies chart-theme.ts tokens to Recharts              |
| FunnelChart     | Custom SVG | Funnel stages with proportional widths                 |
| DonutChart      | Recharts   | Ring/arc charts with center label                      |

## API Loading Store

`apps/web/src/store/apiLoading.ts` (Zustand):

- `activeRequests` counter incremented/decremented by ky wrapper proxy
- After 3s of continuous loading → checks server health via `GET /health`
- If server unhealthy → `isServerWaking = true` (triggers cold-start overlay with health polling every 5s)
- `GlobalLoadingBar` component reads `isSlowLoading` and renders with 300ms debounce

## SSE (Server-Sent Events)

- `GET /api/v1/sse/admin?token=<jwt>` — persistent connection for real-time updates
- Event types: `payment_verified`, `complaint_updated`, `notification_received`, `service_status_changed`, `tenant_checked_out`
- Hook: `apps/web/src/hooks/useSSE.ts` — auto-reconnects on disconnect

## Layout System

### AdminLayout (`apps/web/src/app/(admin)/layout.tsx`)

- Uses `motion` for page transitions (`pageReveal` animation — fade in + slide up 16px, 400ms ease-out)
- Auth guard: redirects to `/login` if no access token, auto-refreshes user profile
- Global Cmd+K listener (meta/ctrl + K) toggles CommandPalette
- Renders: `<GlobalLoadingBar />` + `<Sidebar />` + main content with glass header + `<CommandPalette />` + `<QuickCreate />`

### Sidebar

- 6 navigation sections: Overview, Residents, Finance, Facilities, Engagement, System
- Feature flags filter items (laundryEnabled, messFeedbackEnabled, etc.) from AppConfig
- Pinned items: up to 4 starred items persist to localStorage
- Collapsible: toggles to 64px icon-only mode, persisted to localStorage
- Search: filters pages by label/href
- Section expand/collapse with `AnimatePresence` + `motion`
- Mobile: slide-in overlay with spring animation
