import { create } from "zustand";
import type { ConnectionProfile } from "../../../shared/contracts";
import { getElectronAPI } from "../lib/electron-api";

type ProfileStatuses = Record<string, { isRunning: boolean; port: number | null }>;

interface ProfileState {
  profiles: ConnectionProfile[];
  statuses: ProfileStatuses;
  initialized: boolean;
  initialize: () => Promise<void>;
  saveProfiles: (profiles: ConnectionProfile[]) => Promise<ConnectionProfile[]>;
  upsertProfile: (profile: ConnectionProfile) => Promise<ConnectionProfile[]>;
  startProfile: (profileId: string) => Promise<void>;
  stopProfile: (profileId: string) => Promise<void>;
  setStatuses: (statuses: ProfileStatuses) => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  statuses: {},
  initialized: false,

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    const api = getElectronAPI();
    const [profiles, statuses] = await Promise.all([
      api.getProfiles(),
      api.getProfileStatuses(),
    ]);

    set({
      profiles,
      statuses,
      initialized: true,
    });
  },

  saveProfiles: async (profiles) => {
    const api = getElectronAPI();
    const saved = await api.saveProfiles(profiles);
    set({ profiles: saved });
    return saved;
  },

  upsertProfile: async (profile) => {
    const currentProfiles = get().profiles;
    const nextProfiles = currentProfiles.some((entry) => entry.id === profile.id)
      ? currentProfiles.map((entry) => (entry.id === profile.id ? profile : entry))
      : [...currentProfiles, profile];

    return get().saveProfiles(nextProfiles);
  },

  startProfile: async (profileId) => {
    const api = getElectronAPI();
    await api.startProfile(profileId);
    const statuses = await api.getProfileStatuses();
    set({ statuses });
  },

  stopProfile: async (profileId) => {
    const api = getElectronAPI();
    await api.stopProfile(profileId);
    const statuses = await api.getProfileStatuses();
    set({ statuses });
  },

  setStatuses: (statuses) => {
    set({ statuses });
  },
}));
