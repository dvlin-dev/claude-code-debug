import { create } from "zustand";
import type { ExchangeDetailVM, SessionTraceVM } from "../../../shared/contracts";
import { getElectronAPI } from "../lib/electron-api";
import { useSessionStore } from "./session-store";

export type ContentTab = "messages" | "system" | "tools" | "other" | "dashboard";
export type MessageOrder = "asc" | "desc";

interface TraceState {
  trace: SessionTraceVM | null;
  selectedExchangeId: string | null;
  selectedExchangeDetail: ExchangeDetailVM | null;
  exchangeDetails: Record<string, ExchangeDetailVM>;
  inspectorOpen: boolean;
  rawMode: boolean;
  contentTab: ContentTab;
  messageOrder: MessageOrder;
  loadTrace: (sessionId: string) => Promise<void>;
  selectExchange: (exchangeId: string | null) => Promise<void>;
  toggleInspector: () => void;
  toggleRawMode: () => void;
  setContentTab: (tab: ContentTab) => void;
  toggleMessageOrder: () => void;
  clear: () => void;
}

export const useTraceStore = create<TraceState>((set, get) => {
  let syncVersion = 0;

  async function loadExchangeDetail(exchangeId: string): Promise<void> {
    const api = getElectronAPI();
    const detail = await api.getExchangeDetail(exchangeId);
    if (!detail || get().selectedExchangeId !== exchangeId) {
      return;
    }

    set((state) => ({
      selectedExchangeDetail: detail,
      exchangeDetails: {
        ...state.exchangeDetails,
        [detail.exchangeId]: detail,
      },
    }));
  }

  return {
    trace: null,
    selectedExchangeId: null,
    selectedExchangeDetail: null,
    exchangeDetails: {},
    inspectorOpen: false,
    rawMode: false,
    contentTab: "messages" as ContentTab,
    messageOrder: "asc" as MessageOrder,

    loadTrace: async (sessionId) => {
      const api = getElectronAPI();
      const nextVersion = ++syncVersion;
      const trace = await api.getSessionTrace(sessionId);
      if (syncVersion !== nextVersion) {
        return;
      }

      const currentSelectedExchangeId = get().selectedExchangeId;
      const selectedExchangeId =
        currentSelectedExchangeId &&
        trace.exchanges.some(
          (exchange) => exchange.exchangeId === currentSelectedExchangeId,
        )
          ? currentSelectedExchangeId
          : trace.exchanges.at(-1)?.exchangeId ?? null;
      set({
        trace,
        selectedExchangeId,
        selectedExchangeDetail: null,
        exchangeDetails: {},
      });

      if (selectedExchangeId) {
        await loadExchangeDetail(selectedExchangeId);
      }
    },

    selectExchange: async (exchangeId) => {
      set({
        selectedExchangeId: exchangeId,
        selectedExchangeDetail: exchangeId
          ? get().exchangeDetails[exchangeId] ?? null
          : null,
      });

      if (!exchangeId || get().exchangeDetails[exchangeId]) {
        return;
      }

      await loadExchangeDetail(exchangeId);
    },

    toggleInspector: () =>
      set((state) => ({ inspectorOpen: !state.inspectorOpen })),
    toggleRawMode: () => set((state) => ({ rawMode: !state.rawMode })),
    setContentTab: (tab: ContentTab) => set({ contentTab: tab }),
    toggleMessageOrder: () =>
      set((state) => ({
        messageOrder: state.messageOrder === "asc" ? "desc" : "asc",
      })),
    clear: () => {
      syncVersion++;
      set({
        trace: null,
        selectedExchangeId: null,
        selectedExchangeDetail: null,
        exchangeDetails: {},
        inspectorOpen: false,
        rawMode: false,
        contentTab: "messages" as ContentTab,
        messageOrder: "asc" as MessageOrder,
      });
    },
  };
});

// Coordinate: auto-clear trace when session is deselected or sessions are cleared
useSessionStore.subscribe((state, prevState) => {
  if (
    (!state.selectedSessionId && prevState.selectedSessionId) ||
    (state.sessions.length === 0 && prevState.sessions.length > 0)
  ) {
    useTraceStore.getState().clear();
  }
});
