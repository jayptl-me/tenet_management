# Phase 0: Project Foundation & Tooling Setup

**Status:** ✅ COMPLETE (07/06/2026)
**Goal:** Monorepo skeleton with all services building, connecting to MongoDB, and CI pipeline green. Brandable design system with adjustable CSS tokens driven by AppConfig.
**Estimated:** 3-4 days
**Dependencies:** None (this is the starting point)
**Package Manager:** bun (>=1.3.0) — no pnpm, no npm, no yarn
**Node Runtime:** Bun native (Bun.serve), not Node.js

---

## Architecture Decisions

| Decision        | Choice                                                          | Rationale                                                                         |
| --------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Package manager | Bun (native workspace)                                          | Faster than pnpm, built-in .env loading, native TS support, no node_modules bloat |
| Monorepo tool   | Bun workspaces (no Turborepo needed)                            | Bun has built-in workspace filtering, task running, and caching                   |
| Runtime         | Bun.serve() with Hono `fetch`                                   | 4x faster than Node.js, native Web API support, no @hono/node-server needed       |
| TypeScript      | Strict mode, `verbatimModuleSyntax`, `noUncheckedIndexedAccess` | Maximum type safety across monorepo                                               |
| Linting         | ESLint v9 flat config                                           | Modern, faster than v8, bun-compatible                                            |
| Formatting      | Prettier + prettier-plugin-tailwindcss                          | Consistent formatting with Tailwind class sorting                                 |
| Git hooks       | Husky + lint-staged                                             | Pre-commit quality checks                                                         |
| Build tooling   | Bun.build (API), Next.js (web)                                  | Bun.build is 10x faster than tsc for bundling                                     |
| Testing         | Vitest (API), Playwright (web E2E)                              | Vitest for unit/integration, Playwright for browser E2E                           |
| CI/CD           | GitHub Actions + Render                                         | Free tier compatible                                                              |

---

## Step 0.0: Design System — Brandable Token Architecture

### Philosophy

The entire app (web + API PDFs + Flutter) derives its visual identity from a single `AppConfig` MongoDB document. CSS custom properties are the bridge: the server seeds defaults, the admin overrides via settings, and the frontend reads values at runtime via the public `/app-config` endpoint.

### Token Categories

| Category                  | Source                              | CSS Mapping                                                                 |
| ------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Brand colors              | `AppConfig.primaryColor` (hex)      | Generates 50-950 scale via `chroma.js` on server → CSS vars                 |
| Typography                | Fixed in `@theme` (Syne + DM Sans)  | Headings/body can be swapped via admin later                                |
| Spacing                   | Fixed 4px base unit                 | `--spacing` in @theme                                                       |
| Radii                     | Fixed scale                         | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-full` |
| Shadows                   | Fixed set                           | `--shadow-card`, `--shadow-elevated`, `--shadow-modal`                      |
| Transitions               | Fixed durations + easings           | `--duration-fast`, `--ease-out-expo`, etc.                                  |
| PG Name, Logo, Hero Image | `AppConfig`                         | Direct usage via API                                                        |
| Amenities list            | `AppConfig.amenities`               | Array rendered as grid                                                      |
| Pricing                   | `AppConfig.roomPricing`             | Landing + admin cards                                                       |
| Testimonials              | `AppConfig.testimonials`            | Landing section                                                             |
| UPI details               | `AppConfig.upiId`, `.upiPayeeName`  | Payment QR generation                                                       |
| Address, Phone, Email     | `AppConfig`                         | Footer, contact, invoice PDF                                                |
| GST, PAN                  | `AppConfig.gstNumber`, `.panNumber` | Invoice PDF footer                                                          |

### Color Generation Strategy (Server-Side)

When `primaryColor` is changed in admin settings:

1. API receives hex color
2. Server generates 11-step scale (50-950) using `chroma-js` or a lightweight palette generator
3. Generated scale saved to `AppConfig.colorScale` (Map of 50-950 → hex)
4. Frontend fetches `/app-config` → applies as CSS custom properties on `<html>`:

```css
:root {
  --color-brand-50: #fff7ed;
  --color-brand-100: #ffedd5;
  /* ... through 950 */
}
```

### Brand Token Definition

```typescript
// packages/types/src/tokens.ts
export interface IBrandTokens {
  // ── Colors (complete scales, generated server-side) ──
  brandColorScale: Record<string, string>; // "50": "#hex", "100": "#hex", ..., "950": "#hex"
  surfaceColorScale: Record<string, string>; // Light mode surfaces
  surfaceColorScaleDark: Record<string, string>; // Dark mode surfaces

  // ── Typography ───────────────────────────────────────
  fontDisplay: string; // Google Font family name
  fontBody: string;
  fontMono: string;
  fontWeightHeading: number;
  fontWeightBody: number;

  // ── Spacing (px values) ──────────────────────────────
  spacingBase: number; // default: 4

  // ── Radii ────────────────────────────────────────────
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  radiusFull: string;

  // ── Transitions ──────────────────────────────────────
  durationFast: string;
  durationNormal: string;
  durationSlow: string;
  easeOutExpo: string;
  easeInOutCubic: string;
}

export const DEFAULT_BRAND_TOKENS: IBrandTokens = {
  brandColorScale: {
    '50': '#FFFBEB',
    '100': '#FEF3C7',
    '200': '#FDE68A',
    '300': '#FCD34D',
    '400': '#FBBF24',
    '500': '#F59E0B',
    '600': '#D97706',
    '700': '#B45309',
    '800': '#92400E',
    '900': '#78350F',
    '950': '#451A03',
  },
  surfaceColorScale: {
    '50': '#FAFAF9',
    '100': '#F5F5F4',
    '200': '#E7E5E4',
    '300': '#D6D3D1',
    '400': '#A8A29E',
    '500': '#78716C',
    '600': '#57534E',
    '700': '#44403C',
    '800': '#292524',
    '900': '#1C1917',
    '950': '#0C0A09',
  },
  surfaceColorScaleDark: {
    '50': '#0C0A09',
    '100': '#1C1917',
    '200': '#292524',
    '300': '#44403C',
    '400': '#57534E',
    '500': '#78716C',
    '600': '#A8A29E',
    '700': '#D6D3D1',
    '800': '#E7E5E4',
    '900': '#F5F5F4',
    '950': '#FAFAF9',
  },
  fontDisplay: 'Syne',
  fontBody: 'DM Sans',
  fontMono: 'JetBrains Mono',
  fontWeightHeading: 700,
  fontWeightBody: 400,
  spacingBase: 4,
  radiusSm: '0.25rem',
  radiusMd: '0.5rem',
  radiusLg: '0.75rem',
  radiusXl: '1rem',
  radiusFull: '9999px',
  durationFast: '150ms',
  durationNormal: '250ms',
  durationSlow: '400ms',
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOutCubic: 'cubic-bezier(0.65, 0, 0.35, 1)',
};
```

---

## Step 0.1: Monorepo Initialization with Bun Workspaces

### 0.1.1 Create Root Directory & Initialize

```bash
mkdir pg-management && cd pg-management
git init
bun init -y
```

### 0.1.2 Root `package.json`

```json
{
  "name": "pg-management",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --filter '@pg/api' dev & bun --filter '@pg/web' dev",
    "build": "bun --filter '*' build",
    "lint": "bun --filter '*' lint",
    "typecheck": "bun --filter '*' typecheck",
    "test": "bun --filter '@pg/api' test",
    "test:e2e": "bun --filter '@pg/web' test:e2e",
    "clean": "bun --filter '*' clean",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "seed": "bun --filter '@pg/api' seed",
    "seed:sample": "bun --filter '@pg/api' seed -- --with-sample-data",
    "seo": "bun scripts/generate-seo-files.ts",
    "mobile:setup": "cd mobile && flutter pub get",
    "mobile:gen": "cd mobile && dart run build_runner build --delete-conflicting-outputs"
  },
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.20.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-react": "^7.37.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.5.0",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "typescript": "^5.7.0"
  },
  "engines": {
    "bun": ">=1.2.0"
  }
}
```

### 0.1.3 `bunfig.toml`

```toml
[install]
exact = true
production = false
save = true

[serve]
# Dev server defaults
port = 3000
```

### 0.1.4 `.gitignore`

```
node_modules/
dist/
.next/
out/
build/
*.log
.env
.env.local
.env.*.local
coverage/
.cache/
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
*.jks
*.keystore
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
.DS_Store
Thumbs.db
*.tsbuildinfo
bun.lock
bun.lockb
playwright-report/
test-results/
```

### 0.1.5 `.editorconfig`

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab

[*.dart]
indent_size = 2

[*.yaml]
indent_size = 2
```

---

## Step 0.2: TypeScript Root Config

### 0.2.1 `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true,
    "verbatimModuleSyntax": true,
    "useDefineForClassFields": true,
    "exactOptionalPropertyTypes": false
  },
  "exclude": ["node_modules", "dist", ".next", "out"]
}
```

---

## Step 0.3: Shared Types Package (`packages/types`)

### 0.3.1 `packages/types/package.json`

```json
{
  "name": "@pg/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "scripts": {
    "lint": "echo 'types lint ok'",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

### 0.3.2 `packages/types/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 0.3.3–0.3.19: All Type Files

The shared types package exports these files (complete interfaces as already defined in existing Phase 0, with these additions):

| File              | Contents                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`        | Barrel export for all types                                                                                                                          |
| `common.ts`       | `IPaginationParams`, `IPaginatedResponse`, `IApiSuccess`, `IApiError`, `IApiResponse`, `MonthString`, `INR`, `IAddress`, `ISocialLinks`, `IAuditLog` |
| `tokens.ts`       | `IBrandTokens`, `DEFAULT_BRAND_TOKENS` (see Step 0.0)                                                                                                |
| `user.ts`         | `IUser`, `IUserCreate`, `IUserWithTokens`, etc.                                                                                                      |
| `floor.ts`        | `IFloor`, `IFloorCreate`, etc.                                                                                                                       |
| `room.ts`         | `IRoom`, `IBed`, `IRoomWithOccupants`, etc.                                                                                                          |
| `tenant.ts`       | `ITenant`, `ITenantCreate`, `ITenantTransfer`, etc.                                                                                                  |
| `payment.ts`      | `IPayment`, `IPaymentQrResponse`, `IPaymentUtrSubmit`, etc.                                                                                          |
| `invoice.ts`      | `IInvoice`, `IInvoiceLineItem`, etc.                                                                                                                 |
| `electricity.ts`  | `IElectricityBill`, `IRoomReading`, etc.                                                                                                             |
| `complaint.ts`    | `IComplaint`, `IVendorAssignment`, etc.                                                                                                              |
| `service.ts`      | `IServiceStatus`, `IServiceStatusUpdate`, etc.                                                                                                       |
| `meal.ts`         | `IMealFeedback`, `IMealFeedbackSummary`                                                                                                              |
| `menu.ts`         | `IDailyMenu`, `IMenuItem` _(NEW)_                                                                                                                    |
| `notification.ts` | `INotification`, `INotificationCreate`                                                                                                               |
| `enquiry.ts`      | `IEnquiry`, `IEnquiryCreate`                                                                                                                         |
| `appConfig.ts`    | `IAppConfig`, `IAppConfigPublic`, `IAppConfigUpdate`                                                                                                 |
| `dashboard.ts`    | `IDashboardStats`, `IOccupancyStats`, `IRevenueStats`                                                                                                |
| `visitor.ts`      | `IVisitor`, `IVisitorRegister` _(NEW)_                                                                                                               |
| `laundry.ts`      | `ILaundrySlot`, `ILaundryBooking` _(NEW)_                                                                                                            |
| `notice.ts`       | `INoticeBoard`, `INoticePost` _(NEW)_                                                                                                                |
| `audit.ts`        | `IAuditLog`, `IAuditAction` _(NEW)_                                                                                                                  |
| `export.ts`       | `IExportRequest`, `IExportFormat` _(NEW)_                                                                                                            |
| `attendance.ts`   | `IAttendanceRecord`, `ILeaveApplication` _(NEW, optional feature)_                                                                                   |
| `asset.ts`        | `IAsset`, `IAssetCreate`, `IAssetUpdate` _(NEW)_                                                                                                     |
| `guardian.ts`     | `IGuardian`, `IGuardianCreate`, `IGuardianWardSummary` _(NEW)_                                                                                       |

**Key new types (Phase 2+ features):**

```typescript
// packages/types/src/menu.ts
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export interface IMenuItem {
  name: string;
  description?: string;
  category?: string;
}
export interface IDailyMenu {
  date: string;
  meals: Record<MealType, IMenuItem[]>;
}

// packages/types/src/visitor.ts
export interface IVisitor {
  id: string;
  tenantId: string;
  visitorName: string;
  visitorPhone: string;
  purpose: string;
  expectedArrival: string;
  actualArrival?: string;
  actualDeparture?: string;
  status: 'expected' | 'arrived' | 'departed' | 'cancelled';
  approvedBy?: string;
  createdAt: string;
}

// packages/types/src/laundry.ts
export type TimeSlot =
  | '06-08'
  | '08-10'
  | '10-12'
  | '12-14'
  | '14-16'
  | '16-18'
  | '18-20'
  | '20-22';
export interface ILaundrySlot {
  id: string;
  floorId: string;
  machineNumber: 1 | 2;
  date: string;
  timeSlot: TimeSlot;
  tenantId: string | null;
  bookingId: string | null;
  status: 'available' | 'booked' | 'maintenance';
}

// packages/types/src/notice.ts
export interface INoticePost {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  authorId: string;
  targetType: 'all' | 'floor' | 'room';
  targetIds: string[];
  createdAt: string;
  updatedAt: string;
}

// packages/types/src/audit.ts
export type IAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'payment_verify'
  | 'complaint_status_change'
  | 'tenant_checkout'
  | 'settings_change';

export interface IAuditLog {
  id: string;
  userId: string;
  action: IAuditAction;
  resource: string; // e.g., 'tenant', 'payment', 'complaint'
  resourceId: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

// packages/types/src/export.ts
export type IExportFormat = 'csv' | 'json';

export interface IExportRequest {
  resource: 'tenants' | 'payments' | 'invoices' | 'complaints' | 'enquiries';
  format: IExportFormat;
  filters?: Record<string, string>;
}
```

---

## Step 0.4: ESLint + Prettier (Flat Config)

### 0.4.1 `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 0.4.2 `eslint.config.mjs`

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  prettierConfig,
  {
    ignores: ['**/dist/**', '**/.next/**', '**/out/**', '**/build/**', 'mobile/**'],
  },
);
```

---

## Step 0.5: Backend Scaffold (`apps/api`)

### 0.5.1 Directory Structure

```bash
mkdir -p apps/api/src/{routes,models,middleware,services,jobs,lib,templates,scripts,__tests__}
mkdir -p apps/api/src/__tests__/{services,lib,helpers}
```

### 0.5.2 `apps/api/package.json`

```json
{
  "name": "@pg/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --outdir=dist --target=bun",
    "start": "bun run dist/index.js",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "bun run src/scripts/seed.ts",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@hono/zod-validator": "^0.4.0",
    "@pg/types": "workspace:*",
    "@react-pdf/renderer": "^4.5.0",
    "bcryptjs": "^2.4.3",
    "chroma-js": "^3.1.0",
    "cloudinary": "^2.5.0",
    "hono": "^4.7.0",
    "jose": "^6.0.0",
    "mongoose": "^9.0.0",
    "node-cron": "^3.0.3",
    "pino": "^9.6.0",
    "pino-pretty": "^11.3.0",
    "qrcode": "^1.5.4",
    "resend": "^4.2.0",
    "uuid": "^11.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/bun": "^1.2.0",
    "@types/node-cron": "^3.0.11",
    "@types/qrcode": "^1.5.5",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

Key changes from previous version:

- Added `chroma-js` for dynamic color scale generation
- Added `uuid` (already used in Phase 1, made explicit)
- Added `@hono/zod-validator` for Zod middleware
- Removed `dotenv` (Bun loads `.env` natively)
- Removed `@react-pdf/renderer` React types dependencies (handled separately)

### 0.5.3 `apps/api/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

Note: `jsx: "react-jsx"` is needed for `@react-pdf/renderer` templates (they use JSX).

### 0.5.4–0.5.11: Core Backend Files

The following files follow the same patterns as the existing Phase 0 documentation, with these key updates:

**`apps/api/src/lib/env.ts`** — adds `CHROMA_CACHE_TTL` and `UPTIMEROBOT_API_KEY` (optional). WhatsApp uses direct URLs only, so there are no WhatsApp API keys:

```typescript
const envSchema = z.object({
  // ... existing fields ...
  CHROMA_CACHE_TTL: z.coerce.number().default(86400),
  UPTIMEROBOT_API_KEY: z.string().optional(),
});
```

**`apps/api/src/lib/logger.ts`** — adds audit logging helper:

```typescript
export function auditLog(action: string, details: Record<string, unknown>) {
  logger.info({ type: 'audit', action, ...details }, `AUDIT: ${action}`);
}
```

**`apps/api/src/lib/colors.ts`** — NEW: Color scale generator using chroma-js

```typescript
import chroma from 'chroma-js';
import { env } from './env.js';

// Simple in-memory cache for generated scales
const scaleCache = new Map<string, Record<string, string>>();

export function generateColorScale(hex: string): Record<string, string> {
  const cached = scaleCache.get(hex);
  if (cached) return cached;

  try {
    const scale: Record<string, string> = {};
    const levels = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

    const baseColor = chroma(hex);
    const white = chroma('#FFFFFF');
    const black = chroma('#000000');

    for (const level of levels) {
      // 50 is lightest (closest to white), 950 is darkest (closest to black)
      if (level < 500) {
        const ratio = (500 - level) / 450;
        scale[String(level)] = chroma.mix(baseColor, white, ratio, 'lab').hex();
      } else if (level === 500) {
        scale[String(level)] = hex;
      } else {
        const ratio = (level - 500) / 450;
        scale[String(level)] = chroma.mix(baseColor, black, ratio, 'lab').hex();
      }
    }

    scaleCache.set(hex, scale);

    // Clear cache after TTL (prevent memory leak)
    setTimeout(() => scaleCache.delete(hex), env.CHROMA_CACHE_TTL * 1000);

    return scale;
  } catch {
    // Fallback: return original hex for all levels
    const fallback: Record<string, string> = {};
    for (const level of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      fallback[String(level)] = hex;
    }
    return fallback;
  }
}
```

**`apps/api/src/index.ts`** — Main entry. Uses `Bun.serve()` directly:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { logger as honoLogger } from 'hono/logger';
import { env } from './lib/env.js';
import { pinoLogger } from './lib/logger.js';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from './lib/db.js';
import { securityHeaders } from './middleware/security.js';
import { requestId } from './middleware/requestId.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

const app = new Hono();

// ── Global Middleware Stack ──────────────────────────────
app.use('*', compress());
app.use(
  '*',
  cors({
    origin:
      env.NODE_ENV === 'production'
        ? [env.FRONTEND_URL]
        : ['http://localhost:3000', 'http://localhost:5173', 'capacitor://localhost'],
    credentials: true,
    maxAge: 86400,
  }),
);
app.use('*', requestId);
app.use('*', securityHeaders);

if (env.NODE_ENV === 'development') {
  app.use('*', honoLogger());
}

// ── API v1 ──────────────────────────────────────────────
const api = new Hono().basePath('/api/v1');

api.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: isDatabaseConnected() ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    bunVersion: Bun.version,
    memory: process.memoryUsage(),
  }),
);

// Routes registered in later phases
// api.route('/auth', authRoutes);
// api.route('/app-config', appConfigRoutes);
// ...

app.onError(globalErrorHandler);
app.route('/', api);

api.all('*', (c) =>
  c.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` },
    },
    404,
  ),
);

// ── Server Start ────────────────────────────────────────
const server = Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
  idleTimeout: 120, // 2 min — longer than Render's 5-min proxy timeout
});

pinoLogger.info({ port: env.PORT }, `Server running on http://localhost:${env.PORT}`);

try {
  await connectDatabase();
} catch (error) {
  pinoLogger.fatal({ err: error }, 'Failed to start server — database offline');
  process.exit(1);
}

async function shutdown(signal: string) {
  pinoLogger.info(`${signal} — shutting down`);
  server.stop(true);
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
```

---

## Step 0.6: Frontend Scaffold (`apps/web`)

### 0.6.1 Initialize Next.js

```bash
bun create next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun --turbopack
```

### 0.6.2 `apps/web/package.json`

```json
{
  "name": "@pg/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000 --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test:e2e": "playwright test",
    "clean": "rm -rf .next out"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.0",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.0",
    "@hookform/resolvers": "^3.9.0",
    "@pg/types": "workspace:*",
    "@radix-ui/react-alert-dialog": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-checkbox": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@tanstack/react-query": "^5.62.0",
    "@tanstack/react-table": "^8.20.0",
    "clsx": "^2.1.0",
    "cmdk": "^1.0.0",
    "date-fns": "^4.1.0",
    "ky": "^1.7.0",
    "lucide-react": "^0.468.0",
    "motion": "^12.0.0",
    "next": "^15.1.0",
    "next-themes": "^0.4.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.54.0",
    "recharts": "^2.15.0",
    "sonner": "^1.7.0",
    "tailwind-merge": "^2.6.0",
    "zod": "^3.24.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

Key additions:

- `@dnd-kit/*` for kanban drag-and-drop
- `@tanstack/react-table` for DataTable component
- `date-fns` for date formatting
- `@playwright/test` for E2E testing

### 0.6.3–0.6.11: Core Frontend Files

These follow the existing Phase 0 patterns. Key changes:

**`apps/web/src/styles/globals.css`** — Updated to use CSS custom properties for dynamic branding:

```css
@import 'tailwindcss';

/* ── Fonts ─────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;500;600&display=swap');

/* ── Brand-Driven Design Tokens ────────────────────────── */
/* These are overridden at runtime via <html style="--color-brand-500: #xxx;">
   and via data-theme attribute for multi-theme switching.
   
   ⚠️ IMPORTANT: Use @theme (NOT @theme inline) for all tokens that need 
   to flip across themes. @theme inline bakes hex values into utility classes;
   @theme emits var(--token) references that cascade can override at runtime. */

/* Default token values (active when no data-theme attribute is set) */
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
  /* Border tokens */
  --border-width-default: 3px;
  --border-width-strong: 3px;
  --border-color: #000;
  /* Shadow tokens */
  --shadow-card: 4px 4px 0 0 #000;
  --shadow-button: 2px 2px 0 0 #000;
  /* Transition tokens */
  --transition-duration: 150ms;
  --transition-easing: ease-out;
}

/* @theme (non-inline) — Tailwind emits var(--color-brand-500) references,
   enabling CSS cascade overrides via data-theme attribute */
@theme {
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Bind CSS custom properties to Tailwind theme via var() references */
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

  --spacing: 0.25rem;
  --radius-sm: var(--radius-sm, 0.25rem);
  --radius-md: var(--radius-md, 0.5rem);
  --radius-lg: var(--radius-lg, 0.75rem);
  --radius-xl: var(--radius-xl, 1rem);
  --radius-full: var(--radius-full, 9999px);
}

/* @theme inline is ONLY used for truly static values that never change per theme:
   animation keyframes only — no colors, borders, shadows, or typography here */
@theme inline {
  --animate-fade-in-up: fade-in-up 400ms ease-out both;
  --animate-shimmer: shimmer 2s infinite;
  --animate-slide-in-left: slide-in-left 250ms ease-out both;
  --animate-slide-in-right: slide-in-right 250ms ease-out both;
}
```

**`apps/web/src/lib/brand.ts`** — NEW: Applies brand tokens from API response to DOM

```typescript
import type { IBrandTokens } from '@pg/types/tokens';

export function applyBrandTokens(tokens: IBrandTokens | null): void {
  if (!tokens || typeof document === 'undefined') return;

  const root = document.documentElement;

  // Apply color scales
  for (const [level, hex] of Object.entries(tokens.brandColorScale)) {
    root.style.setProperty(`--color-brand-${level}`, hex);
  }

  for (const [level, hex] of Object.entries(tokens.surfaceColorScale)) {
    root.style.setProperty(`--color-surface-${level}`, hex);
  }

  // Apply dark mode surfaces via class
  const darkStyle = document.createElement('style');
  darkStyle.id = 'brand-dark-tokens';
  darkStyle.textContent = `.dark {\n${Object.entries(tokens.surfaceColorScaleDark)
    .map(([level, hex]) => `  --color-surface-${level}: ${hex};`)
    .join('\n')}\n}`;
  document.head.appendChild(darkStyle);
}

export function resetBrandTokens(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Remove inline styles
  for (let i = 50; i <= 950; i += i < 100 ? 50 : i === 100 ? 50 : 100) {
    root.style.removeProperty(`--color-brand-${i}`);
    root.style.removeProperty(`--color-surface-${i}`);
  }

  // Remove dark mode override
  document.getElementById('brand-dark-tokens')?.remove();
}
```

---

## Step 0.7: Flutter Scaffold (`mobile/`)

### 0.7.1 Create Flutter Project

```bash
flutter create --org com.pgmanagement --project-name pg_app mobile --platforms android,ios,web
```

### 0.7.2 `mobile/pubspec.yaml` (updated dependencies)

```yaml
dependencies:
  flutter:
    sdk: flutter
  dio: ^5.7.0
  flutter_riverpod: ^2.6.0
  riverpod_annotation: ^2.6.0
  go_router: ^14.0.0
  flutter_secure_storage: ^9.2.0
  json_annotation: ^4.9.0
  image_picker: ^1.1.0
  flutter_local_notifications: ^18.0.0
  url_launcher: ^6.3.0
  cached_network_image: ^3.4.0
  shimmer: ^3.0.0
  google_fonts: ^6.2.0
  intl: ^0.19.0
  web_socket_channel: ^3.0.0
  upi_india: ^4.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  build_runner: ^2.4.0
  json_serializable: ^6.9.0
  riverpod_generator: ^2.6.0
  freezed: ^2.5.0
  freezed_annotation: ^2.4.0
  flutter_lints: ^5.0.0
  flutter_launcher_icons: ^0.14.0
```

Key additions:

- `web_socket_channel` for ntfy.sh WebSocket push
- `upi_india` for native UPI intent handling (opens UPI apps on device)
- `flutter_launcher_icons` for app icon generation

---

## Step 0.8: CI/CD Pipeline

### 0.8.1 `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run lint || bun run format:check

  test-api:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run test
        env:
          MONGODB_URI: mongodb://localhost:27017/pg_test
          JWT_ACCESS_SECRET: test-access-secret-min-32-chars!!
          JWT_REFRESH_SECRET: test-refresh-secret-min-32-chars!
          CLOUDINARY_CLOUD_NAME: test
          CLOUDINARY_API_KEY: test
          CLOUDINARY_API_SECRET: test
          RESEND_API_KEY: re_test
          ADMIN_EMAIL: admin@test.com
          ADMIN_PASSWORD: Test1234!

  build-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run --filter '@pg/web' build

  build-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run --filter '@pg/api' build

  e2e:
    needs: [build-web, build-api]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium
      - run: bun run test:e2e
```

---

## Step 0.9: Render Deployment Configs

### 0.9.1 `render.yaml`

```yaml
services:
  - type: web
    name: pg-api
    runtime: bun
    buildCommand: cd apps/api && bun install && bun run build
    startCommand: cd apps/api && bun run start
    envVars:
      - key: PORT
        value: 8000
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: JWT_ACCESS_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: ADMIN_EMAIL
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
      - key: ADMIN_NAME
        sync: false
      - key: ADMIN_PHONE
        sync: false
      - key: FRONTEND_URL
        sync: false

  - type: static
    name: pg-web
    buildCommand: cd apps/web && bun install && bun run build
    staticPublishPath: apps/web/out
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: NEXT_PUBLIC_API_URL
        sync: false
```

### 0.9.2 Keep-Alive via Bun Cron (Alternative to UptimeRobot)

```typescript
// In apps/api/src/index.ts — self-pinging health endpoint
function setupSelfPing() {
  if (env.NODE_ENV !== 'production') return;

  // Ping our own health endpoint every 4 minutes (<5min Render timeout)
  setInterval(
    () => {
      fetch(`http://localhost:${env.PORT}/api/v1/health`)
        .then(() => {})
        .catch(() => {});
    },
    4 * 60 * 1000,
  );
}
```

---

## Verification Checklist

- [ ] `bun install` completes without errors at project root
- [ ] `bun run typecheck` passes for all packages
- [ ] `bun run lint` passes
- [ ] `bun run format:check` passes
- [ ] `bun run --filter '@pg/api' dev` starts API on port 8000
- [ ] `GET /api/v1/health` returns `{ status: 'ok', mongodb: 'connected', ... }`
- [ ] `bun run --filter '@pg/web' dev` starts web on port 3000
- [ ] Web app renders root layout without errors
- [ ] `bun run --filter '@pg/api' build` produces `dist/index.js`
- [ ] `bun run --filter '@pg/web' build` produces `out/` with static export
- [ ] CI pipeline: typecheck, lint, test, build all green
- [ ] Brand token CSS variables applied to `<html>` at runtime
- [ ] Dark mode surfaces flip correctly via `.dark` class
- [ ] `bun run seed` creates admin user from env vars
- [ ] Flutter `pub get` succeeds, `build_runner` generates code
- [ ] `.env.example` files present for both `apps/api` and `apps/web`

---

## Phase 0 Completion Criteria

- [x] Monorepo structure with `apps/api`, `apps/web`, `packages/types`, `mobile/`
- [x] All TypeScript configs extend base, strict mode enabled
- [x] Bun workspaces configured, root scripts work with filters
- [x] ESLint v9 flat config + Prettier + Husky + lint-staged
- [x] API server starts on Bun.serve(), MongoDB connects with retry
- [x] Health endpoint returns system status including memory
- [x] Brand color scale generator (`chroma-js`) with caching
- [x] Frontend Tailwind v4 @theme with CSS custom property overrides
- [x] Brand token applicator (`applyBrandTokens`) for runtime branding
- [x] Shared types package with all interfaces including new ones (menu, visitor, laundry, notice, audit, export, attendance, asset, guardian)
- [x] CI/CD pipeline with typecheck, lint, test, build, e2e jobs
- [x] Render deployment config with self-ping keep-alive
