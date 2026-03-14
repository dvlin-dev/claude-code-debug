import { describe, expect, it, vi } from "vitest";
import type { ConnectionProfile } from "../../../src/shared/contracts";
import {
  createProxyManager,
  type ProfileListener,
} from "../../../src/main/transport/proxy-manager";

describe("proxy manager", () => {
  it("starts one listener per enabled profile and reports status by profile id", async () => {
    const listeners = new Map<string, ProfileListener>();

    const manager = createProxyManager({
      getProfiles: () =>
        [
          {
            id: "anthropic-dev",
            name: "Anthropic Dev",
            providerId: "anthropic",
            upstreamBaseUrl: "https://api.anthropic.com",
            localPort: 8888,
            enabled: true,
            autoStart: false,
          },
        ] satisfies ConnectionProfile[],
      createListener: (profile) => {
        const start = vi.fn().mockResolvedValue(undefined);
        const stop = vi.fn().mockResolvedValue(undefined);
        const listener: ProfileListener = {
          start,
          stop,
          isRunning: () => start.mock.calls.length > stop.mock.calls.length,
          getPort: () => profile.localPort,
        };
        listeners.set(profile.id, listener);
        return listener;
      },
    });

    await manager.startProfile("anthropic-dev");

    expect(listeners.get("anthropic-dev")?.start).toHaveBeenCalled();
    expect(manager.getStatuses()["anthropic-dev"]?.isRunning).toBe(true);
  });
});
