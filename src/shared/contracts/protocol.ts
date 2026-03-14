import type { CapturedExchange } from "./capture";
import type { InspectorDocument } from "./inspector";
import type { NormalizedExchange } from "./normalized";
import type { ProtocolAdapterId } from "./provider";
import type { SessionMatcher, TimelineAssembler } from "./session";

export interface ProtocolAdapter {
  id: ProtocolAdapterId;
  normalize(exchange: CapturedExchange): NormalizedExchange;
  buildInspector(
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
  ): InspectorDocument;
  sessionMatcher: SessionMatcher;
  timelineAssembler: TimelineAssembler;
}
