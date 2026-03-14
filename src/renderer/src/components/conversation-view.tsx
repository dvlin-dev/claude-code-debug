import { useEffect, useMemo, useRef } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { MessageBlock } from "./message-block";
import { ContextChip } from "./context-chip";
import type {
  ContextType,
  NormalizedBlock,
  NormalizedMessage,
  NormalizedMessageBlock,
  SessionTimeline,
} from "../../../shared/contracts";
import { useTraceStore } from "../stores/trace-store";

const EMPTY_INSTRUCTIONS: NormalizedBlock[] = [];

type RenderItem =
  | {
      kind: "context-group";
      contextType: ContextType | null;
      label: string;
      blocks: NormalizedMessageBlock[];
      totalChars: number;
    }
  | { kind: "message"; message: NormalizedMessage };

const CONTEXT_LABELS: Record<string, string> = {
  "system-reminder": "System Reminder",
  "hook-output": "Hook Output",
  "skills-list": "Skills List",
  "claude-md": "CLAUDE.md Context",
};

function buildRenderItems(messages: NormalizedMessage[]): RenderItem[] {
  const items: RenderItem[] = [];

  for (const msg of messages) {
    const injectedGroups: Array<{
      contextType: ContextType | null;
      blocks: NormalizedMessageBlock[];
      totalChars: number;
    }> = [];
    const organicBlocks: NormalizedMessageBlock[] = [];

    let currentGroup: (typeof injectedGroups)[number] | null = null;

    for (const block of msg.blocks) {
      if (block.meta?.injected) {
        const ct = block.meta.contextType;
        if (currentGroup && currentGroup.contextType === ct) {
          currentGroup.blocks.push(block);
          currentGroup.totalChars += block.meta.charCount;
        } else {
          if (currentGroup) injectedGroups.push(currentGroup);
          currentGroup = {
            contextType: ct,
            blocks: [block],
            totalChars: block.meta.charCount,
          };
        }
      } else {
        if (currentGroup) {
          injectedGroups.push(currentGroup);
          currentGroup = null;
        }
        organicBlocks.push(block);
      }
    }
    if (currentGroup) injectedGroups.push(currentGroup);

    // Emit context groups first, then the organic message (if any)
    for (const group of injectedGroups) {
      items.push({
        kind: "context-group",
        contextType: group.contextType,
        label: CONTEXT_LABELS[group.contextType ?? ""] ?? "Injected Context",
        blocks: group.blocks,
        totalChars: group.totalChars,
      });
    }

    if (organicBlocks.length > 0) {
      items.push({
        kind: "message",
        message: { ...msg, blocks: organicBlocks },
      });
    }
  }

  return items;
}

function extractGroupContent(blocks: NormalizedMessageBlock[]): string {
  return blocks
    .map((b) => (b.type === "text" ? b.text : `[${b.type}]`))
    .join("\n\n");
}

interface ConversationViewProps {
  timeline?: SessionTimeline;
  rawMode?: boolean;
}

export function ConversationView({ timeline, rawMode }: ConversationViewProps) {
  const storeTrace = useTraceStore((state) => state.trace);
  const storeRawMode = useTraceStore((state) => state.rawMode);
  const instructions = useTraceStore(
    (state) => state.trace?.instructions ?? EMPTY_INSTRUCTIONS,
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeTimeline = timeline ?? storeTrace?.timeline ?? { messages: [] };
  const activeRawMode = rawMode ?? storeRawMode;
  const messages = activeTimeline.messages;

  const renderItems = useMemo(() => buildRenderItems(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No messages to display
      </div>
    );
  }

  const instructionsText = instructions
    .filter((b: NormalizedBlock) => b.type === "text")
    .map((b: NormalizedBlock) => (b as { type: "text"; text: string }).text)
    .join("\n");

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-6 max-w-4xl mx-auto">
        {instructions.length > 0 && (
          <ContextChip
            contextType="system-reminder"
            label="System Instructions"
            charCount={instructionsText.length}
            content={instructionsText}
            defaultExpanded={false}
          />
        )}
        {renderItems.map((item, i) =>
          item.kind === "context-group" ? (
            <ContextChip
              key={`ctx-${i}`}
              contextType={item.contextType}
              label={item.label}
              charCount={item.totalChars}
              content={extractGroupContent(item.blocks)}
              defaultExpanded={false}
            />
          ) : (
            <MessageBlock
              key={`msg-${i}`}
              message={item.message}
              rawMode={activeRawMode}
            />
          ),
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
