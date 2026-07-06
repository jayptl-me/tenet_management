# AGENTS.md

> Root steering file and instruction set for AI agents.

This file provides the structural overview, styling patterns, build/test scripts, and rules for coding agents working on this project.

## Build and Test Commands

All commands are run using the Bun CLI.

- Start development servers (Frontend & Backend):
  - `bun run dev`
- Build all projects:
  - `bun run build`
- Run linter:
  - `bun run lint`
- Run typecheck check:
  - `bun run typecheck`
- Run backend unit tests:
  - `bun run test`
- Run frontend E2E integration tests:
  - `bun run test:e2e`
- Format entire codebase:
  - `bun run format`
- Check formatting style:
  - `bun run format:check`
- Reset database and seed with configuration:
  - `bun run seed`
- Seed database with configuration and sample records:
  - `bun run seed:sample`
- Generate SEO files:
  - `bun run seo`
- Clean all workspace build directories:
  - `bun run clean`
- Android/iOS Flutter Setup (Optional):
  - `bun run mobile:setup`
  - `bun run mobile:gen`

## Code Style and Conventions

1. **Naming Conventions:**
   - Files and directories must be kebab-case (lowercase with hyphens, e.g. `laundry-slot.ts`).
   - React components must be PascalCase (e.g. `AttendanceCard.tsx`).
   - Customs React hooks must prefix with `use` (e.g. `useSSE.ts`).
2. **Type Safety:** Use TypeScript for all projects. Enforce strict types. Do not use `any`. All API request/response models must be defined inside `packages/types/`.
3. **Encapsulation:** Export types and models using barrel files (`index.ts`) in types and models directories.
4. **Logic Separation:** Keep route handlers focused on requests and input validation (using Zod validation schemas). Business logic must be moved to dedicated services (e.g. `apps/api/src/services/`).

## Project Architecture Map

- `apps/api/` -> Bun + Hono backend service. Uses Mongoose for MongoDB.
- `apps/web/` -> Next.js 16 + React 19 App Router frontend. Uses Tailwind CSS v4, Zustand, and Ky client.
- `packages/types/` -> Shared TypeScript declarations and validation schemas between backend and frontend.
- `render.yaml` -> Production deployment services definitions on Render.

## Critical Rules

- **Never direct import:** `@pg/web` must not import any modules from `apps/api/`. Communication must go through HTTP endpoints.
- **No emojis:** Do not write or commit emojis in comments, commits, code strings, or documentation files. Use standard ASCII connections only.
- **Re-read before write:** Always view the target file content immediately before modifying it to prevent code overwrite or applying stale versions.
- **Backward Compatibility:** When changing database schemas, always specify a default value or fallback to preserve support for historical documents.

## Detailed Workflows Reference

For complete guidelines on execution loops, search protocols, quality gates, and database/monorepo policies, refer to the files under `.sixthrules/workflows/`:

- [master.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/master.md) - Turn router and global state machine.
- [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md) - Living map of file paths and domains.
- [automation-loop.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/automation-loop.md) - Core goal-driven R-P-E-V-I loop guidelines.
- [adaptive-research-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/adaptive-research-protocol.md) - Anti-hallucination research protocols.
- [sub-agent-orchestration.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/sub-agent-orchestration.md) - Sub-agent spawning rules and contract designs.
- [multi-pass-batch-planning.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/multi-pass-batch-planning.md) - Breaking complex tasks into passes.
- [code-quality-verification-gates.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/code-quality-verification-gates.md) - Mandatory checks (Type, Lint, Build, Test).
- [codebase-index-update-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index-update-protocol.md) - How to update codebase-index.md.
- [monorepo-boundaries.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/monorepo-boundaries.md) - Workspace linkage and boundaries.
- [database-schema-protocol.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/database-schema-protocol.md) - Mongoose validation safety, indexing, and seeds.
- [deployment-verification.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/deployment-verification.md) - Render deployment and environment configuration check gates.
