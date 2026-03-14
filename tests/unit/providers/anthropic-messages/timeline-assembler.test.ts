import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { anthropicMessagesAdapter } from "../../../../src/main/providers/protocol-adapters/anthropic-messages";
import type { CapturedExchange } from "../../../../src/shared/contracts";

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

describe("anthropic timeline assembler", () => {
  it("assembles a snapshot-style timeline from the last anthropic exchange", () => {
    const first = anthropicMessagesAdapter.normalize(
      makeExchange(
        JSON.stringify({
          model: "claude-opus-4-6",
          messages: [{ role: "user", content: "Hello" }],
        }),
      ),
    );
    const second = anthropicMessagesAdapter.normalize(makeExchange());

    const timeline = anthropicMessagesAdapter.timelineAssembler.build([
      first,
      second,
    ]);

    expect(timeline.messages.at(-1)?.role).toBe("assistant");
  });
});
