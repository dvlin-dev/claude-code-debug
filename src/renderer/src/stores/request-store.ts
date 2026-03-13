import { create } from "zustand";
import type { RequestRecord } from "../../../shared/types";
import { getElectronAPI } from "../lib/electron-api";

interface RequestState {
  requests: RequestRecord[];
  selectedRequestId: string | null;
  inspectorOpen: boolean;
  rawMode: boolean;
  activeSessionId: string | null;

  loadRequests: (sessionId: string) => Promise<void>;
  refreshSessionIfSelected: (
    updatedSessionId: string | null,
    selectedSessionId: string | null,
  ) => Promise<void>;
  selectRequest: (id: string | null) => void;
  toggleInspector: () => void;
  toggleRawMode: () => void;
}

export const useRequestStore = create<RequestState>((set, get) => {
  let syncVersion = 0;

  return {
    requests: [],
    selectedRequestId: null,
    inspectorOpen: false,
    rawMode: false,
    activeSessionId: null,

    loadRequests: async (sessionId) => {
      const nextVersion = ++syncVersion;
      set({ activeSessionId: sessionId });

      const api = getElectronAPI();
      const requests = await api.getSessionRequests(sessionId);
      if (syncVersion !== nextVersion || get().activeSessionId !== sessionId) {
        return;
      }

      set({ requests, selectedRequestId: null });
    },

    refreshSessionIfSelected: async (updatedSessionId, selectedSessionId) => {
      if (!updatedSessionId || updatedSessionId !== selectedSessionId) {
        return;
      }

      const nextVersion = ++syncVersion;
      const api = getElectronAPI();
      const requests = await api.getSessionRequests(updatedSessionId);
      if (
        syncVersion !== nextVersion ||
        get().activeSessionId !== updatedSessionId
      ) {
        return;
      }

      const currentSelectedRequestId = get().selectedRequestId;
      const nextSelectedRequestId =
        currentSelectedRequestId &&
        requests.some((request) => request.requestId === currentSelectedRequestId)
          ? currentSelectedRequestId
          : null;

      set({
        requests,
        selectedRequestId: nextSelectedRequestId,
      });
    },

    selectRequest: (id) => set({ selectedRequestId: id }),

    toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),

    toggleRawMode: () => set((s) => ({ rawMode: !s.rawMode })),
  };
});
