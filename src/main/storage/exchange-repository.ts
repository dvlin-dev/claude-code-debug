import type Database from "better-sqlite3";
import type {
  CapturedExchange,
  InspectorDocument,
  NormalizedExchange,
} from "../../shared/contracts";

export interface SaveExchangeInput {
  sessionId: string;
  capturedExchange: CapturedExchange;
  normalizedExchange: NormalizedExchange;
  inspectorDocument: InspectorDocument;
}

export interface ExchangeRow {
  exchange_id: string;
  session_id: string;
  provider_id: CapturedExchange["providerId"];
  profile_id: string;
  method: string;
  path: string;
  started_at: string;
  duration_ms: number | null;
  status_code: number | null;
  request_size: number;
  response_size: number | null;
  raw_request_headers_json: string;
  raw_request_body: Buffer | null;
  raw_response_headers_json: string | null;
  raw_response_body: Buffer | null;
  normalized_json: string;
  inspector_json: string;
}

export class ExchangeRepository {
  constructor(private readonly db: Database.Database) {}

  save(input: SaveExchangeInput): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO exchanges (
          exchange_id, session_id, provider_id, profile_id, method, path,
          started_at, duration_ms, status_code, request_size, response_size,
          raw_request_headers_json, raw_request_body,
          raw_response_headers_json, raw_response_body,
          normalized_json, inspector_json
        ) VALUES (
          @exchangeId, @sessionId, @providerId, @profileId, @method, @path,
          @startedAt, @durationMs, @statusCode, @requestSize, @responseSize,
          @rawRequestHeadersJson, @rawRequestBody,
          @rawResponseHeadersJson, @rawResponseBody,
          @normalizedJson, @inspectorJson
        )`,
      )
      .run({
        exchangeId: input.capturedExchange.exchangeId,
        sessionId: input.sessionId,
        providerId: input.capturedExchange.providerId,
        profileId: input.capturedExchange.profileId,
        method: input.capturedExchange.method,
        path: input.capturedExchange.path,
        startedAt: input.capturedExchange.startedAt,
        durationMs: input.capturedExchange.durationMs,
        statusCode: input.capturedExchange.statusCode,
        requestSize: input.capturedExchange.requestSize,
        responseSize: input.capturedExchange.responseSize,
        rawRequestHeadersJson: JSON.stringify(input.capturedExchange.requestHeaders),
        rawRequestBody: input.capturedExchange.requestBody
          ? Buffer.from(input.capturedExchange.requestBody.bytes)
          : null,
        rawResponseHeadersJson: input.capturedExchange.responseHeaders
          ? JSON.stringify(input.capturedExchange.responseHeaders)
          : null,
        rawResponseBody: input.capturedExchange.responseBody
          ? Buffer.from(input.capturedExchange.responseBody.bytes)
          : null,
        normalizedJson: JSON.stringify(input.normalizedExchange),
        inspectorJson: JSON.stringify(input.inspectorDocument),
      });
  }

  getById(exchangeId: string): ExchangeRow | null {
    const row = this.db
      .prepare("SELECT * FROM exchanges WHERE exchange_id = ?")
      .get(exchangeId) as ExchangeRow | undefined;
    return row ?? null;
  }

  listBySessionId(sessionId: string): ExchangeRow[] {
    return this.db
      .prepare(
        "SELECT * FROM exchanges WHERE session_id = ? ORDER BY started_at ASC",
      )
      .all(sessionId) as ExchangeRow[];
  }

  listAll(): ExchangeRow[] {
    return this.db
      .prepare("SELECT * FROM exchanges ORDER BY started_at DESC")
      .all() as ExchangeRow[];
  }

  insertRows(rows: ExchangeRow[]): void {
    const statement = this.db.prepare(
      `INSERT OR REPLACE INTO exchanges (
        exchange_id, session_id, provider_id, profile_id, method, path,
        started_at, duration_ms, status_code, request_size, response_size,
        raw_request_headers_json, raw_request_body,
        raw_response_headers_json, raw_response_body,
        normalized_json, inspector_json
      ) VALUES (
        @exchange_id, @session_id, @provider_id, @profile_id, @method, @path,
        @started_at, @duration_ms, @status_code, @request_size, @response_size,
        @raw_request_headers_json, @raw_request_body,
        @raw_response_headers_json, @raw_response_body,
        @normalized_json, @inspector_json
      )`,
    );

    for (const row of rows) {
      statement.run(row);
    }
  }

  deleteBySessionIds(sessionIds: string[]): void {
    if (sessionIds.length === 0) {
      return;
    }

    const placeholders = sessionIds.map(() => "?").join(", ");
    this.db
      .prepare(`DELETE FROM exchanges WHERE session_id IN (${placeholders})`)
      .run(...sessionIds);
  }

  clearAll(): void {
    this.db.prepare("DELETE FROM exchanges").run();
  }
}
