import { describe, expect, it, vi } from "vitest";
import { HistoryMaintenanceService } from "../../../src/main/storage/history-maintenance-service";
import type { SessionRow } from "../../../src/main/storage/session-repository";

function makeSessionRow(
  sessionId: string,
  exchangeCount: number,
  updatedAt: string,
): SessionRow {
  return {
    session_id: sessionId,
    provider_id: "anthropic",
    profile_id: "profile-1",
    external_hint: null,
    title: sessionId,
    model: null,
    started_at: updatedAt,
    updated_at: updatedAt,
    exchange_count: exchangeCount,
    matcher_state_json: "{}",
  };
}

describe("history maintenance service", () => {
  it("wraps clear-all deletes in a single transaction", () => {
    const calls: string[] = [];
    const service = new HistoryMaintenanceService({
      sessionRepository: {
        transaction<T>(fn: () => T): T {
          calls.push("transaction:start");
          const result = fn();
          calls.push("transaction:end");
          return result;
        },
        listSessions: () => [],
        clearAll() {
          calls.push("sessions:clear");
        },
        deleteByIds: vi.fn(),
      },
      exchangeRepository: {
        clearAll() {
          calls.push("exchanges:clear");
        },
        deleteBySessionIds: vi.fn(),
      },
    });

    service.clearAll();

    expect(calls).toEqual([
      "transaction:start",
      "exchanges:clear",
      "sessions:clear",
      "transaction:end",
    ]);
  });

  it("prunes oldest complete sessions and keeps the newest oversize session intact", () => {
    const deleteByIds = vi.fn();
    const deleteBySessionIds = vi.fn();
    const service = new HistoryMaintenanceService({
      sessionRepository: {
        transaction<T>(fn: () => T): T {
          return fn();
        },
        listSessions: () => [
          makeSessionRow("session-new", 7, "2026-03-14T00:00:02.000Z"),
          makeSessionRow("session-mid", 2, "2026-03-14T00:00:01.000Z"),
          makeSessionRow("session-old", 1, "2026-03-14T00:00:00.000Z"),
        ],
        clearAll: vi.fn(),
        deleteByIds,
      },
      exchangeRepository: {
        clearAll: vi.fn(),
        deleteBySessionIds,
      },
      maxStoredExchanges: 5,
    });

    const deletedSessionIds = service.enforceRetentionLimit();

    expect(deletedSessionIds).toEqual(["session-mid", "session-old"]);
    expect(deleteBySessionIds).toHaveBeenCalledWith([
      "session-mid",
      "session-old",
    ]);
    expect(deleteByIds).toHaveBeenCalledWith(["session-mid", "session-old"]);
  });
});
