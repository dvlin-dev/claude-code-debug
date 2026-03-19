import type {
  NormalizedExchange,
  NormalizedMessage,
  SessionDashboardVM,
  ModelTokenBreakdown,
  ToolCallStat,
  ContextInjectionStat,
  StopReasonStat,
  ExchangeTimePoint,
} from "../../shared/contracts";
import { ExchangeRepository } from "../storage/exchange-repository";
import { annotateMessage } from "../providers/protocol-adapters/shared/annotate-blocks";

function safeParseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_NORMALIZED: NormalizedExchange = {
  exchangeId: "",
  providerId: "anthropic",
  profileId: "",
  endpointKind: "messages",
  model: null,
  request: { instructions: [], tools: [], inputMessages: [], meta: {} },
  response: {
    outputMessages: [],
    stopReason: null,
    usage: null,
    error: null,
    meta: {},
  },
};

function collectToolCalls(
  messages: NormalizedMessage[],
  toolMap: Map<string, { callCount: number; errorCount: number }>,
): void {
  for (const msg of messages) {
    for (const block of msg.blocks) {
      if (block.type === "tool-call") {
        const entry = toolMap.get(block.name) ?? {
          callCount: 0,
          errorCount: 0,
        };
        entry.callCount++;
        toolMap.set(block.name, entry);
      }
      if (block.type === "tool-result" && block.isError) {
        const name = findToolNameByCallId(messages, block.callId);
        if (name) {
          const entry = toolMap.get(name) ?? { callCount: 0, errorCount: 0 };
          entry.errorCount++;
          toolMap.set(name, entry);
        }
      }
    }
  }
}

function findToolNameByCallId(
  messages: NormalizedMessage[],
  callId: string | undefined,
): string | null {
  if (!callId) return null;
  for (const msg of messages) {
    for (const block of msg.blocks) {
      if (block.type === "tool-call" && block.callId === callId) {
        return block.name;
      }
    }
  }
  return null;
}

function collectContextInjections(
  messages: NormalizedMessage[],
  ctxMap: Map<string, { count: number; totalChars: number }>,
): void {
  for (const msg of messages) {
    for (const block of msg.blocks) {
      if (block.type === "text" && block.meta?.injected && block.meta.contextType) {
        const key = block.meta.contextType;
        const entry = ctxMap.get(key) ?? { count: 0, totalChars: 0 };
        entry.count++;
        entry.totalChars += block.meta.charCount ?? block.text.length;
        ctxMap.set(key, entry);
      }
    }
  }
}

export class DashboardQueryService {
  constructor(private readonly exchangeRepository: ExchangeRepository) {}

  getSessionDashboard(sessionId: string): SessionDashboardVM {
    const rows = this.exchangeRepository.listBySessionId(sessionId);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalReasoningTokens = 0;
    let totalDurationMs = 0;
    let errorCount = 0;

    const modelMap = new Map<string, ModelTokenBreakdown>();
    const toolMap = new Map<string, { callCount: number; errorCount: number }>();
    const ctxMap = new Map<string, { count: number; totalChars: number }>();
    const stopReasonMap = new Map<string, number>();
    const timeline: ExchangeTimePoint[] = [];

    for (const row of rows) {
      const normalized = safeParseJson<NormalizedExchange>(
        row.normalized_json as string,
        EMPTY_NORMALIZED,
      );

      const usage = normalized.response.usage;
      const input = usage?.inputTokens ?? 0;
      const output = usage?.outputTokens ?? 0;
      const reasoning = usage?.reasoningTokens ?? 0;

      totalInputTokens += input;
      totalOutputTokens += output;
      totalReasoningTokens += reasoning;
      totalDurationMs += row.duration_ms ?? 0;

      if (normalized.response.error) {
        errorCount++;
      }

      // Model breakdown
      const modelKey = normalized.model ?? "unknown";
      const modelEntry = modelMap.get(modelKey) ?? {
        model: modelKey,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        exchangeCount: 0,
      };
      modelEntry.inputTokens += input;
      modelEntry.outputTokens += output;
      modelEntry.reasoningTokens += reasoning;
      modelEntry.totalTokens += input + output + reasoning;
      modelEntry.exchangeCount++;
      modelMap.set(modelKey, modelEntry);

      // Tool calls from all messages
      const allMessages = [
        ...normalized.request.inputMessages,
        ...normalized.response.outputMessages,
      ];
      collectToolCalls(allMessages, toolMap);

      // Context injections (need annotation since normalized_json doesn't have meta)
      const annotatedInput = normalized.request.inputMessages.map(annotateMessage);
      collectContextInjections(annotatedInput, ctxMap);

      // Stop reasons
      if (normalized.response.stopReason) {
        const prev = stopReasonMap.get(normalized.response.stopReason) ?? 0;
        stopReasonMap.set(normalized.response.stopReason, prev + 1);
      }

      // Timeline point
      timeline.push({
        exchangeId: row.exchange_id,
        startedAt: row.started_at,
        durationMs: row.duration_ms,
        inputTokens: input,
        outputTokens: output,
        reasoningTokens: reasoning,
        model: normalized.model,
        statusCode: row.status_code,
      });
    }

    const toolCalls: ToolCallStat[] = Array.from(toolMap.entries())
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => b.callCount - a.callCount);

    const contextInjections: ContextInjectionStat[] = Array.from(ctxMap.entries())
      .map(([contextType, stat]) => ({ contextType, ...stat }))
      .sort((a, b) => b.totalChars - a.totalChars);

    const stopReasons: StopReasonStat[] = Array.from(stopReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      sessionId,
      exchangeCount: rows.length,
      totalDurationMs,
      tokens: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        reasoningTokens: totalReasoningTokens,
        totalTokens: totalInputTokens + totalOutputTokens + totalReasoningTokens,
      },
      modelBreakdown: Array.from(modelMap.values()),
      toolCalls,
      contextInjections,
      stopReasons,
      errorCount,
      timeline,
    };
  }
}
