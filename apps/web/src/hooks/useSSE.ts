'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

type SSEEventHandler = (event: string, data: unknown) => void;

/**
 * Hook that connects to the admin SSE endpoint and listens for real-time events.
 * Uses exponential backoff with jitter for reconnection to avoid thundering herd.
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
    let retryCount = 0;
    const MAX_RETRY_DELAY = 30_000; // 30 seconds cap

    function connect() {
      if (!isMounted) return;

      // Reset retry count on successful connection
      const url = `${API_BASE_URL}/sse/admin?token=${accessToken}`;

      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        retryCount = 0; // Reset backoff on successful handshake
      };

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
          // Exponential backoff with jitter: 1s → 2s → 4s → ... → 30s max
          const baseDelay = Math.min(1000 * Math.pow(2, retryCount), MAX_RETRY_DELAY);
          const jitter = baseDelay * (0.5 + Math.random() * 0.5); // 50%-100% of base
          retryCount++;
          reconnectTimeout = setTimeout(connect, jitter);
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
