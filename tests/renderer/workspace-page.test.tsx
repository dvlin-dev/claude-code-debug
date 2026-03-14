import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SessionSidebar } from "../../src/renderer/src/components/session-sidebar";
import { EmptyState } from "../../src/renderer/src/components/empty-state";
import { SessionItem } from "../../src/renderer/src/components/session-item";
import { ConversationView } from "../../src/renderer/src/components/conversation-view";
import { InspectorPanel } from "../../src/renderer/src/components/inspector-panel";
import { useSessionStore } from "../../src/renderer/src/stores/session-store";
import { useTraceStore } from "../../src/renderer/src/stores/trace-store";
import { stripXmlTags } from "../../src/shared/strip-xml";
import type { SessionListItemVM } from "../../src/shared/contracts";

// Mock the electron API
vi.mock("../../src/renderer/src/lib/electron-api", () => ({
  getElectronAPI: () => ({
    listSessions: vi.fn().mockResolvedValue([]),
    getSessionTrace: vi.fn().mockResolvedValue({
      sessionId: "s1",
      providerId: "anthropic",
      providerLabel: "Anthropic",
      profileId: "anthropic-dev",
      title: "Trace",
      timeline: { messages: [] },
      exchanges: [],
    }),
    getExchangeDetail: vi.fn().mockResolvedValue(null),
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

describe("EmptyState", () => {
  it("displays no sessions message", () => {
    render(<EmptyState />);
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
    expect(
      screen.getByText(/start listening to capture/i),
    ).toBeInTheDocument();
  });
});

describe("SessionItem", () => {
  const mockSession: SessionListItemVM = {
    sessionId: "s1",
    providerId: "anthropic",
    providerLabel: "Anthropic",
    profileId: "anthropic-dev",
    title: "Fix authentication bug",
    updatedAt: new Date().toISOString(),
    exchangeCount: 5,
    model: "claude-opus-4-6",
  };

  it("displays session title", () => {
    render(
      <SessionItem
        session={mockSession}
        isSelected={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("Fix authentication bug")).toBeInTheDocument();
  });

  it("displays model badge", () => {
    render(
      <SessionItem
        session={mockSession}
        isSelected={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("claude-opus-4-6")).toBeInTheDocument();
  });

  it("displays provider and exchange count", () => {
    render(
      <SessionItem
        session={mockSession}
        isSelected={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});

describe("SessionSidebar", () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      selectedSessionId: null,
      searchQuery: "",
    });
    useTraceStore.setState({
      trace: null,
      selectedExchangeId: null,
      selectedExchangeDetail: null,
      exchangeDetails: {},
      inspectorOpen: false,
      rawMode: false,
    });
  });

  it("renders search input", () => {
    render(<SessionSidebar />);
    expect(
      screen.getByPlaceholderText("Search sessions..."),
    ).toBeInTheDocument();
  });

  it("shows empty state when no sessions", () => {
    render(<SessionSidebar />);
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("renders sessions from store", () => {
    useSessionStore.setState({
      sessions: [
        {
          sessionId: "s1",
          providerId: "anthropic",
          providerLabel: "Anthropic",
          profileId: "anthropic-dev",
          title: "Test session",
          updatedAt: new Date().toISOString(),
          exchangeCount: 3,
          model: "claude-opus-4-6",
        },
      ],
    });

    render(<SessionSidebar />);
    expect(screen.getByText("Test session")).toBeInTheDocument();
  });

  it("renders conversation timeline from trace store", () => {
    const exchanges = [
      {
        exchangeId: "exchange-1",
        providerId: "anthropic" as const,
        providerLabel: "Anthropic",
        method: "POST",
        path: "/v1/messages",
        statusCode: 200,
        durationMs: 101,
        model: "claude-opus-4-1",
      },
    ];

    render(
      <>
        <ConversationView
          timeline={{
            messages: [
              { role: "user", blocks: [{ type: "text", text: "Hello" }] },
              {
                role: "assistant",
                blocks: [{ type: "text", text: "Hi there" }],
              },
            ],
          }}
        />
        <InspectorPanel
          exchanges={exchanges}
          selectedExchangeId="exchange-1"
          onSelectExchange={() => {}}
          inspector={{
            sections: [
              {
                kind: "overview",
                title: "Overview",
                items: [{ label: "Model", value: "claude-opus-4-1" }],
              },
            ],
          }}
        />
      </>,
    );

    expect(screen.getByText("Hi there")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-4-1")).toBeInTheDocument();
  });
});

describe("stripXmlTags", () => {
  it("strips XML tags from text", () => {
    expect(stripXmlTags("<system-reminder>Hello world</system-reminder>")).toBe("Hello world");
  });

  it("strips nested tags", () => {
    expect(stripXmlTags("<a><b>text</b></a>")).toBe("text");
  });

  it("strips self-closing tags", () => {
    expect(stripXmlTags("before <br/> after")).toBe("before  after");
  });

  it("returns plain text unchanged", () => {
    expect(stripXmlTags("no tags here")).toBe("no tags here");
  });

  it("trims whitespace after stripping", () => {
    expect(stripXmlTags("  <tag>hello</tag>  ")).toBe("hello");
  });

  it("SessionItem strips XML tags from title", () => {
    const session: SessionListItemVM = {
      sessionId: "s2",
      providerId: "anthropic",
      providerLabel: "Anthropic",
      profileId: "anthropic-dev",
      title: "<system-reminder>Fix the bug</system-reminder>",
      updatedAt: new Date().toISOString(),
      exchangeCount: 1,
      model: null,
    };

    render(
      <SessionItem session={session} isSelected={false} onClick={() => {}} />,
    );
    expect(screen.getByText("Fix the bug")).toBeInTheDocument();
    expect(screen.queryByText(/<system-reminder>/)).not.toBeInTheDocument();
  });
});
