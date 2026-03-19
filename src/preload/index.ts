import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/ipc-channels";
import type {
  ConnectionProfile,
  ExchangeDetailVM,
  ProfileStatusChangedEvent,
  ProfilesChangedEvent,
  SessionDashboardVM,
  SessionListFilter,
  SessionListItemVM,
  SessionTraceVM,
  TraceCapturedEvent,
  TraceResetEvent,
} from "../shared/contracts";
import type { ElectronAPI } from "../shared/electron-api";
import type { UpdateState } from "../shared/update";

export const electronAPI: ElectronAPI = {
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),

  exportAppData: () =>
    ipcRenderer.invoke(IPC.EXPORT_APP_DATA),

  importAppData: () =>
    ipcRenderer.invoke(IPC.IMPORT_APP_DATA),

  getProfiles: (): Promise<ConnectionProfile[]> =>
    ipcRenderer.invoke(IPC.GET_PROFILES),

  saveProfiles: (input: ConnectionProfile[]): Promise<ConnectionProfile[]> =>
    ipcRenderer.invoke(IPC.SAVE_PROFILES, input),

  startProfile: (profileId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.START_PROFILE, profileId),

  stopProfile: (profileId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.STOP_PROFILE, profileId),

  getProfileStatuses: (): Promise<
    Record<string, { isRunning: boolean; port: number | null }>
  > => ipcRenderer.invoke(IPC.GET_PROFILE_STATUSES),

  listSessions: (
    filter?: SessionListFilter,
  ): Promise<SessionListItemVM[]> =>
    ipcRenderer.invoke(IPC.LIST_SESSIONS, filter ?? {}),

  getSessionTrace: (sessionId: string): Promise<SessionTraceVM> =>
    ipcRenderer.invoke(IPC.GET_SESSION_TRACE, sessionId),

  getExchangeDetail: (exchangeId: string): Promise<ExchangeDetailVM | null> =>
    ipcRenderer.invoke(IPC.GET_EXCHANGE_DETAIL, exchangeId),

  getSessionDashboard: (sessionId: string): Promise<SessionDashboardVM> =>
    ipcRenderer.invoke(IPC.GET_SESSION_DASHBOARD, sessionId),

  clearHistory: (): Promise<void> => ipcRenderer.invoke(IPC.CLEAR_HISTORY),

  getUpdateState: (): Promise<UpdateState> =>
    ipcRenderer.invoke(IPC.GET_UPDATE_STATE),

  checkForUpdates: (): Promise<UpdateState> =>
    ipcRenderer.invoke(IPC.CHECK_FOR_UPDATES),

  downloadUpdate: (): Promise<UpdateState> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_UPDATE),

  quitAndInstallUpdate: (): Promise<void> =>
    ipcRenderer.invoke(IPC.QUIT_AND_INSTALL_UPDATE),

  onProxyError: (cb: (error: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, error: string) => cb(error);
    ipcRenderer.on(IPC.PROXY_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.PROXY_ERROR, handler);
  },

  onTraceCaptured: (cb: (payload: TraceCapturedEvent) => void): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      payload: TraceCapturedEvent,
    ) => cb(payload);
    ipcRenderer.on(IPC.TRACE_CAPTURED, handler);
    return () => ipcRenderer.removeListener(IPC.TRACE_CAPTURED, handler);
  },

  onTraceReset: (cb: (payload: TraceResetEvent) => void): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      payload: TraceResetEvent,
    ) => cb(payload);
    ipcRenderer.on(IPC.TRACE_RESET, handler);
    return () => ipcRenderer.removeListener(IPC.TRACE_RESET, handler);
  },

  onProfileStatusChanged: (
    cb: (payload: ProfileStatusChangedEvent) => void,
  ): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      payload: ProfileStatusChangedEvent,
    ) => cb(payload);
    ipcRenderer.on(IPC.PROFILE_STATUS_CHANGED, handler);
    return () =>
      ipcRenderer.removeListener(IPC.PROFILE_STATUS_CHANGED, handler);
  },

  onProfilesChanged: (
    cb: (payload: ProfilesChangedEvent) => void,
  ): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      payload: ProfilesChangedEvent,
    ) => cb(payload);
    ipcRenderer.on(IPC.PROFILES_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.PROFILES_CHANGED, handler);
  },

  onUpdateStateChanged: (cb: (state: UpdateState) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, state: UpdateState) =>
      cb(state);
    ipcRenderer.on(IPC.UPDATE_STATE_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.UPDATE_STATE_CHANGED, handler);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
