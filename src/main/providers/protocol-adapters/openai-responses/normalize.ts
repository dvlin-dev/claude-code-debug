import type {
  CapturedExchange,
  EndpointKind,
  NormalizedBlock,
  NormalizedError,
  NormalizedExchange,
  NormalizedMessage,
  NormalizedMessageBlock,
  NormalizedTool,
  NormalizedUsage,
} from "../../../../shared/contracts";
import { getCapturedBodyText } from "../../../capture/body-codec";
import { parseJson, parseMaybeJson, getString, type JsonObject } from "../shared/parse-utils";

interface ResponseStreamState {
  items: Map<number, JsonObject>;
  usage: NormalizedUsage | null;
  status: string | null;
  error: NormalizedError | null;
  responseId: string | null;
}

function normalizeInstructionBlock(instructions: unknown): NormalizedBlock[] {
  if (typeof instructions === "string" && instructions.length > 0) {
    return [{ type: "text", text: instructions }];
  }

  if (!Array.isArray(instructions)) {
    return [];
  }

  return instructions.flatMap<NormalizedBlock>((block) => {
    if (typeof block === "string" && block.length > 0) {
      return [{ type: "text", text: block }];
    }
    if (block && typeof block === "object") {
      const record = block as JsonObject;
      if (typeof record.text === "string") {
        return [{ type: "text", text: record.text }];
      }
      if (typeof record.type === "string") {
        return [{
          type: "unknown",
          rawType: record.type,
          payload: record,
        }];
      }
    }
    return [];
  });
}

function normalizeContentBlock(block: unknown): NormalizedMessageBlock | null {
  if (!block || typeof block !== "object") {
    return null;
  }

  const record = block as JsonObject;
  switch (record.type) {
    case "input_text":
    case "output_text":
    case "text":
      return {
        type: "text",
        text: String(record.text ?? record.input_text ?? ""),
      };
    case "reasoning":
    case "reasoning_text":
    case "summary_text":
      return {
        type: "reasoning",
        text: String(
          record.text ??
            record.summary ??
            record.reasoning ??
            "",
        ),
      };
    case "function_call":
      return {
        type: "tool-call",
        name: String(record.name ?? "function_call"),
        input: parseMaybeJson(record.arguments),
        callId: getString(record.call_id) ?? getString(record.id) ?? undefined,
      };
    case "function_call_output":
      return {
        type: "tool-result",
        content: parseMaybeJson(record.output),
        callId: getString(record.call_id) ?? getString(record.id) ?? undefined,
      };
    default:
      return {
        type: "unknown",
        rawType: typeof record.type === "string" ? record.type : "unknown",
        payload: record,
      };
  }
}

function normalizeMessageItem(item: JsonObject): NormalizedMessage | null {
  const rawRole = item.role;
  const role =
    rawRole === "developer"
      ? "system"
      : rawRole === "system" ||
          rawRole === "user" ||
          rawRole === "assistant" ||
          rawRole === "tool"
        ? rawRole
        : "unknown";
  const content = Array.isArray(item.content) ? item.content : [];
  const blocks = content
    .map((block) => normalizeContentBlock(block))
    .filter((block): block is NormalizedMessageBlock => block !== null);

  return { role, blocks };
}

function normalizeResponseItem(item: JsonObject): NormalizedMessage[] {
  switch (item.type) {
    case "message": {
      const message = normalizeMessageItem(item);
      return message ? [message] : [];
    }
    case "function_call":
      return [
        {
          role: "assistant",
          blocks: [
            {
              type: "tool-call",
              name: String(item.name ?? "function_call"),
              input: parseMaybeJson(item.arguments),
              callId:
                getString(item.call_id) ?? getString(item.id) ?? undefined,
            },
          ],
        },
      ];
    case "function_call_output":
      return [
        {
          role: "tool",
          blocks: [
            {
              type: "tool-result",
              content: parseMaybeJson(item.output),
              callId:
                getString(item.call_id) ?? getString(item.id) ?? undefined,
            },
          ],
        },
      ];
    case "reasoning":
      return [
        {
          role: "assistant",
          blocks: [
            {
              type: "reasoning",
              text: String(item.summary ?? item.text ?? ""),
            },
          ],
        },
      ];
    default:
      return [];
  }
}

function parseRequestTools(body: JsonObject | null): NormalizedTool[] {
  const tools = body?.tools;
  if (!Array.isArray(tools)) return [];

  return tools
    .filter((tool): tool is JsonObject => !!tool && typeof tool === "object")
    .map((tool) => ({
      name: String(tool.name ?? tool.type ?? "tool"),
      description:
        typeof tool.description === "string" ? tool.description : null,
      inputSchema: tool.parameters ?? tool.input_schema ?? null,
    }));
}

function parseRequestMessages(body: JsonObject | null): NormalizedMessage[] {
  const input = body?.input;
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as JsonObject;
    if (record.type === "message") {
      const message = normalizeMessageItem(record);
      return message ? [message] : [];
    }

    if (record.type === "function_call_output") {
      return normalizeResponseItem(record);
    }

    if (record.type === "function_call") {
      return normalizeResponseItem(record);
    }

    return [
      {
        role: "unknown",
        blocks: [
          {
            type: "unknown",
            rawType: typeof record.type === "string" ? record.type : "unknown",
            payload: record,
          },
        ],
      },
    ];
  });
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
      typeof usage.reasoning_tokens === "number" ? usage.reasoning_tokens : null,
  };
}

function ensureOutputItem(
  state: ResponseStreamState,
  index: number,
  seed?: JsonObject,
): JsonObject {
  const current = state.items.get(index) ?? {};
  const next = seed ? { ...current, ...seed } : current;
  state.items.set(index, next);
  return next;
}

function parseResponseStream(body: string | null): ResponseStreamState {
  const state: ResponseStreamState = {
    items: new Map(),
    usage: null,
    status: null,
    error: null,
    responseId: null,
  };

  if (!body) {
    return state;
  }

  const lines = body.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) {
      continue;
    }

    const payload = line.slice(5).trim();
    if (payload === "[DONE]" || payload.length === 0) {
      continue;
    }

    const parsed = parseJson(payload);
    if (!parsed) {
      continue;
    }

    switch (parsed.type) {
      case "response.output_item.added":
      case "response.output_item.done": {
        const index =
          typeof parsed.output_index === "number" ? parsed.output_index : 0;
        if (parsed.item && typeof parsed.item === "object") {
          ensureOutputItem(state, index, parsed.item as JsonObject);
        }
        break;
      }
      case "response.content_part.added":
      case "response.content_part.done": {
        const index =
          typeof parsed.output_index === "number" ? parsed.output_index : 0;
        const item = ensureOutputItem(state, index, { type: "message", role: "assistant" });
        const content = Array.isArray(item.content) ? [...item.content] : [];
        const contentIndex =
          typeof parsed.content_index === "number" ? parsed.content_index : content.length;
        content[contentIndex] = parsed.part ?? content[contentIndex] ?? null;
        item.content = content;
        break;
      }
      case "response.output_text.delta": {
        const index =
          typeof parsed.output_index === "number" ? parsed.output_index : 0;
        const item = ensureOutputItem(state, index, { type: "message", role: "assistant" });
        const content = Array.isArray(item.content) ? [...item.content] : [];
        const contentIndex =
          typeof parsed.content_index === "number" ? parsed.content_index : 0;
        const current = (
          content[contentIndex] && typeof content[contentIndex] === "object"
            ? { ...(content[contentIndex] as JsonObject) }
            : { type: "output_text", text: "" }
        ) as JsonObject;
        current.type = "output_text";
        current.text = `${String(current.text ?? "")}${String(parsed.delta ?? "")}`;
        content[contentIndex] = current;
        item.content = content;
        break;
      }
      case "response.output_text.done": {
        const index =
          typeof parsed.output_index === "number" ? parsed.output_index : 0;
        const item = ensureOutputItem(state, index, { type: "message", role: "assistant" });
        const content = Array.isArray(item.content) ? [...item.content] : [];
        const contentIndex =
          typeof parsed.content_index === "number" ? parsed.content_index : 0;
        content[contentIndex] = {
          type: "output_text",
          text: String(parsed.text ?? ""),
        };
        item.content = content;
        break;
      }
      case "response.function_call_arguments.delta": {
        const index =
          typeof parsed.output_index === "number" ? parsed.output_index : 0;
        const item = ensureOutputItem(state, index, { type: "function_call" });
        item._rawArguments = `${String(item._rawArguments ?? "")}${String(parsed.delta ?? "")}`;
        try {
          item.arguments = JSON.parse(item._rawArguments as string);
        } catch {
          item.arguments = item._rawArguments;
        }
        break;
      }
      case "response.function_call_arguments.done": {
        const index =
          typeof parsed.output_index === "number" ? parsed.output_index : 0;
        const item = ensureOutputItem(state, index, { type: "function_call" });
        if (typeof parsed.arguments === "string") {
          item.arguments = parsed.arguments;
        }
        if (typeof parsed.name === "string") {
          item.name = parsed.name;
        }
        break;
      }
      case "response.reasoning_text.delta": {
        const index =
          typeof parsed.output_index === "number" ? parsed.output_index : 0;
        const item = ensureOutputItem(state, index, { type: "reasoning" });
        item.text = `${String(item.text ?? "")}${String(parsed.delta ?? "")}`;
        break;
      }
      case "response.reasoning_text.done": {
        const index =
          typeof parsed.output_index === "number" ? parsed.output_index : 0;
        const item = ensureOutputItem(state, index, { type: "reasoning" });
        if (typeof parsed.text === "string") {
          item.text = parsed.text;
        }
        break;
      }
      case "response.reasoning_summary_text.delta":
      case "response.reasoning_summary_text.done":
      case "response.reasoning_summary_part.added":
      case "response.reasoning_summary_part.done": {
        break;
      }
      case "response.failed": {
        const response =
          parsed.response && typeof parsed.response === "object"
            ? (parsed.response as JsonObject)
            : null;
        const error =
          response?.error && typeof response.error === "object"
            ? (response.error as JsonObject)
            : parsed.error && typeof parsed.error === "object"
              ? (parsed.error as JsonObject)
              : null;
        state.error = {
          code: getString(error?.code) ?? null,
          message: String(error?.message ?? "Response failed"),
        };
        break;
      }
      case "response.completed":
      case "response.done": {
        const response =
          parsed.response && typeof parsed.response === "object"
            ? (parsed.response as JsonObject)
            : null;
        state.responseId = getString(response?.id);
        state.status = getString(response?.status);
        state.usage = parseUsage(response?.usage);
        if (Array.isArray(response?.output)) {
          state.items.clear();
          response.output.forEach((item, index) => {
            if (item && typeof item === "object") {
              state.items.set(index, item as JsonObject);
            }
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return state;
}

export function normalizeOpenAiResponsesExchange(
  exchange: CapturedExchange,
): NormalizedExchange {
  const requestText = getCapturedBodyText(exchange.requestBody);
  const responseText = getCapturedBodyText(exchange.responseBody);
  const request = parseJson(requestText);
  const responseState = parseResponseStream(responseText);
  const outputMessages = [...responseState.items.values()].flatMap((item) =>
    normalizeResponseItem(item),
  );

  return {
    exchangeId: exchange.exchangeId,
    providerId: exchange.providerId,
    profileId: exchange.profileId,
    endpointKind: "responses" as EndpointKind,
    model: typeof request?.model === "string" ? request.model : null,
    request: {
      instructions: normalizeInstructionBlock(request?.instructions),
      tools: parseRequestTools(request),
      inputMessages: parseRequestMessages(request),
      meta: {
        toolChoice: request?.tool_choice ?? null,
        parallelToolCalls: request?.parallel_tool_calls ?? null,
        reasoning: request?.reasoning ?? null,
        store: request?.store ?? null,
        stream: request?.stream ?? null,
        serviceTier: request?.service_tier ?? null,
        include: request?.include ?? null,
        conversation: request?.conversation ?? null,
        text: request?.text ?? null,
      },
    },
    response: {
      outputMessages,
      stopReason: responseState.status,
      usage: responseState.usage,
      error: responseState.error,
      meta: {
        responseId: responseState.responseId,
      },
    },
  };
}
