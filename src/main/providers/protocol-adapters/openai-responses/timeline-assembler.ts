import type {
  NormalizedExchange,
  NormalizedMessage,
  SessionTimeline,
  TimelineAssembler,
} from "../../../../shared/contracts";
import { annotateTimeline } from "../shared/annotate-blocks";

function fingerprint(message: NormalizedMessage): string {
  return JSON.stringify(message);
}

export const openaiResponsesTimelineAssembler: TimelineAssembler = {
  build(exchanges: NormalizedExchange[]): SessionTimeline {
    const messages: NormalizedMessage[] = [];
    // Track messages from previous exchanges only.
    // Within each exchange, new input messages that match a prior output
    // are echoed history — safe to skip.  But truly new messages (even if
    // their text was seen before) are kept, preserving repeated user turns.
    const priorMessages = new Set<string>();

    for (const exchange of exchanges) {
      for (const message of exchange.request.inputMessages) {
        const key = fingerprint(message);
        if (priorMessages.has(key)) {
          continue;
        }
        messages.push(message);
      }

      for (const message of exchange.response.outputMessages) {
        messages.push(message);
      }

      // After processing the exchange, add ALL its messages to the prior set
      // so the *next* exchange can skip them if echoed back.
      for (const message of exchange.request.inputMessages) {
        priorMessages.add(fingerprint(message));
      }
      for (const message of exchange.response.outputMessages) {
        priorMessages.add(fingerprint(message));
      }
    }

    return { messages: annotateTimeline(messages) };
  },
};
