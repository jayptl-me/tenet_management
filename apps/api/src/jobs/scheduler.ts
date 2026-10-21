import cron from 'node-cron';
import { generateMonthlyInvoices, getCurrentMonth } from '../services/invoice.service.js';
import { createNotification } from '../services/notification.service.js';
import { Payment } from '../models/payment.js';
import { Invoice } from '../models/invoice.js';
import { Tenant } from '../models/tenant.js';
import { WashingMachine } from '../models/washingMachine.js';
import { logger } from '../lib/logger.js';

// ── Whether cron jobs are running ───────────────────────
let isRunning = false;

/**
 * Tells the tenants of the invoices that just went overdue.
 *
 * The rows are captured BEFORE the bulk write, so a notification always names
 * an invoice the write really moved. The recipient is the tenant's own user,
 * resolved from the tenant record, never from a client-supplied id. Every send
 * has its own try/catch: a failed push never undoes the overdue write.
 */
async function notifyOverdueInvoices(invoices: Array<Record<string, unknown>>): Promise<void> {
  for (const invoice of invoices) {
    const invoiceId = String(invoice._id ?? '');
    try {
      const tenantRaw = await Tenant.findById(String(invoice.tenantId ?? ''))
        .select('userId')
        .lean();
      const userId = (tenantRaw as { userId?: unknown } | null)?.userId;
      if (!tenantRaw || !userId) {
        logger.warn(
          { invoiceId, tenantId: String(invoice.tenantId ?? '') },
          'Overdue invoice notification skipped: tenant has no user',
        );
        continue;
      }

      const invoiceNumber = String(invoice.invoiceNumber ?? '');
      const month = String(invoice.month ?? '');
      await createNotification({
        targetType: 'individual',
        targetIds: [String(userId)],
        title: 'Invoice overdue',
        body:
          `Your invoice ${invoiceNumber} for ${month} is now overdue. ` +
          `Please settle the pending amount.`,
        type: 'payment_reminder',
        data: { invoiceId, invoiceNumber, month },
        sendPush: true,
      });
    } catch (err) {
      logger.error({ err, invoiceId }, 'Failed to notify tenant about an overdue invoice');
    }
  }
}

/**
 * Marks the past-due invoices of one month overdue and tells the tenants.
 *
 * The rows are captured BEFORE the bulk write, so a notification always names
 * an invoice the write really moved.
 */
export async function runMonthlyOverdueSweep(month: string): Promise<void> {
  const now = new Date();

  // The invoices the write below is about to move: captured before the write,
  // so the notification always names an invoice that really went overdue.
  const invoicesGoingOverdue = (await Invoice.find({
    status: 'sent',
    dueDate: { $lt: now },
    month,
  })
    .select('_id invoiceNumber month tenantId')
    .lean()) as unknown as Array<Record<string, unknown>>;

  await Payment.updateMany(
    { status: 'pending', dueDate: { $lt: now }, month },
    { status: 'overdue' },
  );

  await Invoice.updateMany({ status: 'sent', dueDate: { $lt: now }, month }, { status: 'overdue' });

  await notifyOverdueInvoices(invoicesGoingOverdue);
}

/**
 * Marks every past-due invoice overdue and tells the tenants.
 *
 * The rows are captured BEFORE the bulk write, so a notification always names
 * an invoice the write really moved.
 */
export async function runDailyOverdueCheck(): Promise<void> {
  const now = new Date();

  // The invoices the write below is about to move: captured before the write,
  // so the notification always names an invoice that really went overdue.
  const invoicesGoingOverdue = (await Invoice.find({
    status: 'sent',
    dueDate: { $lt: now },
  })
    .select('_id invoiceNumber month tenantId')
    .lean()) as unknown as Array<Record<string, unknown>>;

  const [paymentResult, invoiceResult] = await Promise.all([
    Payment.updateMany({ status: 'pending', dueDate: { $lt: now } }, { status: 'overdue' }),
    // Never clobber partial: partially paid past-due stays partial for UI filters.
    Invoice.updateMany({ status: 'sent', dueDate: { $lt: now } }, { status: 'overdue' }),
  ]);

  await notifyOverdueInvoices(invoicesGoingOverdue);

  logger.info(
    {
      paymentsOverdue: paymentResult.modifiedCount,
      invoicesOverdue: invoiceResult.modifiedCount,
      invoicesNotified: invoicesGoingOverdue.length,
    },
    'Daily overdue check complete',
  );
}

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

      logger.info({ count: overduePayments.length, month }, 'Dispatching payment reminders');

      const userIds = new Set<string>();
      for (const payment of overduePayments) {
        const t = payment.tenantId as { userId?: { _id?: unknown } } | null;
        if (t?.userId?._id) {
          userIds.add(String(t.userId._id));
        }
      }

      for (const userId of userIds) {
        try {
          await createNotification({
            targetType: 'individual',
            targetIds: [userId],
            title: 'Payment Reminder',
            body: `You have pending or overdue dues for ${month}. Please settle your payment to avoid late penalties.`,
            type: 'payment_reminder',
            data: { month },
            sendPush: true,
          });
        } catch (err) {
          logger.error({ err, userId }, 'Failed to dispatch scheduled payment reminder');
        }
      }

      // Mark pending as overdue if past due date
      await runMonthlyOverdueSweep(month);
    } catch (err) {
      logger.error({ err, month }, 'Payment reminder job failed');
    }
  });

  // ── Daily at 8 AM: Mark overdue ──────────────────────
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running daily overdue check');

    try {
      await runDailyOverdueCheck();
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

      logger.info({ count: activeTenants.length }, 'Dispatching meal feedback prompt');

      if (activeTenants.length > 0) {
        await createNotification({
          targetType: 'all',
          title: 'Meal Feedback Prompt',
          body: 'How was your recent meal? Please share your rating and feedback in the meal menu.',
          type: 'meal_feedback',
          sendPush: true,
        });
      }
    } catch (err) {
      logger.error({ err }, 'Meal feedback prompt job failed');
    }
  });

  // ── Every minute: Release expired washing machine timers ─────
  cron.schedule('* * * * *', async () => {
    try {
      const result = await WashingMachine.updateMany(
        {
          status: 'in_use',
          timerEndsAt: { $lte: new Date() },
        },
        {
          $set: {
            status: 'available',
            currentUserId: null,
            claimedAt: null,
            timerEndsAt: null,
          },
        },
      );

      if (result.modifiedCount > 0) {
        logger.info({ released: result.modifiedCount }, 'Expired washing machine timers released');
      }
    } catch (err) {
      logger.error({ err }, 'Washing machine timer expiry job failed');
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
