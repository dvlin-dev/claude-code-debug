import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ConnectionProfile } from "../../shared/contracts";

export function allocateLocalPort(
  usedPorts: Set<number>,
  start = 8888,
): number {
  let next = start;
  while (usedPorts.has(next)) {
    next += 1;
  }
  return next;
}

export class ProfileStore {
  constructor(private readonly filePath: string) {}

  getProfiles(): ConnectionProfile[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    try {
      const raw = readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as { profiles?: ConnectionProfile[] };
      return Array.isArray(parsed.profiles) ? parsed.profiles : [];
    } catch (error) {
      console.warn("[ProfileStore] Failed to read profiles file, returning empty list:", error);
      return [];
    }
  }

  saveProfiles(profiles: ConnectionProfile[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(
      this.filePath,
      JSON.stringify({ profiles }, null, 2),
      "utf-8",
    );
  }
}
