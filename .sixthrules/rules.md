# tenet_pg_management — AI Context & Rules (Restored)

## Project Identity

- **Project:** tenet_pg_management
- **Stack:** monorepo (apps:api = Hono/Bun, apps:web = Next.js 16, packages:types = shared TS)
- **Directory:** /Users/jay/Development/Projects/Personal Projects/tenet_pg_management
- **Package Manager:** bun (bun.lock present, bun >=1.3.0)
- **Database:** MongoDB via Mongoose 8.x
- **Deployment:** Render (bun runtime for API, static site for Web)

## Workspace Layout

| Package           | Location          | Runtime | Framework     | Purpose                      |
| ----------------- | ----------------- | ------- | ------------- | ---------------------------- |
| `@pg/api`         | `apps/api/`       | Bun     | Hono 4.x      | REST API + SSE + cron jobs   |
| `@pg/web`         | `apps/web/`       | Bun/Node| Next.js 16    | Admin panel + public pages   |
| `@pg/types`       | `packages/types/` | TS      | —             | Shared types + Zod schemas   |

## Active Skills

- **senior-architect** — Monorepo architecture, package boundaries
- **senior-frontend** — Next.js 16, Tailwind v4, Zustand, Radix UI
- **senior-backend** — Hono API, Mongoose, Zod validation, JWT auth
- **senior-devops** — Render deployment, CI/CD, env config
- **code-reviewer** — Code quality across the monorepo
- **tdd-guide** — Vitest for backend, Playwright for E2E
- **senior-qa** — Testing strategy, coverage
- **senior-security** — Auth, rate limiting, security headers
- **impeccable** — UI design, micro-interactions, theming
- **emil-design-eng** — UI work (when explicitly requested)

## Available Commands

| Command                     | Description                                  |
| --------------------------- | -------------------------------------------- |
| `bun run dev`               | Start API + Web dev servers concurrently     |
| `bun run build`             | Build all workspaces                          |
| `bun run lint`              | Lint all workspaces                           |
| `bun run typecheck`         | TypeScript check across all workspaces        |
| `bun run test`              | Run API unit tests (Vitest)                   |
| `bun run test:e2e`          | Run web E2E tests (Playwright)                |
| `bun run seed`              | Seed database with config defaults            |
| `bun run seed:sample`       | Seed with config + sample data                |
| `bun run format`            | Prettier format all                           |
| `bun run format:check`      | Check formatting                              |
| `bun run seo`               | Generate SEO files                            |
| `bun run clean`             | Clean all build directories                   |

## Environment Requirements

- **Required vars** (see `apps/api/.env.example`):
  - `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - `RESEND_API_KEY`, `FRONTEND_URL`, `CRON_SECRET`
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_PHONE`
  - `NTFY_BASE_URL`, `NTFY_SELF_HOSTED`

## Workflow Files

**Primary config lives at: `.sixthrules/workflows/`** (13 files: master.md, automation-loop.md, codebase-index.md, multi-pass-batch-planning.md, sub-agent-orchestration.md, monorepo-boundaries.md, database-schema-protocol.md, deployment-verification.md, verify.md, self-config-protocol.md, etc.)

These are more sophisticated than the generic templates. Do NOT overwrite them.

## MCP Configuration

See `.claude/settings.json` for MCP server config. Connected servers:
- **Context7** — Library documentation (React, Next.js, TypeScript, deps)
- **Tavily** — Web search
