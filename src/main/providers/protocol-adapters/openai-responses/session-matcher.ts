import type {
  CapturedExchange,
  NormalizedExchange,
  SessionCandidate,
  SessionMatchResult,
  SessionMatcher,
} from "../../../../shared/contracts";
import { deriveTitleFromExchange } from "../shared/derive-title";

interface OpenAiResponsesMatcherState {
  sessionHint: string | null;
  turnId: string | null;
  conversationId: string | null;
}

function readHeader(
  headers: Record<string, string>,
  name: string,
): string | null {
  const direct = headers[name];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName && value.length > 0) {
      return value;
    }
  }

  return null;
}

function extractTurnId(headers: Record<string, string>): string | null {
  const raw = readHeader(headers, "x-codex-turn-metadata");
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { turn_id?: unknown };
    return typeof parsed.turn_id === "string" ? parsed.turn_id : null;
  } catch {
    return null;
  }
}

function createState(
  exchange: CapturedExchange,
  normalized: NormalizedExchange,
): OpenAiResponsesMatcherState {
  const conversation = normalized.request.meta.conversation;
  return {
    sessionHint: readHeader(exchange.requestHeaders, "session_id"),
    turnId: extractTurnId(exchange.requestHeaders),
    conversationId:
      typeof conversation === "string" && conversation.length > 0
        ? conversation
        : null,
  };
}

export const openaiResponsesSessionMatcher: SessionMatcher = {
  extractHint(exchange) {
    return readHeader(exchange.requestHeaders, "session_id");
  },

  match(exchange, normalized, candidates): SessionMatchResult | null {
    const nextState = createState(exchange, normalized);

    if (nextState.sessionHint) {
      const bySession = candidates.find((candidate) => {
        const state = candidate.matcherState as OpenAiResponsesMatcherState;
        return state.sessionHint === nextState.sessionHint;
      });
      if (bySession) {
        return {
          sessionId: bySession.sessionId,
          nextState,
        };
      }
    }

    if (nextState.conversationId) {
      const byConversation = candidates.find((candidate) => {
        const state = candidate.matcherState as OpenAiResponsesMatcherState;
        return state.conversationId === nextState.conversationId;
      });
      if (byConversation) {
        return {
          sessionId: byConversation.sessionId,
          nextState,
        };
      }
    }

    return null;
  },

  createState(exchange, normalized) {
    return createState(exchange, normalized);
  },

  updateState(_currentState, exchange, normalized) {
    return createState(exchange, normalized);
  },

  deriveTitle(normalized) {
    return deriveTitleFromExchange(normalized, "Codex Session");
  },
};
