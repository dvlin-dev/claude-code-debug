import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConversationView } from "../../src/renderer/src/components/conversation-view";
import { ContentTabBar } from "../../src/renderer/src/components/content-tab-bar";
import { InspectorPanel } from "../../src/renderer/src/components/inspector-panel";
import type { ExchangeListItemVM, SessionTimeline } from "../../src/shared/contracts";
import { useTraceStore } from "../../src/renderer/src/stores/trace-store";

beforeEach(() => {
  useTraceStore.setState({
    trace: null,
    selectedExchangeId: null,
    selectedExchangeDetail: null,
    exchangeDetails: {},
    inspectorOpen: false,
    rawMode: false,
    contentTab: "messages",
    messageOrder: "asc",
  } as never);
});

describe("ConversationView", () => {
  it("renders timeline messages from the normalized trace view model", () => {
    const timeline: SessionTimeline = {
      messages: [
        {
          role: "user",
          blocks: [{ type: "text", text: "Hello" }],
        },
        {
          role: "assistant",
          blocks: [{ type: "text", text: "Hi there" }],
        },
      ],
    };

    render(<ConversationView timeline={timeline} rawMode={false} />);

    expect(screen.getByText("USER")).toBeInTheDocument();
    expect(screen.getByText("ASSISTANT")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  it("assigns the same round badge to tool/result messages in the same turn", () => {
    const timeline: SessionTimeline = {
      messages: [
        {
          role: "user",
          blocks: [{ type: "text", text: "Question" }],
        },
        {
          role: "assistant",
          blocks: [{ type: "tool-call", name: "search", input: { q: "x" } }],
        },
        {
          role: "tool",
          blocks: [{ type: "tool-result", content: { ok: true } }],
        },
        {
          role: "assistant",
          blocks: [{ type: "text", text: "Answer" }],
        },
      ],
    };

    render(<ConversationView timeline={timeline} rawMode={false} />);

    expect(screen.getAllByText("#1")).toHaveLength(4);
  });

  it("renders messages in reverse order when newest-first is selected", () => {
    useTraceStore.setState({ messageOrder: "desc" } as never);

    const timeline: SessionTimeline = {
      messages: [
        {
          role: "user",
          blocks: [{ type: "text", text: "Hello" }],
        },
        {
          role: "assistant",
          blocks: [{ type: "text", text: "Hi there" }],
        },
      ],
    };

    render(<ConversationView timeline={timeline} rawMode={false} />);

    const firstHello = screen.getByText("Hello");
    const firstReply = screen.getByText("Hi there");

    expect(
      firstReply.compareDocumentPosition(firstHello) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    useTraceStore.setState({ messageOrder: "asc" } as never);
  });
});

describe("ContentTabBar", () => {
  it("toggles message order from the tab bar when messages is selected", () => {
    useTraceStore.setState({
      contentTab: "messages",
      messageOrder: "asc",
    } as never);

    render(<ContentTabBar />);
    fireEvent.click(screen.getByRole("button", { name: /oldest first/i }));

    expect(useTraceStore.getState().messageOrder).toBe("desc");
  });

  it("only shows the message order control on the messages tab", () => {
    useTraceStore.setState({
      contentTab: "system",
      messageOrder: "asc",
    } as never);

    render(<ContentTabBar />);

    expect(
      screen.queryByRole("button", { name: /oldest first/i }),
    ).not.toBeInTheDocument();
  });
});

describe("InspectorPanel", () => {
  it("renders inspector sections from the exchange detail view model", () => {
    const exchanges: ExchangeListItemVM[] = [
      {
        exchangeId: "exchange-1",
        providerId: "anthropic",
        providerLabel: "Anthropic",
        method: "POST",
        path: "/v1/messages",
        statusCode: 200,
        durationMs: 240,
        model: "claude-sonnet-4-5",
      },
    ];

    render(
      <InspectorPanel
        exchanges={exchanges}
        selectedExchangeId="exchange-1"
        onSelectExchange={() => {}}
        inspector={{
          sections: [
            {
              kind: "overview",
              title: "Overview",
              items: [
                { label: "Model", value: "claude-sonnet-4-5" },
                { label: "Status", value: "200" },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/overview/i)).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-4-5")).toBeInTheDocument();
  });
});
