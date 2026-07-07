import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { logger as honoLogger } from 'hono/logger';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from './lib/db.js';
import { securityHeaders } from './middleware/security.js';
import { requestId } from './middleware/requestId.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import floorRoutes from './routes/floors.js';
import roomRoutes from './routes/rooms.js';
import tenantRoutes from './routes/tenants.js';
import complaintRoutes from './routes/complaints.js';
import serviceRoutes from './routes/services.js';
import mealRoutes from './routes/meals.js';
import menuRoutes from './routes/menus.js';
import noticeRoutes from './routes/notices.js';
import visitorRoutes from './routes/visitors.js';
import assetRoutes from './routes/assets.js';
import attendanceRoutes from './routes/attendance.js';
import leaveRoutes from './routes/leaves.js';
import guardianRoutes from './routes/guardians.js';
import enquiryRoutes from './routes/enquiries.js';
import dashboardRoutes from './routes/dashboard.js';
import appConfigRoutes from './routes/appConfig.js';
import paymentRoutes from './routes/payments.js';
import invoiceRoutes from './routes/invoices.js';
import electricityRoutes from './routes/electricity.js';
import jobRoutes from './routes/jobs.js';
import notificationRoutes from './routes/notifications.js';
import sseRoutes from './routes/sse.js';
import { startScheduler } from './jobs/scheduler.js';

const app = new Hono();

// ── Global Middleware Stack ──────────────────────────────
app.use('*', compress());
app.use(
  '*',
  cors({
    origin:
      env.NODE_ENV === 'production'
        ? [env.FRONTEND_URL]
        : ['http://localhost:3000', 'http://localhost:5173', 'capacitor://localhost'],
    credentials: true,
    maxAge: 86400,
  }),
);
app.use('*', requestId);
app.use('*', securityHeaders);

if (env.NODE_ENV === 'development') {
  app.use('*', honoLogger());
}

// ── API v1 ──────────────────────────────────────────────
const api = new Hono().basePath('/api/v1');

api.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: isDatabaseConnected() ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    bunVersion: Bun.version,
    memory: process.memoryUsage(),
  }),
);

api.route('/auth', authRoutes);
api.route('/floors', floorRoutes);
api.route('/rooms', roomRoutes);
api.route('/tenants', tenantRoutes);
api.route('/complaints', complaintRoutes);
api.route('/services', serviceRoutes);
api.route('/meals', mealRoutes);
api.route('/menus', menuRoutes);
api.route('/notices', noticeRoutes);
api.route('/visitors', visitorRoutes);
api.route('/assets', assetRoutes);
api.route('/attendance', attendanceRoutes);
api.route('/leaves', leaveRoutes);
api.route('/guardians', guardianRoutes);
api.route('/enquiries', enquiryRoutes);
api.route('/dashboard', dashboardRoutes);
api.route('/app-config', appConfigRoutes);
api.route('/payments', paymentRoutes);
api.route('/invoices', invoiceRoutes);
api.route('/electricity', electricityRoutes);
api.route('/jobs', jobRoutes);
api.route('/notifications', notificationRoutes);
api.route('/sse', sseRoutes);

app.onError(globalErrorHandler);
app.route('/', api);

api.all('*', (c) =>
  c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404,
  ),
);

// ── Server Start ────────────────────────────────────────
const server = Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
  idleTimeout: 120,
});

logger.info({ port: env.PORT }, `Server running on http://localhost:${env.PORT}`);

try {
  await connectDatabase();
  startScheduler();
} catch (error) {
  logger.fatal({ err: error }, 'Failed to start server — database offline');
  process.exit(1);
}

// ── Graceful Shutdown ───────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} — shutting down`);
  server.stop(true);
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

// ── Self-Ping (Render free tier keep-alive) ─────────────
function setupSelfPing(): void {
  if (env.NODE_ENV !== 'production') return;

  setInterval(
    () => {
      fetch(`http://localhost:${env.PORT}/api/v1/health`)
        .then(() => {})
        .catch(() => {});
    },
    4 * 60 * 1000,
  );
}

setupSelfPing();

// No default export — Bun auto-starts if it finds `export default { fetch }`.
// We call Bun.serve() explicitly above, so no default export here.
