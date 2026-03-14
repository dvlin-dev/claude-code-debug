import type { ProtocolAdapter } from "../../../../shared/contracts";
import { buildOpenAiResponsesInspector } from "./build-inspector";
import { normalizeOpenAiResponsesExchange } from "./normalize";
import { openaiResponsesSessionMatcher } from "./session-matcher";
import { openaiResponsesTimelineAssembler } from "./timeline-assembler";

export const openaiResponsesAdapter = {
  id: "openai-responses",
  normalize: normalizeOpenAiResponsesExchange,
  buildInspector: buildOpenAiResponsesInspector,
  sessionMatcher: openaiResponsesSessionMatcher,
  timelineAssembler: openaiResponsesTimelineAssembler,
} satisfies ProtocolAdapter;
