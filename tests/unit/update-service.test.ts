import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeUpdater extends EventEmitter {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  checkForUpdates = vi.fn(async () => undefined);
  downloadUpdate = vi.fn(async () => undefined);
  quitAndInstall = vi.fn();
}

describe("createUpdateService", () => {
  let updater: FakeUpdater;

  beforeEach(() => {
    updater = new FakeUpdater();
  });

  it("tracks available, downloading and downloaded states", async () => {
    const { createUpdateService } = await import(
      "../../src/main/update/update-service"
    );

    const service = createUpdateService({
      currentVersion: "0.1.2",
      updater,
      platform: "darwin",
      isPackaged: true,
    });

    const states: string[] = [];
    service.subscribe((state) => {
      states.push(state.status);
    });

    const checking = service.checkForUpdates();
    updater.emit("checking-for-update");
    updater.emit("update-available", { version: "0.1.3" });
    await checking;

    const downloading = service.downloadUpdate();
    updater.emit("download-progress", { percent: 48 });
    updater.emit("update-downloaded", { version: "0.1.3" });
    await downloading;

    expect(states).toContain("checking");
    expect(states).toContain("available");
    expect(states).toContain("downloading");
    expect(states).toContain("downloaded");
    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "downloaded",
        currentVersion: "0.1.2",
        availableVersion: "0.1.3",
        downloadPercent: 100,
      }),
    );
  });

  it("marks not-available when updater reports no release", async () => {
    const { createUpdateService } = await import(
      "../../src/main/update/update-service"
    );

    const service = createUpdateService({
      currentVersion: "0.1.2",
      updater,
      platform: "darwin",
      isPackaged: true,
    });

    const checking = service.checkForUpdates();
    updater.emit("checking-for-update");
    updater.emit("update-not-available");
    await checking;

    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "not-available",
        availableVersion: null,
      }),
    );
  });

  it("rejects download before an update is available", async () => {
    const { createUpdateService } = await import(
      "../../src/main/update/update-service"
    );

    const service = createUpdateService({
      currentVersion: "0.1.2",
      updater,
      platform: "darwin",
      isPackaged: true,
    });

    await expect(service.downloadUpdate()).rejects.toThrow(
      "No update is available to download.",
    );
  });

  it("maps updater errors into error state", async () => {
    const { createUpdateService } = await import(
      "../../src/main/update/update-service"
    );

    const service = createUpdateService({
      currentVersion: "0.1.2",
      updater,
      platform: "darwin",
      isPackaged: true,
    });

    const checking = service.checkForUpdates();
    updater.emit("error", new Error("network unavailable"));
    await checking;

    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "error",
        message: "network unavailable",
      }),
    );
  });

  it("returns explanatory idle state outside packaged macOS", async () => {
    const { createUpdateService } = await import(
      "../../src/main/update/update-service"
    );

    const service = createUpdateService({
      currentVersion: "0.1.2",
      updater,
      platform: "linux",
      isPackaged: false,
    });

    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "idle",
        message: "Automatic updates are only enabled for packaged macOS and Windows builds.",
      }),
    );

    // Silently returns current state instead of throwing
    const result = await service.checkForUpdates();
    expect(result.status).toBe("idle");
  });
});
