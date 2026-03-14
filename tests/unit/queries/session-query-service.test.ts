import { describe, expect, it } from "vitest";
import { createProviderCatalog } from "../../../src/main/providers/provider-catalog";
import { anthropicMessagesAdapter } from "../../../src/main/providers/protocol-adapters/anthropic-messages";
import { CapturePipeline } from "../../../src/main/pipeline/capture-pipeline";
import { SessionResolver } from "../../../src/main/pipeline/session-resolver";
import { ExchangeQueryService } from "../../../src/main/queries/exchange-query-service";
import { SessionQueryService } from "../../../src/main/queries/session-query-service";
import { ExchangeRepository } from "../../../src/main/storage/exchange-repository";
import { HistoryMaintenanceService } from "../../../src/main/storage/history-maintenance-service";
import { SessionRepository } from "../../../src/main/storage/session-repository";
import { createSqliteDatabase } from "../../../src/main/storage/sqlite";
import type { CapturedExchange, ProtocolAdapter } from "../../../src/shared/contracts";

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

describe("session query service", () => {
  it("builds SessionTraceVM from normalized exchanges and timeline assembler", async () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const exchangeRepository = new ExchangeRepository(db);
    const providerCatalog = createProviderCatalog();
    const adapters = new Map<string, ProtocolAdapter>([
      ["anthropic-messages", anthropicMessagesAdapter],
    ]);
    const historyMaintenance = new HistoryMaintenanceService({
      sessionRepository,
      exchangeRepository,
    });
    const pipeline = new CapturePipeline({
      providerCatalog,
      protocolAdapters: adapters,
      sessionResolver: new SessionResolver(sessionRepository),
      sessionRepository,
      exchangeRepository,
      historyMaintenance,
    });
    const result = pipeline.process(makeExchange());

    const sessionQuery = new SessionQueryService(
      sessionRepository,
      exchangeRepository,
      providerCatalog,
      adapters,
    );
    const exchangeQuery = new ExchangeQueryService(
      exchangeRepository,
      providerCatalog,
    );

    const trace = await sessionQuery.getSessionTrace(result.sessionId);
    const detail = await exchangeQuery.getExchangeDetail("exchange-1");

    expect(trace.timeline.messages.length).toBeGreaterThan(0);
    expect(detail?.inspector.sections.length).toBeGreaterThan(0);
  });
});
