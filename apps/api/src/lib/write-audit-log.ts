import mongoose from 'mongoose';
import { AuditLog } from '../models/auditLog.js';
import { logger } from './logger.js';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'payment_verify'
  | 'complaint_status_change'
  | 'tenant_checkout'
  | 'tenant_transfer'
  | 'settings_change'
  | 'notification_send'
  | 'visitor_approve'
  | 'export';

export interface WriteAuditLogParams {
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Persist an audit log entry using the closed AuditLog.action enum.
 * Failures are logged but never throw — audit must not break primary flows.
 */
export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    type CreateFn = (doc: Record<string, unknown>) => Promise<unknown>;
    const create = AuditLog.create.bind(AuditLog) as unknown as CreateFn;
    await create({
      userId: new mongoose.Types.ObjectId(params.userId),
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      details: params.details ?? {},
      ip: params.ip,
      userAgent: params.userAgent,
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error(
      { err, action: params.action, resource: params.resource },
      'Failed to write audit log',
    );
  }
}
