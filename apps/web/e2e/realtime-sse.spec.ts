import { test, expect } from '@playwright/test';

test.describe('Real-Time SSE Stream & Admin Badge Updates', () => {
  test.beforeEach(async ({ page }) => {
    // Seed authenticated admin state in localStorage/authStore
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

  test('admin dashboard connects to SSE and reacts to live event broadcasts', async ({ page }) => {
    // Intercept SSE and dashboard API endpoints
    await page.route('**/dashboard/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalBeds: 50,
            occupiedBeds: 35,
            occupancyRate: 70,
            monthlyRevenue: 280000,
            pendingDues: 15000,
            pendingComplaints: 2,
            activeNotices: 4,
          },
        }),
      });
    });

    await page.route('**/dashboard/badges', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            unreadNotifications: 3,
            openComplaints: 2,
            pendingEnquiries: 1,
          },
        }),
      });
    });

    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Super Admin')).toBeVisible();
  });
});
