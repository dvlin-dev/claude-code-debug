import { describe, expect, it } from "vitest";
import { createProviderCatalog } from "../../../src/main/providers/provider-catalog";
import { anthropicMessagesAdapter } from "../../../src/main/providers/protocol-adapters/anthropic-messages";
import { SessionQueryService } from "../../../src/main/queries/session-query-service";
import type {
  ExchangeRow,
} from "../../../src/main/storage/exchange-repository";
import type {
  SessionRepository,
  SessionRow,
} from "../../../src/main/storage/session-repository";
import type {
  NormalizedExchange,
  ProtocolAdapter,
} from "../../../src/shared/contracts";

function makeSessionRow(title: string): SessionRow {
  return {
    session_id: "session-1",
    provider_id: "anthropic",
    profile_id: "profile-1",
    external_hint: "hint-1",
    title,
    model: "claude-opus-4-6",
    started_at: "2026-03-14T00:00:00.000Z",
    updated_at: "2026-03-14T00:00:01.000Z",
    exchange_count: 1,
    matcher_state_json: "{}",
  };
}

function makeService(sessionRow: SessionRow) {
  const sessionRepository = {
    getById: () => sessionRow,
    listSessions: () => [sessionRow],
  } as Pick<SessionRepository, "getById" | "listSessions"> as SessionRepository;

  const exchangeRepository = {
    listBySessionId: () => [] as ExchangeRow[],
  };

  return new SessionQueryService(
    sessionRepository,
    exchangeRepository as never,
    createProviderCatalog(),
    new Map<string, ProtocolAdapter>([
      ["anthropic-messages", anthropicMessagesAdapter],
    ]),
  );
}

describe("SessionQueryService title display", () => {
  it("strips XML tags from stored title", () => {
    const row = makeSessionRow("<system-reminder>Fix bug</system-reminder>");
    const service = makeService(row);
    expect(service.listSessions()[0]?.title).toBe("Fix bug");
  });

  it("falls back to model when cleaned title is empty", () => {
    const row = makeSessionRow("");
    const service = makeService(row);
    expect(service.listSessions()[0]?.title).toBe("claude-opus-4-6");
  });

  it("returns cleaned title as-is when meaningful", () => {
    const row = makeSessionRow("Fix the sidebar title parser");
    const service = makeService(row);
    expect(service.listSessions()[0]?.title).toBe("Fix the sidebar title parser");
  });
});
