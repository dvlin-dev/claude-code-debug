import type { ProviderId } from "../../shared/contracts";

const LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  codex: "Codex",
};

export function formatProviderLabel(providerId: ProviderId): string {
  return LABELS[providerId];
}
