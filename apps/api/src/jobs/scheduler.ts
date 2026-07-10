import cron from 'node-cron';
import { generateMonthlyInvoices, getCurrentMonth } from '../services/invoice.service.js';
import { Payment } from '../models/payment.js';
import { Invoice } from '../models/invoice.js';
import { Tenant } from '../models/tenant.js';
import { logger } from '../lib/logger.js';

// ── Whether cron jobs are running ───────────────────────
let isRunning = false;

/**
 * Starts all scheduled cron jobs. Called once at server startup.
 */
export function startScheduler(): void {
  if (isRunning) {
    logger.warn('Scheduler already running');
    return;
  }

  // ── 1st of month at 9 AM: Generate invoices ───────────
  cron.schedule('0 9 1 * *', async () => {
    const month = getCurrentMonth();
    logger.info({ month }, 'Starting monthly invoice generation (cron)');
    try {
      const result = await generateMonthlyInvoices(month);
      logger.info({ month, ...result }, 'Monthly invoice generation complete');
    } catch (err) {
      logger.error({ err, month }, 'Monthly invoice generation failed');
    }
  });

  // ── 5th, 10th, 15th at 10 AM: Payment reminders ───────
  cron.schedule('0 10 5,10,15 * *', async () => {
    const month = getCurrentMonth();
    logger.info({ month }, 'Running payment reminder job');

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

      logger.info({ count: overduePayments.length, month }, 'Payment reminders would be sent');

      // TODO: Phase 5 — integrate with ntfy.sh push notifications
      // For now, just logs the count. In Phase 5, send actual push + in-app notifications.

      // Mark pending as overdue if past due date
      const now = new Date();
      await Payment.updateMany(
        { status: 'pending', dueDate: { $lt: now }, month },
        { status: 'overdue' },
      );

      await Invoice.updateMany(
        { status: 'sent', dueDate: { $lt: now }, month },
        { status: 'overdue' },
      );
    } catch (err) {
      logger.error({ err, month }, 'Payment reminder job failed');
    }
  });

  // ── Daily at 8 AM: Mark overdue ──────────────────────
  cron.schedule('0 8 * * *', async () => {
    const now = new Date();
    logger.info('Running daily overdue check');

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
        'Daily overdue check complete',
      );
    } catch (err) {
      logger.error({ err }, 'Daily overdue check failed');
    }
  });

  // ── Noon & 7 PM: Meal feedback prompt ────────────────
  cron.schedule('0 12,19 * * *', async () => {
    logger.info('Running meal feedback prompt job');
    try {
      const activeTenants = await (Tenant.find({ isActive: true })
        .populate('userId', 'name')
        .lean() as unknown as Array<Record<string, unknown>>);

      logger.info({ count: activeTenants.length }, 'Meal feedback prompts would be sent');

      // TODO: Phase 5 — send ntfy.sh push to each tenant
    } catch (err) {
      logger.error({ err }, 'Meal feedback prompt job failed');
    }
  });

  isRunning = true;
  logger.info('Scheduler started — all cron jobs registered');
}

/**
 * Stops all cron jobs. Called during graceful shutdown.
 */
export function stopScheduler(): void {
  cron.getTasks().forEach((task) => task.stop());
  isRunning = false;
  logger.info('Scheduler stopped');
}
