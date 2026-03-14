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

describe("openai responses normalize", () => {
  it("normalizes a codex exchange into NormalizedExchange", () => {
    const normalized = openaiResponsesAdapter.normalize(makeExchange());

    expect(normalized.providerId).toBe("codex");
    expect(normalized.endpointKind).toBe("responses");
    expect(normalized.model).toBe("gpt-5.4");
    expect(normalized.request.instructions[0]).toEqual({
      type: "text",
      text: expect.stringContaining("You are Codex"),
    });
    expect(normalized.request.tools[0]?.name).toBe("exec_command");
    expect(normalized.request.inputMessages.at(-1)?.blocks[0]).toEqual({
      type: "text",
      text: "Reply with exactly the word probe.",
    });
    expect(normalized.response.outputMessages[0]?.role).toBe("assistant");
    expect(normalized.response.outputMessages[0]?.blocks[0]).toEqual({
      type: "text",
      text: "probe",
    });
    expect(normalized.response.usage).toEqual({
      inputTokens: 123,
      outputTokens: 1,
      reasoningTokens: null,
    });
  });
});
