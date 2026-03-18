import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC } from "../../src/shared/ipc-channels";

const handleMock = vi.fn();
const sendMock = vi.fn();
const openExternalMock = vi.fn();
const showItemInFolderMock = vi.fn();
const showSaveDialogMock = vi.fn();
const showOpenDialogMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
  },
  dialog: {
    showSaveDialog: showSaveDialogMock,
    showOpenDialog: showOpenDialogMock,
  },
  shell: {
    openExternal: openExternalMock,
    showItemInFolder: showItemInFolderMock,
  },
}));

function createRegisterDeps(overrides: Record<string, unknown> = {}) {
  return {
    profileStore: {
      getProfiles: vi.fn().mockReturnValue([]),
      saveProfiles: vi.fn(),
    },
    proxyManager: {
      startProfile: vi.fn(),
      stopProfile: vi.fn(),
      getStatuses: vi.fn().mockReturnValue({}),
    },
    sessionQueryService: {
      listSessions: vi.fn().mockResolvedValue([]),
      getSessionTrace: vi.fn(),
    },
    exchangeQueryService: {
      getExchangeDetail: vi.fn(),
    },
    exportData: vi.fn(),
    importData: vi.fn(),
    clearHistory: vi.fn(),
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
    },
    ...overrides,
  } as never;
}

describe("IPC Channels", () => {
  it("defines all required channels", () => {
    expect(IPC.OPEN_EXTERNAL).toBe("app:open-external");
    expect(IPC.EXPORT_APP_DATA).toBe("app:export-data");
    expect(IPC.IMPORT_APP_DATA).toBe("app:import-data");
    expect(IPC.GET_PROFILES).toBe("profiles:get");
    expect(IPC.SAVE_PROFILES).toBe("profiles:save");
    expect(IPC.START_PROFILE).toBe("profiles:start");
    expect(IPC.STOP_PROFILE).toBe("profiles:stop");
    expect(IPC.GET_PROFILE_STATUSES).toBe("profiles:get-statuses");
    expect(IPC.LIST_SESSIONS).toBe("app:list-sessions");
    expect(IPC.GET_SESSION_TRACE).toBe("trace:get-session");
    expect(IPC.GET_EXCHANGE_DETAIL).toBe("trace:get-exchange");
    expect(IPC.CLEAR_HISTORY).toBe("trace:clear-history");
    expect(IPC.GET_UPDATE_STATE).toBe("app:get-update-state");
    expect(IPC.CHECK_FOR_UPDATES).toBe("app:check-for-updates");
    expect(IPC.DOWNLOAD_UPDATE).toBe("app:download-update");
    expect(IPC.QUIT_AND_INSTALL_UPDATE).toBe("app:quit-and-install-update");
    expect(IPC.PROXY_ERROR).toBe("proxy:error");
    expect(IPC.TRACE_CAPTURED).toBe("trace:captured");
    expect(IPC.TRACE_RESET).toBe("trace:reset");
    expect(IPC.PROFILE_STATUS_CHANGED).toBe("profiles:status-changed");
    expect(IPC.UPDATE_STATE_CHANGED).toBe("app:update-state-changed");
  });

  it("has unique channel names", () => {
    const values = Object.values(IPC);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("all channels follow naming convention", () => {
    for (const channel of Object.values(IPC)) {
      expect(channel).toMatch(/^(app|proxy|profiles|trace):/);
    }
  });
});

describe("registerIpcHandlers", () => {
  beforeEach(() => {
    handleMock.mockReset();
    sendMock.mockReset();
    openExternalMock.mockReset();
    showItemInFolderMock.mockReset();
    showSaveDialogMock.mockReset();
    showOpenDialogMock.mockReset();
  });

  it("registers profile-aware handlers and broadcasts status changes", async () => {
    const { registerIpcHandlers } = await import(
      "../../src/main/ipc/register-ipc"
    );

    const getProfiles = vi.fn().mockReturnValue([
      {
        id: "anthropic-dev",
        name: "Anthropic Dev",
        providerId: "anthropic",
        upstreamBaseUrl: "https://api.anthropic.com",
        localPort: 8888,
        enabled: true,
        autoStart: false,
      },
    ]);
    const startProfile = vi.fn().mockResolvedValue(undefined);
    const stopProfile = vi.fn().mockResolvedValue(undefined);
    const getStatuses = vi.fn().mockReturnValue({
      "anthropic-dev": { isRunning: true, port: 8888 },
    });

    registerIpcHandlers(
      createRegisterDeps({
        profileStore: {
          getProfiles,
          saveProfiles: vi.fn(),
        },
        proxyManager: {
          startProfile,
          stopProfile,
          getStatuses,
        },
      }),
    );

    expect(handleMock).toHaveBeenCalledWith(
      IPC.OPEN_EXTERNAL,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.EXPORT_APP_DATA,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.IMPORT_APP_DATA,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.GET_PROFILES,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.SAVE_PROFILES,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.START_PROFILE,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.STOP_PROFILE,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.GET_PROFILE_STATUSES,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.GET_SESSION_TRACE,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.GET_EXCHANGE_DETAIL,
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith(
      IPC.CLEAR_HISTORY,
      expect.any(Function),
    );

    const startHandler = handleMock.mock.calls.find(
      ([channel]) => channel === IPC.START_PROFILE,
    )?.[1];

    await startHandler?.({}, "anthropic-dev");

    expect(startProfile).toHaveBeenCalledWith("anthropic-dev");
    expect(sendMock).toHaveBeenCalledWith(IPC.PROFILE_STATUS_CHANGED, {
      statuses: {
        "anthropic-dev": {
          isRunning: true,
          port: 8888,
        },
      },
    });
  });

  it("opens validated external URLs via the system browser", async () => {
    const { registerIpcHandlers } = await import(
      "../../src/main/ipc/register-ipc"
    );

    openExternalMock.mockResolvedValue("");
    registerIpcHandlers(createRegisterDeps({ getMainWindow: () => null }));

    const openExternalHandler = handleMock.mock.calls.find(
      ([channel]) => channel === IPC.OPEN_EXTERNAL,
    )?.[1];

    await openExternalHandler?.({}, "https://github.com/dvlin-dev/agent-trace");

    expect(openExternalMock).toHaveBeenCalledWith(
      "https://github.com/dvlin-dev/agent-trace",
    );
  });

  it("exports app data through the save dialog", async () => {
    const { registerIpcHandlers } = await import(
      "../../src/main/ipc/register-ipc"
    );
    const exportData = vi.fn().mockReturnValue({
      filePath: "/tmp/agent-trace-backup.zip",
      profileCount: 1,
      sessionCount: 2,
      exchangeCount: 3,
    });
    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: "/tmp/agent-trace-backup.zip",
    });

    registerIpcHandlers(
      createRegisterDeps({
        exportData,
        getMainWindow: () => null,
      }),
    );

    const exportHandler = handleMock.mock.calls.find(
      ([channel]) => channel === IPC.EXPORT_APP_DATA,
    )?.[1];

    const result = await exportHandler?.();

    expect(showSaveDialogMock).toHaveBeenCalled();
    expect(exportData).toHaveBeenCalledWith("/tmp/agent-trace-backup.zip");
    expect(showItemInFolderMock).toHaveBeenCalledWith(
      "/tmp/agent-trace-backup.zip",
    );
    expect(result).toEqual({
      filePath: "/tmp/agent-trace-backup.zip",
      profileCount: 1,
      sessionCount: 2,
      exchangeCount: 3,
    });
  });

  it("imports app data through the open dialog and broadcasts refresh events", async () => {
    const { registerIpcHandlers } = await import(
      "../../src/main/ipc/register-ipc"
    );
    const importedProfiles = [
      {
        id: "anthropic-dev",
        name: "Anthropic Dev",
        providerId: "anthropic",
        upstreamBaseUrl: "https://api.anthropic.com",
        localPort: 8888,
        enabled: true,
        autoStart: true,
      },
    ];
    const importData = vi.fn().mockResolvedValue({
      filePath: "/tmp/agent-trace-backup.zip",
      profileCount: 1,
      sessionCount: 2,
      exchangeCount: 3,
    });
    showOpenDialogMock.mockResolvedValue({
      canceled: false,
      filePaths: ["/tmp/agent-trace-backup.zip"],
    });

    registerIpcHandlers(
      createRegisterDeps({
        profileStore: {
          getProfiles: vi.fn().mockReturnValue(importedProfiles),
          saveProfiles: vi.fn(),
        },
        proxyManager: {
          startProfile: vi.fn(),
          stopProfile: vi.fn(),
          getStatuses: vi.fn().mockReturnValue({
            "anthropic-dev": { isRunning: true, port: 8888 },
          }),
        },
        importData,
      }),
    );

    const importHandler = handleMock.mock.calls.find(
      ([channel]) => channel === IPC.IMPORT_APP_DATA,
    )?.[1];

    const result = await importHandler?.();

    expect(showOpenDialogMock).toHaveBeenCalled();
    expect(importData).toHaveBeenCalledWith("/tmp/agent-trace-backup.zip");
    expect(sendMock).toHaveBeenCalledWith(IPC.PROFILES_CHANGED, {
      profiles: importedProfiles,
    });
    expect(sendMock).toHaveBeenCalledWith(IPC.PROFILE_STATUS_CHANGED, {
      statuses: {
        "anthropic-dev": { isRunning: true, port: 8888 },
      },
    });
    expect(sendMock).toHaveBeenCalledWith(IPC.TRACE_RESET, {
      clearedAt: expect.any(String),
    });
    expect(result).toEqual({
      filePath: "/tmp/agent-trace-backup.zip",
      profileCount: 1,
      sessionCount: 2,
      exchangeCount: 3,
    });
  });

  it("restarts a running profile after saving changed profile settings", async () => {
    const { registerIpcHandlers } = await import(
      "../../src/main/ipc/register-ipc"
    );

    const previousProfiles = [
      {
        id: "anthropic-dev",
        name: "Anthropic Dev",
        providerId: "anthropic",
        upstreamBaseUrl: "https://api.anthropic.com",
        localPort: 8888,
        enabled: true,
        autoStart: false,
      },
    ];
    let currentProfiles = [...previousProfiles];

    const getProfiles = vi.fn(() => currentProfiles);
    const saveProfiles = vi.fn((profiles) => {
      currentProfiles = profiles;
    });
    const stopProfile = vi.fn().mockResolvedValue(undefined);
    const startProfile = vi.fn().mockResolvedValue(undefined);
    const getStatuses = vi
      .fn()
      .mockReturnValueOnce({
        "anthropic-dev": { isRunning: true, port: 8888 },
      })
      .mockReturnValue({
        "anthropic-dev": { isRunning: true, port: 9999 },
      });

    registerIpcHandlers(
      createRegisterDeps({
        profileStore: {
          getProfiles,
          saveProfiles,
        },
        proxyManager: {
          startProfile,
          stopProfile,
          getStatuses,
        },
      }),
    );

    const saveHandler = handleMock.mock.calls.find(
      ([channel]) => channel === IPC.SAVE_PROFILES,
    )?.[1];

    await saveHandler?.({}, [
      {
        ...previousProfiles[0],
        localPort: 9999,
      },
    ]);

    expect(stopProfile).toHaveBeenCalledWith("anthropic-dev");
    expect(startProfile).toHaveBeenCalledWith("anthropic-dev");
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

    registerIpcHandlers(
      createRegisterDeps({
        updateService,
      }),
    );

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

  it("broadcasts a reset event when clearing history", async () => {
    const { registerIpcHandlers } = await import(
      "../../src/main/ipc/register-ipc"
    );
    const clearHistory = vi.fn();

    registerIpcHandlers(
      createRegisterDeps({
        clearHistory,
      }),
    );

    const clearHandler = handleMock.mock.calls.find(
      ([channel]) => channel === IPC.CLEAR_HISTORY,
    )?.[1];

    await clearHandler?.();

    expect(clearHistory).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith(IPC.TRACE_RESET, {
      clearedAt: expect.any(String),
    });
  });
});
