import { useEffect, useRef } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { MessageBlock } from "./message-block";
import type { NormalizedBlock, SessionTimeline } from "../../../shared/contracts";
import { useTraceStore } from "../stores/trace-store";

const EMPTY_INSTRUCTIONS: NormalizedBlock[] = [];

interface ConversationViewProps {
  timeline?: SessionTimeline;
  rawMode?: boolean;
}

export function ConversationView({ timeline, rawMode }: ConversationViewProps) {
  const storeTrace = useTraceStore((state) => state.trace);
  const storeRawMode = useTraceStore((state) => state.rawMode);
  const instructions = useTraceStore((state) => state.trace?.instructions ?? EMPTY_INSTRUCTIONS);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeTimeline = timeline ?? storeTrace?.timeline ?? { messages: [] };
  const activeRawMode = rawMode ?? storeRawMode;
  const messages = activeTimeline.messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No messages to display
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4 max-w-3xl mx-auto">
        {instructions.length > 0 && (
          <div className="max-w-3xl mx-auto mb-4 p-3 bg-cyan-500/5 border border-cyan-500/10">
            <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-1.5">
              System Instructions
            </div>
            <div className="text-xs text-muted-foreground line-clamp-3">
              {instructions.filter((b: NormalizedBlock) => b.type === "text").map((b: NormalizedBlock) => (b as { type: "text"; text: string }).text).join("\n")}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBlock key={i} message={msg} rawMode={activeRawMode} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
