import type { ProtocolAdapter } from "../../../../shared/contracts";
import { buildAnthropicInspector } from "./build-inspector";
import { normalizeAnthropicExchange } from "./normalize";
import { anthropicSessionMatcher } from "./session-matcher";
import { anthropicTimelineAssembler } from "./timeline-assembler";

export const anthropicMessagesAdapter = {
  id: "anthropic-messages",
  normalize: normalizeAnthropicExchange,
  buildInspector: buildAnthropicInspector,
  sessionMatcher: anthropicSessionMatcher,
  timelineAssembler: anthropicTimelineAssembler,
} satisfies ProtocolAdapter;
