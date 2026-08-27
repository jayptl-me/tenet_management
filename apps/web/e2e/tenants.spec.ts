import { test, expect } from '@playwright/test';

test.describe('Admin Tenant Management & Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Seed authenticated admin state
    await page.addInitScript(() => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
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
        }),
      );
    });
  });

  test('displays tenant list with search and filters', async ({ page }) => {
    await page.route('**/tenants?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'tenant-1',
              user: { name: 'Amit Verma', email: 'amit@example.com', phone: '+919876543210' },
              room: { roomNumber: '101', floor: { label: '1st Floor' } },
              bedId: 'A',
              status: 'active',
              monthlyRent: 8000,
              depositPaid: 16000,
              moveInDate: '2026-01-01T00:00:00.000Z',
            },
          ],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        }),
      });
    });

    await page.goto('/tenants');
    await expect(page.getByText('Amit Verma')).toBeVisible();
    await expect(page.getByText('Room 101')).toBeVisible();
  });

  test('validates required fields on tenant onboarding form', async ({ page }) => {
    await page.route('**/rooms/available', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto('/tenants/new');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/Name must be at least 2 characters/i)).toBeVisible();
    await expect(page.getByText(/Invalid email/i)).toBeVisible();
    await expect(page.getByText(/Phone is required/i)).toBeVisible();
  });
});
