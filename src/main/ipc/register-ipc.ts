import { homedir } from "node:os";
import { join } from "node:path";
import { dialog, ipcMain, shell, type BrowserWindow } from "electron";
import { IPC } from "../../shared/ipc-channels";
import type { AppDataTransferResult } from "../../shared/app-data";
import type {
  ConnectionProfile,
  SessionListFilter,
} from "../../shared/contracts";
import type { UpdateService } from "../update/update-service";
import type { ExchangeQueryService } from "../queries/exchange-query-service";
import type { SessionQueryService } from "../queries/session-query-service";
import type { ProfileStore } from "../storage/profile-store";
import type { ProxyManager } from "../transport/proxy-manager";

export interface IpcDependencies {
  profileStore: Pick<ProfileStore, "getProfiles" | "saveProfiles">;
  proxyManager: ProxyManager;
  sessionQueryService: Pick<
    SessionQueryService,
    "listSessions" | "getSessionTrace"
  >;
  exchangeQueryService: Pick<ExchangeQueryService, "getExchangeDetail">;
  exportData: (filePath: string) => AppDataTransferResult;
  importData: (filePath: string) => Promise<AppDataTransferResult>;
  clearHistory: () => void | Promise<void>;
  getMainWindow: () => BrowserWindow | null;
  updateService: UpdateService;
}

function broadcast(
  getMainWindow: () => BrowserWindow | null,
  channel: string,
  payload: unknown,
): void {
  const win = getMainWindow();
  if (!win) {
    return;
  }
  win.webContents.send(channel, payload);
}

function validateExternalUrl(input: string): string {
  if (typeof input !== "string") {
    throw new Error("Invalid external URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Invalid external URL");
  }

  if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
    throw new Error("Unsupported external URL protocol");
  }

  return parsed.toString();
}

export function registerIpcHandlers(deps: IpcDependencies): () => void {
  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(validateExternalUrl(url));
  });

  ipcMain.handle(IPC.EXPORT_APP_DATA, async () => {
    const defaultPath = join(
      homedir(),
      `agent-trace-backup-${new Date().toISOString().slice(0, 10)}.zip`,
    );
    const window = deps.getMainWindow();
    const dialogOptions: Electron.SaveDialogOptions = {
      title: "Export Agent Trace Data",
      defaultPath,
      filters: [
        { name: "Agent Trace Backup Archive", extensions: ["zip"] },
      ],
    };
    const result = window
      ? await dialog.showSaveDialog(window, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return null;
    }

    const exported = deps.exportData(result.filePath);
    shell.showItemInFolder(result.filePath);
    return exported;
  });

  ipcMain.handle(IPC.IMPORT_APP_DATA, async () => {
    const window = deps.getMainWindow();
    const dialogOptions: Electron.OpenDialogOptions = {
      title: "Import Agent Trace Data",
      properties: ["openFile"],
      filters: [
        { name: "Agent Trace Backups", extensions: ["zip"] },
      ],
    };
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    const filePath = result.filePaths[0];
    if (result.canceled || !filePath) {
      return null;
    }

    const imported = await deps.importData(filePath);
    broadcast(deps.getMainWindow, IPC.PROFILES_CHANGED, {
      profiles: deps.profileStore.getProfiles(),
    });
    broadcast(deps.getMainWindow, IPC.PROFILE_STATUS_CHANGED, {
      statuses: deps.proxyManager.getStatuses(),
    });
    broadcast(deps.getMainWindow, IPC.TRACE_RESET, {
      clearedAt: new Date().toISOString(),
    });
    return imported;
  });

  ipcMain.handle(IPC.GET_PROFILES, () => {
    return deps.profileStore.getProfiles();
  });

  ipcMain.handle(IPC.SAVE_PROFILES, async (_event, input: ConnectionProfile[]) => {
    if (!Array.isArray(input)) {
      throw new Error("Invalid profiles input");
    }

    const previousProfiles = deps.profileStore.getProfiles();
    const previousStatuses = deps.proxyManager.getStatuses();
    deps.profileStore.saveProfiles(input);

    const nextProfiles = new Map(input.map((profile) => [profile.id, profile]));
    for (const previousProfile of previousProfiles) {
      const nextProfile = nextProfiles.get(previousProfile.id);
      const configChanged =
        nextProfile &&
        (nextProfile.localPort !== previousProfile.localPort ||
          nextProfile.upstreamBaseUrl !== previousProfile.upstreamBaseUrl ||
          nextProfile.providerId !== previousProfile.providerId);

      if (!nextProfile || !nextProfile.enabled || configChanged) {
        await deps.proxyManager.stopProfile(previousProfile.id);
      }
    }

    for (const profile of input) {
      if (!profile.enabled) {
        continue;
      }

      const wasRunning = previousStatuses[profile.id]?.isRunning === true;
      if (wasRunning) {
        await deps.proxyManager.startProfile(profile.id);
      }
    }

    broadcast(deps.getMainWindow, IPC.PROFILE_STATUS_CHANGED, {
      statuses: deps.proxyManager.getStatuses(),
    });

    return deps.profileStore.getProfiles();
  });

  ipcMain.handle(IPC.START_PROFILE, async (_event, profileId: string) => {
    if (typeof profileId !== "string") {
      throw new Error("Invalid profileId");
    }

    await deps.proxyManager.startProfile(profileId);

    const profiles = deps.profileStore.getProfiles();
    const updated = profiles.map((p) => p.id === profileId ? { ...p, autoStart: true } : p);
    deps.profileStore.saveProfiles(updated);

    broadcast(deps.getMainWindow, IPC.PROFILES_CHANGED, { profiles: updated });
    broadcast(deps.getMainWindow, IPC.PROFILE_STATUS_CHANGED, {
      statuses: deps.proxyManager.getStatuses(),
    });
  });

  ipcMain.handle(IPC.STOP_PROFILE, async (_event, profileId: string) => {
    if (typeof profileId !== "string") {
      throw new Error("Invalid profileId");
    }

    await deps.proxyManager.stopProfile(profileId);

    const profiles = deps.profileStore.getProfiles();
    const updated = profiles.map((p) => p.id === profileId ? { ...p, autoStart: false } : p);
    deps.profileStore.saveProfiles(updated);

    broadcast(deps.getMainWindow, IPC.PROFILES_CHANGED, { profiles: updated });
    broadcast(deps.getMainWindow, IPC.PROFILE_STATUS_CHANGED, {
      statuses: deps.proxyManager.getStatuses(),
    });
  });

  ipcMain.handle(IPC.GET_PROFILE_STATUSES, () => {
    return deps.proxyManager.getStatuses();
  });

  ipcMain.handle(IPC.LIST_SESSIONS, (_event, filter?: SessionListFilter) => {
    if (filter != null && typeof filter !== "object") {
      throw new Error("Invalid filter parameter");
    }
    return deps.sessionQueryService.listSessions(filter);
  });

  ipcMain.handle(IPC.GET_SESSION_TRACE, (_event, sessionId: string) => {
    if (typeof sessionId !== "string") {
      throw new Error("Invalid sessionId");
    }
    return deps.sessionQueryService.getSessionTrace(sessionId);
  });

  ipcMain.handle(IPC.GET_EXCHANGE_DETAIL, (_event, exchangeId: string) => {
    if (typeof exchangeId !== "string") {
      throw new Error("Invalid exchangeId");
    }
    return deps.exchangeQueryService.getExchangeDetail(exchangeId);
  });

  ipcMain.handle(IPC.CLEAR_HISTORY, async () => {
    await deps.clearHistory();
    broadcast(deps.getMainWindow, IPC.TRACE_RESET, {
      clearedAt: new Date().toISOString(),
    });
  });

  ipcMain.handle(IPC.GET_UPDATE_STATE, () => {
    return deps.updateService.getState();
  });

  ipcMain.handle(IPC.CHECK_FOR_UPDATES, () => {
    return deps.updateService.checkForUpdates();
  });

  ipcMain.handle(IPC.DOWNLOAD_UPDATE, () => {
    return deps.updateService.downloadUpdate();
  });

  ipcMain.handle(IPC.QUIT_AND_INSTALL_UPDATE, () => {
    return deps.updateService.quitAndInstall();
  });

  const unsubscribe = deps.updateService.subscribe((state) => {
    broadcast(deps.getMainWindow, IPC.UPDATE_STATE_CHANGED, state);
  });

  return () => {
    unsubscribe();
  };
}
