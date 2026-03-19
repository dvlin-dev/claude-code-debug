export interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface ModelTokenBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  exchangeCount: number;
}

export interface ToolCallStat {
  name: string;
  callCount: number;
  errorCount: number;
}

export interface ExchangeTimePoint {
  exchangeId: string;
  startedAt: string;
  durationMs: number | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  model: string | null;
  statusCode: number | null;
}

export interface ContextInjectionStat {
  contextType: string;
  count: number;
  totalChars: number;
}

export interface StopReasonStat {
  reason: string;
  count: number;
}

export interface SessionDashboardVM {
  sessionId: string;
  exchangeCount: number;
  totalDurationMs: number;
  tokens: TokenStats;
  modelBreakdown: ModelTokenBreakdown[];
  toolCalls: ToolCallStat[];
  contextInjections: ContextInjectionStat[];
  stopReasons: StopReasonStat[];
  errorCount: number;
  timeline: ExchangeTimePoint[];
}
