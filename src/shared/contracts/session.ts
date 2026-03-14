import type { CapturedExchange } from "./capture";
import type { NormalizedExchange, NormalizedMessage } from "./normalized";
import type { ProviderId } from "./provider";

export interface SessionCandidate {
  sessionId: string;
  providerId: ProviderId;
  profileId: string;
  updatedAt: string;
  matcherState: unknown;
}

export interface SessionMatchResult {
  sessionId: string;
  nextState: unknown;
}

export interface SessionTimeline {
  messages: NormalizedMessage[];
}

export interface TimelineAssembler {
  build(exchanges: NormalizedExchange[]): SessionTimeline;
}

export interface SessionMatcher {
  extractHint(
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
  ): string | null;
  match(
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
    candidates: SessionCandidate[],
  ): SessionMatchResult | null;
  createState(
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
  ): unknown;
  updateState(
    currentState: unknown,
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
  ): unknown;
  deriveTitle(normalized: NormalizedExchange): string | null;
}
