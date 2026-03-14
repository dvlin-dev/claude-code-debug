import { describe, expect, it } from "vitest";
import { createProviderCatalog } from "../../../src/main/providers/provider-catalog";
import { ExchangeQueryService } from "../../../src/main/queries/exchange-query-service";
import { ExchangeRepository } from "../../../src/main/storage/exchange-repository";
import { SessionRepository } from "../../../src/main/storage/session-repository";
import { createSqliteDatabase } from "../../../src/main/storage/sqlite";
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

describe("exchange query service", () => {
  it("returns ExchangeDetailVM with inspector document", async () => {
    const db = createSqliteDatabase(":memory:");
    const sessionRepository = new SessionRepository(db);
    const exchangeRepository = new ExchangeRepository(db);

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

    const capturedExchange: CapturedExchange = {
      exchangeId: "exchange-1",
      providerId: "anthropic",
      profileId: "profile-1",
      method: "POST",
      path: "/v1/messages",
      requestHeaders: {},
      requestBody: textBody("{}"),
      responseHeaders: {},
      responseBody: textBody("{}"),
      statusCode: 200,
      startedAt: "2026-03-13T00:00:00.000Z",
      durationMs: 10,
      requestSize: 1,
      responseSize: 1,
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
        inputMessages: [],
        meta: {},
      },
      response: {
        outputMessages: [],
        stopReason: null,
        usage: null,
        error: null,
        meta: {},
      },
    };
    const inspectorDocument: InspectorDocument = {
      sections: [{ kind: "overview", title: "Overview", items: [] }],
    };

    exchangeRepository.save({
      sessionId: "session-1",
      capturedExchange,
      normalizedExchange,
      inspectorDocument,
    });

    const service = new ExchangeQueryService(
      exchangeRepository,
      createProviderCatalog(),
    );
    const detail = await service.getExchangeDetail("exchange-1");

    expect(detail?.inspector.sections.length).toBeGreaterThan(0);
  });
});
