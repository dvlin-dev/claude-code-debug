import { describe, expect, expectTypeOf, it } from "vitest";
import { createSqliteDatabase } from "../../../src/main/storage/sqlite";
import {
  ExchangeRepository,
  type ExchangeRow,
} from "../../../src/main/storage/exchange-repository";
import {
  SessionRepository,
  type SessionRow,
} from "../../../src/main/storage/session-repository";
import type {
  CapturedExchange,
  InspectorDocument,
  NormalizedExchange,
} from "../../../src/shared/contracts";

function textBody(text: string, contentType = "application/json") {
  return {
    bytes: Buffer.from(text, "utf-8"),
    contentType,
    contentEncoding: null,
  };
}

const capturedExchange: CapturedExchange = {
  exchangeId: "exchange-1",
  providerId: "anthropic",
  profileId: "profile-1",
  method: "POST",
  path: "/v1/messages",
  requestHeaders: { "content-type": "application/json" },
  requestBody: textBody('{"model":"claude-opus-4-6"}'),
  responseHeaders: { "content-type": "application/json" },
  responseBody: textBody('{"ok":true}'),
  statusCode: 200,
  startedAt: "2026-03-13T00:00:00.000Z",
  durationMs: 120,
  requestSize: 10,
  responseSize: 12,
};

const normalizedExchange: NormalizedExchange = {
  exchangeId: "exchange-1",
  providerId: "anthropic",
  profileId: "profile-1",
  endpointKind: "messages",
  model: "claude-opus-4-6",
  request: {
    instructions: [],
    tools: [],
    inputMessages: [{ role: "user", blocks: [{ type: "text", text: "Hello" }] }],
    meta: {},
  },
  response: {
    outputMessages: [{ role: "assistant", blocks: [{ type: "text", text: "Hi" }] }],
    stopReason: "end_turn",
    usage: null,
    error: null,
    meta: {},
  },
};

const inspectorDocument: InspectorDocument = {
  sections: [{ kind: "overview", title: "Overview", items: [] }],
};

describe("exchange repository", () => {
  it("exposes typed database rows to callers", () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const repository = new ExchangeRepository(db);

    expectTypeOf(repository.getById("exchange-1")).toEqualTypeOf<ExchangeRow | null>();
    expectTypeOf(repository.listBySessionId("session-1")).toEqualTypeOf<ExchangeRow[]>();
    expectTypeOf(sessionRepository.getById("session-1")).toEqualTypeOf<SessionRow | null>();
  });

  it("persists normalized exchange and inspector as separate columns", () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const repository = new ExchangeRepository(db);

    sessionRepository.upsert({
      sessionId: "session-1",
      providerId: "anthropic",
      profileId: "profile-1",
      externalHint: "uuid-1",
      title: "Hello",
      model: "claude-opus-4-6",
      startedAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z",
      exchangeCount: 1,
      matcherState: {},
    });

    repository.save({
      sessionId: "session-1",
      capturedExchange,
      normalizedExchange,
      inspectorDocument,
    });

    const row = repository.getById("exchange-1");

    expect(row?.normalized_json).toContain('"providerId":"anthropic"');
    expect(row?.inspector_json).toContain('"sections"');
    expect(Buffer.isBuffer(row?.raw_request_body)).toBe(true);
  });
});
