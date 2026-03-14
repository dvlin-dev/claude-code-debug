import { createRequire } from "node:module";
import {
  createDefaultUpdateState,
  type UpdateState,
  UNSUPPORTED_AUTO_UPDATE_MESSAGE,
} from "../../shared/update";

const require = createRequire(import.meta.url);

type UpdaterEvent =
  | "checking-for-update"
  | "update-available"
  | "update-not-available"
  | "download-progress"
  | "update-downloaded"
  | "error";

type UpdaterListener = (payload?: unknown) => void;

export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: UpdaterEvent, listener: UpdaterListener): UpdaterLike;
  removeListener(event: UpdaterEvent, listener: UpdaterListener): UpdaterLike;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface UpdateService {
  getState(): UpdateState;
  checkForUpdates(): Promise<UpdateState>;
  downloadUpdate(): Promise<UpdateState>;
  quitAndInstall(): Promise<void>;
  subscribe(listener: (state: UpdateState) => void): () => void;
  dispose(): void;
}

interface CreateUpdateServiceOptions {
  currentVersion: string;
  updater?: UpdaterLike;
  platform?: NodeJS.Platform;
  isPackaged?: boolean;
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
};

const normalizeMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Update operation failed.";
};

const resolveVersion = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = payload as { version?: unknown };
  return typeof candidate.version === "string" && candidate.version.trim()
    ? candidate.version.trim()
    : null;
};

const resolveProgress = (payload: unknown): number | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = payload as { percent?: unknown };
  return typeof candidate.percent === "number" && Number.isFinite(candidate.percent)
    ? Math.max(0, Math.min(100, candidate.percent))
    : null;
};

export const resolveAutoUpdater = (
  loadModule: (id: string) => unknown = require,
): UpdaterLike => {
  const candidate = loadModule("electron-updater") as
    | { autoUpdater?: UpdaterLike }
    | undefined;
  if (!candidate?.autoUpdater) {
    throw new Error("electron-updater.autoUpdater is unavailable.");
  }
  return candidate.autoUpdater;
};

export function createUpdateService({
  currentVersion,
  updater = resolveAutoUpdater(),
  platform = process.platform,
  isPackaged = false,
}: CreateUpdateServiceOptions): UpdateService {
  const listeners = new Set<(state: UpdateState) => void>();
  const supported = platform === "darwin" && isPackaged;
  let state = createDefaultUpdateState(
    currentVersion,
    supported ? null : UNSUPPORTED_AUTO_UPDATE_MESSAGE,
  );
  let checkDeferred: Deferred<UpdateState> | null = null;
  let downloadDeferred: Deferred<UpdateState> | null = null;

  const emit = () => {
    const snapshot = { ...state };
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const setState = (next: Partial<UpdateState>): UpdateState => {
    state = {
      ...state,
      ...next,
    };
    emit();
    return { ...state };
  };

  const resolveCheck = (nextState: UpdateState) => {
    checkDeferred?.resolve(nextState);
    checkDeferred = null;
  };

  const resolveDownload = (nextState: UpdateState) => {
    downloadDeferred?.resolve(nextState);
    downloadDeferred = null;
  };

  const handleChecking: UpdaterListener = () => {
    setState({
      status: "checking",
      message: null,
      downloadPercent: null,
    });
  };

  const handleAvailable: UpdaterListener = (payload) => {
    const nextState = setState({
      status: "available",
      availableVersion: resolveVersion(payload),
      downloadPercent: null,
      message: null,
      checkedAt: new Date().toISOString(),
    });
    resolveCheck(nextState);
  };

  const handleNotAvailable: UpdaterListener = () => {
    const nextState = setState({
      status: "not-available",
      availableVersion: null,
      downloadPercent: null,
      message: null,
      checkedAt: new Date().toISOString(),
    });
    resolveCheck(nextState);
  };

  const handleDownloadProgress: UpdaterListener = (payload) => {
    setState({
      status: "downloading",
      downloadPercent: resolveProgress(payload),
      message: null,
    });
  };

  const handleDownloaded: UpdaterListener = (payload) => {
    const nextState = setState({
      status: "downloaded",
      availableVersion: resolveVersion(payload) ?? state.availableVersion,
      downloadPercent: 100,
      message: null,
    });
    resolveDownload(nextState);
  };

  const handleError: UpdaterListener = (payload) => {
    const nextState = setState({
      status: "error",
      downloadPercent: null,
      message: normalizeMessage(payload),
      checkedAt: state.checkedAt ?? new Date().toISOString(),
    });
    resolveCheck(nextState);
    resolveDownload(nextState);
  };

  if (supported) {
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.on("checking-for-update", handleChecking);
    updater.on("update-available", handleAvailable);
    updater.on("update-not-available", handleNotAvailable);
    updater.on("download-progress", handleDownloadProgress);
    updater.on("update-downloaded", handleDownloaded);
    updater.on("error", handleError);
  }

  return {
    getState: () => ({ ...state }),

    checkForUpdates: async () => {
      if (!supported) return { ...state };
      if (checkDeferred) {
        return checkDeferred.promise;
      }
      const deferred = createDeferred<UpdateState>();
      checkDeferred = deferred;
      setState({
        status: "checking",
        message: null,
        downloadPercent: null,
      });
      try {
        await updater.checkForUpdates();
      } catch (error) {
        const nextState = setState({
          status: "error",
          message: normalizeMessage(error),
          downloadPercent: null,
          checkedAt: new Date().toISOString(),
        });
        resolveCheck(nextState);
      }
      return deferred.promise;
    },

    downloadUpdate: async () => {
      if (!supported) return { ...state };
      if (!state.availableVersion || state.status !== "available") {
        throw new Error("No update is available to download.");
      }
      if (downloadDeferred) {
        return downloadDeferred.promise;
      }
      const deferred = createDeferred<UpdateState>();
      downloadDeferred = deferred;
      setState({
        status: "downloading",
        downloadPercent: 0,
        message: null,
      });
      try {
        await updater.downloadUpdate();
      } catch (error) {
        const nextState = setState({
          status: "error",
          message: normalizeMessage(error),
          downloadPercent: null,
          checkedAt: new Date().toISOString(),
        });
        resolveDownload(nextState);
      }
      return deferred.promise;
    },

    quitAndInstall: async () => {
      if (!supported) return;
      if (state.status !== "downloaded") {
        throw new Error("No downloaded release is available to install.");
      }
      updater.quitAndInstall();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose: () => {
      if (!supported) {
        return;
      }
      updater.removeListener("checking-for-update", handleChecking);
      updater.removeListener("update-available", handleAvailable);
      updater.removeListener("update-not-available", handleNotAvailable);
      updater.removeListener("download-progress", handleDownloadProgress);
      updater.removeListener("update-downloaded", handleDownloaded);
      updater.removeListener("error", handleError);
      listeners.clear();
    },
  };
}
