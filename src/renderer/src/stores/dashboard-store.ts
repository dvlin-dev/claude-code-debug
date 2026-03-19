import { create } from "zustand";
import type { SessionDashboardVM } from "../../../shared/contracts";
import { getElectronAPI } from "../lib/electron-api";
import { useSessionStore } from "./session-store";

interface DashboardState {
  dashboard: SessionDashboardVM | null;
  isOpen: boolean;
  loading: boolean;
  loadDashboard: (sessionId: string) => Promise<void>;
  toggleOpen: () => void;
  clear: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => {
  let syncVersion = 0;

  return {
    dashboard: null,
    isOpen: false,
    loading: false,

    loadDashboard: async (sessionId) => {
      const nextVersion = ++syncVersion;
      set({ loading: true });
      try {
        const api = getElectronAPI();
        const dashboard = await api.getSessionDashboard(sessionId);
        if (syncVersion !== nextVersion) return;
        set({ dashboard, loading: false });
      } catch (err) {
        console.error("[DashboardStore] Failed to load dashboard:", err);
        if (syncVersion === nextVersion) {
          set({ loading: false });
        }
      }
    },

    toggleOpen: () => {
      const next = !get().isOpen;
      set({ isOpen: next });
      if (next) {
        const sessionId = useSessionStore.getState().selectedSessionId;
        if (sessionId) {
          void get().loadDashboard(sessionId);
        }
      }
    },

    clear: () => {
      syncVersion++;
      set({ dashboard: null, loading: false });
    },
  };
});

// Auto-clear when session changes; reload if panel is open
useSessionStore.subscribe((state, prevState) => {
  if (state.selectedSessionId !== prevState.selectedSessionId) {
    const store = useDashboardStore.getState();
    store.clear();
    if (store.isOpen && state.selectedSessionId) {
      void store.loadDashboard(state.selectedSessionId);
    }
  }
  if (!state.selectedSessionId && prevState.selectedSessionId) {
    useDashboardStore.getState().clear();
  }
});
