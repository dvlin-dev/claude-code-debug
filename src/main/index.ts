import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import { registerIpcHandlers } from "./ipc/register-ipc";
import { IPC } from "../shared/ipc-channels";
import { createUpdateService } from "./update/update-service";
import { createAppBootstrap, type AppBootstrap } from "./bootstrap/app-bootstrap";

let mainWindow: BrowserWindow | null = null;
let appBootstrap: AppBootstrap | null = null;
let disposeIpcHandlers: (() => void) | null = null;
let disposeUpdateService: (() => void) | null = null;
let profilesStarted = false;

function getExternalNavigationTarget(
  currentUrl: string,
  nextUrl: string,
): string | null {
  let target: URL;
  try {
    target = new URL(nextUrl);
  } catch {
    return null;
  }

  if (!["http:", "https:", "mailto:"].includes(target.protocol)) {
    return null;
  }

  if (target.protocol === "mailto:") {
    return target.toString();
  }

  if (!currentUrl) {
    return target.toString();
  }

  try {
    const current = new URL(currentUrl);
    if (current.origin === target.origin) {
      return null;
    }
  } catch {
    return target.toString();
  }

  return target.toString();
}

function broadcastProfileStatuses(): void {
  if (!mainWindow || !appBootstrap) return;
  mainWindow.webContents.send(IPC.PROFILE_STATUS_CHANGED, {
    statuses: appBootstrap.proxyManager.getStatuses(),
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 11 },
    autoHideMenuBar: process.platform === "win32",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Broadcast profile statuses after every page load (initial + refresh),
  // so the renderer always sees the correct running state.
  mainWindow.webContents.on("did-finish-load", () => {
    broadcastProfileStatuses();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const target = getExternalNavigationTarget(
      mainWindow?.webContents.getURL() ?? "",
      url,
    );
    if (target) {
      void shell.openExternal(target);
      return { action: "deny" };
    }

    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = getExternalNavigationTarget(
      mainWindow?.webContents.getURL() ?? "",
      url,
    );
    if (!target) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(target);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  app.setName("Agent Trace");
  const userDataPath = app.getPath("userData");
  const updateService = createUpdateService({
    currentVersion: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
  });
  disposeUpdateService = () => updateService.dispose();

  appBootstrap = createAppBootstrap({
    userDataPath,
    appVersion: app.getVersion(),
    onTraceCaptured: (payload) => {
      mainWindow?.webContents.send(IPC.TRACE_CAPTURED, payload);
    },
    onProfileStatusChanged: (payload) => {
      mainWindow?.webContents.send(IPC.PROFILE_STATUS_CHANGED, payload);
    },
    onProfileError: (message) => {
      mainWindow?.webContents.send(IPC.PROXY_ERROR, message);
    },
  });

  disposeIpcHandlers = registerIpcHandlers({
    profileStore: appBootstrap.profileStore,
    proxyManager: appBootstrap.proxyManager,
    sessionQueryService: appBootstrap.sessionQueryService,
    exchangeQueryService: appBootstrap.exchangeQueryService,
    exportData: (filePath) => appBootstrap!.exportData(filePath),
    importData: (filePath) => appBootstrap!.importData(filePath),
    clearHistory: () => {
      appBootstrap?.clearHistory();
    },
    getMainWindow: () => mainWindow,
    updateService,
  });

  createWindow();

  // Start auto-start profiles once during app lifecycle.
  // did-finish-load handler will broadcast statuses to the renderer.
  if (!profilesStarted) {
    profilesStarted = true;
    await appBootstrap.startAutoStartProfiles();
  }

  // Check for updates shortly after launch, then every 30 minutes
  const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
  const initialCheckTimer = setTimeout(() => {
    void updateService.checkForUpdates().catch(() => undefined);
  }, 5_000);
  initialCheckTimer.unref?.();
  const periodicCheckTimer = setInterval(() => {
    void updateService.checkForUpdates().catch(() => undefined);
  }, UPDATE_CHECK_INTERVAL_MS);
  periodicCheckTimer.unref?.();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  disposeIpcHandlers?.();
  disposeUpdateService?.();
  await appBootstrap?.dispose();
});
