import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATED_FILES = [
  "settings.json",
  "history.db",
  "history.db-shm",
  "history.db-wal",
] as const;

interface MigrateLegacyUserDataOptions {
  appDataPath: string;
  currentUserDataPath: string;
  legacyFolderName: string;
}

export async function migrateLegacyUserData({
  appDataPath,
  currentUserDataPath,
  legacyFolderName,
}: MigrateLegacyUserDataOptions): Promise<boolean> {
  const legacyUserDataPath = join(appDataPath, legacyFolderName);

  if (legacyUserDataPath === currentUserDataPath || !existsSync(legacyUserDataPath)) {
    return false;
  }

  let migrated = false;
  await mkdir(currentUserDataPath, { recursive: true });

  for (const fileName of MIGRATED_FILES) {
    const sourcePath = join(legacyUserDataPath, fileName);
    const targetPath = join(currentUserDataPath, fileName);

    if (!existsSync(sourcePath) || existsSync(targetPath)) {
      continue;
    }

    await copyFile(sourcePath, targetPath);
    migrated = true;
  }

  return migrated;
}
