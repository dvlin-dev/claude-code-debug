import { useState } from "react";
import { cn } from "../lib/utils";
import { ChevronRight } from "lucide-react";
import type { NormalizedMessageBlock } from "../../../shared/contracts";

interface ContentBlockProps {
  block: NormalizedMessageBlock;
}

export function ContentBlock({ block }: ContentBlockProps) {
  const [expanded, setExpanded] = useState(false);

  if (block.type === "text") {
    const text = block.text ?? "";
    const isLong = text.length > 200;

    return (
      <div className="text-sm whitespace-pre-wrap">
        {isLong && !expanded ? (
          <>
            {text.slice(0, 200)}...
            <button
              className="ml-1 text-xs text-primary hover:underline"
              onClick={() => setExpanded(true)}
            >
              Show more
            </button>
          </>
        ) : (
          text
        )}
        {isLong && expanded && (
          <button
            className="ml-1 text-xs text-primary hover:underline"
            onClick={() => setExpanded(false)}
          >
            Show less
          </button>
        )}
      </div>
    );
  }

  if (block.type === "reasoning") {
    return (
      <div
        className="border-l-2 border-fuchsia-400/60 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <ChevronRight
            className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
          />
          Thinking
        </div>
        {expanded && (
          <div className="px-3 pb-2 text-sm whitespace-pre-wrap">
            {block.text}
          </div>
        )}
      </div>
    );
  }

  if (block.type === "tool-call") {
    return (
      <div
        className="border-l-2 border-muted-foreground/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <ChevronRight
            className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
          />
          {block.name}
        </div>
        {expanded && (
          <pre className="px-3 pb-2 text-xs overflow-auto">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (block.type === "tool-result") {
    const content =
      typeof block.content === "string"
        ? block.content
        : JSON.stringify(block.content, null, 2);
    const isLong = content.length > 200;
    const hasError = !!block.isError;

    return (
      <div
        className={cn(
          "border-l-2 cursor-pointer",
          hasError ? "border-destructive" : "border-success",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <ChevronRight
            className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
          />
          {hasError ? "Error" : "Result"}
        </div>
        {expanded && (
          <pre className="px-3 pb-2 text-xs overflow-auto whitespace-pre-wrap">
            {content}
          </pre>
        )}
        {!expanded && isLong && (
          <div className="px-3 pb-1.5 text-xs text-muted-foreground truncate">
            {content.slice(0, 100)}...
          </div>
        )}
      </div>
    );
  }

  // Fallback for unknown types
  return (
    <div className="text-sm text-muted-foreground">
      [{block.type}] {JSON.stringify(block)}
    </div>
  );
}
