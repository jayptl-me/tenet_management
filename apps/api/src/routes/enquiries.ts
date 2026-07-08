import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { publicLimiter } from '../middleware/rateLimiter.js';
import { notFound, badRequest, parseId, parsePagination } from '../lib/routeUtils.js';
import { Enquiry } from '../models/enquiry.js';

const enquiries = new Hono();

// ── Schemas ─────────────────────────────────────────────
const createEnquirySchema = z.strictObject({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  phone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number (+91 followed by 10 digits)'),
  email: z.string().email('Invalid email address'),
  sharingPreference: z.enum(['2', '3', '4', 'any']),
  message: z.string().max(1000, 'Message cannot exceed 1000 characters').optional(),
});

const updateStatusSchema = z.strictObject({
  status: z.enum(['new', 'contacted', 'converted', 'lost']),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

// ── POST /enquiries ─────────────────────────────────────
enquiries.post('/', publicLimiter, zValidator('json', createEnquirySchema), async (c) => {
  const body = c.req.valid('json');

  const enquiry = await Enquiry.create({
    ...body,
    status: 'new',
    source: 'landing_page',
  });

  return c.json({ success: true, data: enquiry }, 201);
});

// ── GET /enquiries ──────────────────────────────────────
enquiries.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, skip } = parsePagination(c);
  const status = c.req.query('status');
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');

  const filter: Record<string, unknown> = {};

  if (status) {
    filter.status = status;
  }

  if (fromDate || toDate) {
    const createdAtFilter: Record<string, unknown> = {};
    if (fromDate) {
      createdAtFilter['$gte'] = new Date(fromDate);
    }
    if (toDate) {
      createdAtFilter['$lte'] = new Date(toDate);
    }
    filter.createdAt = createdAtFilter;
  }

  const [data, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .lean(),
    Enquiry.countDocuments(filter as Record<string, unknown>),
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

// ── GET /enquiries/:id ──────────────────────────────────
enquiries.get('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid enquiry ID');

  const enquiry = await Enquiry.findById(id).lean();
  if (!enquiry) return notFound(c, 'Enquiry');

  return c.json({ success: true, data: enquiry });
});

// ── PUT /enquiries/:id/status ───────────────────────────
enquiries.put(
  '/:id/status',
  authGuard,
  adminOnly,
  zValidator('json', updateStatusSchema),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid enquiry ID');

    const body = c.req.valid('json');

    const enquiry = await Enquiry.findByIdAndUpdate(id, body, {
      returnDocument: 'after',
      runValidators: true,
    }).lean();

    if (!enquiry) return notFound(c, 'Enquiry');

    return c.json({ success: true, data: enquiry });
  },
);

// ── DELETE /enquiries/:id ────────────────────────────────
enquiries.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid enquiry ID');

  const enquiry = await Enquiry.findByIdAndDelete(id);
  if (!enquiry) return notFound(c, 'Enquiry');

  return c.json({ success: true, data: { message: 'Enquiry deleted' } });
});

export default enquiries;
