import { ScrollArea } from "./ui/scroll-area";
import { MarkdownRenderer } from "./ui/markdown-renderer";
import type { NormalizedBlock } from "../../../shared/contracts";
import { useTraceStore } from "../stores/trace-store";

const EMPTY_INSTRUCTIONS: NormalizedBlock[] = [];

export function SystemView() {
  const instructions = useTraceStore(
    (state) => state.trace?.instructions ?? EMPTY_INSTRUCTIONS,
  );
  const rawMode = useTraceStore((state) => state.rawMode);

  const text = instructions
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  if (!text) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No system instructions
      </div>
    );
  }

  if (rawMode) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 max-w-4xl mx-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-auto">
            {JSON.stringify(instructions, null, 2)}
          </pre>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-6 max-w-4xl mx-auto">
        <div className="bg-card border border-border p-4 overflow-visible">
          {rawMode ? (
            <pre className="text-sm whitespace-pre-wrap break-words font-mono">
              {text}
            </pre>
          ) : (
            <MarkdownRenderer content={text} />
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
