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
} from "./contracts";
import type { AppDataTransferResult } from "./app-data";
import type { UpdateState } from "./update";

export interface ElectronAPI {
  openExternal(url: string): Promise<void>;
  exportAppData(): Promise<AppDataTransferResult | null>;
  importAppData(): Promise<AppDataTransferResult | null>;
  getProfiles(): Promise<ConnectionProfile[]>;
  saveProfiles(input: ConnectionProfile[]): Promise<ConnectionProfile[]>;
  startProfile(profileId: string): Promise<void>;
  stopProfile(profileId: string): Promise<void>;
  getProfileStatuses(): Promise<
    Record<string, { isRunning: boolean; port: number | null }>
  >;
  listSessions(filter?: SessionListFilter): Promise<SessionListItemVM[]>;
  getSessionTrace(sessionId: string): Promise<SessionTraceVM>;
  getExchangeDetail(exchangeId: string): Promise<ExchangeDetailVM | null>;
  getSessionDashboard(sessionId: string): Promise<SessionDashboardVM>;
  clearHistory(): Promise<void>;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  downloadUpdate(): Promise<UpdateState>;
  quitAndInstallUpdate(): Promise<void>;
  onProxyError(cb: (error: string) => void): () => void;
  onTraceCaptured(cb: (payload: TraceCapturedEvent) => void): () => void;
  onTraceReset(cb: (payload: TraceResetEvent) => void): () => void;
  onProfileStatusChanged(
    cb: (payload: ProfileStatusChangedEvent) => void,
  ): () => void;
  onProfilesChanged(cb: (payload: ProfilesChangedEvent) => void): () => void;
  onUpdateStateChanged(cb: (state: UpdateState) => void): () => void;
}
