import { describe, expect, it } from "vitest";
import { createProviderCatalog } from "../../../src/main/providers/provider-catalog";
import { anthropicMessagesAdapter } from "../../../src/main/providers/protocol-adapters/anthropic-messages";
import { CapturePipeline } from "../../../src/main/pipeline/capture-pipeline";
import { SessionResolver } from "../../../src/main/pipeline/session-resolver";
import { ExchangeRepository } from "../../../src/main/storage/exchange-repository";
import { HistoryMaintenanceService } from "../../../src/main/storage/history-maintenance-service";
import { SessionRepository } from "../../../src/main/storage/session-repository";
import { createSqliteDatabase } from "../../../src/main/storage/sqlite";
import type { CapturedExchange, ProtocolAdapter } from "../../../src/shared/contracts";
import { zstdCompressSync } from "node:zlib";

function textBody(text: string, contentType = "application/json") {
  return {
    bytes: Buffer.from(text, "utf-8"),
    contentType,
    contentEncoding: null,
  };
}

function makeExchange(): CapturedExchange {
  return {
    exchangeId: "exchange-1",
    providerId: "anthropic",
    profileId: "profile-1",
    method: "POST",
    path: "/v1/messages",
    requestHeaders: { "content-type": "application/json" },
    requestBody: textBody(
      JSON.stringify({
        model: "claude-opus-4-6",
        metadata: { user_id: "user_hash_account__session_uuid-123" },
        messages: [{ role: "user", content: "Hello" }],
      }),
    ),
    responseHeaders: { "content-type": "application/json" },
    responseBody: textBody(
      JSON.stringify({
        role: "assistant",
        content: [{ type: "text", text: "Hi" }],
      }),
    ),
    statusCode: 200,
    startedAt: "2026-03-13T00:00:00.000Z",
    durationMs: 12,
    requestSize: 100,
    responseSize: 80,
  };
}

describe("capture pipeline", () => {
  it("runs normalize -> buildInspector -> resolveSession -> persist", async () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const exchangeRepository = new ExchangeRepository(db);
    const historyMaintenance = new HistoryMaintenanceService({
      sessionRepository,
      exchangeRepository,
    });
    const resolver = new SessionResolver(sessionRepository);
    const adapters = new Map<string, ProtocolAdapter>([
      ["anthropic-messages", anthropicMessagesAdapter],
    ]);

    const pipeline = new CapturePipeline({
      providerCatalog: createProviderCatalog(),
      protocolAdapters: adapters,
      sessionResolver: resolver,
      sessionRepository,
      exchangeRepository,
      historyMaintenance,
    });

    const result = pipeline.process(makeExchange());

    expect(result.sessionId).toBeDefined();
    expect(sessionRepository.getById(result.sessionId)).not.toBeNull();
    expect(exchangeRepository.getById("exchange-1")).not.toBeNull();
  });

  it("rolls back the session write if exchange persistence fails", async () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const historyMaintenance = new HistoryMaintenanceService({
      sessionRepository,
      exchangeRepository: { clearAll() {}, deleteBySessionIds() {} } as ExchangeRepository,
    });
    const resolver = new SessionResolver(sessionRepository);
    const adapters = new Map<string, ProtocolAdapter>([
      ["anthropic-messages", anthropicMessagesAdapter],
    ]);

    const pipeline = new CapturePipeline({
      providerCatalog: createProviderCatalog(),
      protocolAdapters: adapters,
      sessionResolver: resolver,
      sessionRepository,
      exchangeRepository: {
        save() {
          throw new Error("disk full");
        },
      } as ExchangeRepository,
      historyMaintenance,
    });

    expect(() => pipeline.process(makeExchange())).toThrow("disk full");
    expect(sessionRepository.listSessions()).toHaveLength(0);
  });

  it("normalizes a zstd-compressed Codex request body through the runtime path", async () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const exchangeRepository = new ExchangeRepository(db);
    const historyMaintenance = new HistoryMaintenanceService({
      sessionRepository,
      exchangeRepository,
    });
    const resolver = new SessionResolver(sessionRepository);
    const { openaiResponsesAdapter } = await import(
      "../../../src/main/providers/protocol-adapters/openai-responses"
    );
    const adapters = new Map<string, ProtocolAdapter>([
      ["anthropic-messages", anthropicMessagesAdapter],
      ["openai-responses", openaiResponsesAdapter],
    ]);

    const pipeline = new CapturePipeline({
      providerCatalog: createProviderCatalog(),
      protocolAdapters: adapters,
      sessionResolver: resolver,
      sessionRepository,
      exchangeRepository,
      historyMaintenance,
    });

    const requestJson = JSON.stringify({
      model: "gpt-5.4",
      instructions: "You are Codex.",
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "probe" }],
        },
      ],
      tools: [],
      stream: true,
      store: false,
    });

    const responseSse =
      'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","model":"gpt-5.4","output":[{"id":"msg_1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"probe"}]}]}}\n\ndata: [DONE]\n';

    pipeline.process({
      exchangeId: "exchange-codex-1",
      providerId: "codex",
      profileId: "codex-dev",
      method: "POST",
      path: "/responses",
      requestHeaders: {
        "content-type": "application/json",
        "content-encoding": "zstd",
        session_id: "session-codex-1",
        "x-codex-turn-metadata":
          '{"turn_id":"turn-codex-1","sandbox":"none"}',
      },
      requestBody: {
        bytes: zstdCompressSync(Buffer.from(requestJson, "utf-8")),
        contentType: "application/json",
        contentEncoding: "zstd",
      },
      responseHeaders: { "content-type": "text/event-stream" },
      responseBody: textBody(responseSse, "text/event-stream"),
      statusCode: 200,
      startedAt: "2026-03-13T00:00:00.000Z",
      durationMs: 15,
      requestSize: 256,
      responseSize: responseSse.length,
    });

    const row = exchangeRepository.getById("exchange-codex-1");
    expect(row).not.toBeNull();
    expect(String(row?.normalized_json)).toContain('"model":"gpt-5.4"');
  });

  it("processes multiple exchanges in the same session via hint matching", async () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const exchangeRepository = new ExchangeRepository(db);
    const historyMaintenance = new HistoryMaintenanceService({
      sessionRepository,
      exchangeRepository,
    });
    const resolver = new SessionResolver(sessionRepository);
    const adapters = new Map<string, ProtocolAdapter>([
      ["anthropic-messages", anthropicMessagesAdapter],
    ]);

    const pipeline = new CapturePipeline({
      providerCatalog: createProviderCatalog(),
      protocolAdapters: adapters,
      sessionResolver: resolver,
      sessionRepository,
      exchangeRepository,
      historyMaintenance,
    });

    const first = makeExchange();
    first.exchangeId = "exchange-first";
    first.startedAt = "2026-03-14T00:00:00.000Z";

    const second = makeExchange();
    second.exchangeId = "exchange-second";
    second.startedAt = "2026-03-14T00:00:01.000Z";
    second.requestBody = textBody(
      JSON.stringify({
        model: "claude-opus-4-6",
        metadata: { user_id: "user_hash_account__session_uuid-123" },
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: [{ type: "text", text: "Hi" }] },
          { role: "user", content: "Follow up" },
        ],
      }),
    );

    const result1 = pipeline.process(first);
    const result2 = pipeline.process(second);

    expect(result2.sessionId).toBe(result1.sessionId);

    const session = sessionRepository.getById(result1.sessionId);
    expect(session?.exchange_count).toBe(2);

    const exchanges = exchangeRepository.listBySessionId(result1.sessionId);
    expect(exchanges).toHaveLength(2);
    expect(exchanges.map((e) => e.exchange_id)).toEqual([
      "exchange-first",
      "exchange-second",
    ]);
  });

  it("captures and normalizes a non-200 response", () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const exchangeRepository = new ExchangeRepository(db);
    const historyMaintenance = new HistoryMaintenanceService({
      sessionRepository,
      exchangeRepository,
    });
    const resolver = new SessionResolver(sessionRepository);
    const adapters = new Map<string, ProtocolAdapter>([
      ["anthropic-messages", anthropicMessagesAdapter],
    ]);

    const pipeline = new CapturePipeline({
      providerCatalog: createProviderCatalog(),
      protocolAdapters: adapters,
      sessionResolver: resolver,
      sessionRepository,
      exchangeRepository,
      historyMaintenance,
    });

    const exchange = makeExchange();
    exchange.statusCode = 429;
    exchange.responseBody = textBody(
      JSON.stringify({
        type: "error",
        error: { type: "rate_limit_error", message: "Too many requests" },
      }),
    );

    const result = pipeline.process(exchange);
    expect(result.sessionId).toBeDefined();

    const row = exchangeRepository.getById("exchange-1");
    expect(row).not.toBeNull();
    expect(row?.status_code).toBe(429);
  });

  it("prunes oldest complete sessions when the retention limit is exceeded", async () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const exchangeRepository = new ExchangeRepository(db);
    const historyMaintenance = new HistoryMaintenanceService({
      sessionRepository,
      exchangeRepository,
      maxStoredExchanges: 2,
    });
    const resolver = new SessionResolver(sessionRepository);
    const adapters = new Map<string, ProtocolAdapter>([
      ["anthropic-messages", anthropicMessagesAdapter],
    ]);

    const pipeline = new CapturePipeline({
      providerCatalog: createProviderCatalog(),
      protocolAdapters: adapters,
      sessionResolver: resolver,
      sessionRepository,
      exchangeRepository,
      historyMaintenance,
    });

    for (const [index, sessionId] of ["one", "two", "three"].entries()) {
      const exchange = makeExchange();
      exchange.exchangeId = `exchange-${sessionId}`;
      exchange.startedAt = `2026-03-13T00:00:0${index}.000Z`;
      exchange.requestBody = textBody(
        JSON.stringify({
          model: "claude-opus-4-6",
          metadata: { user_id: `user_hash_account__session_${sessionId}` },
          messages: [{ role: "user", content: `Hello ${sessionId}` }],
        }),
      );

      pipeline.process(exchange);
    }

    const sessions = sessionRepository.listSessions();
    const exchangeIds = exchangeRepository
      .listAll()
      .map((row) => row.exchange_id);

    expect(sessions).toHaveLength(2);
    expect(exchangeIds).toEqual(["exchange-three", "exchange-two"]);
    expect(sessions.map((row) => row.title)).toEqual(["Hello three", "Hello two"]);
  });
});
