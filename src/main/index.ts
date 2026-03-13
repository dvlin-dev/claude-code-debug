import { app, BrowserWindow } from "electron";
import { join } from "path";
import { SettingsStore } from "./store/settings-store";
import { createDatabase } from "./store/database";
import { HistoryStore } from "./store/history-store";
import { SessionManager } from "./session/session-manager";
import { createProxyServer, type ProxyServer } from "./proxy/server";
import { registerIpcHandlers } from "./ipc/register-ipc";
import { IPC } from "../shared/ipc-channels";
import { DEFAULT_PROXY_PORT } from "../shared/defaults";
import { createUpdateService } from "./update/update-service";
import { migrateLegacyUserData } from "./store/user-data-migration";
import type { CaptureUpdatePayload } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let proxy: ProxyServer | null = null;
let disposeIpcHandlers: (() => void) | null = null;
let disposeUpdateService: (() => void) | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath("userData");
  const appDataPath = app.getPath("appData");

  await migrateLegacyUserData({
    appDataPath,
    currentUserDataPath: userDataPath,
    legacyFolderName: "claude-code-debug",
  });

  // Initialize stores
  const settingsStore = new SettingsStore(
    join(userDataPath, "settings.json"),
  );

  const db = createDatabase(join(userDataPath, "history.db"));
  const historyStore = new HistoryStore(db);
  const sessionManager = new SessionManager();
  const updateService = createUpdateService({
    currentVersion: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
  });
  disposeUpdateService = () => updateService.dispose();

  // Initialize proxy (not started yet)
  const settings = settingsStore.getSettings();
  proxy = createProxyServer({
    targetUrl: settings.targetUrl || "https://api.anthropic.com",
    port: DEFAULT_PROXY_PORT,
    onRequest: (record) => {
      // Assign session
      const sessionId = sessionManager.assignSession(record);
      record.sessionId = sessionId;

      // Persist
      historyStore.saveRequest(record);
      historyStore.prune();

      // Push to renderer
      if (mainWindow) {
        const payload: CaptureUpdatePayload = {
          sessions: historyStore.listSessions(),
          updatedSessionId: sessionId,
          updatedRequestId: record.requestId,
        };
        mainWindow.webContents.send(
          IPC.CAPTURE_UPDATED,
          payload,
        );
      }
    },
    onError: (error) => {
      if (mainWindow) {
        mainWindow.webContents.send(IPC.PROXY_ERROR, error);
      }
    },
  });

  // Register IPC handlers
  disposeIpcHandlers = registerIpcHandlers({
    settingsStore,
    historyStore,
    sessionManager,
    getProxy: () => proxy,
    getMainWindow: () => mainWindow,
    updateService,
  });

  createWindow();

  const updateCheckTimer = setTimeout(() => {
    void updateService.checkForUpdates().catch(() => undefined);
  }, 15_000);
  updateCheckTimer.unref?.();

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
  if (proxy?.isRunning()) {
    await proxy.stop();
  }
});
