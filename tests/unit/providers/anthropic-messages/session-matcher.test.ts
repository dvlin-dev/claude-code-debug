import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { anthropicMessagesAdapter } from "../../../../src/main/providers/protocol-adapters/anthropic-messages";
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

function fixture(name: string): string {
  return readFileSync(
    resolve(
      __dirname,
      "../../../fixtures/protocols/anthropic-messages",
      name,
    ),
    "utf-8",
  );
}

function makeExchange(requestBody = fixture("request.json")): CapturedExchange {
  return {
    exchangeId: "exchange-1",
    providerId: "anthropic",
    profileId: "profile-1",
    method: "POST",
    path: "/v1/messages",
    requestHeaders: { "content-type": "application/json" },
    requestBody: textBody(requestBody, "application/json"),
    responseHeaders: { "content-type": "text/event-stream" },
    responseBody: textBody(fixture("response.sse.txt"), "text/event-stream"),
    statusCode: 200,
    startedAt: "2026-03-13T00:00:00.000Z",
    durationMs: 120,
    requestSize: 100,
    responseSize: 120,
  };
}

describe("anthropic session matcher", () => {
  it("extracts session hint from metadata.user_id", () => {
    const exchange = makeExchange();
    const normalized = anthropicMessagesAdapter.normalize(exchange);

    const hint = anthropicMessagesAdapter.sessionMatcher.extractHint(
      exchange,
      normalized,
    );

    expect(hint).toBe("uuid-123");
  });

  it("matches by snapshot message superset when no hint exists", () => {
    const firstBody = JSON.stringify({
      model: "claude-opus-4-6",
      messages: [{ role: "user", content: "Hello" }],
    });
    const nextBody = JSON.stringify({
      model: "claude-opus-4-6",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: [{ type: "text", text: "Hi" }] },
        { role: "user", content: "More" },
      ],
    });

    const firstExchange = makeExchange(firstBody);
    const firstNormalized = anthropicMessagesAdapter.normalize(firstExchange);
    const candidateState = anthropicMessagesAdapter.sessionMatcher.createState(
      firstExchange,
      firstNormalized,
    );

    const candidates: SessionCandidate[] = [
      {
        sessionId: "session-1",
        providerId: "anthropic",
        profileId: "profile-1",
        updatedAt: firstExchange.startedAt,
        matcherState: candidateState,
      },
    ];

    const nextExchange = makeExchange(nextBody);
    const nextNormalized = anthropicMessagesAdapter.normalize(nextExchange);
    const match = anthropicMessagesAdapter.sessionMatcher.match(
      nextExchange,
      nextNormalized,
      candidates,
    );

    expect(match?.sessionId).toBe("session-1");
  });
});
