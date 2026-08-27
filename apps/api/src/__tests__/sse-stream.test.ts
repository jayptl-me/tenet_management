/**
 * Real-time SSE stream tests for /api/v1/sse/admin.
 * Validates:
 * 1. Authentication via Authorization header and ?token= query param.
 * 2. Rejection of unauthenticated requests (401) and non-admin roles (403).
 * 3. Connection handshake (event: connected).
 * 4. Real-time event broadcasting via publishEvent().
 * 5. Clean disconnect and subscriber unregistration on abort signal (preventing memory leaks).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { User } from '../models/user.js';
import { signAccessToken } from '../lib/jwt.js';
import { globalErrorHandler } from '../middleware/errorHandler.js';
import { publishEvent, getClientCount, clearAll } from '../lib/eventBus.js';
import sseRoutes from '../routes/sse.js';

type AnyDoc = Record<string, unknown>;
const userCreate = User.create.bind(User) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

function buildApp() {
  const app = new Hono();
  app.onError(globalErrorHandler);
  const api = new Hono().basePath('/api/v1');
  api.route('/sse', sseRoutes);
  app.route('/', api);
  return app;
}

const app = buildApp();

describe('Real-Time Server-Sent Events (SSE) Stream', () => {
  beforeEach(() => {
    clearAll();
  });

  afterEach(async () => {
    clearAll();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  async function createTestUser(role: 'admin' | 'tenant' | 'guardian') {
    const user = await userCreate({
      name: `Test ${role}`,
      email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      phone: `+9198${String(Date.now()).slice(-8)}`,
      passwordHash: 'hash123',
      role,
      isActive: true,
    });
    const token = await signAccessToken({ sub: String(user._id), role });
    return { user, token };
  }

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const res = await app.request('/api/v1/sse/admin');
    expect(res.status).toBe(401);
    const json = (await res.json()) as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects non-admin role (tenant/guardian) with 403 FORBIDDEN', async () => {
    const { token: tenantToken } = await createTestUser('tenant');
    const res = await app.request('/api/v1/sse/admin', {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    expect(res.status).toBe(403);
    const json = (await res.json()) as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('accepts valid admin token via Authorization header and sends handshake', async () => {
    const { token: adminToken } = await createTestUser('admin');
    const abortCtrl = new AbortController();

    const res = await app.request('/api/v1/sse/admin', {
      headers: { Authorization: `Bearer ${adminToken}` },
      signal: abortCtrl.signal,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    const firstChunk = await reader!.read();
    expect(firstChunk.done).toBe(false);

    const chunkText = decoder.decode(firstChunk.value);
    expect(chunkText).toContain('event: connected');
    expect(chunkText).toContain('SSE connection established');

    expect(getClientCount()).toBe(1);

    abortCtrl.abort();
    await reader?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('accepts valid admin token via ?token= query parameter', async () => {
    const { token: adminToken } = await createTestUser('admin');
    const abortCtrl = new AbortController();

    const res = await app.request(`/api/v1/sse/admin?token=${adminToken}`, {
      signal: abortCtrl.signal,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    const firstChunk = await reader!.read();
    const chunkText = decoder.decode(firstChunk.value);

    expect(chunkText).toContain('event: connected');

    abortCtrl.abort();
    await reader?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('broadcasts real-time events to connected SSE client streams', async () => {
    const { token: adminToken } = await createTestUser('admin');
    const abortCtrl = new AbortController();

    const res = await app.request('/api/v1/sse/admin', {
      headers: { Authorization: `Bearer ${adminToken}` },
      signal: abortCtrl.signal,
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    // Read initial connection event
    const handshake = await reader!.read();
    expect(decoder.decode(handshake.value)).toContain('event: connected');

    // Broadcast a custom event
    publishEvent('new_complaint', {
      complaintId: 'cmp_12345',
      category: 'plumbing',
      title: 'Water tap leaking',
    });

    // Read broadcasted event
    const eventChunk = await reader!.read();
    const eventText = decoder.decode(eventChunk.value);

    expect(eventText).toContain('event: new_complaint');
    expect(eventText).toContain('Water tap leaking');
    expect(eventText).toContain('cmp_12345');

    // Broadcast payment received event
    publishEvent('payment_received', {
      paymentId: 'pay_999',
      amount: 8500,
      tenantName: 'Alex Doe',
    });

    const paymentChunk = await reader!.read();
    const paymentText = decoder.decode(paymentChunk.value);

    expect(paymentText).toContain('event: payment_received');
    expect(paymentText).toContain('Alex Doe');
    expect(paymentText).toContain('8500');

    abortCtrl.abort();
    await reader?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('cleans up client subscriber on stream disconnect without memory leaks', async () => {
    const { token: adminToken } = await createTestUser('admin');
    const abortCtrl = new AbortController();

    const res = await app.request('/api/v1/sse/admin', {
      headers: { Authorization: `Bearer ${adminToken}` },
      signal: abortCtrl.signal,
    });

    const reader = res.body?.getReader();
    await reader!.read();

    expect(getClientCount()).toBe(1);

    // Trigger disconnect via abort signal and cancel reader
    abortCtrl.abort();
    await reader?.cancel();

    // Allow event listener microtasks / macrotasks to resolve
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(getClientCount()).toBe(0);
  });
});
