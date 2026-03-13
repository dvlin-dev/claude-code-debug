export interface ParsedClaudeRequest {
  model: string | null;
  system:
    | Array<{ type: string; text: string; cache_control?: unknown }>
    | string
    | null;
  tools:
    | Array<{ name: string; description: string; input_schema: unknown }>
    | null;
  messages: Array<{ role: string; content: unknown }> | null;
  maxTokens: number | null;
  stream: boolean;
}

export function parseClaudeRequest(
  body: string | null,
): ParsedClaudeRequest | null {
  if (!body) return null;

  try {
    const parsed = JSON.parse(body);

    return {
      model: typeof parsed.model === "string" ? parsed.model : null,
      system: parsed.system ?? null,
      tools: Array.isArray(parsed.tools) ? parsed.tools : null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : null,
      maxTokens:
        typeof parsed.max_tokens === "number" ? parsed.max_tokens : null,
      stream: parsed.stream === true,
    };
  } catch {
    return null;
  }
}

export interface ParsedClaudeResponse {
  role: string;
  content: Array<{ type: string; [key: string]: unknown }>;
  model: string | null;
  stopReason: string | null;
}

type ParsedClaudeContentBlock = { type: string; [key: string]: unknown };
type SseEvent = Record<string, unknown>;

function parseClaudeJsonResponse(body: string): ParsedClaudeResponse | null {
  try {
    const parsed = JSON.parse(body);
    if (parsed.content && parsed.role === "assistant") {
      return {
        role: "assistant",
        content: Array.isArray(parsed.content) ? parsed.content : [],
        model: parsed.model ?? null,
        stopReason: parsed.stop_reason ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function getEventIndex(event: SseEvent): number {
  return typeof event.index === "number" ? event.index : 0;
}

function createFallbackBlock(
  delta: Record<string, unknown>,
): ParsedClaudeContentBlock {
  switch (delta.type) {
    case "thinking_delta":
      return { type: "thinking", thinking: "" };
    case "input_json_delta":
      return { type: "tool_use", _rawInput: "" };
    case "text_delta":
    default:
      return { type: "text", text: "" };
  }
}

function applyDeltaToBlock(
  blockMap: Map<number, ParsedClaudeContentBlock>,
  event: SseEvent,
): void {
  const delta =
    event.delta && typeof event.delta === "object"
      ? (event.delta as Record<string, unknown>)
      : null;

  if (!delta) {
    return;
  }

  const index = getEventIndex(event);
  const existing = blockMap.get(index) ?? createFallbackBlock(delta);
  blockMap.set(index, existing);

  if (delta.type === "text_delta") {
    existing.text = ((existing.text as string) ?? "") + (delta.text ?? "");
    return;
  }

  if (delta.type === "thinking_delta") {
    existing.thinking =
      ((existing.thinking as string) ?? "") + (delta.thinking ?? "");
    return;
  }

  if (delta.type === "input_json_delta") {
    existing._rawInput =
      ((existing._rawInput as string) ?? "") + (delta.partial_json ?? "");
  }
}

function normalizeBlocks(
  blockMap: Map<number, ParsedClaudeContentBlock>,
): ParsedClaudeContentBlock[] {
  return [...blockMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, block]) => {
      const normalized = { ...block };

      if (normalized.type === "tool_use" && normalized._rawInput) {
        try {
          normalized.input = JSON.parse(normalized._rawInput as string);
        } catch {
          normalized.input = normalized._rawInput;
        }
        delete normalized._rawInput;
      }

      if (normalized.type === "thinking" && normalized.thinking) {
        normalized.text = normalized.thinking;
        delete normalized.thinking;
      }

      return normalized;
    });
}

function parseClaudeSseResponse(body: string): ParsedClaudeResponse | null {
  const blockMap = new Map<number, ParsedClaudeContentBlock>();
  let sawSseData = false;

  for (const line of body.split("\n")) {
    if (!line.startsWith("data:")) continue;
    sawSseData = true;

    let event: SseEvent;
    try {
      const parsed = JSON.parse(line.slice(5).trim());
      if (!parsed || typeof parsed !== "object") {
        continue;
      }
      event = parsed as SseEvent;
    } catch {
      continue;
    }

    if (event.type === "message_start") {
      const message =
        event.message && typeof event.message === "object"
          ? (event.message as { content?: unknown })
          : null;

      if (Array.isArray(message?.content)) {
        for (const [index, block] of message.content.entries()) {
          if (block && typeof block === "object") {
            blockMap.set(index, { ...(block as ParsedClaudeContentBlock) });
          }
        }
      }

      continue;
    }

    if (event.type === "content_block_start" && event.content_block) {
      const contentBlock =
        typeof event.content_block === "object"
          ? { ...(event.content_block as ParsedClaudeContentBlock) }
          : null;
      if (contentBlock) {
        blockMap.set(getEventIndex(event), contentBlock);
      }
      continue;
    }

    if (event.type === "content_block_delta") {
      applyDeltaToBlock(blockMap, event);
    }
  }

  if (!sawSseData) {
    return null;
  }

  const content = normalizeBlocks(blockMap);
  if (content.length === 0) {
    return null;
  }

  return {
    role: "assistant",
    content,
    model: null,
    stopReason: null,
  };
}

export function parseClaudeResponse(
  body: string | null,
): ParsedClaudeResponse | null {
  if (!body) return null;

  return parseClaudeJsonResponse(body) ?? parseClaudeSseResponse(body);
}
