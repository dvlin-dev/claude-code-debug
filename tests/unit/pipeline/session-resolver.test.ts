import { describe, expect, it } from "vitest";
import { createSqliteDatabase } from "../../../src/main/storage/sqlite";
import { SessionRepository } from "../../../src/main/storage/session-repository";
import { SessionResolver } from "../../../src/main/pipeline/session-resolver";
import { anthropicMessagesAdapter } from "../../../src/main/providers/protocol-adapters/anthropic-messages";
import type { CapturedExchange } from "../../../src/shared/contracts";

function textBody(text: string, contentType = "application/json") {
  return {
    bytes: Buffer.from(text, "utf-8"),
    contentType,
    contentEncoding: null,
  };
}

function makeExchange(requestBody: string, startedAt: string): CapturedExchange {
  return {
    exchangeId: crypto.randomUUID(),
    providerId: "anthropic",
    profileId: "profile-1",
    method: "POST",
    path: "/v1/messages",
    requestHeaders: { "content-type": "application/json" },
    requestBody: textBody(requestBody),
    responseHeaders: { "content-type": "application/json" },
    responseBody: textBody(
      JSON.stringify({
        role: "assistant",
        content: [{ type: "text", text: "Hi" }],
      }),
    ),
    statusCode: 200,
    startedAt,
    durationMs: 10,
    requestSize: 100,
    responseSize: 100,
  };
}

describe("session resolver", () => {
  it("creates a new session when no candidate matches", async () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const resolver = new SessionResolver(sessionRepository);
    const exchange = makeExchange(
      JSON.stringify({
        model: "claude-opus-4-6",
        messages: [{ role: "user", content: "Hello" }],
      }),
      "2026-03-13T00:00:00.000Z",
    );
    const normalized = anthropicMessagesAdapter.normalize(exchange);

    const sessionId = await resolver.resolve(
      exchange,
      normalized,
      anthropicMessagesAdapter.sessionMatcher,
    );

    expect(sessionId).toBeDefined();
    expect(sessionRepository.getById(sessionId)).not.toBeNull();
  });

  it("reuses an existing session when matcher returns a candidate", async () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const resolver = new SessionResolver(sessionRepository);

    const firstExchange = makeExchange(
      JSON.stringify({
        model: "claude-opus-4-6",
        messages: [{ role: "user", content: "Hello" }],
      }),
      "2026-03-13T00:00:00.000Z",
    );
    const firstNormalized = anthropicMessagesAdapter.normalize(firstExchange);
    const sessionId = await resolver.resolve(
      firstExchange,
      firstNormalized,
      anthropicMessagesAdapter.sessionMatcher,
    );

    const nextExchange = makeExchange(
      JSON.stringify({
        model: "claude-opus-4-6",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: [{ type: "text", text: "Hi" }] },
          { role: "user", content: "More" },
        ],
      }),
      "2026-03-13T00:00:01.000Z",
    );
    const nextNormalized = anthropicMessagesAdapter.normalize(nextExchange);

    const reused = await resolver.resolve(
      nextExchange,
      nextNormalized,
      anthropicMessagesAdapter.sessionMatcher,
    );

    expect(reused).toBe(sessionId);
  });

  it("creates a new session when hint extraction returns null", () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const resolver = new SessionResolver(sessionRepository);
    const exchange = makeExchange(
      JSON.stringify({
        model: "claude-opus-4-6",
        messages: [{ role: "user", content: "Hello" }],
      }),
      "2026-03-14T00:00:00.000Z",
    );
    const normalized = anthropicMessagesAdapter.normalize(exchange);
    const sessionId = resolver.resolve(
      exchange,
      normalized,
      anthropicMessagesAdapter.sessionMatcher,
    );
    expect(sessionId).toBeDefined();
  });

  it("creates separate sessions for unrelated conversations", () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const resolver = new SessionResolver(sessionRepository);

    const exchange1 = makeExchange(
      JSON.stringify({
        model: "claude-opus-4-6",
        system: "You are a helpful assistant.",
        messages: [{ role: "user", content: "Topic A" }],
      }),
      "2026-03-14T00:00:00.000Z",
    );
    const exchange2 = makeExchange(
      JSON.stringify({
        model: "claude-opus-4-6",
        system: "You are a code reviewer.",
        messages: [{ role: "user", content: "Topic B" }],
      }),
      "2026-03-14T00:00:01.000Z",
    );

    const normalized1 = anthropicMessagesAdapter.normalize(exchange1);
    const normalized2 = anthropicMessagesAdapter.normalize(exchange2);

    const sessionId1 = resolver.resolve(
      exchange1,
      normalized1,
      anthropicMessagesAdapter.sessionMatcher,
    );
    const sessionId2 = resolver.resolve(
      exchange2,
      normalized2,
      anthropicMessagesAdapter.sessionMatcher,
    );

    expect(sessionId1).not.toBe(sessionId2);
  });
});
