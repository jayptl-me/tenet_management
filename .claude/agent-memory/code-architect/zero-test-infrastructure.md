---
name: zero-test-infrastructure
description: No __tests__ directory exists anywhere in the monorepo -- 24 models, 130+ endpoints, 0 automated tests
metadata:
  type: project
---

The entire codebase at /home/odoo/Development/tenet_management has zero automated test coverage. The `apps/api/src/__tests__/` directory referenced in codebase-index.md does not exist. `bun run test` (vitest) would find no test files.

**Why:** Every code change risks regression with no safety net. This is a P0 infrastructure gap.

**How to apply:** Establish test infrastructure (vitest config, **tests** directory, core model tests) before making risky refactors. At minimum add tests for Tenant lifecycle, Room sharingType changes, and Invoice/Payment flows.
