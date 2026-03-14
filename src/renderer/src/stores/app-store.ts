import { create } from "zustand";
import { getElectronAPI } from "../lib/electron-api";
import {
  createDefaultUpdateState,
  type UpdateState,
} from "../../../shared/update";
import { useProfileStore } from "./profile-store";

interface AppState {
  initialized: boolean;
  updateState: UpdateState;
  commandPaletteOpen: boolean;
  initialize: () => Promise<void>;
  setUpdateState: (updateState: UpdateState) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  quitAndInstallUpdate: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => {
  let initializePromise: Promise<void> | null = null;
  let unsubscribeUpdateState: (() => void) | null = null;

  return {
    initialized: false,
    updateState: createDefaultUpdateState(),
    commandPaletteOpen: false,

    initialize: async () => {
      if (get().initialized) {
        return;
      }
      if (initializePromise) {
        return initializePromise;
      }

      const api = getElectronAPI();
      initializePromise = (async () => {
        const [updateState] = await Promise.all([
          api.getUpdateState(),
          useProfileStore.getState().initialize(),
        ]);

        unsubscribeUpdateState?.();
        unsubscribeUpdateState = api.onUpdateStateChanged((nextState) => {
          set({ updateState: nextState });
        });

        set({
          initialized: true,
          updateState,
        });
      })();

      try {
        await initializePromise;
      } finally {
        initializePromise = null;
      }
    },

    setUpdateState: (updateState) => {
      set({ updateState });
    },

    toggleCommandPalette: () => {
      set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen }));
    },

    setCommandPaletteOpen: (open) => {
      set({ commandPaletteOpen: open });
    },

    checkForUpdates: async () => {
      const api = getElectronAPI();
      const updateState = await api.checkForUpdates();
      set({ updateState });
    },

    downloadUpdate: async () => {
      const api = getElectronAPI();
      const updateState = await api.downloadUpdate();
      set({ updateState });
    },

    quitAndInstallUpdate: async () => {
      const api = getElectronAPI();
      await api.quitAndInstallUpdate();
    },
  };
});
