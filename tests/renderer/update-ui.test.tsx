import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "../../src/renderer/src/components/settings-dialog";
import { UpdateToastListener } from "../../src/renderer/src/components/update-toast-listener";
import { useAppStore } from "../../src/renderer/src/stores/app-store";
import { useProfileStore } from "../../src/renderer/src/stores/profile-store";

const {
  toastInfo,
  toastSuccess,
  toastError,
  getUpdateState,
  checkForUpdates,
  downloadUpdate,
  quitAndInstallUpdate,
  onUpdateStateChanged,
} = vi.hoisted(() => ({
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  getUpdateState: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstallUpdate: vi.fn(),
  onUpdateStateChanged: vi.fn(() => () => {}),
}));

vi.mock("sonner", () => ({
  toast: {
    info: toastInfo,
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("../../src/renderer/src/lib/electron-api", () => ({
  getElectronAPI: () => ({
    getProfiles: vi.fn().mockResolvedValue([]),
    saveProfiles: vi.fn().mockResolvedValue([]),
    startProfile: vi.fn().mockResolvedValue(undefined),
    stopProfile: vi.fn().mockResolvedValue(undefined),
    getProfileStatuses: vi.fn().mockResolvedValue({}),
    getUpdateState,
    checkForUpdates,
    downloadUpdate,
    quitAndInstallUpdate,
    onUpdateStateChanged,
    onTraceCaptured: vi.fn(() => () => {}),
    onTraceReset: vi.fn(() => () => {}),
    onProfileStatusChanged: vi.fn(() => () => {}),
    onProxyError: vi.fn(() => () => {}),
  }),
}));

describe("update ui", () => {
  beforeEach(() => {
    toastInfo.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    getUpdateState.mockReset().mockResolvedValue({
      status: "idle",
      currentVersion: "0.1.2",
      availableVersion: null,
      downloadPercent: null,
      message: null,
      checkedAt: null,
    });
    checkForUpdates.mockReset().mockResolvedValue(undefined);
    downloadUpdate.mockReset().mockResolvedValue(undefined);
    quitAndInstallUpdate.mockReset().mockResolvedValue(undefined);
    onUpdateStateChanged.mockReset().mockReturnValue(() => {});
    useAppStore.setState({
      initialized: true,
      updateState: {
        status: "idle",
        currentVersion: "0.1.2",
        availableVersion: null,
        downloadPercent: null,
        message: null,
        checkedAt: null,
      },
    } as never);
    useProfileStore.setState({
      profiles: [
        {
          id: "anthropic-dev",
          name: "anthropic-dev",
          providerId: "anthropic",
          upstreamBaseUrl: "https://api.anthropic.com",
          localPort: 8888,
          enabled: true,
          autoStart: false,
        },
      ],
      statuses: {
        "anthropic-dev": {
          isRunning: false,
          port: 8888,
        },
      },
      initialized: true,
    });
  });

  it("shows check for updates in settings when idle", () => {
    render(<SettingsDialog open onOpenChange={() => {}} />);

    expect(screen.getByText("Version 0.1.2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /check/i }),
    ).toBeInTheDocument();
  });

  it("shows download action when update is available", async () => {
    useAppStore.setState({
      updateState: {
        status: "available",
        currentVersion: "0.1.2",
        availableVersion: "0.1.3",
        downloadPercent: null,
        message: null,
        checkedAt: "2026-03-13T10:00:00.000Z",
      },
    } as never);

    render(<SettingsDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() => {
      expect(downloadUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it("shows restart action when update has downloaded", async () => {
    useAppStore.setState({
      updateState: {
        status: "downloaded",
        currentVersion: "0.1.2",
        availableVersion: "0.1.3",
        downloadPercent: 100,
        message: null,
        checkedAt: "2026-03-13T10:00:00.000Z",
      },
    } as never);

    render(<SettingsDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /restart/i }));

    await waitFor(() => {
      expect(quitAndInstallUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it("emits toast notifications for available, downloaded and error states", async () => {
    render(<UpdateToastListener />);

    act(() => {
      useAppStore.getState().setUpdateState({
        status: "available",
        currentVersion: "0.1.2",
        availableVersion: "0.1.3",
        downloadPercent: null,
        message: null,
        checkedAt: "2026-03-13T10:00:00.000Z",
      });
    });

    act(() => {
      useAppStore.getState().setUpdateState({
        status: "downloaded",
        currentVersion: "0.1.2",
        availableVersion: "0.1.3",
        downloadPercent: 100,
        message: null,
        checkedAt: "2026-03-13T10:00:00.000Z",
      });
    });

    act(() => {
      useAppStore.getState().setUpdateState({
        status: "error",
        currentVersion: "0.1.2",
        availableVersion: null,
        downloadPercent: null,
        message: "network unavailable",
        checkedAt: "2026-03-13T10:00:00.000Z",
      });
    });

    await waitFor(() => {
      expect(toastInfo).toHaveBeenCalledWith(
        expect.stringContaining("0.1.3"),
        expect.any(Object),
      );
      expect(toastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("0.1.3"),
        expect.any(Object),
      );
      expect(toastError).toHaveBeenCalledWith("network unavailable");
    });
  });
});
