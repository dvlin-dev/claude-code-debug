import type {
  CapturedExchange,
  EndpointKind,
  NormalizedBlock,
  NormalizedExchange,
  NormalizedMessage,
  NormalizedMessageBlock,
  NormalizedTool,
  NormalizedUsage,
} from "../../../../shared/contracts";
import { getCapturedBodyText } from "../../../capture/body-codec";
import { parseJson, type JsonObject } from "../shared/parse-utils";

interface AnthropicResponseState {
  outputMessages: NormalizedMessage[];
  stopReason: string | null;
  usage: NormalizedUsage | null;
}

function normalizeInstructionBlock(block: unknown): NormalizedBlock | null {
  if (typeof block === "string") {
    return { type: "text", text: block };
  }

  if (block && typeof block === "object") {
    const record = block as JsonObject;
    if (typeof record.text === "string") {
      return { type: "text", text: record.text };
    }
    if (typeof record.type === "string") {
      return {
        type: "unknown",
        rawType: record.type,
        payload: record,
      };
    }
  }

  return null;
}

function normalizeMessageBlock(block: unknown): NormalizedMessageBlock | null {
  if (typeof block === "string") {
    return { type: "text", text: block };
  }

  if (!block || typeof block !== "object") {
    return null;
  }

  const record = block as JsonObject;
  switch (record.type) {
    case "text":
      return { type: "text", text: String(record.text ?? "") };
    case "thinking":
      return { type: "reasoning", text: String(record.text ?? record.thinking ?? "") };
    case "tool_use":
      return {
        type: "tool-call",
        name: String(record.name ?? "tool_use"),
        input: record.input ?? null,
        callId: typeof record.id === "string" ? record.id : undefined,
      };
    case "tool_result":
      return {
        type: "tool-result",
        content: record.content ?? null,
        callId:
          typeof record.tool_use_id === "string" ? record.tool_use_id : undefined,
        isError: record.is_error === true,
      };
    default:
      return {
        type: "unknown",
        rawType: typeof record.type === "string" ? record.type : "unknown",
        payload: record,
      };
  }
}

function normalizeMessage(message: unknown): NormalizedMessage | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const record = message as JsonObject;
  const role =
    record.role === "system" ||
    record.role === "user" ||
    record.role === "assistant" ||
    record.role === "tool"
      ? record.role
      : "unknown";
  const content = Array.isArray(record.content)
    ? record.content
    : [record.content].filter((value) => value != null);
  const blocks = content
    .map((block) => normalizeMessageBlock(block))
    .filter((block): block is NormalizedMessageBlock => block !== null);

  return { role, blocks };
}

function parseRequestTools(body: JsonObject | null): NormalizedTool[] {
  const tools = body?.tools;
  if (!Array.isArray(tools)) return [];

  return tools
    .filter((tool): tool is JsonObject => !!tool && typeof tool === "object")
    .map((tool) => ({
      name: String(tool.name ?? "tool"),
      description:
        typeof tool.description === "string" ? tool.description : null,
      inputSchema: tool.input_schema ?? null,
    }));
}

function parseUsage(value: unknown): NormalizedUsage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const usage = value as JsonObject;
  return {
    inputTokens:
      typeof usage.input_tokens === "number" ? usage.input_tokens : null,
    outputTokens:
      typeof usage.output_tokens === "number" ? usage.output_tokens : null,
    reasoningTokens:
      typeof usage.thinking_tokens === "number" ? usage.thinking_tokens : null,
  };
}

function mergeUsage(
  current: NormalizedUsage | null,
  next: NormalizedUsage | null,
): NormalizedUsage | null {
  if (!current) {
    return next;
  }
  if (!next) {
    return current;
  }

  return {
    inputTokens: next.inputTokens ?? current.inputTokens,
    outputTokens: next.outputTokens ?? current.outputTokens,
    reasoningTokens: next.reasoningTokens ?? current.reasoningTokens,
  };
}

function parseResponseSse(body: string | null): AnthropicResponseState {
  const state: AnthropicResponseState = {
    outputMessages: [],
    stopReason: null,
    usage: null,
  };

  if (!body) return state;

  type Block = Record<string, unknown>;
  const blocks = new Map<number, Block>();

  for (const line of body.split("\n")) {
    if (!line.startsWith("data:")) continue;

    let event: JsonObject;
    try {
      const parsed = JSON.parse(line.slice(5).trim());
      if (!parsed || typeof parsed !== "object") continue;
      event = parsed as JsonObject;
    } catch {
      continue;
    }

    state.usage = mergeUsage(state.usage, parseUsage(event.usage));
    if (event.message && typeof event.message === "object") {
      state.usage = mergeUsage(
        state.usage,
        parseUsage((event.message as JsonObject).usage),
      );
    }

    if (event.type === "message_delta" && event.delta && typeof event.delta === "object") {
      const delta = event.delta as JsonObject;
      if (typeof delta.stop_reason === "string") {
        state.stopReason = delta.stop_reason;
      }
      continue;
    }

    if (event.type === "content_block_start" && event.content_block) {
      const index =
        typeof event.index === "number" ? event.index : blocks.size;
      blocks.set(index, { ...(event.content_block as JsonObject) });
      continue;
    }

    if (event.type === "content_block_delta" && event.delta) {
      const delta = event.delta as JsonObject;
      const index = typeof event.index === "number" ? event.index : 0;
      const current = blocks.get(index) ?? {
        type:
          delta.type === "thinking_delta"
            ? "thinking"
            : delta.type === "input_json_delta"
              ? "tool_use"
              : "text",
      };

      if (delta.type === "text_delta") {
        current.text = `${String(current.text ?? "")}${String(delta.text ?? "")}`;
      } else if (delta.type === "thinking_delta") {
        current.text = `${String(current.text ?? "")}${String(delta.thinking ?? "")}`;
      } else if (delta.type === "input_json_delta") {
        const raw = `${String(current._rawInput ?? "")}${String(delta.partial_json ?? "")}`;
        current._rawInput = raw;
        try {
          current.input = JSON.parse(raw);
        } catch {
          current.input = raw;
        }
      }

      blocks.set(index, current);
    }
  }

  const messageBlocks = [...blocks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, block]) => normalizeMessageBlock(block))
    .filter((block): block is NormalizedMessageBlock => block !== null);

  if (messageBlocks.length === 0) {
    return state;
  }

  state.outputMessages = [{ role: "assistant", blocks: messageBlocks }];
  return state;
}

function parseResponse(
  exchange: CapturedExchange,
  responseText: string | null,
  json: JsonObject | null,
): AnthropicResponseState {
  if (json?.role === "assistant" && Array.isArray(json.content)) {
    return {
      outputMessages: [
        {
          role: "assistant",
          blocks: json.content
            .map((block) => normalizeMessageBlock(block))
            .filter((block): block is NormalizedMessageBlock => block !== null),
        },
      ],
      stopReason: typeof json.stop_reason === "string" ? json.stop_reason : null,
      usage: parseUsage(json.usage),
    };
  }

  return parseResponseSse(responseText);
}

export function normalizeAnthropicExchange(
  exchange: CapturedExchange,
): NormalizedExchange {
  const requestText = getCapturedBodyText(exchange.requestBody);
  const responseText = getCapturedBodyText(exchange.responseBody);
  const request = parseJson(requestText);
  const response = parseJson(responseText);
  const normalizedResponse = parseResponse(exchange, responseText, response);
  const inputMessages = Array.isArray(request?.messages)
    ? request.messages
        .map((message) => normalizeMessage(message))
        .filter((message): message is NormalizedMessage => message !== null)
    : [];
  const instructions = Array.isArray(request?.system)
    ? request.system
        .map((block) => normalizeInstructionBlock(block))
        .filter((block): block is NormalizedBlock => block !== null)
    : request?.system
      ? [normalizeInstructionBlock(request.system)].filter(
          (block): block is NormalizedBlock => block !== null,
        )
      : [];

  return {
    exchangeId: exchange.exchangeId,
    providerId: exchange.providerId,
    profileId: exchange.profileId,
    endpointKind: "messages" as EndpointKind,
    model: typeof request?.model === "string" ? request.model : null,
    request: {
      instructions,
      tools: parseRequestTools(request),
      inputMessages,
      meta: {
        maxTokens:
          typeof request?.max_tokens === "number" ? request.max_tokens : null,
        stream: request?.stream === true,
      },
    },
    response: {
      outputMessages: normalizedResponse.outputMessages,
      stopReason:
        normalizedResponse.stopReason ??
        (typeof response?.stop_reason === "string" ? response.stop_reason : null),
      usage: normalizedResponse.usage,
      error: null,
      meta: {},
    },
  };
}
