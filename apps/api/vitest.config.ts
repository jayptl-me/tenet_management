import { defineConfig } from 'vitest/config';

// Ensure env.ts can parse when suites import services that pull logger/env.
// Prefer real process.env (CI / apps/api/.env); fall back to test secrets.
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/pg-test-unused';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-min-32-characters-long';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-min-32-characters-long';
process.env.NODE_ENV ??= 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
