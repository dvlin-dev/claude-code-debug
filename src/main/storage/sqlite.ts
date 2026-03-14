import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  external_hint TEXT,
  title TEXT NOT NULL,
  model TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  exchange_count INTEGER NOT NULL,
  matcher_state_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exchanges (
  exchange_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  duration_ms INTEGER,
  status_code INTEGER,
  request_size INTEGER NOT NULL,
  response_size INTEGER,
  raw_request_headers_json TEXT NOT NULL,
  raw_request_body BLOB,
  raw_response_headers_json TEXT,
  raw_response_body BLOB,
  normalized_json TEXT NOT NULL,
  inspector_json TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_profile_updated
  ON sessions(profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_exchanges_session_started
  ON exchanges(session_id, started_at ASC);

CREATE INDEX IF NOT EXISTS idx_exchanges_profile_started
  ON exchanges(profile_id, started_at DESC);
`;

export function createSqliteDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function listTables(db: Database.Database): string[] {
  return (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
      )
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}
