import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC } from "../../src/shared/ipc-channels";

const exposeInMainWorldMock = vi.fn();
const invokeMock = vi.fn();
const onMock = vi.fn();
const removeListenerMock = vi.fn();

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: exposeInMainWorldMock,
  },
  ipcRenderer: {
    invoke: invokeMock,
    on: onMock,
    removeListener: removeListenerMock,
  },
}));

describe("preload update api", () => {
  beforeEach(() => {
    exposeInMainWorldMock.mockReset();
    invokeMock.mockReset();
    onMock.mockReset();
    removeListenerMock.mockReset();
  });

  it("exposes update methods and subscriptions", async () => {
    const { electronAPI } = await import("../../src/preload/index");

    expect(exposeInMainWorldMock).toHaveBeenCalledWith(
      "electronAPI",
      electronAPI,
    );

    await electronAPI.getUpdateState();
    await electronAPI.checkForUpdates();
    await electronAPI.downloadUpdate();
    await electronAPI.quitAndInstallUpdate();

    expect(invokeMock).toHaveBeenNthCalledWith(1, IPC.GET_UPDATE_STATE);
    expect(invokeMock).toHaveBeenNthCalledWith(2, IPC.CHECK_FOR_UPDATES);
    expect(invokeMock).toHaveBeenNthCalledWith(3, IPC.DOWNLOAD_UPDATE);
    expect(invokeMock).toHaveBeenNthCalledWith(
      4,
      IPC.QUIT_AND_INSTALL_UPDATE,
    );

    const unsubscribe = electronAPI.onUpdateStateChanged(() => {});
    expect(onMock).toHaveBeenCalledWith(
      IPC.UPDATE_STATE_CHANGED,
      expect.any(Function),
    );

    unsubscribe();
    expect(removeListenerMock).toHaveBeenCalledWith(
      IPC.UPDATE_STATE_CHANGED,
      expect.any(Function),
    );
  });

  it("exposes multi-provider bridge methods and subscriptions", async () => {
    const { electronAPI } = await import("../../src/preload/index");

    await electronAPI.openExternal("https://github.com/dvlin-dev/agent-trace");
    await electronAPI.exportAppData();
    await electronAPI.importAppData();
    await electronAPI.getProfiles();
    await electronAPI.saveProfiles([]);
    await electronAPI.startProfile("anthropic-dev");
    await electronAPI.stopProfile("anthropic-dev");
    await electronAPI.getProfileStatuses();
    await electronAPI.listSessions({ providerId: "anthropic" });
    await electronAPI.getSessionTrace("session-1");
    await electronAPI.getExchangeDetail("exchange-1");
    await electronAPI.clearHistory();

    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      IPC.OPEN_EXTERNAL,
      "https://github.com/dvlin-dev/agent-trace",
    );
    expect(invokeMock).toHaveBeenNthCalledWith(2, IPC.EXPORT_APP_DATA);
    expect(invokeMock).toHaveBeenNthCalledWith(3, IPC.IMPORT_APP_DATA);
    expect(invokeMock).toHaveBeenNthCalledWith(4, IPC.GET_PROFILES);
    expect(invokeMock).toHaveBeenNthCalledWith(5, IPC.SAVE_PROFILES, []);
    expect(invokeMock).toHaveBeenNthCalledWith(
      6,
      IPC.START_PROFILE,
      "anthropic-dev",
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      7,
      IPC.STOP_PROFILE,
      "anthropic-dev",
    );
    expect(invokeMock).toHaveBeenNthCalledWith(8, IPC.GET_PROFILE_STATUSES);
    expect(invokeMock).toHaveBeenNthCalledWith(9, IPC.LIST_SESSIONS, {
      providerId: "anthropic",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(
      10,
      IPC.GET_SESSION_TRACE,
      "session-1",
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      11,
      IPC.GET_EXCHANGE_DETAIL,
      "exchange-1",
    );
    expect(invokeMock).toHaveBeenNthCalledWith(12, IPC.CLEAR_HISTORY);

    const unsubTrace = electronAPI.onTraceCaptured(() => {});
    const unsubReset = electronAPI.onTraceReset(() => {});
    const unsubStatuses = electronAPI.onProfileStatusChanged(() => {});

    expect(onMock).toHaveBeenCalledWith(
      IPC.TRACE_CAPTURED,
      expect.any(Function),
    );
    expect(onMock).toHaveBeenCalledWith(
      IPC.TRACE_RESET,
      expect.any(Function),
    );
    expect(onMock).toHaveBeenCalledWith(
      IPC.PROFILE_STATUS_CHANGED,
      expect.any(Function),
    );

    unsubTrace();
    unsubReset();
    unsubStatuses();

    expect(removeListenerMock).toHaveBeenCalledWith(
      IPC.TRACE_CAPTURED,
      expect.any(Function),
    );
    expect(removeListenerMock).toHaveBeenCalledWith(
      IPC.TRACE_RESET,
      expect.any(Function),
    );
    expect(removeListenerMock).toHaveBeenCalledWith(
      IPC.PROFILE_STATUS_CHANGED,
      expect.any(Function),
    );
  });
});
