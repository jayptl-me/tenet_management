import { create } from 'zustand';

const API_BASE_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000')
    : 'http://localhost:8000';

interface ApiLoadingState {
  isSlowLoading: boolean;
  isServerWaking: boolean;
  activeRequests: number;
  setServerWaking: (val: boolean) => void;
  incrementRequests: () => void;
  decrementRequests: () => void;
  checkAndHandleSlowRequests: () => void;
}

let slowTimer: ReturnType<typeof setTimeout> | null = null;
let healthPollTimer: ReturnType<typeof setInterval> | null = null;
let hasBeenWakingThisSession = false;

/**
 * Check if the server is actually awake by hitting the health endpoint.
 * Uses raw fetch (not the ky wrapper) to avoid triggering the request counter.
 */
async function checkServerHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_BASE_URL}/api/v1/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = await res.json();
    return data.mongodb === 'connected';
  } catch {
    return false;
  }
}

function startHealthPolling(set: (partial: Partial<ApiLoadingState>) => void) {
  if (healthPollTimer) return;
  healthPollTimer = setInterval(async () => {
    const isHealthy = await checkServerHealth();
    if (isHealthy) {
      clearInterval(healthPollTimer!);
      healthPollTimer = null;
      set({ isServerWaking: false });
    }
  }, 5000);
}

function stopHealthPolling() {
  if (healthPollTimer) {
    clearInterval(healthPollTimer);
    healthPollTimer = null;
  }
}

export const useApiLoadingStore = create<ApiLoadingState>((set, get) => ({
  isSlowLoading: false,
  isServerWaking: false,
  activeRequests: 0,

  setServerWaking: (val) => {
    if (val && !hasBeenWakingThisSession) {
      hasBeenWakingThisSession = true;
      set({ isServerWaking: true });
      startHealthPolling(set);
    } else if (!val) {
      stopHealthPolling();
      set({ isServerWaking: false });
    }
  },

  incrementRequests: () =>
    set((state) => {
      const newActive = state.activeRequests + 1;
      if (newActive === 1 && !slowTimer) {
        slowTimer = setTimeout(() => {
          // Request has been pending for >3s — check if server is actually waking
          get().checkAndHandleSlowRequests();
        }, 3000);
      }
      return { activeRequests: newActive, isSlowLoading: true };
    }),

  decrementRequests: () =>
    set((state) => {
      const newActive = Math.max(0, state.activeRequests - 1);
      if (newActive === 0) {
        if (slowTimer) {
          clearTimeout(slowTimer);
          slowTimer = null;
        }
        return { activeRequests: 0, isSlowLoading: false };
      }
      return { activeRequests: newActive };
    }),

  checkAndHandleSlowRequests: async () => {
    // Only show the full cold-start overlay if the server is actually unhealthy
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      get().setServerWaking(true);
    }
    // If healthy, just leave isSlowLoading true — the caller already handles that
    // (a subtle progress bar can be shown instead of the full overlay)
  },
}));
