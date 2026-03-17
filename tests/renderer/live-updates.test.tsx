import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../src/renderer/src/stores/app-store";
import { useProfileStore } from "../../src/renderer/src/stores/profile-store";
import { useProxyEvents } from "../../src/renderer/src/hooks/use-proxy-events";
import { useSessionStore } from "../../src/renderer/src/stores/session-store";
import { useTraceStore } from "../../src/renderer/src/stores/trace-store";
import type {
  ProfileStatusChangedEvent,
  ProfilesChangedEvent,
  SessionListItemVM,
  SessionTraceVM,
  TraceResetEvent,
  TraceCapturedEvent,
} from "../../src/shared/contracts";
import { createDefaultUpdateState } from "../../src/shared/update";

const mockGetProfiles = vi.fn();
const mockGetProfileStatuses = vi.fn();
const mockListSessions = vi.fn();
const mockGetSessionTrace = vi.fn();
const mockGetExchangeDetail = vi.fn();
const mockClearHistory = vi.fn();
const mockGetUpdateState = vi.fn();
const mockCheckForUpdates = vi.fn();
const mockDownloadUpdate = vi.fn();
const mockQuitAndInstallUpdate = vi.fn();
const mockOnUpdateStateChanged = vi.fn(() => () => {});
const mockOnProxyError = vi.fn(() => () => {});

let traceCapturedHandler: ((payload: TraceCapturedEvent) => void) | null = null;
let profileStatusHandler: ((payload: ProfileStatusChangedEvent) => void) | null = null;
let profilesChangedHandler: ((payload: ProfilesChangedEvent) => void) | null = null;
let traceResetHandler: ((payload: TraceResetEvent) => void) | null = null;

const mockOnTraceCaptured = vi.fn((cb: (payload: TraceCapturedEvent) => void) => {
  traceCapturedHandler = cb;
  return () => {
    traceCapturedHandler = null;
  };
});

const mockOnProfileStatusChanged = vi.fn(
  (cb: (payload: ProfileStatusChangedEvent) => void) => {
    profileStatusHandler = cb;
    return () => {
      profileStatusHandler = null;
    };
  },
);

const mockOnProfilesChanged = vi.fn(
  (cb: (payload: ProfilesChangedEvent) => void) => {
    profilesChangedHandler = cb;
    return () => {
      profilesChangedHandler = null;
    };
  },
);

const mockOnTraceReset = vi.fn((cb: (payload: TraceResetEvent) => void) => {
  traceResetHandler = cb;
  return () => {
    traceResetHandler = null;
  };
});

vi.mock("../../src/renderer/src/lib/electron-api", () => ({
  getElectronAPI: () => ({
    getProfiles: mockGetProfiles,
    getProfileStatuses: mockGetProfileStatuses,
    listSessions: mockListSessions,
    getSessionTrace: mockGetSessionTrace,
    getExchangeDetail: mockGetExchangeDetail,
    clearHistory: mockClearHistory,
    getUpdateState: mockGetUpdateState,
    checkForUpdates: mockCheckForUpdates,
    downloadUpdate: mockDownloadUpdate,
    quitAndInstallUpdate: mockQuitAndInstallUpdate,
    onUpdateStateChanged: mockOnUpdateStateChanged,
    onTraceCaptured: mockOnTraceCaptured,
    onTraceReset: mockOnTraceReset,
    onProfileStatusChanged: mockOnProfileStatusChanged,
    onProfilesChanged: mockOnProfilesChanged,
    onProxyError: mockOnProxyError,
  }),
}));

function makeSessions(count: number): SessionListItemVM[] {
  return Array.from({ length: count }, (_, index) => ({
    sessionId: `session-${index}`,
    providerId: "anthropic",
    providerLabel: "Anthropic",
    profileId: "anthropic-dev",
    title: `Session ${index}`,
    model: "claude-opus-4-1",
    updatedAt: new Date(Date.now() - index * 60000).toISOString(),
    exchangeCount: index + 1,
  }));
}

function makeTrace(sessionId: string): SessionTraceVM {
  return {
    sessionId,
    providerId: "anthropic",
    providerLabel: "Anthropic",
    profileId: "anthropic-dev",
    title: `Trace ${sessionId}`,
    timeline: {
      messages: [
        { role: "user", blocks: [{ type: "text", text: "Hello" }] },
        { role: "assistant", blocks: [{ type: "text", text: "Hi" }] },
      ],
    },
    exchanges: [
      {
        exchangeId: `${sessionId}-exchange-1`,
        providerId: "anthropic",
        providerLabel: "Anthropic",
        method: "POST",
        path: "/v1/messages",
        statusCode: 200,
        durationMs: 100,
        model: "claude-opus-4-1",
      },
    ],
  };
}

describe("Session Store", () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      selectedSessionId: null,
      searchQuery: "",
    } as never);
    useTraceStore.setState({
      trace: null,
      selectedExchangeId: null,
      selectedExchangeDetail: null,
      exchangeDetails: {},
      inspectorOpen: false,
      rawMode: false,
    } as never);
    mockListSessions.mockReset().mockResolvedValue(makeSessions(0));
    mockGetSessionTrace.mockReset().mockResolvedValue(makeTrace("session-0"));
    mockGetExchangeDetail.mockReset().mockResolvedValue({
      ...makeTrace("session-0").exchanges[0]!,
      inspector: { sections: [] },
    });
    mockClearHistory.mockReset().mockResolvedValue(undefined);
    mockOnTraceCaptured.mockClear();
    mockOnProfileStatusChanged.mockClear();
    mockOnProfilesChanged.mockClear();
    mockOnTraceReset.mockClear();
    traceCapturedHandler = null;
    profileStatusHandler = null;
    profilesChangedHandler = null;
    traceResetHandler = null;
  });

  it("upsertSession adds a new session to the top of the list", () => {
    act(() => {
      useSessionStore.getState().upsertSession(makeSessions(1)[0]!);
    });
    expect(useSessionStore.getState().sessions).toHaveLength(1);
  });

  it("upsertSession moves an existing session to the top", () => {
    const initial = makeSessions(3);
    useSessionStore.setState({ sessions: initial } as never);

    const updated = { ...initial[2]!, title: "Updated" };
    act(() => {
      useSessionStore.getState().upsertSession(updated);
    });

    const sessions = useSessionStore.getState().sessions;
    expect(sessions).toHaveLength(3);
    expect(sessions[0]!.title).toBe("Updated");
  });

  it("selectSession sets the selected session", () => {
    act(() => {
      useSessionStore.getState().selectSession("session-1");
    });
    expect(useSessionStore.getState().selectedSessionId).toBe("session-1");
  });

  it("clearHistory empties sessions and selection", async () => {
    useSessionStore.setState({
      sessions: makeSessions(2),
      selectedSessionId: "session-1",
    } as never);

    await act(async () => {
      await useSessionStore.getState().clearHistory();
    });

    expect(mockClearHistory).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().sessions).toHaveLength(0);
    expect(useSessionStore.getState().selectedSessionId).toBeNull();
  });

  it("refreshes trace when the selected session receives a trace update", async () => {
    function TestHarness() {
      useProxyEvents();
      return null;
    }

    useSessionStore.setState({
      sessions: makeSessions(1),
      selectedSessionId: "session-0",
      searchQuery: "",
    } as never);

    render(<TestHarness />);

    expect(traceCapturedHandler).not.toBeNull();

    act(() => {
      traceCapturedHandler?.({
        updatedSession: makeSessions(1)[0]!,
        updatedExchangeId: "exchange-new",
      });
    });

    await waitFor(() => {
      expect(mockGetSessionTrace).toHaveBeenCalledWith("session-0");
    });
  });

  it("keeps the currently selected exchange when the refreshed trace still contains it", async () => {
    function TestHarness() {
      useProxyEvents();
      return null;
    }

    mockGetSessionTrace.mockResolvedValue({
      ...makeTrace("session-0"),
      exchanges: [
        {
          exchangeId: "exchange-1",
          providerId: "anthropic",
          providerLabel: "Anthropic",
          method: "POST",
          path: "/v1/messages",
          statusCode: 200,
          durationMs: 100,
          model: "claude-opus-4-1",
        },
        {
          exchangeId: "exchange-2",
          providerId: "anthropic",
          providerLabel: "Anthropic",
          method: "POST",
          path: "/v1/messages",
          statusCode: 200,
          durationMs: 120,
          model: "claude-opus-4-1",
        },
      ],
    });

    useSessionStore.setState({
      sessions: makeSessions(1),
      selectedSessionId: "session-0",
      searchQuery: "",
    } as never);
    useTraceStore.setState({
      trace: {
        ...makeTrace("session-0"),
        exchanges: [
          {
            exchangeId: "exchange-1",
            providerId: "anthropic",
            providerLabel: "Anthropic",
            method: "POST",
            path: "/v1/messages",
            statusCode: 200,
            durationMs: 100,
            model: "claude-opus-4-1",
          },
          {
            exchangeId: "exchange-2",
            providerId: "anthropic",
            providerLabel: "Anthropic",
            method: "POST",
            path: "/v1/messages",
            statusCode: 200,
            durationMs: 120,
            model: "claude-opus-4-1",
          },
        ],
      },
      selectedExchangeId: "exchange-1",
      selectedExchangeDetail: null,
      exchangeDetails: {},
      inspectorOpen: false,
      rawMode: false,
    } as never);

    render(<TestHarness />);

    act(() => {
      traceCapturedHandler?.({
        updatedSession: makeSessions(1)[0]!,
        updatedExchangeId: "exchange-3",
      });
    });

    await waitFor(() => {
      expect(mockGetSessionTrace).toHaveBeenCalledWith("session-0");
    });

    expect(useTraceStore.getState().selectedExchangeId).toBe("exchange-1");
  });

  it("does not refresh trace when another session receives a trace update", async () => {
    function TestHarness() {
      useProxyEvents();
      return null;
    }

    useSessionStore.setState({
      sessions: makeSessions(2),
      selectedSessionId: "session-0",
      searchQuery: "",
    } as never);

    render(<TestHarness />);

    act(() => {
      traceCapturedHandler?.({
        updatedSession: {
          ...makeSessions(2)[1]!,
          sessionId: "session-1",
        },
        updatedExchangeId: "exchange-other",
      });
    });

    await Promise.resolve();
    expect(mockGetSessionTrace).not.toHaveBeenCalled();
  });

  it("updates profile statuses when a status event arrives", async () => {
    function TestHarness() {
      useProxyEvents();
      return null;
    }

    render(<TestHarness />);

    act(() => {
      profileStatusHandler?.({
        statuses: {
          "anthropic-dev": { isRunning: true, port: 8888 },
        },
      });
    });

    expect(useProfileStore.getState().statuses["anthropic-dev"]).toEqual({
      isRunning: true,
      port: 8888,
    });
  });

  it("clears session and trace state when a reset event arrives", () => {
    function TestHarness() {
      useProxyEvents();
      return null;
    }

    useSessionStore.setState({
      sessions: makeSessions(2),
      selectedSessionId: "session-0",
      searchQuery: "",
    } as never);
    useTraceStore.setState({
      trace: makeTrace("session-0"),
      selectedExchangeId: "session-0-exchange-1",
      selectedExchangeDetail: null,
      exchangeDetails: {},
      inspectorOpen: false,
      rawMode: false,
    } as never);

    render(<TestHarness />);

    act(() => {
      traceResetHandler?.({
        clearedAt: "2026-03-14T00:00:00.000Z",
      });
    });

    expect(useSessionStore.getState().sessions).toHaveLength(0);
    expect(useSessionStore.getState().selectedSessionId).toBeNull();
    expect(useTraceStore.getState().trace).toBeNull();
  });
});

describe("App Store", () => {
  beforeEach(() => {
    mockGetProfiles.mockReset().mockResolvedValue([
      {
        id: "anthropic-dev",
        name: "anthropic-dev",
        providerId: "anthropic",
        upstreamBaseUrl: "https://api.anthropic.com",
        localPort: 8888,
        enabled: true,
        autoStart: false,
      },
    ]);
    mockGetProfileStatuses.mockReset().mockResolvedValue({
      "anthropic-dev": { isRunning: false, port: 8888 },
    });
    mockGetUpdateState.mockReset().mockResolvedValue(
      createDefaultUpdateState("0.1.2"),
    );
    mockCheckForUpdates.mockReset().mockResolvedValue(
      createDefaultUpdateState("0.1.2"),
    );
    mockDownloadUpdate.mockReset().mockResolvedValue(
      createDefaultUpdateState("0.1.2"),
    );
    mockQuitAndInstallUpdate.mockReset().mockResolvedValue(undefined);
    mockOnUpdateStateChanged.mockReset().mockReturnValue(() => {});

    useAppStore.setState({
      initialized: false,
      updateState: createDefaultUpdateState(),
    } as never);
    useProfileStore.setState({
      profiles: [],
      statuses: {},
      initialized: false,
    } as never);
  });

  it("initialize loads profiles and marks the app initialized", async () => {
    await act(async () => {
      await useAppStore.getState().initialize();
    });

    expect(useAppStore.getState().initialized).toBe(true);
    expect(useProfileStore.getState().profiles).toHaveLength(1);
    expect(useProfileStore.getState().profiles[0]?.name).toBe("anthropic-dev");
  });
});
