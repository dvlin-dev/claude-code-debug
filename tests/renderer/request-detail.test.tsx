import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { parseClaudeRequest, parseClaudeResponse } from "../../src/renderer/src/lib/parse-claude-body";
import { ContentBlock } from "../../src/renderer/src/components/content-block";
import { MessageBlock } from "../../src/renderer/src/components/message-block";
import { RequestItem } from "../../src/renderer/src/components/request-item";
import type { RequestRecord } from "../../src/shared/types";

vi.mock("../../src/renderer/src/lib/electron-api", () => ({
  getElectronAPI: () => ({
    getSessionRequests: vi.fn().mockResolvedValue([]),
    getUpdateState: vi.fn().mockResolvedValue({
      status: "idle",
      currentVersion: "0.1.2",
      availableVersion: null,
      downloadPercent: null,
      message: null,
      checkedAt: null,
    }),
    onUpdateStateChanged: vi.fn().mockReturnValue(() => {}),
  }),
}));

describe("parseClaudeRequest", () => {
  it("parses a valid Claude request body", () => {
    const body = JSON.stringify({
      model: "claude-opus-4-6",
      system: "You are helpful",
      tools: [{ name: "read_file", description: "Read a file", input_schema: {} }],
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 4096,
      stream: true,
    });

    const result = parseClaudeRequest(body);
    expect(result).not.toBeNull();
    expect(result!.model).toBe("claude-opus-4-6");
    expect(result!.system).toBe("You are helpful");
    expect(result!.tools).toHaveLength(1);
    expect(result!.messages).toHaveLength(1);
    expect(result!.maxTokens).toBe(4096);
    expect(result!.stream).toBe(true);
  });

  it("returns null for null body", () => {
    expect(parseClaudeRequest(null)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseClaudeRequest("not json")).toBeNull();
  });

  it("handles missing optional fields", () => {
    const result = parseClaudeRequest(JSON.stringify({}));
    expect(result).not.toBeNull();
    expect(result!.model).toBeNull();
    expect(result!.system).toBeNull();
    expect(result!.tools).toBeNull();
  });
});

describe("parseClaudeResponse", () => {
  it("parses a non-streaming response", () => {
    const body = JSON.stringify({
      role: "assistant",
      content: [
        { type: "text", text: "Hello!" },
      ],
      model: "claude-opus-4-6",
      stop_reason: "end_turn",
    });

    const result = parseClaudeResponse(body);
    expect(result).not.toBeNull();
    expect(result!.role).toBe("assistant");
    expect(result!.content).toHaveLength(1);
    expect(result!.content[0].text).toBe("Hello!");
    expect(result!.model).toBe("claude-opus-4-6");
    expect(result!.stopReason).toBe("end_turn");
  });

  it("returns null for null body", () => {
    expect(parseClaudeResponse(null)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseClaudeResponse("not json")).toBeNull();
  });

  it("returns null for non-assistant response", () => {
    const body = JSON.stringify({ role: "user", content: [] });
    expect(parseClaudeResponse(body)).toBeNull();
  });

  it("parses delta-only SSE without content_block_start", () => {
    const body = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
      "",
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}',
      "",
      'event: message_stop',
      'data: {"type":"message_stop"}',
      "",
    ].join("\n");

    const result = parseClaudeResponse(body);
    expect(result).not.toBeNull();
    expect(result!.role).toBe("assistant");
    expect(result!.content).toHaveLength(1);
    expect(result!.content[0]).toMatchObject({
      type: "text",
      text: "Hello world",
    });
  });

  it("parses SSE deltas without index by falling back to block zero", () => {
    const body = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Plan"}}',
      "",
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":" more"}}',
      "",
      'event: message_stop',
      'data: {"type":"message_stop"}',
      "",
    ].join("\n");

    const result = parseClaudeResponse(body);
    expect(result).not.toBeNull();
    expect(result!.content).toHaveLength(1);
    expect(result!.content[0]).toMatchObject({
      type: "thinking",
      text: "Plan more",
    });
  });

  it("parses data-only SSE without explicit event lines", () => {
    const body = [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
      "",
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}',
      "",
      'data: {"type":"message_stop"}',
      "",
    ].join("\n");

    const result = parseClaudeResponse(body);
    expect(result).not.toBeNull();
    expect(result!.content).toHaveLength(1);
    expect(result!.content[0]).toMatchObject({
      type: "text",
      text: "Hello there",
    });
  });
});

describe("ContentBlock", () => {
  it("renders text content", () => {
    render(<ContentBlock block={{ type: "text", text: "Hello world" }} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("truncates long text with Show more", () => {
    const longText = "x".repeat(300);
    render(<ContentBlock block={{ type: "text", text: longText }} />);
    expect(screen.getByText("Show more")).toBeInTheDocument();
  });

  it("renders thinking block collapsed by default", () => {
    render(<ContentBlock block={{ type: "thinking", text: "Let me think..." }} />);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.queryByText("Let me think...")).not.toBeInTheDocument();
  });

  it("expands thinking block on click", () => {
    render(<ContentBlock block={{ type: "thinking", text: "Let me think..." }} />);
    fireEvent.click(screen.getByText("Thinking"));
    expect(screen.getByText("Let me think...")).toBeInTheDocument();
  });

  it("renders tool_use block with name", () => {
    render(
      <ContentBlock
        block={{ type: "tool_use", name: "read_file", input: { path: "/test" } }}
      />,
    );
    expect(screen.getByText("read_file")).toBeInTheDocument();
  });

  it("renders tool_result block", () => {
    render(
      <ContentBlock block={{ type: "tool_result", content: "Success" }} />,
    );
    expect(screen.getByText("Result")).toBeInTheDocument();
  });
});

describe("MessageBlock", () => {
  it("renders USER badge for user messages", () => {
    render(
      <MessageBlock message={{ role: "user", content: "Hello" }} />,
    );
    expect(screen.getByText("USER")).toBeInTheDocument();
  });

  it("renders ASSISTANT badge for assistant messages", () => {
    render(
      <MessageBlock message={{ role: "assistant", content: "Hi there" }} />,
    );
    expect(screen.getByText("ASSISTANT")).toBeInTheDocument();
  });

  it("handles array content", () => {
    render(
      <MessageBlock
        message={{
          role: "assistant",
          content: [
            { type: "text", text: "Hello" },
            { type: "tool_use", name: "read_file", input: {} },
          ],
        }}
      />,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("read_file")).toBeInTheDocument();
  });

  it("renders raw JSON in rawMode", () => {
    render(
      <MessageBlock
        message={{ role: "user", content: "Hello" }}
        rawMode={true}
      />,
    );
    expect(screen.getByText("USER")).toBeInTheDocument();
    expect(screen.getByText(/"Hello"/)).toBeInTheDocument();
  });
});

describe("RequestItem", () => {
  const mockRequest: RequestRecord = {
    requestId: "r1",
    sessionId: "s1",
    method: "POST",
    path: "/v1/messages",
    timestamp: new Date().toISOString(),
    duration: 1200,
    model: "claude-opus-4-6",
    requestHeaders: {},
    requestBody: null,
    responseHeaders: null,
    responseBody: null,
    statusCode: 200,
    requestSize: 103000,
    responseSize: null,
  };

  it("displays method and path", () => {
    render(
      <RequestItem request={mockRequest} isSelected={false} onClick={() => {}} />,
    );
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("/v1/messages")).toBeInTheDocument();
  });

  it("displays status code", () => {
    render(
      <RequestItem request={mockRequest} isSelected={false} onClick={() => {}} />,
    );
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("displays duration", () => {
    render(
      <RequestItem request={mockRequest} isSelected={false} onClick={() => {}} />,
    );
    expect(screen.getByText("1.2s")).toBeInTheDocument();
  });

  it("displays model badge", () => {
    render(
      <RequestItem request={mockRequest} isSelected={false} onClick={() => {}} />,
    );
    expect(screen.getByText("claude-opus-4-6")).toBeInTheDocument();
  });
});
