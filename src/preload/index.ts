import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/ipc-channels";
import type {
  AppSettings,
  CaptureUpdatePayload,
  SessionSummary,
  RequestRecord,
} from "../shared/types";
import type { UpdateState } from "../shared/update";

export const electronAPI = {
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.GET_SETTINGS),

  saveSettings: (input: { targetUrl: string }): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SAVE_SETTINGS, input),

  toggleListening: (
    value: boolean,
  ): Promise<{ isRunning: boolean; address: string | null; port: number }> =>
    ipcRenderer.invoke(IPC.TOGGLE_LISTENING, value),

  getProxyStatus: (): Promise<{ isRunning: boolean }> =>
    ipcRenderer.invoke(IPC.GET_PROXY_STATUS),

  listSessions: (): Promise<SessionSummary[]> =>
    ipcRenderer.invoke(IPC.LIST_SESSIONS),

  getSessionRequests: (sessionId: string): Promise<RequestRecord[]> =>
    ipcRenderer.invoke(IPC.GET_SESSION_REQUESTS, sessionId),

  getRequestDetail: (requestId: string): Promise<RequestRecord | null> =>
    ipcRenderer.invoke(IPC.GET_REQUEST_DETAIL, requestId),

  clearData: (): Promise<void> => ipcRenderer.invoke(IPC.CLEAR_DATA),

  search: (
    query: string,
  ): Promise<{ sessions: SessionSummary[]; requests: RequestRecord[] }> =>
    ipcRenderer.invoke(IPC.SEARCH, query),

  getUpdateState: (): Promise<UpdateState> =>
    ipcRenderer.invoke(IPC.GET_UPDATE_STATE),

  checkForUpdates: (): Promise<UpdateState> =>
    ipcRenderer.invoke(IPC.CHECK_FOR_UPDATES),

  downloadUpdate: (): Promise<UpdateState> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_UPDATE),

  quitAndInstallUpdate: (): Promise<void> =>
    ipcRenderer.invoke(IPC.QUIT_AND_INSTALL_UPDATE),

  onCaptureUpdated: (cb: (payload: CaptureUpdatePayload) => void): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      payload: CaptureUpdatePayload,
    ) => cb(payload);
    ipcRenderer.on(IPC.CAPTURE_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC.CAPTURE_UPDATED, handler);
  },

  onProxyError: (cb: (error: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, error: string) => cb(error);
    ipcRenderer.on(IPC.PROXY_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.PROXY_ERROR, handler);
  },

  onUpdateStateChanged: (cb: (state: UpdateState) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: UpdateState) =>
      cb(state);
    ipcRenderer.on(IPC.UPDATE_STATE_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.UPDATE_STATE_CHANGED, handler);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
