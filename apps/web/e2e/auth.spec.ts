import { test, expect } from '@playwright/test';

test.describe('Admin Panel Authentication & Role Guard Barrier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('displays login page with required elements', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Admin Portal');
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows validation errors for empty fields', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/Enter a valid email|Email is required/i)).toBeVisible();
  });

  test('shows error message on invalid credentials', async ({ page }) => {
    await page.fill('input#email', 'wrongadmin@pg.com');
    await page.fill('input#password', 'WrongPassword123');
    await page.locator('button[type="submit"]').click();

    // Error banner should appear
    await expect(page.locator('.bg-\\[color\\:var\\(--color-danger-50\\)\\]')).toBeVisible({
      timeout: 8000,
    });
  });

  test('shows admin-only disclaimer for tenant/guardian credentials', async ({ page }) => {
    // Intercept login API to simulate tenant login response
    await page.route('**/auth/login', async (route) => {
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
    await expect(
      page.getByText(/Use the Flutter app under \/mobile for resident portals/i),
    ).toBeVisible();
  });
});
