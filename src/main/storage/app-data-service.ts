import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  APP_DATA_ARCHIVE_FORMAT,
  APP_DATA_SCHEMA_VERSION,
  type AppDataArchiveManifest,
  type AppDataTransferResult,
  type ExportedAppData,
  type ExportedExchangeRow,
  type ExportedSessionRow,
} from "../../shared/app-data";
import type { ConnectionProfile } from "../../shared/contracts";
import type { ProxyManager } from "../transport/proxy-manager";
import { ExchangeRepository, type ExchangeRow } from "./exchange-repository";
import { ProfileStore } from "./profile-store";
import { SessionRepository, type SessionRow } from "./session-repository";
import { createZipArchive, extractZipArchive } from "./app-data-archive";

interface AppDataServiceDependencies {
  appVersion: string;
  profileStore: ProfileStore;
  sessionRepository: SessionRepository;
  exchangeRepository: ExchangeRepository;
  proxyManager: ProxyManager;
}

function toBase64(value: Buffer | null): string | null {
  return value ? value.toString("base64") : null;
}

function fromBase64(value: string | null): Buffer | null {
  return value ? Buffer.from(value, "base64") : null;
}

function isConnectionProfile(value: unknown): value is ConnectionProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.providerId === "string" &&
    typeof candidate.upstreamBaseUrl === "string" &&
    typeof candidate.localPort === "number" &&
    typeof candidate.enabled === "boolean" &&
    typeof candidate.autoStart === "boolean"
  );
}

function isExportedSessionRow(value: unknown): value is ExportedSessionRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.session_id === "string" &&
    typeof candidate.provider_id === "string" &&
    typeof candidate.profile_id === "string" &&
    (candidate.external_hint === null || typeof candidate.external_hint === "string") &&
    typeof candidate.title === "string" &&
    (candidate.model === null || typeof candidate.model === "string") &&
    typeof candidate.started_at === "string" &&
    typeof candidate.updated_at === "string" &&
    typeof candidate.exchange_count === "number" &&
    typeof candidate.matcher_state_json === "string"
  );
}

function isExportedExchangeRow(value: unknown): value is ExportedExchangeRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.exchange_id === "string" &&
    typeof candidate.session_id === "string" &&
    typeof candidate.provider_id === "string" &&
    typeof candidate.profile_id === "string" &&
    typeof candidate.method === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.started_at === "string" &&
    (candidate.duration_ms === null || typeof candidate.duration_ms === "number") &&
    (candidate.status_code === null || typeof candidate.status_code === "number") &&
    typeof candidate.request_size === "number" &&
    (candidate.response_size === null || typeof candidate.response_size === "number") &&
    typeof candidate.raw_request_headers_json === "string" &&
    (candidate.raw_request_body_base64 === null ||
      typeof candidate.raw_request_body_base64 === "string") &&
    (candidate.raw_response_headers_json === null ||
      typeof candidate.raw_response_headers_json === "string") &&
    (candidate.raw_response_body_base64 === null ||
      typeof candidate.raw_response_body_base64 === "string") &&
    typeof candidate.normalized_json === "string" &&
    typeof candidate.inspector_json === "string"
  );
}

function parseExportedAppData(raw: string): ExportedAppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid backup file: malformed JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup file: expected an object");
  }

  const data = parsed as Record<string, unknown>;
  if (data.schemaVersion !== APP_DATA_SCHEMA_VERSION) {
    throw new Error("Invalid backup file: unsupported schema version");
  }

  if (
    typeof data.appVersion !== "string" ||
    typeof data.exportedAt !== "string" ||
    !Array.isArray(data.profiles) ||
    !Array.isArray(data.sessions) ||
    !Array.isArray(data.exchanges)
  ) {
    throw new Error("Invalid backup file: missing required fields");
  }

  if (!data.profiles.every(isConnectionProfile)) {
    throw new Error("Invalid backup file: corrupted profiles");
  }

  if (!data.sessions.every(isExportedSessionRow)) {
    throw new Error("Invalid backup file: corrupted sessions");
  }

  if (!data.exchanges.every(isExportedExchangeRow)) {
    throw new Error("Invalid backup file: corrupted exchanges");
  }

  return {
    schemaVersion: data.schemaVersion,
    appVersion: data.appVersion,
    exportedAt: data.exportedAt,
    profiles: data.profiles,
    sessions: data.sessions,
    exchanges: data.exchanges,
  };
}

function parseArchiveManifest(raw: string): AppDataArchiveManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid backup archive: malformed manifest");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup archive: expected manifest object");
  }

  const manifest = parsed as Record<string, unknown>;
  if (
    manifest.schemaVersion !== APP_DATA_SCHEMA_VERSION ||
    manifest.format !== APP_DATA_ARCHIVE_FORMAT ||
    typeof manifest.appVersion !== "string" ||
    typeof manifest.exportedAt !== "string" ||
    !Array.isArray(manifest.profiles)
  ) {
    throw new Error("Invalid backup archive: unsupported manifest");
  }

  return {
    schemaVersion: manifest.schemaVersion as number,
    format: manifest.format as typeof APP_DATA_ARCHIVE_FORMAT,
    appVersion: manifest.appVersion,
    exportedAt: manifest.exportedAt,
    profiles: manifest.profiles as AppDataArchiveManifest["profiles"],
  };
}

function serializeExchangeRow(row: ExchangeRow): ExportedExchangeRow {
  return {
    exchange_id: row.exchange_id,
    session_id: row.session_id,
    provider_id: row.provider_id,
    profile_id: row.profile_id,
    method: row.method,
    path: row.path,
    started_at: row.started_at,
    duration_ms: row.duration_ms,
    status_code: row.status_code,
    request_size: row.request_size,
    response_size: row.response_size,
    raw_request_headers_json: row.raw_request_headers_json,
    raw_request_body_base64: toBase64(row.raw_request_body),
    raw_response_headers_json: row.raw_response_headers_json,
    raw_response_body_base64: toBase64(row.raw_response_body),
    normalized_json: row.normalized_json,
    inspector_json: row.inspector_json,
  };
}

function deserializeExchangeRow(row: ExportedExchangeRow): ExchangeRow {
  return {
    exchange_id: row.exchange_id,
    session_id: row.session_id,
    provider_id: row.provider_id,
    profile_id: row.profile_id,
    method: row.method,
    path: row.path,
    started_at: row.started_at,
    duration_ms: row.duration_ms,
    status_code: row.status_code,
    request_size: row.request_size,
    response_size: row.response_size,
    raw_request_headers_json: row.raw_request_headers_json,
    raw_request_body: fromBase64(row.raw_request_body_base64),
    raw_response_headers_json: row.raw_response_headers_json,
    raw_response_body: fromBase64(row.raw_response_body_base64),
    normalized_json: row.normalized_json,
    inspector_json: row.inspector_json,
  };
}

function getProfileArchiveName(profileId: string): string {
  return encodeURIComponent(profileId);
}

function unpackArchive(buffer: Buffer): ExportedAppData {
  const entries = extractZipArchive(buffer);
  const manifestBuffer = entries.get("manifest.json");
  if (!manifestBuffer) {
    throw new Error("Invalid backup archive: missing manifest");
  }

  const manifest = parseArchiveManifest(manifestBuffer.toString("utf-8"));
  const profiles: ConnectionProfile[] = [];
  const sessions: ExportedSessionRow[] = [];
  const exchanges: ExportedExchangeRow[] = [];

  for (const profileEntry of manifest.profiles) {
    const profileBuffer = entries.get(profileEntry.profileFile);
    if (!profileBuffer) {
      throw new Error(`Invalid backup archive: missing ${profileEntry.profileFile}`);
    }

    const profile = JSON.parse(profileBuffer.toString("utf-8")) as ConnectionProfile;
    if (!isConnectionProfile(profile)) {
      throw new Error(`Invalid backup archive: corrupted ${profileEntry.profileFile}`);
    }
    profiles.push(profile);

    const sessionBuffer = entries.get(profileEntry.sessionsFile);
    if (sessionBuffer) {
      const sessionRows = JSON.parse(
        sessionBuffer.toString("utf-8"),
      ) as ExportedSessionRow[];
      if (!Array.isArray(sessionRows) || !sessionRows.every(isExportedSessionRow)) {
        throw new Error(`Invalid backup archive: corrupted ${profileEntry.sessionsFile}`);
      }
      sessions.push(...sessionRows);
    }

    const exchangeBuffer = entries.get(profileEntry.exchangesFile);
    if (exchangeBuffer) {
      const exchangeRows = JSON.parse(
        exchangeBuffer.toString("utf-8"),
      ) as ExportedExchangeRow[];
      if (!Array.isArray(exchangeRows) || !exchangeRows.every(isExportedExchangeRow)) {
        throw new Error(`Invalid backup archive: corrupted ${profileEntry.exchangesFile}`);
      }
      exchanges.push(...exchangeRows);
    }
  }

  return {
    schemaVersion: manifest.schemaVersion,
    appVersion: manifest.appVersion,
    exportedAt: manifest.exportedAt,
    profiles,
    sessions,
    exchanges,
  };
}

function packArchive(data: ExportedAppData): Buffer {
  const entries: Array<{ name: string; content: Buffer }> = [];
  const manifestProfiles: AppDataArchiveManifest["profiles"] = [];

  for (const profile of data.profiles) {
    const archiveName = getProfileArchiveName(profile.id);
    const profileFile = `profiles/${archiveName}.json`;
    const sessionsFile = `history/${archiveName}/sessions.json`;
    const exchangesFile = `history/${archiveName}/exchanges.json`;
    manifestProfiles.push({
      profileId: profile.id,
      profileFile,
      sessionsFile,
      exchangesFile,
    });

    entries.push({
      name: profileFile,
      content: Buffer.from(JSON.stringify(profile, null, 2), "utf-8"),
    });
    entries.push({
      name: sessionsFile,
      content: Buffer.from(
        JSON.stringify(
          data.sessions.filter((session) => session.profile_id === profile.id),
          null,
          2,
        ),
        "utf-8",
      ),
    });
    entries.push({
      name: exchangesFile,
      content: Buffer.from(
        JSON.stringify(
          data.exchanges.filter((exchange) => exchange.profile_id === profile.id),
          null,
          2,
        ),
        "utf-8",
      ),
    });
  }

  const manifest: AppDataArchiveManifest = {
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    format: APP_DATA_ARCHIVE_FORMAT,
    appVersion: data.appVersion,
    exportedAt: data.exportedAt,
    profiles: manifestProfiles,
  };

  entries.unshift({
    name: "manifest.json",
    content: Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"),
  });

  return createZipArchive(entries);
}

async function stopRunningProfiles(proxyManager: ProxyManager): Promise<void> {
  const statuses = proxyManager.getStatuses();
  for (const [profileId, status] of Object.entries(statuses)) {
    if (status.isRunning) {
      await proxyManager.stopProfile(profileId);
    }
  }
}

async function startAutoStartProfiles(
  proxyManager: ProxyManager,
  profiles: ConnectionProfile[],
): Promise<void> {
  for (const profile of profiles) {
    if (profile.enabled && profile.autoStart) {
      await proxyManager.startProfile(profile.id);
    }
  }
}

export class AppDataService {
  constructor(private readonly deps: AppDataServiceDependencies) {}

  exportToFile(filePath: string): AppDataTransferResult {
    const profiles = this.deps.profileStore.getProfiles();
    const sessions = this.deps.sessionRepository.listSessions();
    const exchanges = this.deps.exchangeRepository.listAll();

    const data: ExportedAppData = {
      schemaVersion: APP_DATA_SCHEMA_VERSION,
      appVersion: this.deps.appVersion,
      exportedAt: new Date().toISOString(),
      profiles,
      sessions,
      exchanges: exchanges.map(serializeExchangeRow),
    };

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, packArchive(data));

    return {
      filePath,
      profileCount: profiles.length,
      sessionCount: sessions.length,
      exchangeCount: exchanges.length,
    };
  }

  async importFromFile(filePath: string): Promise<AppDataTransferResult> {
    const fileBuffer = readFileSync(filePath);
    if (fileBuffer[0] !== 0x50 || fileBuffer[1] !== 0x4b) {
      throw new Error("Invalid backup file: expected a ZIP archive");
    }

    const parsed = unpackArchive(fileBuffer);
    const sessions: SessionRow[] = parsed.sessions;
    const exchanges = parsed.exchanges.map(deserializeExchangeRow);

    await stopRunningProfiles(this.deps.proxyManager);

    this.deps.sessionRepository.transaction(() => {
      this.deps.exchangeRepository.clearAll();
      this.deps.sessionRepository.clearAll();
      this.deps.sessionRepository.insertRows(sessions);
      this.deps.exchangeRepository.insertRows(exchanges);
    });

    this.deps.profileStore.saveProfiles(parsed.profiles);
    await startAutoStartProfiles(this.deps.proxyManager, parsed.profiles);

    return {
      filePath,
      profileCount: parsed.profiles.length,
      sessionCount: parsed.sessions.length,
      exchangeCount: parsed.exchanges.length,
    };
  }
}
