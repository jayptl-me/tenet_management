import { test, expect } from '@playwright/test';

/**
 * Admin authentication and the admin-only role guard.
 *
 * The API is stubbed on purpose: this suite drives the admin UI, and the API
 * has its own contract tests in the test-api job. The stubbed payloads are
 * the exact envelopes the API returns (apps/api/src/routes/auth.ts), so the
 * client parses them the way it parses the real server.
 */
const LOGIN_ROUTE = '**/auth/login';

test.describe('Admin Panel Authentication & Role Guard Barrier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('displays login page with required elements', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Admin Login');
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows validation errors for empty fields', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/Enter a valid email|Email is required/i)).toBeVisible();
  });

  test('shows error message on invalid credentials', async ({ page }) => {
    await page.route(LOGIN_ROUTE, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        }),
      });
    });

    await page.fill('input#email', 'wrongadmin@pg.com');
    await page.fill('input#password', 'WrongPassword123');
    await page.locator('button[type="submit"]').click();

    // The banner shows the message the client derives from the API error code.
    await expect(
      page.getByText('The email or password you entered is incorrect. Please try again.'),
    ).toBeVisible();
  });

  test('shows admin-only disclaimer for tenant/guardian credentials', async ({ page }) => {
    // Intercept login API to simulate tenant login response
    await page.route(LOGIN_ROUTE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'tenant-123',
              name: 'John Tenant',
              email: 'tenant@pg.com',
              role: 'tenant',
              isActive: true,
            },
            accessToken: 'mock_jwt_token',
            refreshToken: 'mock_refresh_token',
          },
        }),
      });
    });

    await page.fill('input#email', 'tenant@pg.com');
    await page.fill('input#password', 'Tenant@123');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/This login is for administrators only/i)).toBeVisible();
    await expect(page.getByText(/Use the Flutter app under \/mobile/i)).toBeVisible();
  });
});
