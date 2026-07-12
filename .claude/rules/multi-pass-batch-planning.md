# multi-pass-batch-planning.md

> Task decomposition guidelines for complex feature additions.

Complex tasks that cross multiple package boundaries (e.g. types, API, and web) must be broken down into structured passes. Each pass must yield a compile-safe state before moving to the next.

## Pass-Based Execution Model

For full-stack features, choose the client surface first (see docs/AGENT_CONTEXT.md):

- **Admin features** -> Types, DB, API, then `apps/web` only.
- **Resident features** -> Types (if shared), DB, API, then `mobile/` Flutter only (Web + iOS + Android). Never resident UI in Next.js.

```
   +---------------------------------------+
   |            PASS 1: Types              |  <-- packages/types when API+admin share contracts
   +---------------------------------------+
                       |
                       v
   +---------------------------------------+
   |           PASS 2: Database            |  <-- apps/api/src/models
   +---------------------------------------+
                       |
                       v
   +---------------------------------------+
   |             PASS 3: API               |  <-- Hono routes and services
   +---------------------------------------+
                       |
          +------------+------------+
          v                         v
   +------------------+    +------------------+
   | PASS 4a: Admin   |    | PASS 4b: Flutter |
   | apps/web         |    | mobile/          |
   | (admin only)     |    | Web+iOS+Android  |
   +------------------+    +------------------+
          |                         |
          +------------+------------+
                       v
   +---------------------------------------+
   |         PASS 5: Verification          |  <-- typecheck/lint; flutter analyze; smoke
   +---------------------------------------+
```

### Pass Sizing

- Keep each pass focused on a single logical domain.
- Limit changes to a manageable number of files (typically fewer than 8).
- Ensure each pass compiles and passes `bun run typecheck` before starting the next.

## Batch Strategies

- **Sequential Batches:** Used for core dependencies (e.g. Types must always be defined and verified before the database schema can use them).
- **Parallel Batches:** Used for independent features (e.g. creating two frontend page forms that call different endpoints can be done in parallel or delegated to sub-agents).

## Example Decomposition (Actual Tech Stack)

Task: "Add a Room Booking Feature with Laundry Slot reservation."

### Pass 1: Shared Types

- Create `packages/types/src/booking.ts`.
- Export from `packages/types/src/index.ts`.
- Verify: Run `bun --filter '@pg/types' typecheck`.

### Pass 2: Database Models

- Create `apps/api/src/models/booking.ts` and import types from `@pg/types`.
- Reference inside `apps/api/src/models/index.ts`.
- Verify: Run `bun --filter '@pg/api' typecheck`.

### Pass 3: API Logic

- Create Hono routes `apps/api/src/routes/bookings.ts`.
- Register route in server entry point `apps/api/src/index.ts`.
- Write unit tests in `apps/api/src/__tests__/bookings.test.ts`.
- Verify: Run `bun run test` (Vitest).

### Pass 4: Frontend Logic

- Create hooks in `apps/web/src/hooks/useBookings.ts`.
- Create components in `apps/web/src/components/bookings/`.
- Verify: Run `bun --filter '@pg/web' typecheck`.

### Pass 5: Integration

- Build layout/page `apps/web/src/app/bookings/page.tsx` and wire forms.
- Add page to navigation dashboard.
- Verify: Run `bun run dev` and test in browser.

### Pass 6: Final Verification

- Run `bun run build`.
- Run E2E tests `bun run test:e2e` (Playwright).

## Re-Plan Triggers

Stop and revise the plan under these conditions:

1. A new dependency is discovered during Phase 3 that requires modifying packages/types.
2. The current design violates package encapsulation rules.
3. Verification fails 3 consecutive times in a single pass.
4. The user updates the feature scope.

## Emergency Brake Conditions

Immediately halt work and query the user if:

- A major structural conflict is discovered (e.g. database schema change breaks existing models and requires data migration that wasn't planned).
- A severe security vulnerability is detected in a required package.
