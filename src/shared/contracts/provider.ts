export type ProviderId = "anthropic" | "codex";

export type ProtocolAdapterId = "anthropic-messages" | "openai-responses";

export interface ProviderSetupDescriptor {
  envVarName?: string;
  exampleBaseUrl?: string;
  instructions: string[];
}

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  defaultUpstreamBaseUrl: string;
  protocolAdapterId: ProtocolAdapterId;
  setup: ProviderSetupDescriptor;
}
