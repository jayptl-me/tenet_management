import { test, expect } from '@playwright/test';

/**
 * The tenant directory and the tenant onboarding form.
 *
 * The session is seeded into the persisted zustand store
 * (apps/web/src/store/auth.ts) under its real key, "pg-auth-storage", and the
 * API calls are stubbed with the envelope the API returns. The suite needs no
 * API server and no database.
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

const tenantRow = {
  _id: 'tenant-1',
  user: { name: 'Amit Verma', email: 'amit@example.com', phone: '+919876543210' },
  room: { roomNumber: '101', floor: { label: '1st Floor' } },
  bedId: 'A',
  status: 'active',
  monthlyRent: 8000,
  depositPaid: 16000,
  moveInDate: '2026-01-01T00:00:00.000Z',
};

test.describe('Admin Tenant Management & Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Seed the authenticated admin state in the persisted auth store.
    await page.addInitScript(
      (payload: { key: string; value: string }) => {
        localStorage.setItem(payload.key, payload.value);
      },
      { key: AUTH_STORAGE_KEY, value: JSON.stringify(adminSession) },
    );
  });

  test('displays tenant list with search and filters', async ({ page }) => {
    await page.route('**/tenants?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [tenantRow],
          meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
        }),
      });
    });

    await page.goto('/tenants');

    // The filter bar: the search box and the status filter.
    await expect(page.getByPlaceholder('Search by name...')).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible();

    // The seeded row. The desktop table is the visible one at this viewport,
    // so the assertion is scoped to a table cell.
    await expect(page.getByRole('cell', { name: 'Amit Verma' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /101/ })).toBeVisible();
  });

  test('validates required fields on tenant onboarding form', async ({ page }) => {
    await page.route('**/rooms?isActive=true', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto('/tenants/new');

    // The browser blocks a submit with empty required fields before the app
    // sees it, so the native validation is switched off to let the form run
    // its own schema.
    await page
      .locator('form')
      .first()
      .evaluate((form) => {
        (form as HTMLFormElement).noValidate = true;
      });

    await page.click('button[type="submit"]');

    await expect(page.getByText('Name must be at least 2 characters')).toBeVisible();
    await expect(page.getByText('Invalid email')).toBeVisible();
    await expect(page.getByText('Phone is required')).toBeVisible();
  });
});
