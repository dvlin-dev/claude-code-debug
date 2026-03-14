import { describe, expect, it } from "vitest";
import { createSqliteDatabase, listTables } from "../../../src/main/storage/sqlite";

describe("sqlite schema", () => {
  it("creates sessions and exchanges tables with the new schema", () => {
    const db = createSqliteDatabase(":memory:");
    const tables = listTables(db);

    expect(tables).toContain("sessions");
    expect(tables).toContain("exchanges");
  });
});
