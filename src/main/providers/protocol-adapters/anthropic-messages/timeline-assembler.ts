import type { NormalizedExchange, SessionTimeline, TimelineAssembler } from "../../../../shared/contracts";

function buildSnapshotTimeline(exchanges: NormalizedExchange[]): SessionTimeline {
  const last = exchanges[exchanges.length - 1];
  if (!last) {
    return { messages: [] };
  }

  return {
    messages: [
      ...last.request.inputMessages,
      ...last.response.outputMessages,
    ],
  };
}

export const anthropicTimelineAssembler: TimelineAssembler = {
  build(exchanges) {
    return buildSnapshotTimeline(exchanges);
  },
};
