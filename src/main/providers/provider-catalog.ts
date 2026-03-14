import type { ProviderDefinition, ProviderId } from "../../shared/contracts";
import { anthropicProvider } from "./definitions/anthropic";
import { codexProvider } from "./definitions/codex";

export interface ProviderCatalog {
  list(): ProviderDefinition[];
  get(id: ProviderId): ProviderDefinition | null;
}

const providers: ProviderDefinition[] = [
  anthropicProvider,
  codexProvider,
];

export function createProviderCatalog(): ProviderCatalog {
  const index = new Map<ProviderId, ProviderDefinition>(
    providers.map((provider) => [provider.id, provider]),
  );

  return {
    list() {
      return [...providers];
    },

    get(id) {
      return index.get(id) ?? null;
    },
  };
}
