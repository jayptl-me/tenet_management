import { defineConfig, devices, type ReporterDescription } from '@playwright/test';

/**
 * Playwright E2E configuration for the Next.js Admin Web Panel.
 *
 * Browsers: the CI job installs chromium only (see .github/workflows/ci.yml),
 * so CI must not ask for an engine that is not on the machine, otherwise every
 * firefox and webkit spec dies with "browser not found". A local run uses all
 * three engines unless PLAYWRIGHT_BROWSERS narrows the list, for example
 * PLAYWRIGHT_BROWSERS=chromium,firefox. A local run needs the engines on the
 * machine first: bunx playwright install.
 */
const BROWSER_PROJECTS = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];

const defaultBrowsers = process.env.CI ? 'chromium' : 'chromium,firefox,webkit';
const browserList = (process.env.PLAYWRIGHT_BROWSERS ?? defaultBrowsers).split(',');
const enabledBrowsers = new Set(browserList.map((name) => name.trim()));

// The html reporter opens the report on failure by default, which blocks a CI
// runner forever. In CI it only writes the report file.
const reporters: ReporterDescription[] = process.env.CI
  ? [['list'], ['html', { open: 'never' }]]
  : ['html'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: reporters,
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: BROWSER_PROJECTS.filter((project) => enabledBrowsers.has(project.name)),
  webServer: process.env.CI
    ? {
        // `next start` serves the production build of the admin app. The CI
        // job builds it before the suite runs and fails with a clear message
        // when apps/web/.next/BUILD_ID is missing.
        command: 'bun run start',
        url: 'http://localhost:3000',
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
});
