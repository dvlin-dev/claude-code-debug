import { createHash } from "node:crypto";
import type {
  CapturedExchange,
  NormalizedExchange,
  SessionCandidate,
  SessionMatchResult,
  SessionMatcher,
} from "../../../../shared/contracts";
import { getCapturedBodyText } from "../../../capture/body-codec";
import { deriveTitleFromExchange } from "../shared/derive-title";

interface AnthropicMatcherState {
  systemHash: string | null;
  messageFingerprints: string[];
}

function extractHintFromRequest(body: string | null): string | null {
  if (!body) return null;

  try {
    const parsed = JSON.parse(body) as {
      metadata?: { user_id?: unknown };
    };
    const userId = parsed.metadata?.user_id;
    if (typeof userId !== "string" || userId.length === 0) {
      return null;
    }
    const sessionIndex = userId.indexOf("_session_");
    return sessionIndex === -1
      ? userId
      : userId.slice(sessionIndex + "_session_".length);
  } catch {
    return null;
  }
}

function hashInstructions(normalized: NormalizedExchange): string | null {
  const text = normalized.request.instructions
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) return null;

  return createHash("sha256").update(text.slice(0, 1000)).digest("hex").slice(0, 16);
}

function blockFingerprint(block: { type: string; [key: string]: unknown }): string {
  switch (block.type) {
    case "text":
      return `text:${String(block.text ?? "")}`;
    case "reasoning":
      return `reasoning:${String(block.text ?? "")}`;
    case "tool-call":
      return `tool-call:${String(block.name ?? "")}:${JSON.stringify(block.input ?? null)}`;
    case "tool-result":
      return `tool-result:${JSON.stringify(block.content ?? null)}`;
    default:
      return `${block.type}:${JSON.stringify(block)}`;
  }
}

function messageFingerprint(message: NormalizedExchange["request"]["inputMessages"][number]): string {
  const content = message.blocks.map((block) => blockFingerprint(block)).join("|");
  return `${message.role}::${content}`;
}

function isSuperSet(existing: string[], next: string[]): boolean {
  if (existing.length === 0 || next.length <= existing.length) return false;

  for (let index = 0; index < existing.length; index += 1) {
    if (existing[index] !== next[index]) {
      return false;
    }
  }

  return true;
}

function createState(normalized: NormalizedExchange): AnthropicMatcherState {
  return {
    systemHash: hashInstructions(normalized),
    messageFingerprints: normalized.request.inputMessages.map((message) =>
      messageFingerprint(message),
    ),
  };
}

export const anthropicSessionMatcher: SessionMatcher = {
  extractHint(exchange) {
    return extractHintFromRequest(getCapturedBodyText(exchange.requestBody));
  },

  match(_exchange, normalized, candidates): SessionMatchResult | null {
    const nextState = createState(normalized);

    for (const candidate of candidates) {
      const state = candidate.matcherState as AnthropicMatcherState;
      if (
        state.systemHash &&
        nextState.systemHash &&
        state.systemHash === nextState.systemHash &&
        isSuperSet(state.messageFingerprints, nextState.messageFingerprints)
      ) {
        return {
          sessionId: candidate.sessionId,
          nextState,
        };
      }
    }

    for (const candidate of candidates) {
      const state = candidate.matcherState as AnthropicMatcherState;
      if (isSuperSet(state.messageFingerprints, nextState.messageFingerprints)) {
        return {
          sessionId: candidate.sessionId,
          nextState,
        };
      }
    }

    return null;
  },

  createState(_exchange, normalized) {
    return createState(normalized);
  },

  updateState(_currentState, _exchange, normalized) {
    return createState(normalized);
  },

  deriveTitle(normalized) {
    return deriveTitleFromExchange(normalized, "Anthropic Session");
  },
};
