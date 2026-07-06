'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

type SSEEventHandler = (event: string, data: unknown) => void;

/**
 * Hook that connects to the admin SSE endpoint and listens for real-time events.
 * Automatically reconnects on disconnect and cleans up on unmount.
 */
export function useSSE(onEvent: SSEEventHandler) {
  const { accessToken, isAuthenticated } = useAuthStore();
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      const url = `${API_BASE_URL}/sse/admin?token=${accessToken}`;

      // EventSource doesn't support custom headers, so we pass token as query param.
      // The SSE route will validate it via the authGuard middleware.
      eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onEventRef.current(event.type === 'message' ? 'message' : event.type, parsed);
        } catch {
          onEventRef.current(event.type, event.data);
        }
      };

      // Handle named events
      const namedEvents = [
        'connected',
        'new_complaint',
        'complaint_updated',
        'payment_received',
        'payment_verified',
        'new_enquiry',
        'notification_created',
        'tenant_checkin',
        'tenant_checkout',
        'meal_feedback_submitted',
        'emergency_alert',
        'service_update',
        'ping',
      ];

      for (const eventName of namedEvents) {
        eventSource.addEventListener(eventName, (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data);
            onEventRef.current(eventName, parsed);
          } catch {
            onEventRef.current(eventName, event.data);
          }
        });
      }

      eventSource.onerror = () => {
        eventSource?.close();
        if (isMounted) {
          // Reconnect after 5 seconds
          reconnectTimeout = setTimeout(connect, 5000);
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, [isAuthenticated, accessToken]);
}
