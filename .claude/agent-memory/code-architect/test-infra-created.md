---
name: test-infra-created
description: API test infrastructure established -- vitest config, setup, 20 tests across 3 suites
metadata:
  type: project
---

**Setup:**

- `apps/api/vitest.config.ts` -- already existed, pointed to `src/__tests__/`
- `apps/api/src/__tests__/setup.ts` -- created: connects to `MONGODB_URI_TEST` (defaults to `mongodb://localhost:27017/pg_management_test`), cleans all collections between tests, disconnects after all
- `bun run test` -- runs vitest via `@pg/api` package.json script

**Test suites created:**

1. `visitors.test.ts` (8 tests) -- create, reject missing/field validation, arrive/depart lifecycle, toJSON alias, delete
2. `tenants.test.ts` (6 tests) -- create, reject missing userId, reject invalid bedId, reject low rent, checkout, unique constraint
3. `rooms.test.ts` (6 tests) -- 2-sharing type, 4-sharing type, duplicate reject, invalid sharing type, occupancyCount derive, generateBeds static

**Caveat:** Tests require a running MongoDB instance. They will skip with `MongooseServerSelectionError: connect ECONNREFUSED` if mongod is not running. No `mongodb-memory-server` dependency is installed (too heavy for this project's scope).

**How to extend:** Add new `.test.ts` files in `src/__tests__/`. Vitest auto-discovers them via the glob `src/__tests__/**/*.test.ts`.
