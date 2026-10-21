import { test, expect } from '@playwright/test';

/**
 * The admin dashboard behind a signed-in admin session.
 *
 * The session is seeded into the persisted zustand store
 * (apps/web/src/store/auth.ts) under its real key, "pg-auth-storage", and
 * every API call the dashboard makes is stubbed with the envelope the API
 * returns. The suite therefore needs no API server and no database: the
 * admin UI is what is under test, the API has its own job in CI.
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

/** The payload of GET /dashboard/stats, in the shape the dashboard renders. */
const dashboardStats = {
  occupancy: { totalRooms: 12, totalBeds: 50, occupiedBeds: 35, vacancyRate: 30 },
  revenue: { collected: 280000, expected: 300000, month: '2026-10' },
  complaints: { open: 2, inProgress: 1, resolved: 12, dismissed: 1 },
  services: { operational: 8, degraded: 1, down: 0 },
  enquiries: { pending: 4, contacted: 6, newThisWeek: 3 },
  pendingVerifications: 2,
  recent: {
    complaints: [
      {
        _id: 'complaint-1',
        title: 'Water leak in washroom',
        status: 'open',
        category: 'plumbing',
        tenantId: { userId: { name: 'Amit Verma' } },
        createdAt: '2026-10-18T09:30:00.000Z',
      },
    ],
    enquiries: [
      {
        _id: 'enquiry-1',
        name: 'Ravi Kumar',
        phone: '+919876543210',
        status: 'new',
        createdAt: '2026-10-19T11:15:00.000Z',
      },
    ],
  },
  revenueHistory: [
    { month: '2026-05', collected: 210000, expected: 240000 },
    { month: '2026-06', collected: 226000, expected: 250000 },
    { month: '2026-07', collected: 241000, expected: 260000 },
    { month: '2026-08', collected: 255000, expected: 270000 },
    { month: '2026-09', collected: 268000, expected: 285000 },
    { month: '2026-10', collected: 280000, expected: 300000 },
  ],
  occupancyHistory: [
    { month: '2026-05', occupied: 31, total: 50 },
    { month: '2026-06', occupied: 32, total: 50 },
    { month: '2026-07', occupied: 33, total: 50 },
    { month: '2026-08', occupied: 34, total: 50 },
    { month: '2026-09', occupied: 34, total: 50 },
    { month: '2026-10', occupied: 35, total: 50 },
  ],
  mealFeedbackTrend: [
    { date: '2026-10-18', breakfast: 4.1, lunch: 4.4, dinner: 4.2 },
    { date: '2026-10-19', breakfast: 4.3, lunch: 4.5, dinner: 4.0 },
    { date: '2026-10-20', breakfast: 4.2, lunch: 4.6, dinner: 4.3 },
  ],
  complaintsByCategory: [
    { _id: 'plumbing', count: 3 },
    { _id: 'electricity', count: 2 },
    { _id: 'housekeeping', count: 1 },
  ],
  paymentFunnel: {
    paid: { count: 12, totalAmount: 280000 },
    sent: { count: 6, totalAmount: 96000 },
    partial: { count: 2, totalAmount: 18000 },
    overdue: { count: 1, totalAmount: 8000 },
  },
  amenityHealth: {
    wifi: { operational: 1, degraded: 0, down: 0, total: 1 },
    power_backup: { operational: 1, degraded: 1, down: 0, total: 2 },
  },
  complaintHeatmap: { '2026-10-05': 2, '2026-10-12': 1 },
  serviceHistory: [
    {
      id: 'service-1',
      date: '2026-10-20',
      title: 'Wi-Fi check',
      description: 'Router replaced on the first floor',
      status: 'success',
    },
  ],
  roomOccupancyMatrix: [
    {
      _id: 'room-101',
      roomNumber: '101',
      floorId: 'floor-1',
      floorLabel: '1st Floor',
      floorNumber: 1,
      sharingType: 3,
      monthlyRent: 8000,
      totalBeds: 3,
      occupiedBeds: 2,
      beds: [
        { bedId: 'A', isOccupied: true, tenantName: 'Amit Verma' },
        { bedId: 'B', isOccupied: true, tenantName: 'Neha Singh' },
        { bedId: 'C', isOccupied: false },
      ],
    },
  ],
};

test.describe('Real-Time SSE Stream & Admin Badge Updates', () => {
  test.beforeEach(async ({ page }) => {
    // Seed the authenticated admin state in the persisted auth store.
    await page.addInitScript(
      (payload: { key: string; value: string }) => {
        localStorage.setItem(payload.key, payload.value);
      },
      { key: AUTH_STORAGE_KEY, value: JSON.stringify(adminSession) },
    );

    await page.route('**/dashboard/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: dashboardStats }),
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
  });

  test('admin dashboard renders the live metrics for the signed-in admin', async ({ page }) => {
    await page.goto('/dashboard');

    // The dashboard is behind the admin guard: a session that was not applied
    // sends the browser to /login instead.
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('35 / 50')).toBeVisible();
    await expect(page.getByText('Super Admin')).toBeVisible();
  });
});
