import type { SSEMessage } from '@pg/types';

// ── Types ───────────────────────────────────────────────
type EventHandler = (message: SSEMessage) => void;

// ── Simple pub/sub event bus for SSE streams ────────────
const clients = new Map<string, Set<EventHandler>>();

/**
 * Subscribe to SSE events for a given client ID.
 * Returns an unsubscribe function.
 */
export function subscribe(clientId: string, handler: EventHandler): () => void {
  if (!clients.has(clientId)) {
    clients.set(clientId, new Set());
  }
  clients.get(clientId)!.add(handler);

  return () => {
    const handlers = clients.get(clientId);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        clients.delete(clientId);
      }
    }
  };
}

/**
 * Remove all subscriptions for a client (called on SSE disconnect).
 */
export function unsubscribeAll(clientId: string): void {
  clients.delete(clientId);
}

/**
 * Broadcast a message to all connected SSE clients.
 */
export function broadcast(message: SSEMessage): void {
  for (const [, handlers] of clients) {
    for (const handler of handlers) {
      try {
        handler(message);
      } catch {
        // Silently drop handlers that throw
      }
    }
  }
}

/**
 * Send a message to a specific client by ID.
 */
export function sendToClient(clientId: string, message: SSEMessage): void {
  const handlers = clients.get(clientId);
  if (handlers) {
    for (const handler of handlers) {
      try {
        handler(message);
      } catch {
        // Silently drop handlers that throw
      }
    }
  }
}

/**
 * Get the number of currently connected clients.
 */
export function getClientCount(): number {
  return clients.size;
}
