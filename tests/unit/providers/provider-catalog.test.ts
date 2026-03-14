import { describe, expect, it } from "vitest";
import { createProviderCatalog } from "../../../src/main/providers/provider-catalog";

describe("provider catalog", () => {
  it("returns only implemented provider definitions", () => {
    const catalog = createProviderCatalog();

    expect(catalog.get("anthropic")?.protocolAdapterId).toBe("anthropic-messages");
    expect(catalog.get("codex")?.protocolAdapterId).toBe("openai-responses");
    expect(catalog.list().map((provider) => provider.id)).toEqual([
      "anthropic",
      "codex",
    ]);
  });
});
