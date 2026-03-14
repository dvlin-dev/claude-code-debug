import type { ProviderId } from "./provider";

export interface NormalizedTool {
  name: string;
  description: string | null;
  inputSchema: unknown;
}

export interface NormalizedUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
}

export interface NormalizedError {
  code: string | null;
  message: string;
}

export type NormalizedBlock =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "unknown"; rawType: string; payload: unknown };

export type NormalizedMessageBlock =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool-call"; name: string; input: unknown; callId?: string }
  | { type: "tool-result"; content: unknown; callId?: string; isError?: boolean }
  | { type: "unknown"; rawType: string; payload: unknown };

export interface NormalizedMessage {
  role: "system" | "user" | "assistant" | "tool" | "unknown";
  blocks: NormalizedMessageBlock[];
}

export type EndpointKind = "messages" | "responses";

export interface NormalizedExchange {
  exchangeId: string;
  providerId: ProviderId;
  profileId: string;
  endpointKind: EndpointKind;
  model: string | null;
  request: {
    instructions: NormalizedBlock[];
    tools: NormalizedTool[];
    inputMessages: NormalizedMessage[];
    meta: Record<string, unknown>;
  };
  response: {
    outputMessages: NormalizedMessage[];
    stopReason: string | null;
    usage: NormalizedUsage | null;
    error: NormalizedError | null;
    meta: Record<string, unknown>;
  };
}
