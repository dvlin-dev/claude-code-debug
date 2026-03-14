import { describe, expect, expectTypeOf, it } from "vitest";
import { createSqliteDatabase } from "../../../src/main/storage/sqlite";
import {
  SessionRepository,
  type SessionRow,
} from "../../../src/main/storage/session-repository";

describe("session repository", () => {
  it("exposes typed session rows to callers", () => {
    const db = createSqliteDatabase(":memory:");
    const repository = new SessionRepository(db);

    expectTypeOf(repository.getById("session-1")).toEqualTypeOf<SessionRow | null>();
    expectTypeOf(
      repository.getByExternalHint("anthropic", "profile-1", "hint-1"),
    ).toEqualTypeOf<SessionRow | null>();
    expectTypeOf(
      repository.listCandidates("anthropic", "profile-1"),
    ).toEqualTypeOf<SessionRow[]>();
    expectTypeOf(repository.listSessions()).toEqualTypeOf<SessionRow[]>();
  });

  it("stores session model as a denormalized column for fast list queries", () => {
    const db = createSqliteDatabase(":memory:");
    const repository = new SessionRepository(db);

    repository.upsert({
      sessionId: "session-1",
      providerId: "anthropic",
      profileId: "profile-1",
      externalHint: "uuid-1",
      title: "Hello",
      model: "claude-opus-4-6",
      startedAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:01.000Z",
      exchangeCount: 1,
      matcherState: { lastMessageCount: 1 },
    });

    const row = repository.getById("session-1");

    expect(row?.model).toBe("claude-opus-4-6");
  });
});
