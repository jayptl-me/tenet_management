# Phase 10: Polish, Testing & Optimization

**Status:** ✅ COMPLETE
**Goal:** Production-quality polish across all platforms, state handling audit, responsive audit, accessibility, animation polish, performance optimization, unit tests, security audit, final production handoff. **Plus: Multi-Theme Design System integration testing.**
**Estimated:** Completed (linter, typecheck, format, and builds verified clean)
**Depends On:** Phase 9 (deployment verified), Multi-Theme Design System (THEMING_ARCHITECTURE.md implemented)
**Package Manager:** bun

---

## Pre-Polish: Multi-Theme Verification (from THEMING_ARCHITECTURE.md Phase E)

The multi-theme system must be verified before general polish:

- [ ] Visual regression: screenshot each page in all 4 themes (brutalist, neumorphic, soft-ui, saas)
- [ ] Responsive testing at all 4 breakpoints (sm/md/lg/xl) for each theme
- [ ] Dark mode variants for neumorphic + SaaS themes
- [ ] Performance: verify CSS-only cascade has zero runtime cost (no JS re-renders on theme switch)
- [ ] Cross-browser: Chrome, Firefox, Safari
- [ ] CSS specificity audit: ensure custom `data-theme` tokens aren't overridden by base styles
- [ ] `@theme` (non-inline) verification: confirm Tailwind emits `var(--color-brand-500)` not hex values in built CSS
- [ ] Theme persistence: verify theme setting is saved to AppConfig and restored on page reload
- [ ] Custom brand color palette generation: verify 11-step scale from a single hex input generates correct colors
- [ ] Font loading: confirm all 4 theme fonts load with `font-display: swap` and no FOUT
- [ ] Accessibility: verify all 4 themes maintain WCAG AA color contrast ratios

---

## Step 10.1: State Handling Audit

Every page/component must handle these 4 states:

| State       | UI                                           | Implementation                                                                                |
| ----------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Loading** | Skeleton shimmer matching component shape    | `isLoading` from TanStack Query → `<Skeleton>` or custom skeleton                             |
| **Empty**   | Illustration + descriptive text + CTA button | `data?.length === 0` → `<EmptyState icon={...} title="..." description="..." action={...} />` |
| **Error**   | Error message + retry button                 | `isError` → `<ErrorState message={error.message} onRetry={refetch} />`                        |
| **Success** | Normal data display                          | `data` → render component                                                                     |

### Audit checklist per page:

**Admin Pages:**

- [ ] Dashboard: empty state for fresh install (all KPIs = 0)
- [ ] Floors: "Add Your First Floor" empty state
- [ ] Rooms: "Add Your First Room" empty state
- [ ] Tenants: "Add Your First Tenant" empty state
- [ ] Payments: "No payments recorded yet"
- [ ] Invoices: "Generate Your First Invoice" CTA
- [ ] Complaints: empty kanban columns with "No complaints" placeholder
- [ ] Services: all operational (green across the board)
- [ ] Mess: "No feedback yet for this period"
- [ ] Notifications: "No notifications sent yet"
- [ ] Enquiries: "No enquiries received yet"

**Landing Page:**

- [ ] AppConfig API fails → show defaults, no broken layout
- [ ] No hero image → gradient placeholder
- [ ] No testimonials → hide section entirely

**Flutter:**

- [ ] All screens have shimmer loading states
- [ ] All lists have empty states
- [ ] Network errors show snackbar with retry

---

## Step 10.2: Responsive Audit

Test at these viewports:

- **375px** (iPhone SE) — smallest target
- **414px** (iPhone 11) — common mobile
- **768px** (iPad portrait) — tablet
- **1024px** (small laptop) — sidebar collapse point
- **1440px** (desktop) — full layout

Known fix points:

- [ ] DataTables: collapse to card view on `sm-` breakpoints
- [ ] Modals/Dialogs: full-screen on `sm-`, centered dialog on `md+`
- [ ] KPI cards: 1-col on mobile, 2-col on tablet, 4-col on desktop
- [ ] Room grid: 1-col on mobile, 2-4 col on larger
- [ ] Sidebar: hidden on mobile (hamburger), icon-only on tablet, full on desktop
- [ ] Forms: single column on mobile, two-column on desktop
- [ ] Hero section: stacked on mobile, side-by-side on desktop
- [ ] No horizontal overflow at any breakpoint

---

## Step 10.3: Accessibility

- [ ] Keyboard navigation: Tab through all interactive elements, Enter/Space activates, Escape closes modals
- [ ] Focus visible: `focus-visible:ring-2 ring-brand-500` on all focusable elements
- [ ] ARIA labels: sidebar nav items (aria-label), icon buttons (notification bell, user menu), modal titles (aria-labelledby)
- [ ] Color contrast: text on badges meets WCAG AA (4.5:1 normal, 3:1 large)
  - StatusBadge colors verified
  - PriorityBadge colors verified
  - Button text on brand-500 background verified
- [ ] Screen reader: form labels properly associated (`htmlFor`/`id`), error messages linked via `aria-describedby`, page titles announced on route change
- [ ] Skip to content link (optional, adds `.sr-only` focusable link at top)
- [ ] `prefers-reduced-motion`: all Motion animations disabled, instant transitions

---

## Step 10.4: Animation Polish

- [ ] `prefers-reduced-motion` respected:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] Motion variants check `window.matchMedia('(prefers-reduced-motion: reduce)')` → return instant/no animation
- [ ] No layout shift during page transitions (stable dimensions, skeleton matching final layout)
- [ ] Chart animations: only on first render, not on every data refetch (use `useRef` flag)
- [ ] Kanban drag: smooth drop animation, optimistic UI update, rollback on API failure

---

## Step 10.5: Performance Optimization

### Frontend

- [ ] Next.js Image: proper `sizes` attribute, lazy loading for below-fold images (`loading="lazy"`)
- [ ] Code splitting: dynamic imports for heavy components:

```typescript
const RevenueChart = dynamic(() => import('@/components/admin/RevenueChart'), { ssr: false });
const ComplaintKanban = dynamic(() => import('@/components/admin/ComplaintKanban'), { ssr: false });
```

- [ ] TanStack Query: appropriate `staleTime` per resource:
  - Dashboard stats: 60s
  - Payments (active month): 30s
  - Floors/Rooms: 5min
  - Settings/AppConfig: 5min
  - Complaints: 30s
- [ ] Bundle size: `bun run build --filter=@pg/web`, check `out/` sizes. No single JS chunk > 200KB (excluding framework)

### Backend

- [ ] MongoDB indexes: verify all frequently queried fields have indexes (Phase 2 already defined them)
- [ ] Aggregation pipeline: dashboard stats use single DB round-trip
- [ ] Response compression: Hono `compress()` middleware for JSON responses > 1KB

```typescript
import { compress } from 'hono/compress';
app.use('*', compress());
```

- [ ] Invoice PDF: optional 1-hour cache for same invoice (since data rarely changes). Cache key: `invoice-{id}-{updatedAt}`
- [ ] Database connection pooling: Mongoose default pool size 5 is sufficient for Render free tier

---

## Step 10.6: Unit Tests

### Backend (Vitest)

Critical service tests:

```typescript
// apps/api/src/services/__tests__/invoice.service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Invoice Service', () => {
  it('should generate invoices for all active tenants', async () => {
    // Setup: create test floor, room, tenants
    // Act: generateMonthlyInvoices('2026-07')
    // Assert: correct number of invoices created, payments created
  });

  it('should skip tenants with existing invoices', async () => {
    // Setup: pre-create invoice for tenant A
    // Act: generateMonthlyInvoices('2026-07')
    // Assert: tenant A skipped, tenant B generated
  });

  it('should calculate electricity share correctly', async () => {
    // Setup: room with 2 tenants, electricity bill distributed
    // Assert: each tenant gets 50% of room amount
  });
});

// apps/api/src/services/__tests__/notification.service.test.ts
describe('Notification Service', () => {
  it('should resolve topics for targetType "all"', async () => {});
  it('should resolve topics for targetType "room"', async () => {});
  it('should mark notification as read for a user', async () => {});
  it('should not duplicate readBy entries', async () => {});
});

// apps/api/src/lib/__tests__/jwt.test.ts
describe('JWT Utils', () => {
  it('should generate and verify access token', async () => {});
  it('should reject expired token', async () => {});
  it('should detect wrong token type', async () => {});
  it('should rotate refresh tokens correctly', async () => {});
});
```

### Run tests:

```bash
bun run test          # All tests
bun run test:watch    # Watch mode
```

### Vitest config (`apps/api/vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

---

## Step 10.7: Security Audit

- [ ] Run `bun audit` (or equivalent) — fix any high/critical vulnerabilities
- [ ] Verify no secrets in client bundle:
  ```bash
  grep -r "NEXT_PUBLIC" apps/web/src/ | grep -v "API_URL"
  # Should only show NEXT_PUBLIC_API_URL
  ```
- [ ] Test rate limiting:
  ```bash
  for i in {1..10}; do curl -X POST https://api-url/auth/login -d '{}' -s -o /dev/null -w "%{http_code} "; done
  # Should show 200s then 429
  ```
- [ ] Test role middleware:
  - Tenant token → admin routes → 403
  - No token → protected routes → 401
  - Admin token → tenant self-routes → allowed
- [ ] Test input validation:
  - Send malformed JSON → 400 with Zod error details
  - Send SQL injection strings → sanitized, not executed
  - Send XSS payloads → React escaping, not rendered
  - Overly long strings → Zod maxLength rejection

---

## Step 10.8: Final Production Handoff Checklist

- [ ] All env vars documented in `.env.example` files
- [ ] Admin seed user created, credentials shared with PG owner
- [ ] PG owner's UPI ID configured in settings
- [ ] Landing page content: hero headline, amenities, pricing, testimonials, address, map — all reviewed and accurate
- [ ] Logo and hero image uploaded to Cloudinary, URLs set in settings
- [ ] Test tenant account created for demo
- [ ] Flutter APK built and shared with test tenants
- [ ] MongoDB Atlas: daily backups confirmed active
- [ ] Render: both services running, no crashes in logs for 24h
- [ ] Custom domain configured (if purchased)
- [ ] README reviewed for accuracy
- [ ] All 10 phase files reviewed and complete
- [ ] `bun run build` succeeds with zero errors
- [ ] `bun run typecheck` passes with zero errors
- [ ] `bun run lint` passes with zero warnings
- [ ] `bun run test` passes with all tests green

---

## Summary: Total Effort

| Phase                  | Days           |
| ---------------------- | -------------- |
| 0: Foundation          | 2-3            |
| 1: Authentication      | 3-4            |
| 2: Models & Seed       | 2-3            |
| 3: Core API            | 4-5            |
| 4: Payments & Invoices | 5-6            |
| 5: Notifications       | 3-4            |
| 6: Admin UI            | 8-10           |
| 7: Landing Page        | 3-4            |
| 8: Flutter App         | 7-9            |
| 9: Deployment          | 2-3            |
| 10: Polish & Testing   | 3-5            |
| **Total**              | **42-56 days** |

---

## Key Edge Cases — Master Summary

| Area          | Edge Case                          | Resolution                                              |
| ------------- | ---------------------------------- | ------------------------------------------------------- |
| Auth          | Token expired during request       | ky/Dio interceptor: refresh queue, retry                |
| Auth          | Multiple tabs logout sync          | Next API call fails, redirects to login                 |
| Auth          | Server restart clears tokens       | Force re-login (acceptable — ephemeral tokens)          |
| Payments      | Duplicate UTR                      | Unique sparse index → 409                               |
| Payments      | Invoice PDF for deleted tenant     | Renders with available data                             |
| Payments      | QR for zero-amount invoice         | Still generates (for receipts)                          |
| Invoices      | Race condition on counter          | Atomic `$inc` on Counter collection                     |
| Electricity   | Bill distributed before finalized  | Route checks status, returns 400                        |
| Notifications | ntfy.sh down                       | In-app notification still stored; push fails gracefully |
| Notifications | User deleted, notification remains | `readBy` still valid, just won't grow                   |
| SSE           | Render 5-min timeout               | Heartbeat every 30s                                     |
| UI            | Very long names in table           | Truncation + tooltip                                    |
| UI            | Mobile tables                      | Card view alternative                                   |
| SEO           | AppConfig API down at build        | Default config used, page still renders                 |
| Flutter       | UPI app not installed              | Alert with install suggestion                           |
| Flutter       | Camera permission denied           | Gallery-only fallback                                   |
