import type {
  NormalizedExchange,
  NormalizedMessage,
  SessionTimeline,
  TimelineAssembler,
} from "../../../../shared/contracts";

function fingerprint(message: NormalizedMessage): string {
  return JSON.stringify(message);
}

export const openaiResponsesTimelineAssembler: TimelineAssembler = {
  build(exchanges: NormalizedExchange[]): SessionTimeline {
    const messages: NormalizedMessage[] = [];
    const seenSystemMessages = new Set<string>();

    for (const exchange of exchanges) {
      for (const message of exchange.request.inputMessages) {
        if (message.role === "system") {
          const key = fingerprint(message);
          if (seenSystemMessages.has(key)) {
            continue;
          }
          seenSystemMessages.add(key);
        }
        messages.push(message);
      }

      messages.push(...exchange.response.outputMessages);
    }

    return { messages };
  },
};
