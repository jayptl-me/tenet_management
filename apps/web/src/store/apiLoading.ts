import { create } from 'zustand';

interface ApiLoadingState {
  isSlowLoading: boolean;
  activeRequests: number;
  setSlowLoading: (val: boolean) => void;
  incrementRequests: () => void;
  decrementRequests: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useApiLoadingStore = create<ApiLoadingState>((set) => ({
  isSlowLoading: false,
  activeRequests: 0,
  setSlowLoading: (val) => set({ isSlowLoading: val }),
  incrementRequests: () =>
    set((state) => {
      const newActive = state.activeRequests + 1;
      if (newActive === 1 && !timer) {
        timer = setTimeout(() => {
          set({ isSlowLoading: true });
        }, 2000); // Trigger slow loading message after 2 seconds
      }
      return { activeRequests: newActive };
    }),
  decrementRequests: () =>
    set((state) => {
      const newActive = Math.max(0, state.activeRequests - 1);
      if (newActive === 0) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        return { activeRequests: 0, isSlowLoading: false };
      }
      return { activeRequests: newActive };
    }),
}));
