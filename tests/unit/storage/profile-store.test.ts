import { describe, expect, it } from "vitest";
import { allocateLocalPort, ProfileStore } from "../../../src/main/storage/profile-store";

describe("profile store", () => {
  it("allocates the next available local port starting at 8888", () => {
    const port = allocateLocalPort(new Set([8888, 8889]));
    expect(port).toBe(8890);
  });

  it("returns an empty profile list when no file exists", () => {
    const store = new ProfileStore("/tmp/agent-trace-profile-store-does-not-exist.json");
    expect(store.getProfiles()).toEqual([]);
  });
});
