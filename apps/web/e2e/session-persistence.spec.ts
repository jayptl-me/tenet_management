import { test, expect } from '@playwright/test';

/**
 * The session must survive a full page load.
 *
 * The admin shell used to decide "nobody is signed in" from the store before
 * the persisted session had been restored, so every refresh, every shared link
 * and every bookmark dumped a signed-in admin on the login page. The store now
 * reports that it is still hydrating and the shell waits.
 *
 * This spec is the guard for that: it seeds the persisted session, loads an
 * admin page directly (a full page load, not a client-side navigation), and
 * asserts the admin is still on that page.
 */
const AUTH_STORAGE_KEY = 'pg-auth-storage';

const adminSession = {
  state: {
    user: {
      id: 'admin-001',
      name: 'Super Admin',
      email: 'admin@sunrisepg.in',
      role: 'admin',
      isActive: true,
    },
    accessToken: 'mock_valid_admin_token',
    refreshToken: 'mock_valid_refresh_token',
    isAuthenticated: true,
  },
  version: 0,
};

test.describe('Admin session survives a full page load', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      (payload: { key: string; value: string }) => {
        localStorage.setItem(payload.key, payload.value);
      },
      { key: AUTH_STORAGE_KEY, value: JSON.stringify(adminSession) },
    );
    // The page shell asks the API for its badges; answer it so the shell is
    // not waiting on a network error.
    await page.route('**/dashboard/badges**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { pendingVerification: 0, openComplaints: 0 } }),
      });
    });
  });

  test('keeps a signed-in admin on the page they opened', async ({ page }) => {
    await page.goto('/tenants');

    // Not the login page, and not a redirect on the way there.
    await expect(page).toHaveURL(/\/tenants$/);
    await expect(page.locator('h1')).not.toContainText('Admin Login');

    // The session is still there.
    const stored = await page.evaluate(() => localStorage.getItem('pg-auth-storage'));
    expect(stored).toContain('admin@sunrisepg.in');
  });

  test('keeps a signed-in admin on a form page', async ({ page }) => {
    await page.route('**/rooms?isActive=true', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto('/tenants/new');

    await expect(page).toHaveURL(/\/tenants\/new$/);
    await expect(page.locator('h1')).not.toContainText('Admin Login');
  });
});
