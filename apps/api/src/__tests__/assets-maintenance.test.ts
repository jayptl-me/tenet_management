/**
 * Assets inventory, low-stock alerts, and maintenance schedule tests.
 * Validates:
 * 1. Admin creates asset records with maintenance and quantity thresholds.
 * 2. Low-stock endpoint identifies depleted inventory.
 * 3. Service-due endpoint identifies items requiring maintenance within 30 days.
 * 4. Status updates to under_maintenance / retired and deletion.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { User } from '../models/user.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import assetRoutes from '../routes/assets.js';

type AnyDoc = Record<string, unknown>;
type Json = Record<string, unknown>;

const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/assets', assetRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();

describe('Assets Inventory & Maintenance Management', () => {
  async function setupAdmin() {
    const admin = await userCreate({
      name: 'Admin Assets',
      email: `admin-assets-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      phone: `+9198${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'admin',
      isActive: true,
    });
    const token = await signAccessToken({ sub: String(admin._id), role: 'admin' });
    return { admin, token };
  }

  async function jsonReq(
    method: string,
    path: string,
    token: string,
    body?: unknown,
  ): Promise<{ status: number; body: Json }> {
    const res = await app.request(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const parsed = text ? (JSON.parse(text) as Json) : {};
    return { status: res.status, body: parsed };
  }

  it('manages asset lifecycle, detects low stock and upcoming service requirements', async () => {
    const { token: adminToken } = await setupAdmin();

    const today = new Date();
    const serviceDueDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days from now

    // 1. Create asset that is low stock and service due soon
    const createRes = await jsonReq('POST', '/api/v1/assets', adminToken, {
      name: 'Havells Water Geyser 25L',
      category: 'appliance',
      location: 'Floor 1 Common Bathroom',
      quantity: 1,
      lowStockThreshold: 2,
      status: 'available',
      purchasedDate: new Date('2025-01-01').toISOString(),
      nextServiceDate: serviceDueDate,
      notes: 'Needs periodic descaling.',
    });

    expect(createRes.status).toBe(201);
    const asset = createRes.body.data as Json;
    const assetId = String(asset.id ?? asset._id);
    expect(asset.name).toBe('Havells Water Geyser 25L');

    // 2. Verify low-stock alert
    const lowStockRes = await jsonReq('GET', '/api/v1/assets/low-stock', adminToken);
    expect(lowStockRes.status).toBe(200);
    const lowStockItems = lowStockRes.body.data as Json[];
    expect(lowStockItems.some((item) => String(item.id ?? item._id) === assetId)).toBe(true);

    // 3. Verify service-due alert
    const serviceDueRes = await jsonReq('GET', '/api/v1/assets/service-due', adminToken);
    expect(serviceDueRes.status).toBe(200);
    const serviceDueItems = serviceDueRes.body.data as Json[];
    expect(serviceDueItems.some((item) => String(item.id ?? item._id) === assetId)).toBe(true);

    // 4. Update asset status to under_maintenance
    const updateRes = await jsonReq('PUT', `/api/v1/assets/${assetId}`, adminToken, {
      status: 'under_maintenance',
      lastServicedDate: new Date().toISOString(),
      quantity: 5, // replenish stock
    });
    expect(updateRes.status).toBe(200);
    expect((updateRes.body.data as Json).status).toBe('under_maintenance');
    expect((updateRes.body.data as Json).quantity).toBe(5);

    // 5. Delete asset
    const deleteRes = await jsonReq('DELETE', `/api/v1/assets/${assetId}`, adminToken);
    expect(deleteRes.status).toBe(200);

    const checkRes = await jsonReq('GET', `/api/v1/assets/${assetId}`, adminToken);
    expect(checkRes.status).toBe(200);
    expect((checkRes.body.data as Json).status).toBe('retired');
  });
});
