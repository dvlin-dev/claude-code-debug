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

function makeExchange(): CapturedExchange {
  return {
    exchangeId: "exchange-1",
    providerId: "anthropic",
    profileId: "profile-1",
    method: "POST",
    path: "/v1/messages",
    requestHeaders: { "content-type": "application/json" },
    requestBody: textBody(fixture("request.json"), "application/json"),
    responseHeaders: { "content-type": "text/event-stream" },
    responseBody: textBody(fixture("response.sse.txt"), "text/event-stream"),
    statusCode: 200,
    startedAt: "2026-03-13T00:00:00.000Z",
    durationMs: 120,
    requestSize: 100,
    responseSize: 120,
  };
}

describe("anthropic normalize", () => {
  it("normalizes anthropic request/response into NormalizedExchange", () => {
    const normalized = anthropicMessagesAdapter.normalize(makeExchange());

    expect(normalized.request.inputMessages[0]?.role).toBe("user");
    expect(normalized.request.inputMessages[0]?.blocks[0]).toEqual({
      type: "text",
      text: "Hello",
    });
    expect(normalized.response.outputMessages[0]?.role).toBe("assistant");
    expect(normalized.response.outputMessages[0]?.blocks[0]).toEqual({
      type: "text",
      text: "Hi",
    });
  });

  it("returns empty output blocks when response body has invalid gzip encoding", () => {
    const exchange = makeExchange();
    exchange.responseBody = {
      bytes: Buffer.from("this is not gzip data"),
      contentType: "application/json",
      contentEncoding: "gzip",
    };

    const normalized = anthropicMessagesAdapter.normalize(exchange);
    expect(normalized.response.outputMessages).toEqual([]);
  });

  it("extracts Anthropic usage from streamed events", () => {
    const normalized = anthropicMessagesAdapter.normalize({
      ...makeExchange(),
      responseBody: textBody(
        [
          'event: message_start',
          'data: {"type":"message_start","message":{"role":"assistant","content":[],"usage":{"input_tokens":321}}}',
          "",
          'event: message_delta',
          'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":45}}',
          "",
          'event: content_block_start',
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
          "",
          'event: content_block_delta',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
          "",
          'event: message_stop',
          'data: {"type":"message_stop"}',
          "",
        ].join("\n"),
        "text/event-stream",
      ),
    });

    expect(normalized.response.stopReason).toBe("end_turn");
    expect(normalized.response.usage).toEqual({
      inputTokens: 321,
      outputTokens: 45,
      reasoningTokens: null,
    });
  });
});
