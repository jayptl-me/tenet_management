import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, safeFilter } from '../lib/routeUtils.js';
import { LaundrySlot } from '../models/laundrySlot.js';

const laundry = new Hono();

// ── Schemas ─────────────────────────────────────────────
const createSlotSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant is required'),
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  items: z.number().int().min(1, 'At least 1 item').optional(),
  notes: z.string().max(300).optional(),
});

const updateSlotSchema = z.strictObject({
  status: z.enum(['booked', 'completed', 'cancelled']).optional(),
  slotDate: z.string().min(1).optional(),
  slotTime: z.string().min(1).optional(),
  items: z.number().int().min(1).optional(),
  notes: z.string().max(300).optional(),
});

// ── GET /laundry-slots ──────────────────────────────────
laundry.get('/', authGuard, async (c) => {
  const user = c.get('user');

  // Tenants see only their own slots
  if (user.role === 'tenant') {
    const { Tenant } = await import('../models/tenant.js');
    const tenant = await Tenant.findOne(safeFilter({ userId: user.sub })).lean();
    if (!tenant) return c.json({ success: true, data: [] });
    const data = await LaundrySlot.find(safeFilter({ tenantId: tenant._id }))
      .sort({ slotDate: -1, slotTime: -1 })
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
      .lean();
    return c.json({ success: true, data });
  }

  // Admins see all
  const data = await LaundrySlot.find()
    .sort({ slotDate: -1, slotTime: -1 })
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
    .lean();
  return c.json({ success: true, data });
});

// ── GET /laundry-slots/:id ──────────────────────────────
laundry.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid slot ID');

  const slot = await LaundrySlot.findById(id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name phone' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
    .lean();
  if (!slot) return notFound(c, 'Laundry slot');

  return c.json({ success: true, data: slot });
});

// ── POST /laundry-slots ─────────────────────────────────
laundry.post('/', authGuard, zValidator('json', createSlotSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  // If tenant, force their own tenantId
  if (user.role === 'tenant') {
    const { Tenant } = await import('../models/tenant.js');
    const tenant = await Tenant.findOne(safeFilter({ userId: user.sub })).lean();
    if (!tenant) return badRequest(c, 'No tenant profile found', 'TENANT_REQUIRED');
    body.tenantId = String((tenant as unknown as Record<string, unknown>)._id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slot: any = await LaundrySlot.create(body as any);
  const populated = await LaundrySlot.findById(String((slot as any)._id))
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
    .lean();

  return c.json({ success: true, data: populated }, 201);
});

// ── PUT /laundry-slots/:id ──────────────────────────────
laundry.put('/:id', authGuard, adminOnly, zValidator('json', updateSlotSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid slot ID');

  const body = c.req.valid('json');
  const slot = await LaundrySlot.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  })
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
    .lean();

  if (!slot) return notFound(c, 'Laundry slot');
  return c.json({ success: true, data: slot });
});

// ── DELETE /laundry-slots/:id ───────────────────────────
laundry.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid slot ID');

  const slot = await LaundrySlot.findByIdAndDelete(id);
  if (!slot) return notFound(c, 'Laundry slot');
  return c.json({ success: true, data: { message: 'Laundry slot deleted' } });
});

export default laundry;
