import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../../../../src/main/providers/protocol-adapters/openai-responses";
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
      "../../../fixtures/protocols/openai-responses",
      name,
    ),
    "utf-8",
  );
}

function makeExchange(): CapturedExchange {
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
    requestBody: textBody(fixture("request.json"), "application/json"),
    responseHeaders: { "content-type": "text/event-stream" },
    responseBody: textBody(fixture("response.sse.txt"), "text/event-stream"),
    statusCode: 200,
    startedAt: "2026-03-13T00:00:00.000Z",
    durationMs: 180,
    requestSize: 20876,
    responseSize: 1024,
  };
}

describe("openai responses inspector", () => {
  it("builds an inspector document from codex raw and normalized data", () => {
    const exchange = makeExchange();
    const normalized = openaiResponsesAdapter.normalize(exchange);
    const inspector = openaiResponsesAdapter.buildInspector(exchange, normalized);

    expect(inspector.sections.length).toBeGreaterThan(0);
    expect(inspector.sections[0]?.kind).toBe("overview");
    expect(
      inspector.sections.some((section) => section.kind === "tool-list"),
    ).toBe(true);
  });
});
