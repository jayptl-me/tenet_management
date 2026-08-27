/**
 * Enquiries lifecycle and conversion to tenant integration test.
 * Validates:
 * 1. Public user submits enquiry via landing page.
 * 2. Admin filters and updates enquiry status (new -> contacted).
 * 3. Conversion of enquiry into active tenant via POST /tenants updates enquiry status to converted.
 * 4. Admin deletion of enquiry.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { User } from '../models/user.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Enquiry } from '../models/enquiry.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import enquiryRoutes from '../routes/enquiries.js';
import tenantRoutes from '../routes/tenants.js';

type AnyDoc = Record<string, unknown>;
type Json = Record<string, unknown>;

const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const floorCreate = Floor.create.bind(Floor) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/enquiries', enquiryRoutes);
  api.route('/tenants', tenantRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();

describe('Enquiry Management & Tenant Conversion Lifecycle', () => {
  async function setupAdmin() {
    const admin = await userCreate({
      name: 'Admin Manager',
      email: `admin-enq-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
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
    token?: string,
    body?: unknown,
  ): Promise<{ status: number; body: Json }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await app.request(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: Json = {};
    try {
      parsed = text ? (JSON.parse(text) as Json) : {};
    } catch {
      throw new Error(
        `Failed to parse JSON from ${method} ${path} (status ${res.status}): ${text}`,
      );
    }
    return { status: res.status, body: parsed };
  }

  it('handles full enquiry journey: submit -> review -> contact -> convert to tenant -> delete', async () => {
    const { token: adminToken } = await setupAdmin();

    // 1. Public user submits enquiry
    const submitRes = await jsonReq('POST', '/api/v1/enquiries', undefined, {
      name: 'Karan Mehra',
      phone: '+919876543210',
      email: 'karan@example.com',
      preferredSharing: '2',
      message: 'Looking for 2-sharing room with AC.',
    });

    expect(submitRes.status).toBe(201);
    const createdEnquiry = submitRes.body.data as Json;
    const enquiryId = String(createdEnquiry._id ?? createdEnquiry.id);

    // 2. Admin retrieves list filtered by status: 'new'
    const listRes = await jsonReq('GET', '/api/v1/enquiries?status=new', adminToken);
    expect(listRes.status).toBe(200);
    const enquiriesList = listRes.body.data as Json[];
    expect(enquiriesList.some((e) => String(e._id ?? e.id) === enquiryId)).toBe(true);

    // 3. Admin updates status to 'contacted'
    const statusRes = await jsonReq('PUT', `/api/v1/enquiries/${enquiryId}/status`, adminToken, {
      status: 'contacted',
      notes: 'Called Karan on phone, agreed to visit tomorrow.',
    });
    expect(statusRes.status).toBe(200);
    expect((statusRes.body.data as Json).status).toBe('contacted');
    expect((statusRes.body.data as Json).notes).toContain('agreed to visit');

    // 4. Seed a room for tenant onboarding
    const floor = await floorCreate({
      floorNumber: 2,
      label: '2nd Floor',
      totalRooms: 5,
    });
    const room = await roomCreate({
      floorId: floor._id,
      roomNumber: `E${Date.now().toString().slice(-4)}`,
      sharingType: 2,
      monthlyRent: 8500,
      beds: Room.generateBeds(2),
    });
    const fullRoom = await Room.findById(room._id as string);
    const bedId = fullRoom!.beds[0].bedId;

    // 5. Admin converts enquiry to tenant
    const tenantRes = await jsonReq('POST', '/api/v1/tenants', adminToken, {
      name: 'Karan Mehra',
      phone: '+919876543210',
      email: 'karan.converted@example.com',
      roomId: String(fullRoom!._id),
      bedId,
      moveInDate: new Date().toISOString(),
      monthlyRent: 8500,
      depositPaid: 17000,
      enquiryId,
    });

    expect(tenantRes.status).toBe(201);

    // 6. Verify enquiry status was updated to converted
    const enquiryAfterConvert = await Enquiry.findById(enquiryId).lean();
    expect(enquiryAfterConvert).not.toBeNull();
    expect(enquiryAfterConvert!.status).toBe('converted');

    // 7. Admin deletes enquiry
    const deleteRes = await jsonReq('DELETE', `/api/v1/enquiries/${enquiryId}`, adminToken);
    expect(deleteRes.status).toBe(200);

    const checkDeleted = await Enquiry.findById(enquiryId).lean();
    expect(checkDeleted).toBeNull();
  });
});
