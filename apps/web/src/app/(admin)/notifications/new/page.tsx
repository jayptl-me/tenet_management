'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Consolidated compose entry point.
 *
 * The compose form now lives in the "Compose" tab on /notifications.
 * This standalone page redirects there to avoid dual compose entry points.
 */
export default function NewNotificationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/notifications');
  }, [router]);
  return null;
}
