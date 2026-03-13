import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC } from "../../src/shared/ipc-channels";

const handleMock = vi.fn();
const sendMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
  },
}));

describe("IPC Channels", () => {
  it("defines all required channels", () => {
    expect(IPC.GET_SETTINGS).toBe("app:get-settings");
    expect(IPC.SAVE_SETTINGS).toBe("app:save-settings");
    expect(IPC.TOGGLE_LISTENING).toBe("app:toggle-listening");
    expect(IPC.GET_PROXY_STATUS).toBe("app:get-proxy-status");
    expect(IPC.LIST_SESSIONS).toBe("app:list-sessions");
    expect(IPC.GET_SESSION_REQUESTS).toBe("app:get-session-requests");
    expect(IPC.GET_REQUEST_DETAIL).toBe("app:get-request-detail");
    expect(IPC.CLEAR_DATA).toBe("app:clear-data");
    expect(IPC.SEARCH).toBe("app:search");
    expect(IPC.GET_UPDATE_STATE).toBe("app:get-update-state");
    expect(IPC.CHECK_FOR_UPDATES).toBe("app:check-for-updates");
    expect(IPC.DOWNLOAD_UPDATE).toBe("app:download-update");
    expect(IPC.QUIT_AND_INSTALL_UPDATE).toBe("app:quit-and-install-update");
    expect(IPC.CAPTURE_UPDATED).toBe("proxy:capture-updated");
    expect(IPC.PROXY_ERROR).toBe("proxy:error");
    expect(IPC.UPDATE_STATE_CHANGED).toBe("app:update-state-changed");
  });

  it("has unique channel names", () => {
    const values = Object.values(IPC);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("all channels follow naming convention", () => {
    for (const channel of Object.values(IPC)) {
      expect(channel).toMatch(/^(app|proxy):/);
    }
  });
});

describe("registerIpcHandlers", () => {
  beforeEach(() => {
    handleMock.mockReset();
    sendMock.mockReset();
  });

  it("registers update handlers and broadcasts state changes", async () => {
    const { registerIpcHandlers } = await import(
      "../../src/main/ipc/register-ipc"
    );

    const updateService = {
      getState: vi.fn().mockReturnValue({
        status: "idle",
        currentVersion: "0.1.2",
        availableVersion: null,
        downloadPercent: null,
        message: null,
        checkedAt: null,
      }),
      checkForUpdates: vi.fn().mockResolvedValue({
        status: "checking",
        currentVersion: "0.1.2",
        availableVersion: null,
        downloadPercent: null,
        message: null,
        checkedAt: null,
      }),
      downloadUpdate: vi.fn().mockResolvedValue({
        status: "downloading",
        currentVersion: "0.1.2",
        availableVersion: "0.1.3",
        downloadPercent: 12,
        message: null,
        checkedAt: null,
      }),
      quitAndInstall: vi.fn(),
      subscribe: vi.fn((listener: (state: unknown) => void) => {
        listener({
          status: "available",
          currentVersion: "0.1.2",
          availableVersion: "0.1.3",
          downloadPercent: null,
          message: null,
          checkedAt: "2026-03-13T10:00:00.000Z",
        });
        return () => {};
      }),
    };

    registerIpcHandlers({
      settingsStore: {
        getSettings: vi.fn().mockReturnValue({ targetUrl: "" }),
        saveSettings: vi.fn(),
      } as never,
      historyStore: {
        listSessions: vi.fn().mockReturnValue([]),
        listRequests: vi.fn().mockReturnValue([]),
        getRequest: vi.fn().mockReturnValue(null),
        clearAll: vi.fn(),
        search: vi.fn().mockReturnValue({ sessions: [], requests: [] }),
      } as never,
      sessionManager: {} as never,
      getProxy: () => null,
      getMainWindow: () =>
        ({
          webContents: {
            send: sendMock,
          },
        }) as never,
      updateService,
    });

    expect(handleMock).toHaveBeenCalledWith(
      IPC.GET_UPDATE_STATE,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.CHECK_FOR_UPDATES,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.DOWNLOAD_UPDATE,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.QUIT_AND_INSTALL_UPDATE,
      expect.any(Function),
    );
    expect(updateService.subscribe).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith(
      IPC.UPDATE_STATE_CHANGED,
      expect.objectContaining({
        status: "available",
        availableVersion: "0.1.3",
      }),
    );
  });

  it("broadcasts an empty structured capture payload when clearing data", async () => {
    const { registerIpcHandlers } = await import(
      "../../src/main/ipc/register-ipc"
    );

    const clearAll = vi.fn();

    registerIpcHandlers({
      settingsStore: {
        getSettings: vi.fn().mockReturnValue({ targetUrl: "" }),
        saveSettings: vi.fn(),
      } as never,
      historyStore: {
        listSessions: vi.fn().mockReturnValue([]),
        listRequests: vi.fn().mockReturnValue([]),
        getRequest: vi.fn().mockReturnValue(null),
        clearAll,
        search: vi.fn().mockReturnValue({ sessions: [], requests: [] }),
      } as never,
      sessionManager: {} as never,
      getProxy: () => null,
      getMainWindow: () =>
        ({
          webContents: {
            send: sendMock,
          },
        }) as never,
      updateService: {
        getState: vi.fn(),
        checkForUpdates: vi.fn(),
        downloadUpdate: vi.fn(),
        quitAndInstall: vi.fn(),
        subscribe: vi.fn(() => () => {}),
      } as never,
    });

    const clearHandler = handleMock.mock.calls.find(
      ([channel]) => channel === IPC.CLEAR_DATA,
    )?.[1];

    expect(clearHandler).toBeTypeOf("function");

    clearHandler?.();

    expect(clearAll).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith(IPC.CAPTURE_UPDATED, {
      sessions: [],
      updatedSessionId: null,
      updatedRequestId: null,
    });
  });
});
