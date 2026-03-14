import type { InspectorDocument } from "./inspector";
import type { NormalizedBlock } from "./normalized";
import type { ProviderId } from "./provider";
import type { SessionTimeline } from "./session";

export interface SessionListItemVM {
  sessionId: string;
  providerId: ProviderId;
  providerLabel: string;
  profileId: string;
  title: string;
  model: string | null;
  updatedAt: string;
  exchangeCount: number;
}

export interface SessionListFilter {
  providerId?: ProviderId;
  profileId?: string;
  query?: string;
}

export interface ExchangeListItemVM {
  exchangeId: string;
  providerId: ProviderId;
  providerLabel: string;
  method: string;
  path: string;
  statusCode: number | null;
  durationMs: number | null;
  model: string | null;
}

export interface SessionTraceVM {
  sessionId: string;
  providerId: ProviderId;
  providerLabel: string;
  profileId: string;
  title: string;
  instructions: NormalizedBlock[];
  timeline: SessionTimeline;
  exchanges: ExchangeListItemVM[];
}

export interface ExchangeDetailVM extends ExchangeListItemVM {
  inspector: InspectorDocument;
}
