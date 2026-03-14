import type { ConnectionProfile } from "../../shared/contracts";
import {
  createProfileListener,
  type ListenerDependencies,
  type ProfileListener,
} from "./listener";

export interface ProxyManagerDependencies {
  getProfiles: () => ConnectionProfile[];
  createListener?: (
    profile: ConnectionProfile,
    deps: ListenerDependencies,
  ) => ProfileListener;
  listenerDependencies?: ListenerDependencies;
}

export interface ProxyManager {
  startProfile(profileId: string): Promise<void>;
  stopProfile(profileId: string): Promise<void>;
  getStatuses(): Record<string, { isRunning: boolean; port: number | null }>;
}

export { type ProfileListener };

export function createProxyManager(
  deps: ProxyManagerDependencies,
): ProxyManager {
  const listeners = new Map<string, ProfileListener>();
  const createListener =
    deps.createListener ??
    ((profile: ConnectionProfile, listenerDeps: ListenerDependencies) =>
      createProfileListener(profile, listenerDeps));
  const listenerDependencies: ListenerDependencies =
    deps.listenerDependencies ?? {
      onRequest: () => undefined,
    };

  function getProfile(profileId: string): ConnectionProfile {
    const profile = deps.getProfiles().find((entry) => entry.id === profileId);
    if (!profile) {
      throw new Error(`Unknown profile: ${profileId}`);
    }
    return profile;
  }

  return {
    async startProfile(profileId) {
      const profile = getProfile(profileId);
      const listener =
        listeners.get(profileId) ??
        createListener(profile, listenerDependencies);
      listeners.set(profileId, listener);
      await listener.start();
    },

    async stopProfile(profileId) {
      const listener = listeners.get(profileId);
      if (!listener) return;
      await listener.stop();
      listeners.delete(profileId);
    },

    getStatuses() {
      const statuses: Record<
        string,
        { isRunning: boolean; port: number | null }
      > = {};

      for (const profile of deps.getProfiles()) {
        const listener = listeners.get(profile.id);
        statuses[profile.id] = {
          isRunning: listener?.isRunning() ?? false,
          port: listener?.getPort() ?? profile.localPort ?? null,
        };
      }

      return statuses;
    },
  };
}
