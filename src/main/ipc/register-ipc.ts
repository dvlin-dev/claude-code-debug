import { ipcMain, type BrowserWindow } from "electron";
import { IPC } from "../../shared/ipc-channels";
import type { SettingsStore } from "../store/settings-store";
import type { HistoryStore } from "../store/history-store";
import type { SessionManager } from "../session/session-manager";
import type { ProxyServer } from "../proxy/server";
import { DEFAULT_PROXY_PORT } from "../../shared/defaults";
import type { UpdateService } from "../update/update-service";
import type { CaptureUpdatePayload } from "../../shared/types";

export interface IpcDependencies {
  settingsStore: SettingsStore;
  historyStore: HistoryStore;
  sessionManager: SessionManager;
  getProxy: () => ProxyServer | null;
  getMainWindow: () => BrowserWindow | null;
  updateService: UpdateService;
}

export function registerIpcHandlers(deps: IpcDependencies): () => void {
  ipcMain.handle(IPC.GET_SETTINGS, () => {
    return deps.settingsStore.getSettings();
  });

  ipcMain.handle(IPC.SAVE_SETTINGS, (_event, input: { targetUrl: string }) => {
    if (!input || typeof input.targetUrl !== "string") {
      throw new Error("Invalid settings: targetUrl must be a string");
    }
    deps.settingsStore.saveSettings(input);
    const proxy = deps.getProxy();
    if (proxy) {
      proxy.updateTargetUrl(input.targetUrl.trim());
    }
    return deps.settingsStore.getSettings();
  });

  ipcMain.handle(IPC.TOGGLE_LISTENING, async (_event, shouldListen: boolean) => {
    const proxy = deps.getProxy();
    if (!proxy) {
      throw new Error("Proxy server not initialized");
    }

    if (shouldListen) {
      const info = await proxy.start();
      return { isRunning: true, address: info.address, port: info.port };
    } else {
      await proxy.stop();
      return { isRunning: false, address: null, port: DEFAULT_PROXY_PORT };
    }
  });

  ipcMain.handle(IPC.GET_PROXY_STATUS, () => {
    const proxy = deps.getProxy();
    return {
      isRunning: proxy?.isRunning() ?? false,
    };
  });

  ipcMain.handle(IPC.LIST_SESSIONS, () => {
    return deps.historyStore.listSessions();
  });

  ipcMain.handle(IPC.GET_SESSION_REQUESTS, (_event, sessionId: string) => {
    if (typeof sessionId !== "string") {
      throw new Error("Invalid sessionId");
    }
    return deps.historyStore.listRequests(sessionId);
  });

  ipcMain.handle(IPC.GET_REQUEST_DETAIL, (_event, requestId: string) => {
    if (typeof requestId !== "string") {
      throw new Error("Invalid requestId");
    }
    return deps.historyStore.getRequest(requestId);
  });

  ipcMain.handle(IPC.CLEAR_DATA, () => {
    deps.historyStore.clearAll();
    const win = deps.getMainWindow();
    if (win) {
      const payload: CaptureUpdatePayload = {
        sessions: [],
        updatedSessionId: null,
        updatedRequestId: null,
      };
      win.webContents.send(IPC.CAPTURE_UPDATED, payload);
    }
  });

  ipcMain.handle(IPC.SEARCH, (_event, query: string) => {
    if (typeof query !== "string") {
      throw new Error("Invalid search query");
    }
    return deps.historyStore.search(query);
  });

  ipcMain.handle(IPC.GET_UPDATE_STATE, () => {
    return deps.updateService.getState();
  });

  ipcMain.handle(IPC.CHECK_FOR_UPDATES, () => {
    return deps.updateService.checkForUpdates();
  });

  ipcMain.handle(IPC.DOWNLOAD_UPDATE, () => {
    return deps.updateService.downloadUpdate();
  });

  ipcMain.handle(IPC.QUIT_AND_INSTALL_UPDATE, () => {
    return deps.updateService.quitAndInstall();
  });

  const unsubscribe = deps.updateService.subscribe((state) => {
    const win = deps.getMainWindow();
    if (!win) {
      return;
    }
    win.webContents.send(IPC.UPDATE_STATE_CHANGED, state);
  });

  return () => {
    unsubscribe();
  };
}
