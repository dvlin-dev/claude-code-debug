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

function makeExchange(
  prompt: string,
  responseText: string,
  turnId: string,
): CapturedExchange {
  return {
    exchangeId: `exchange-${turnId}`,
    providerId: "codex",
    profileId: "profile-codex-1",
    method: "POST",
    path: "/responses",
    requestHeaders: {
      "content-type": "application/json",
      session_id: "session-codex-1",
      "x-codex-turn-metadata": `{\"turn_id\":\"${turnId}\",\"sandbox\":\"none\"}`,
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
      `data: {"type":"response.completed","response":{"id":"resp_${turnId}","status":"completed","output":[{"id":"msg_${turnId}","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"${responseText}"}]}]}}\n\ndata: [DONE]\n`,
      "text/event-stream",
    ),
    statusCode: 200,
    startedAt: "2026-03-13T00:00:00.000Z",
    durationMs: 180,
    requestSize: 300,
    responseSize: 120,
  };
}

describe("openai responses timeline assembler", () => {
  it("assembles an incremental codex timeline across exchanges", () => {
    const first = openaiResponsesAdapter.normalize(
      makeExchange("First prompt", "first answer", "turn-1"),
    );
    const second = openaiResponsesAdapter.normalize(
      makeExchange("Second prompt", "second answer", "turn-2"),
    );

    const timeline = openaiResponsesAdapter.timelineAssembler.build([
      first,
      second,
    ]);

    expect(timeline.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    expect(timeline.messages.at(-1)?.blocks[0]).toEqual({
      type: "text",
      text: "second answer",
    });
  });
});
