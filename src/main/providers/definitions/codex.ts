import type { ProviderDefinition } from "../../../shared/contracts";

export const codexProvider: ProviderDefinition = {
  id: "codex",
  label: "Codex",
  defaultUpstreamBaseUrl: "https://chatgpt.com/backend-api/codex",
  protocolAdapterId: "openai-responses",
  setup: {
    envVarName: "OPENAI_BASE_URL",
    exampleBaseUrl: "http://127.0.0.1:8889",
    instructions: [
      "Set OPENAI_BASE_URL to the local listener address before running Codex.",
      "Codex will probe /responses over WebSocket first and can fall back to HTTP POST.",
      "Keep authentication headers handled by the Codex client itself.",
    ],
  },
};
