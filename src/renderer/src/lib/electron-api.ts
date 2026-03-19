import type { ElectronAPI } from "../../../shared/electron-api";

export function getElectronAPI(): ElectronAPI {
  const api = (window as Window & { electronAPI?: Partial<ElectronAPI> }).electronAPI;
  if (!api) {
    throw new Error("Missing window.electronAPI preload bridge");
  }

  const requiredMethods: Array<keyof ElectronAPI> = [
    "openExternal",
    "exportAppData",
    "importAppData",
    "getProfiles",
    "saveProfiles",
    "startProfile",
    "stopProfile",
    "getProfileStatuses",
    "listSessions",
    "getSessionTrace",
    "getExchangeDetail",
    "getSessionDashboard",
    "clearHistory",
    "getUpdateState",
    "checkForUpdates",
    "downloadUpdate",
    "quitAndInstallUpdate",
    "onProxyError",
    "onTraceCaptured",
    "onTraceReset",
    "onProfileStatusChanged",
    "onProfilesChanged",
    "onUpdateStateChanged",
  ];

  for (const method of requiredMethods) {
    if (typeof api[method] !== "function") {
      throw new Error(`Missing electronAPI.${String(method)} preload bridge`);
    }
  }

  return api as ElectronAPI;
}
