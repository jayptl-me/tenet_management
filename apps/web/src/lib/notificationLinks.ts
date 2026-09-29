import type { INotification } from '@pg/types';

/**
 * Resolve the admin surface a notification should deep-link to, if any.
 * Returns null when the notification has no specific destination and the
 * generic notification detail page should be used.
 */
export function notificationTargetHref(
  notif: Pick<INotification, 'type' | 'data'>,
): string | null {
  if (notif.type === 'kyc_uploaded' && notif.data?.tenantId) {
    return `/tenants/${notif.data.tenantId}`;
  }
  return null;
}
