import type { SessionListItemVM } from "./view-models";

export interface TraceCapturedEvent {
  updatedSession: SessionListItemVM;
  updatedExchangeId: string;
}

export interface ProfileStatusChangedEvent {
  statuses: Record<string, { isRunning: boolean; port: number | null }>;
}

export interface TraceResetEvent {
  clearedAt: string;
}
