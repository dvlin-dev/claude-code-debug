import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";
import { useSessionStore } from "../../src/renderer/src/stores/session-store";
import { useRequestStore } from "../../src/renderer/src/stores/request-store";
import { useAppStore } from "../../src/renderer/src/stores/app-store";
import { useProxyEvents } from "../../src/renderer/src/hooks/use-proxy-events";
import type { SessionSummary } from "../../src/shared/types";
import { createDefaultUpdateState } from "../../src/shared/update";

// Mock the electron API
const mockGetSettings = vi.fn().mockResolvedValue({ targetUrl: "https://api.anthropic.com" });
const mockGetProxyStatus = vi.fn().mockResolvedValue({ isRunning: false });
const mockListSessions = vi.fn().mockResolvedValue([]);
const mockGetSessionRequests = vi.fn().mockResolvedValue([]);
const mockClearData = vi.fn().mockResolvedValue(undefined);
const mockGetUpdateState = vi.fn().mockResolvedValue(
  createDefaultUpdateState("0.1.2"),
);
const mockCheckForUpdates = vi.fn().mockResolvedValue(
  createDefaultUpdateState("0.1.2"),
);
const mockDownloadUpdate = vi.fn().mockResolvedValue(
  createDefaultUpdateState("0.1.2"),
);
const mockQuitAndInstallUpdate = vi.fn().mockResolvedValue(undefined);
const mockOnCaptureUpdated = vi.fn((cb) => {
  captureHandler = cb;
  return () => {
    captureHandler = null;
  };
});
let captureHandler: ((payload: unknown) => void) | null = null;

vi.mock("../../src/renderer/src/lib/electron-api", () => ({
  getElectronAPI: () => ({
    getSettings: mockGetSettings,
    getProxyStatus: mockGetProxyStatus,
    listSessions: mockListSessions,
    getSessionRequests: mockGetSessionRequests,
    clearData: mockClearData,
    getUpdateState: mockGetUpdateState,
    checkForUpdates: mockCheckForUpdates,
    downloadUpdate: mockDownloadUpdate,
    quitAndInstallUpdate: mockQuitAndInstallUpdate,
    onUpdateStateChanged: vi.fn().mockReturnValue(() => {}),
    onCaptureUpdated: mockOnCaptureUpdated,
    onProxyError: vi.fn().mockReturnValue(() => {}),
  }),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const makeSessions = (count: number): SessionSummary[] =>
  Array.from({ length: count }, (_, i) => ({
    sessionId: `s${i}`,
    title: `Session ${i}`,
    startedAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - i * 60000).toISOString(),
    requestCount: i + 1,
    model: "claude-opus-4-6",
  }));

describe("Session Store", () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      selectedSessionId: null,
      searchQuery: "",
    });
    useRequestStore.setState({
      requests: [],
      selectedRequestId: null,
      inspectorOpen: false,
      rawMode: false,
      activeSessionId: null,
    });
    mockGetSessionRequests.mockReset();
    mockOnCaptureUpdated.mockClear();
    captureHandler = null;
  });

  it("updateSessions updates the session list", () => {
    const sessions = makeSessions(3);
    act(() => {
      useSessionStore.getState().updateSessions(sessions);
    });
    expect(useSessionStore.getState().sessions).toHaveLength(3);
  });

  it("selectSession sets the selected session", () => {
    act(() => {
      useSessionStore.getState().selectSession("s1");
    });
    expect(useSessionStore.getState().selectedSessionId).toBe("s1");
  });

  it("clearData empties sessions and selection", async () => {
    useSessionStore.setState({
      sessions: makeSessions(2),
      selectedSessionId: "s1",
    });

    await act(async () => {
      await useSessionStore.getState().clearData();
    });

    expect(useSessionStore.getState().sessions).toHaveLength(0);
    expect(useSessionStore.getState().selectedSessionId).toBeNull();
  });

  it("new capture updates session list", () => {
    const initialSessions = makeSessions(2);
    act(() => {
      useSessionStore.getState().updateSessions(initialSessions);
    });
    expect(useSessionStore.getState().sessions).toHaveLength(2);

    // Simulate new capture arriving
    const updatedSessions = makeSessions(3);
    act(() => {
      useSessionStore.getState().updateSessions(updatedSessions);
    });
    expect(useSessionStore.getState().sessions).toHaveLength(3);
  });

  it("refreshes requests when the selected session receives a capture update", async () => {
    function TestHarness() {
      useProxyEvents();
      return null;
    }

    useSessionStore.setState({
      sessions: makeSessions(1),
      selectedSessionId: "s0",
      searchQuery: "",
    });

    render(<TestHarness />);

    expect(captureHandler).not.toBeNull();

    act(() => {
      captureHandler?.({
        sessions: makeSessions(2),
        updatedSessionId: "s0",
        updatedRequestId: "r-new",
      });
    });

    await waitFor(() => {
      expect(mockGetSessionRequests).toHaveBeenCalledWith("s0");
    });
  });

  it("does not refresh requests when another session receives a capture update", async () => {
    function TestHarness() {
      useProxyEvents();
      return null;
    }

    useSessionStore.setState({
      sessions: makeSessions(2),
      selectedSessionId: "s0",
      searchQuery: "",
    });

    render(<TestHarness />);

    act(() => {
      captureHandler?.({
        sessions: makeSessions(3),
        updatedSessionId: "s1",
        updatedRequestId: "r-other",
      });
    });

    await Promise.resolve();
    expect(mockGetSessionRequests).not.toHaveBeenCalled();
  });

  it("keeps a single capture subscription while selected session changes", () => {
    function TestHarness() {
      useProxyEvents();
      return null;
    }

    render(<TestHarness />);
    expect(mockOnCaptureUpdated).toHaveBeenCalledTimes(1);

    act(() => {
      useSessionStore.getState().selectSession("s1");
    });

    expect(mockOnCaptureUpdated).toHaveBeenCalledTimes(1);
  });

  it("drops stale request refresh results after switching sessions", async () => {
    const s0Deferred = createDeferred<Array<{ requestId: string; sessionId: string }>>();
    const s1Deferred = createDeferred<Array<{ requestId: string; sessionId: string }>>();

    mockGetSessionRequests.mockImplementation((sessionId: string) => {
      if (sessionId === "s0") {
        return s0Deferred.promise;
      }
      if (sessionId === "s1") {
        return s1Deferred.promise;
      }
      return Promise.resolve([]);
    });

    useRequestStore.setState({
      requests: [],
      selectedRequestId: null,
      inspectorOpen: false,
      rawMode: false,
      activeSessionId: "s0",
    });

    const refreshPromise = useRequestStore
      .getState()
      .refreshSessionIfSelected("s0", "s0");

    const switchPromise = useRequestStore.getState().loadRequests("s1");

    s1Deferred.resolve([
      { requestId: "r-s1", sessionId: "s1" } as never,
    ]);
    await switchPromise;

    s0Deferred.resolve([
      { requestId: "r-s0", sessionId: "s0" } as never,
    ]);
    await refreshPromise;

    expect(useRequestStore.getState().activeSessionId).toBe("s1");
    expect(useRequestStore.getState().requests).toEqual([
      { requestId: "r-s1", sessionId: "s1" },
    ]);
  });
});

describe("App Store", () => {
  beforeEach(() => {
    useAppStore.setState({
      settings: null,
      isListening: false,
      proxyAddress: null,
      initialized: false,
      updateState: createDefaultUpdateState(),
    });
  });

  it("initialize loads settings", async () => {
    await act(async () => {
      await useAppStore.getState().initialize();
    });

    expect(useAppStore.getState().settings).toEqual({
      targetUrl: "https://api.anthropic.com",
    });
    expect(useAppStore.getState().initialized).toBe(true);
  });

  it("initialize loads proxy status", async () => {
    mockGetProxyStatus.mockResolvedValueOnce({ isRunning: true });

    await act(async () => {
      await useAppStore.getState().initialize();
    });

    expect(useAppStore.getState().isListening).toBe(true);
  });
});
