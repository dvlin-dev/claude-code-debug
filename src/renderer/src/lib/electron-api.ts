import type {
  AppSettings,
  CaptureUpdatePayload,
  SessionSummary,
  RequestRecord,
} from "../../../shared/types";
import type { UpdateState } from "../../../shared/update";

export interface ElectronAPI {
  getSettings(): Promise<AppSettings>;
  saveSettings(input: { targetUrl: string }): Promise<AppSettings>;
  toggleListening(
    value: boolean,
  ): Promise<{ isRunning: boolean; address: string | null; port: number }>;
  getProxyStatus(): Promise<{ isRunning: boolean }>;
  listSessions(): Promise<SessionSummary[]>;
  getSessionRequests(sessionId: string): Promise<RequestRecord[]>;
  getRequestDetail(requestId: string): Promise<RequestRecord | null>;
  clearData(): Promise<void>;
  search(
    query: string,
  ): Promise<{ sessions: SessionSummary[]; requests: RequestRecord[] }>;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  downloadUpdate(): Promise<UpdateState>;
  quitAndInstallUpdate(): Promise<void>;
  onCaptureUpdated(cb: (payload: CaptureUpdatePayload) => void): () => void;
  onProxyError(cb: (error: string) => void): () => void;
  onUpdateStateChanged(cb: (state: UpdateState) => void): () => void;
}

export function getElectronAPI(): ElectronAPI {
  return (window as Window & { electronAPI: ElectronAPI }).electronAPI;
}
