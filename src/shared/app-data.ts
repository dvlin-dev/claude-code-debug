import type { ConnectionProfile, ProviderId } from "./contracts";

export const APP_DATA_SCHEMA_VERSION = 1;
export const APP_DATA_ARCHIVE_FORMAT = "agent-trace-zip-v1";

export interface ExportedSessionRow {
  session_id: string;
  provider_id: ProviderId;
  profile_id: string;
  external_hint: string | null;
  title: string;
  model: string | null;
  started_at: string;
  updated_at: string;
  exchange_count: number;
  matcher_state_json: string;
}

export interface ExportedExchangeRow {
  exchange_id: string;
  session_id: string;
  provider_id: ProviderId;
  profile_id: string;
  method: string;
  path: string;
  started_at: string;
  duration_ms: number | null;
  status_code: number | null;
  request_size: number;
  response_size: number | null;
  raw_request_headers_json: string;
  raw_request_body_base64: string | null;
  raw_response_headers_json: string | null;
  raw_response_body_base64: string | null;
  normalized_json: string;
  inspector_json: string;
}

export interface ExportedAppData {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  profiles: ConnectionProfile[];
  sessions: ExportedSessionRow[];
  exchanges: ExportedExchangeRow[];
}

export interface AppDataArchiveProfileEntry {
  profileId: string;
  profileFile: string;
  sessionsFile: string;
  exchangesFile: string;
}

export interface AppDataArchiveManifest {
  schemaVersion: number;
  format: typeof APP_DATA_ARCHIVE_FORMAT;
  appVersion: string;
  exportedAt: string;
  profiles: AppDataArchiveProfileEntry[];
}

export interface AppDataTransferResult {
  filePath: string;
  profileCount: number;
  sessionCount: number;
  exchangeCount: number;
}
