import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConversationView } from "../../src/renderer/src/components/conversation-view";
import { InspectorPanel } from "../../src/renderer/src/components/inspector-panel";
import type { ExchangeListItemVM, SessionTimeline } from "../../src/shared/contracts";

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
