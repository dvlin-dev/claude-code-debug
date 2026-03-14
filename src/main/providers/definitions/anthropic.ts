import type { ProviderDefinition } from "../../../shared/contracts";

export const anthropicProvider: ProviderDefinition = {
  id: "anthropic",
  label: "Anthropic",
  defaultUpstreamBaseUrl: "https://api.anthropic.com",
  protocolAdapterId: "anthropic-messages",
  setup: {
    envVarName: "ANTHROPIC_BASE_URL",
    exampleBaseUrl: "http://127.0.0.1:8888",
    instructions: [
      "Set ANTHROPIC_BASE_URL to the local listener address.",
      "Run Claude Code normally after exporting the environment variable.",
    ],
  },
};
