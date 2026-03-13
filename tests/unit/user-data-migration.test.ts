import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { migrateLegacyUserData } from "../../src/main/store/user-data-migration";

describe("migrateLegacyUserData", () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdDirs.splice(0).map(async (dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it("copies legacy settings and history files into the new user data directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-trace-migrate-"));
    createdDirs.push(root);

    const appDataPath = join(root, "Application Support");
    const legacyPath = join(appDataPath, "claude-code-debug");
    const currentPath = join(appDataPath, "agent-trace");

    await mkdir(legacyPath, { recursive: true });
    await writeFile(join(legacyPath, "settings.json"), '{"targetUrl":"https://api.anthropic.com"}');
    await writeFile(join(legacyPath, "history.db"), "sqlite");

    const migrated = await migrateLegacyUserData({
      appDataPath,
      currentUserDataPath: currentPath,
      legacyFolderName: "claude-code-debug",
    });

    expect(migrated).toBe(true);
    await expect(readFile(join(currentPath, "settings.json"), "utf8")).resolves.toContain(
      "targetUrl",
    );
    await expect(readFile(join(currentPath, "history.db"), "utf8")).resolves.toBe(
      "sqlite",
    );
  });

  it("does not overwrite files that already exist in the new user data directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-trace-migrate-"));
    createdDirs.push(root);

    const appDataPath = join(root, "Application Support");
    const legacyPath = join(appDataPath, "claude-code-debug");
    const currentPath = join(appDataPath, "agent-trace");

    await mkdir(legacyPath, { recursive: true });
    await mkdir(currentPath, { recursive: true });
    await writeFile(join(legacyPath, "settings.json"), '{"targetUrl":"https://legacy.example"}');
    await writeFile(join(currentPath, "settings.json"), '{"targetUrl":"https://current.example"}');

    const migrated = await migrateLegacyUserData({
      appDataPath,
      currentUserDataPath: currentPath,
      legacyFolderName: "claude-code-debug",
    });

    expect(migrated).toBe(false);
    await expect(readFile(join(currentPath, "settings.json"), "utf8")).resolves.toContain(
      "current.example",
    );
    expect(existsSync(join(currentPath, "history.db"))).toBe(false);
  });
});
