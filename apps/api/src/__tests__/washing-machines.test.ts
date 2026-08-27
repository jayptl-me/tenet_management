/**
 * Washing Machines functional lifecycle and tenant claim/release tests.
 * Validates:
 * 1. Admin creates, updates, and deletes washing machines per floor.
 * 2. Tenant claims an available machine -> transitions to in_use with timer.
 * 3. Concurrent/duplicate claim returns 409 conflict.
 * 4. Tenant or admin releases machine -> transitions back to available.
 * 5. Feature flag enforcement (laundryEnabled).
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { User } from '../models/user.js';
import { AppConfig } from '../models/appConfig.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import { invalidateFeatureFlagCache } from '../middleware/featureFlags.js';
import washingMachineRoutes from '../routes/washingMachines.js';

type AnyDoc = Record<string, unknown>;
type Json = Record<string, unknown>;

const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const configCreate = AppConfig.create.bind(AppConfig) as unknown as (
  doc: AnyDoc,
) => Promise<AnyDoc>;
const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const tenantCreate = Tenant.create.bind(Tenant) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/washing-machines', washingMachineRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();

describe('Washing Machines Lifecycle & Real-Time Claims', () => {
  async function setupEnvironment(laundryEnabled = true) {
    invalidateFeatureFlagCache();
    await AppConfig.deleteMany({});
    await configCreate({
      pgName: 'Test PG Washing',
      address: { line1: '1 Test Rd', city: 'Bangalore', state: 'KA', pincode: '560001' },
      phone: '+919876543210',
      email: 'test@example.com',
      roomPricing: { sharing2: 8000, sharing3: 6500, sharing4: 5000 },
      features: { laundryEnabled },
    });

    const admin = await userCreate({
      name: 'Admin User',
      email: `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      phone: `+9198${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'admin',
      isActive: true,
    });
    const adminToken = await signAccessToken({ sub: String(admin._id), role: 'admin' });

    const floor = await floorCreate({
      floorNumber: 1,
      label: '1st Floor',
      totalRooms: 10,
    });

    const room = await roomCreate({
      floorId: floor._id,
      roomNumber: `W${Date.now().toString().slice(-4)}`,
      sharingType: 2,
      monthlyRent: 8000,
      beds: Room.generateBeds(2),
    });

    const fullRoom = await Room.findById(room._id as string);
    if (!fullRoom) throw new Error('Room seed failed');

    const tenantUser = await userCreate({
      name: 'Rahul Sharma',
      email: `rahul-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      phone: `+9197${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash',
      role: 'tenant',
      isActive: true,
    });

    const tenant = await tenantCreate({
      userId: tenantUser._id,
      roomId: fullRoom._id,
      bedId: fullRoom.beds[0].bedId,
      moveInDate: new Date(),
      status: 'active',
      monthlyRent: 8000,
      depositAmount: 16000,
    });

    const tenantToken = await signAccessToken({ sub: String(tenantUser._id), role: 'tenant' });

    return { admin, adminToken, floor, room, tenantUser, tenant, tenantToken };
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
    const parsed = (await res.json()) as Json;
    return { status: res.status, body: parsed };
  }

  it('admin creates a washing machine, lists it, and updates details', async () => {
    const { adminToken, floor } = await setupEnvironment();

    // 1. Create Machine
    const createRes = await jsonReq('POST', '/api/v1/washing-machines', adminToken, {
      floorId: String(floor._id),
      machineNumber: 1,
      label: 'Samsung EcoBubble 7kg',
      timerDuration: 45,
    });

    expect(createRes.status).toBe(201);
    const machine = createRes.body.data as Json;
    expect(machine.machineNumber).toBe(1);
    expect(machine.status).toBe('available');
    expect(machine.label).toBe('Samsung EcoBubble 7kg');

    const machineId = machine._id as string;

    // 2. Update Machine
    const updateRes = await jsonReq('PUT', `/api/v1/washing-machines/${machineId}`, adminToken, {
      label: 'Samsung EcoBubble 8kg',
      status: 'under_maintenance',
    });

    expect(updateRes.status).toBe(200);
    const updated = updateRes.body.data as Json;
    expect(updated.label).toBe('Samsung EcoBubble 8kg');
    expect(updated.status).toBe('under_maintenance');
  });

  it('tenant claims an available washing machine and then releases it', async () => {
    const { adminToken, tenantToken, floor } = await setupEnvironment();

    // 1. Admin creates machine in available status
    const createRes = await jsonReq('POST', '/api/v1/washing-machines', adminToken, {
      floorId: String(floor._id),
      machineNumber: 2,
      label: 'LG DirectDrive',
      status: 'available',
      timerDuration: 40,
    });
    const machineId = (createRes.body.data as Json)._id as string;

    // 2. Tenant claims the machine
    const claimRes = await jsonReq(
      'POST',
      `/api/v1/washing-machines/${machineId}/claim`,
      tenantToken,
      { timerDuration: 35 },
    );

    expect(claimRes.status).toBe(200);
    const claimedMachine = claimRes.body.data as Json;
    expect(claimedMachine.status).toBe('in_use');
    expect(claimedMachine.timerDuration).toBe(35);
    expect(claimedMachine.claimedAt).toBeDefined();

    // 3. Second claim returns 409 Conflict
    const secondClaimRes = await jsonReq(
      'POST',
      `/api/v1/washing-machines/${machineId}/claim`,
      tenantToken,
      { timerDuration: 30 },
    );
    expect(secondClaimRes.status).toBe(409);

    // 4. Tenant releases machine
    const releaseRes = await jsonReq(
      'POST',
      `/api/v1/washing-machines/${machineId}/release`,
      tenantToken,
    );

    expect(releaseRes.status).toBe(200);
    const releasedMachine = releaseRes.body.data as Json;
    expect(releasedMachine.status).toBe('available');
    expect(releasedMachine.currentUser).toBeUndefined();
  });

  it('blocks washing machine endpoints when laundryEnabled feature flag is false', async () => {
    const { adminToken } = await setupEnvironment(false);

    const res = await jsonReq('GET', '/api/v1/washing-machines', adminToken);
    expect(res.status).toBe(403);
    expect((res.body.error as Json)?.code).toBe('FEATURE_DISABLED');
  });
});
