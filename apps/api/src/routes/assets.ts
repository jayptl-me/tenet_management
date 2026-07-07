import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import {
  notFound,
  badRequest,
  parseId,
  parsePagination,
  paginatedResponse,
} from '../lib/routeUtils.js';
import { Asset } from '../models/asset.js';

const assets = new Hono();

// ── Schemas ─────────────────────────────────────────────
const createAssetSchema = z.strictObject({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name cannot exceed 120 characters'),
  category: z.enum(['furniture', 'appliance', 'electronics', 'cleaning', 'other']),
  location: z
    .string()
    .min(1, 'Location is required')
    .max(160, 'Location cannot exceed 160 characters'),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  lowStockThreshold: z.number().int().min(0, 'Threshold cannot be negative').default(0),
  status: z
    .enum(['available', 'in_use', 'under_maintenance', 'damaged', 'retired'])
    .default('available'),
  purchasedDate: z.string().datetime({ message: 'Invalid ISO date' }).optional(),
  lastServicedDate: z.string().datetime({ message: 'Invalid ISO date' }).optional(),
  nextServiceDate: z.string().datetime({ message: 'Invalid ISO date' }).optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

const updateAssetSchema = createAssetSchema.partial();

// ── GET /assets ─────────────────────────────────────────
assets.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, sort, order, skip } = parsePagination(c);
  const category = c.req.query('category');
  const status = c.req.query('status');
  const search = c.req.query('search');

  const filter: Record<string, unknown> = {};
  if (category) {
    filter.category = category;
  }
  if (status) {
    filter.status = status;
  }
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }

  const [data, total] = await Promise.all([
    Asset.find(filter)
      .sort({ category: 1, name: 1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .lean(),
    Asset.countDocuments(filter as Record<string, unknown>),
  ]);

  return c.json({
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── GET /assets/low-stock ───────────────────────────────
assets.get('/low-stock', authGuard, adminOnly, async (c) => {
  const data = await Asset.find({
    lowStockThreshold: { $gt: 0 },
    $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
  })
    .sort({ category: 1, name: 1 } as Record<string, 1 | -1>)
    .lean();

  return c.json({ success: true, data });
});

// ── POST /assets ────────────────────────────────────────
assets.post('/', authGuard, adminOnly, zValidator('json', createAssetSchema), async (c) => {
  const body = c.req.valid('json');

  const asset = await Asset.create(body);
  return c.json({ success: true, data: asset }, 201);
});

// ── PUT /assets/:id ─────────────────────────────────────
assets.put('/:id', authGuard, adminOnly, zValidator('json', updateAssetSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid asset ID');

  const body = c.req.valid('json');

  const asset = await Asset.findByIdAndUpdate(id, body, {
    returnDocument: 'after',
    runValidators: true,
  }).lean();

  if (!asset) return notFound(c, 'Asset');

  return c.json({ success: true, data: asset });
});

// ── DELETE /assets/:id ──────────────────────────────────
assets.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid asset ID');

  const asset = await Asset.findByIdAndUpdate(id, { status: 'retired' }, { returnDocument: 'after' }).lean();

  if (!asset) return notFound(c, 'Asset');

  return c.json({ success: true, data: { message: 'Asset retired' } });
});

export default assets;
