import { Hono } from 'hono';
import { env } from '../lib/env.js';
import { generateMonthlyInvoices, getCurrentMonth } from '../services/invoice.service.js';
import { Payment } from '../models/payment.js';
import { Invoice } from '../models/invoice.js';
import { Tenant } from '../models/tenant.js';
import { logger } from '../lib/logger.js';

const jobs = new Hono();

// Middleware to protect routes with the cron secret
jobs.use('*', async (c, next) => {
  const secret = c.req.header('x-cron-secret');
  if (!secret || secret !== env.CRON_SECRET) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' },
      },
      401,
    );
  }
  await next();
});

// POST /jobs/generate-invoices
jobs.post('/generate-invoices', async (c) => {
  const month = getCurrentMonth();
  logger.info({ month }, 'Triggered job: generate-invoices');
  try {
    const result = await generateMonthlyInvoices(month);
    return c.json({
      success: true,
      message: 'Monthly invoice generation complete',
      data: result,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error({ err, month }, 'Job generate-invoices failed');
    return c.json(
      {
        success: false,
        error: { code: 'JOB_FAILED', message: err.message || 'Invoice generation failed' },
      },
      500,
    );
  }
});

// POST /jobs/overdue-check
jobs.post('/overdue-check', async (c) => {
  const now = new Date();
  logger.info('Triggered job: overdue-check');
  try {
    const [paymentResult, invoiceResult] = await Promise.all([
      Payment.updateMany({ status: 'pending', dueDate: { $lt: now } }, { status: 'overdue' }),
      Invoice.updateMany(
        { status: { $in: ['sent', 'partial'] }, dueDate: { $lt: now } },
        { status: 'overdue' },
      ),
    ]);

    logger.info(
      {
        paymentsOverdue: paymentResult.modifiedCount,
        invoicesOverdue: invoiceResult.modifiedCount,
      },
      'Job overdue-check complete',
    );

    return c.json({
      success: true,
      message: 'Daily overdue check complete',
      data: {
        paymentsOverdue: paymentResult.modifiedCount,
        invoicesOverdue: invoiceResult.modifiedCount,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error({ err }, 'Job overdue-check failed');
    return c.json(
      {
        success: false,
        error: { code: 'JOB_FAILED', message: err.message || 'Overdue check failed' },
      },
      500,
    );
  }
});

// POST /jobs/send-reminders
jobs.post('/send-reminders', async (c) => {
  const month = getCurrentMonth();
  logger.info({ month }, 'Triggered job: send-reminders');

  try {
    const overduePayments = await (Payment.find({
      status: { $in: ['pending', 'overdue'] },
      month,
    })
      .populate({
        path: 'tenantId',
        populate: { path: 'userId', select: 'name phone' },
      })
      .lean() as unknown as Array<Record<string, unknown>>);

    logger.info({ count: overduePayments.length, month }, 'Payment reminders triggered');

    // In Phase 5, we will trigger actual push notifications/alerts here via notificationService.

    // Also perform the due date update as in scheduler.ts:
    const now = new Date();
    const [paymentUpdate, invoiceUpdate] = await Promise.all([
      Payment.updateMany(
        { status: 'pending', dueDate: { $lt: now }, month },
        { status: 'overdue' },
      ),
      Invoice.updateMany({ status: 'sent', dueDate: { $lt: now }, month }, { status: 'overdue' }),
    ]);

    return c.json({
      success: true,
      message: 'Payment reminders processed',
      data: {
        remindersLoggedCount: overduePayments.length,
        paymentsMarkedOverdue: paymentUpdate.modifiedCount,
        invoicesMarkedOverdue: invoiceUpdate.modifiedCount,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error({ err, month }, 'Job send-reminders failed');
    return c.json(
      {
        success: false,
        error: { code: 'JOB_FAILED', message: err.message || 'Payment reminders job failed' },
      },
      500,
    );
  }
});

// POST /jobs/meal-prompts
jobs.post('/meal-prompts', async (c) => {
  logger.info('Triggered job: meal-prompts');
  try {
    const activeTenants = await (Tenant.find({ isActive: true })
      .populate('userId', 'name')
      .lean() as unknown as Array<Record<string, unknown>>);

    logger.info({ count: activeTenants.length }, 'Meal feedback prompts triggered');

    // In Phase 5, we will send push notification prompts via notificationService here.

    return c.json({
      success: true,
      message: 'Meal feedback prompts processed',
      data: {
        tenantsPromptedCount: activeTenants.length,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error({ err }, 'Job meal-prompts failed');
    return c.json(
      {
        success: false,
        error: { code: 'JOB_FAILED', message: err.message || 'Meal prompts job failed' },
      },
      500,
    );
  }
});

export default jobs;
