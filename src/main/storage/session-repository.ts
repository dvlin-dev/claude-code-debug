import type Database from "better-sqlite3";
import type { ProviderId } from "../../shared/contracts";

export interface UpsertSessionInput {
  sessionId: string;
  providerId: ProviderId;
  profileId: string;
  externalHint: string | null;
  title: string;
  model: string | null;
  startedAt: string;
  updatedAt: string;
  exchangeCount: number;
  matcherState: unknown;
}

export interface SessionRow {
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

export class SessionRepository {
  constructor(private readonly db: Database.Database) {}

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  upsert(input: UpsertSessionInput): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO sessions (
          session_id, provider_id, profile_id, external_hint, title, model,
          started_at, updated_at, exchange_count, matcher_state_json
        ) VALUES (
          @sessionId, @providerId, @profileId, @externalHint, @title, @model,
          @startedAt, @updatedAt, @exchangeCount, @matcherStateJson
        )`,
      )
      .run({
        sessionId: input.sessionId,
        providerId: input.providerId,
        profileId: input.profileId,
        externalHint: input.externalHint,
        title: input.title,
        model: input.model,
        startedAt: input.startedAt,
        updatedAt: input.updatedAt,
        exchangeCount: input.exchangeCount,
        matcherStateJson: JSON.stringify(input.matcherState),
      });
  }

  getById(sessionId: string): SessionRow | null {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .get(sessionId) as SessionRow | undefined;
    return row ?? null;
  }

  getByExternalHint(
    providerId: ProviderId,
    profileId: string,
    externalHint: string,
  ): SessionRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE provider_id = ? AND profile_id = ? AND external_hint = ?`,
      )
      .get(providerId, profileId, externalHint) as SessionRow | undefined;
    return row ?? null;
  }

  listCandidates(
    providerId: ProviderId,
    profileId: string,
  ): SessionRow[] {
    return this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE provider_id = ? AND profile_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(providerId, profileId) as SessionRow[];
  }

  listSessions(): SessionRow[] {
    return this.db
      .prepare("SELECT * FROM sessions ORDER BY updated_at DESC")
      .all() as SessionRow[];
  }

  insertRows(rows: SessionRow[]): void {
    const statement = this.db.prepare(
      `INSERT OR REPLACE INTO sessions (
        session_id, provider_id, profile_id, external_hint, title, model,
        started_at, updated_at, exchange_count, matcher_state_json
      ) VALUES (
        @session_id, @provider_id, @profile_id, @external_hint, @title, @model,
        @started_at, @updated_at, @exchange_count, @matcher_state_json
      )`,
    );

    for (const row of rows) {
      statement.run(row);
    }
  }

  deleteByIds(sessionIds: string[]): void {
    if (sessionIds.length === 0) {
      return;
    }

    const placeholders = sessionIds.map(() => "?").join(", ");
    this.db
      .prepare(`DELETE FROM sessions WHERE session_id IN (${placeholders})`)
      .run(...sessionIds);
  }

  clearAll(): void {
    this.db.prepare("DELETE FROM sessions").run();
  }
}
