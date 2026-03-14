import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../../../../src/main/providers/protocol-adapters/openai-responses";
import type {
  CapturedExchange,
  SessionCandidate,
} from "../../../../src/shared/contracts";

function textBody(text: string, contentType: string) {
  return {
    bytes: Buffer.from(text, "utf-8"),
    contentType,
    contentEncoding: null,
  };
}

function makeExchange(
  overrides: Partial<CapturedExchange> = {},
  prompt = "Reply with exactly the word probe.",
): CapturedExchange {
  return {
    exchangeId: "exchange-openai-1",
    providerId: "codex",
    profileId: "profile-codex-1",
    method: "POST",
    path: "/responses",
    requestHeaders: {
      "content-type": "application/json",
      session_id: "session-codex-1",
      "x-codex-turn-metadata":
        "{\"turn_id\":\"turn-codex-1\",\"sandbox\":\"none\"}",
    },
    requestBody: textBody(
      JSON.stringify({
        model: "gpt-5.4",
        instructions: "You are Codex.",
        input: [
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
        tools: [],
        stream: true,
        store: false,
      }),
      "application/json",
    ),
    responseHeaders: { "content-type": "text/event-stream" },
    responseBody: textBody(
      'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","output":[{"id":"msg_1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"probe"}]}]}}\n\ndata: [DONE]\n',
      "text/event-stream",
    ),
    statusCode: 200,
    startedAt: "2026-03-13T00:00:00.000Z",
    durationMs: 180,
    requestSize: 300,
    responseSize: 120,
    ...overrides,
  };
}

describe("openai responses session matcher", () => {
  it("extracts session hint from the session_id header", () => {
    const exchange = makeExchange();
    const normalized = openaiResponsesAdapter.normalize(exchange);

    const hint = openaiResponsesAdapter.sessionMatcher.extractHint(
      exchange,
      normalized,
    );

    expect(hint).toBe("session-codex-1");
  });

  it("matches exchanges by the captured session header", () => {
    const firstExchange = makeExchange();
    const firstNormalized = openaiResponsesAdapter.normalize(firstExchange);
    const candidateState = openaiResponsesAdapter.sessionMatcher.createState(
      firstExchange,
      firstNormalized,
    );

    const candidates: SessionCandidate[] = [
      {
        sessionId: "session-1",
        providerId: "codex",
        profileId: "profile-codex-1",
        updatedAt: firstExchange.startedAt,
        matcherState: candidateState,
      },
    ];

    const nextExchange = makeExchange({
      exchangeId: "exchange-openai-2",
      requestHeaders: {
        "content-type": "application/json",
        session_id: "session-codex-1",
        "x-codex-turn-metadata":
          "{\"turn_id\":\"turn-codex-2\",\"sandbox\":\"none\"}",
      },
    }, "Do it again.");
    const nextNormalized = openaiResponsesAdapter.normalize(nextExchange);

    const match = openaiResponsesAdapter.sessionMatcher.match(
      nextExchange,
      nextNormalized,
      candidates,
    );

    expect(match?.sessionId).toBe("session-1");
  });
});
