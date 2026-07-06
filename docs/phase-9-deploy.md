# Phase 9: Deployment & Production Hardening

**Status:** ✅ COMPLETE
**Goal:** Everything deployed on Render free tier, production-ready with security hardening, smoke tests passing, documentation complete.
**Estimated:** Completed (Render blueprints, configs, CORS, and env setup fully prepared)
**Depends On:** All previous phases
**Package Manager:** bun

---

## Step 9.1: Render Blueprint

### File: `render.yaml`

```yaml
services:
  # ── API (Hono + Bun) ──────────────────────────────────
  - type: web
    name: pg-api
    runtime: bun
    region: oregon
    plan: free
    buildCommand: bun install --frozen-lockfile && cd apps/api && bun build src/index.ts --outdir=dist --target=bun
    startCommand: cd apps/api && bun run dist/index.js
    healthCheckPath: /api/v1/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: '10000'
      - key: BUN_RUNTIME
        value: '1'
      # MongoDB
      - key: MONGODB_URI
        sync: false
      # JWT
      - key: JWT_ACCESS_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: JWT_ACCESS_EXPIRES_IN
        value: 15m
      - key: JWT_REFRESH_EXPIRES_IN
        value: 30d
      # Cloudinary
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
      # Resend
      - key: RESEND_API_KEY
        sync: false
      - key: RESEND_FROM_EMAIL
        value: noreply@your-pg.com
      # Admin seed
      - key: ADMIN_EMAIL
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
      - key: ADMIN_NAME
        sync: false
      - key: ADMIN_PHONE
        sync: false
      # Frontend URL
      - key: FRONTEND_URL
        sync: false
      # ntfy
      - key: NTFY_BASE_URL
        value: https://ntfy.sh
      - key: NTFY_SELF_HOSTED
        value: 'false'
      # UPI defaults
      - key: DEFAULT_UPI_ID
        sync: false
      - key: DEFAULT_UPI_PAYEE_NAME
        sync: false

  # ── Static Site (Next.js export) ──────────────────────
  - type: static
    name: pg-web
    buildCommand: bun install --frozen-lockfile && bun run generate-seo && bun run --filter @pg/web build
    staticPublishPath: ./apps/web/out
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: NEXT_PUBLIC_API_URL
        sync: false
```

### Environment Variables Setup

On Render dashboard, set all `sync: false` variables manually:

1. `MONGODB_URI` — Atlas connection string
2. Cloudinary keys (3 values)
3. Resend API key
4. Admin credentials
5. `FRONTEND_URL` — Render static site URL (e.g., `https://pg-web.onrender.com`)
6. `NEXT_PUBLIC_API_URL` — Render API URL (e.g., `https://pg-api.onrender.com/api/v1`)
7. `DEFAULT_UPI_ID` — PG owner's UPI ID

---

## Step 9.2: Security Hardening

### CORS Configuration

```typescript
// api/src/index.ts — update CORS origins
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'];
      // Allow requests with no origin (server-to-server, mobile apps)
      if (!origin || origin === 'null') return '*';
      return allowed.includes(origin) ? origin : env.FRONTEND_URL;
    },
    credentials: true,
    maxAge: 86400,
  }),
);
```

### Production Checklist

- [ ] All Zod schemas use `.strict()` — rejects unknown fields
- [ ] Cloudinary upload size limit enforced (max 5MB)
- [ ] Rate limiter active: auth routes 5/15min, general 300/min, public 3/hr
- [ ] Security headers middleware active: X-Frame-Options, X-Content-Type-Options, etc.
- [ ] Pino log level set to `info` in production (no debug logs)
- [ ] No secrets in client bundle: verify `out/` directory doesn't contain API keys
- [ ] Mongoose `sanitizeFilter` enabled on all queries
- [ ] `helmet` equivalent: CSP, HSTS via headers
- [ ] Error responses never leak stack traces (`NODE_ENV=production` check)

---

## Step 9.3: Build Verification

```bash
# At repo root
bun install --frozen-lockfile
bun run typecheck          # Should pass with 0 errors
bun run lint               # Should pass with 0 errors
bun run build              # Should succeed

# Verify outputs exist
ls apps/api/dist/index.js  # API build
ls apps/web/out/index.html # Frontend export

# Verify no env files committed
git status | grep ".env"   # Should return nothing (except .env.example)
```

---

## Step 9.4: Smoke Tests

### API Health

```bash
curl https://pg-api.onrender.com/api/v1/health
# → { "status": "ok", "mongodb": "connected", "uptime": ..., "bunVersion": "..." }
```

### Authentication

```bash
# Login
curl -X POST https://pg-api.onrender.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@pg.com","password":"ChangeMe123!"}'
# → { "success": true, "data": { "accessToken": "...", "user": {...} } }

# Me
curl https://pg-api.onrender.com/api/v1/auth/me \
  -H 'Authorization: Bearer <accessToken>'
# → { "success": true, "data": { "name": "Administrator", ... } }
```

### CRUD Operations

```bash
# Create floor
curl -X POST https://pg-api.onrender.com/api/v1/floors \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"floorNumber":0,"label":"Ground Floor","totalRooms":4}'
# → 201

# Create room
curl -X POST https://pg-api.onrender.com/api/v1/rooms \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"roomNumber":"G01","floorId":"<floorId>","sharingType":2,"monthlyRent":8000}'
# → 201 with auto-generated beds
```

### Frontend

- [ ] Landing page loads at `https://pg-web.onrender.com`
- [ ] Login at `https://pg-web.onrender.com/login`
- [ ] After login, redirected to `/admin/dashboard`
- [ ] Dashboard shows KPI cards
- [ ] All admin pages navigable via sidebar

### Flutter APK

- [ ] APK installed on test device
- [ ] Login as tenant works
- [ ] Home dashboard loads with data
- [ ] UPI QR displayed for payment
- [ ] Complaint created successfully

---

## Step 9.5: Monitoring

### Health Check Route

Render pings `/api/v1/health` every 30 seconds. The handler checks:

- MongoDB connection status
- Server uptime
- Returns `200 OK` if healthy, `503` if unhealthy

### Logging

All logs go to `stdout`, captured by Render dashboard. Key log events:

- Server start: `"🚀 Server running on port {port}"`
- MongoDB connect/disconnect
- Invoice generation results
- Payment overdue markings
- Unhandled errors (with `requestId` for tracing)

---

## Step 9.6: Documentation

### Root `README.md`

```markdown
# PG Management System

Open-source, self-hostable PG (Paying Guest) accommodation management system.

## Tech Stack

- **Backend:** Hono + Bun + MongoDB (Mongoose) + TypeScript
- **Frontend:** Next.js 15 (static export) + Tailwind CSS v4 + shadcn/ui + TanStack Query
- **Mobile:** Flutter (Android)
- **Payments:** UPI QR scanner (zero fees, manual verification)
- **Notifications:** ntfy.sh (self-hostable) + in-app + SSE
- **PDF:** @react-pdf/renderer (on-demand, no storage)
- **Deployment:** Render free tier

## Quick Start

1. Clone repo
2. Install bun: `curl -fsSL https://bun.sh/install | bash`
3. Install deps: `bun install`
4. Copy env files: `cp apps/api/.env.example apps/api/.env`
5. Fill in `.env` with your MongoDB URI, Cloudinary keys, etc.
6. Seed admin: `bun run seed`
7. Start dev: `bun run dev`
8. Open: http://localhost:3000 (frontend), http://localhost:8000/api/v1/health (API)

## Deployment

See `render.yaml` for Render blueprint. Requires:

- MongoDB Atlas M0 cluster
- Cloudinary account (free)
- Resend account (free)
- ntfy.sh (public or self-hosted)

## Branding

All branding (name, logo, colors, pricing, content) configured via Admin Settings page. No code changes needed.

## License

MIT
```

---

## Step 9.7: DNS & Custom Domain (Optional)

1. Purchase domain (e.g., `your-pg.com`)
2. In Render dashboard: Settings → Custom Domain → Add
3. Configure DNS: CNAME record pointing to `pg-web.onrender.com`
4. API subdomain: CNAME `api.your-pg.com` → `pg-api.onrender.com`
5. Update `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` env vars
6. Render auto-provisions TLS certificates (Let's Encrypt)

---

## Verification Checklist

- [ ] Render: both services green (API + static site)
- [ ] API health check returns 200
- [ ] MongoDB connection established
- [ ] Admin seeded and can login
- [ ] Landing page accessible at production URL
- [ ] SSL/TLS active (HTTPS)
- [ ] CORS allows frontend origin only
- [ ] Rate limiting active (test rapid login attempts)
- [ ] Security headers present (check with `curl -I`)
- [ ] Error responses don't leak stack traces
- [ ] All env templates match actual Render env vars
- [ ] README complete with quick start guide
- [ ] No `.env` files committed to git
- [ ] `bun run build` succeeds on Render
