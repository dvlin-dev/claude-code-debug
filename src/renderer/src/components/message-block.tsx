import { useState } from "react";
import { ContentBlock } from "./content-block";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import { Copy, Check, ChevronRight } from "lucide-react";
import type {
  NormalizedMessage,
  NormalizedMessageBlock,
} from "../../../shared/contracts";

interface MessageBlockProps {
  message: NormalizedMessage;
  roundNumber?: number | null;
  rawMode?: boolean;
}

function extractText(blocks: NormalizedMessageBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }
      if (block.type === "reasoning") {
        return block.text;
      }
      if (block.type === "tool-call") {
        return `[tool-call: ${block.name}]\n${JSON.stringify(block.input, null, 2)}`;
      }
      if (block.type === "tool-result") {
        return typeof block.content === "string"
          ? block.content
          : JSON.stringify(block.content, null, 2);
      }
      return JSON.stringify(block, null, 2);
    })
    .join("\n\n");
}

function normalizeContent(message: NormalizedMessage): NormalizedMessageBlock[] {
  if (message.blocks.length > 0) {
    return message.blocks;
  }

  return [{ type: "text", text: "" }];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      className="flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function roleDotColor(role: string): string {
  switch (role) {
    case "user": return "bg-accent-brand";
    case "assistant": return "bg-emerald-500";
    case "system": return "bg-muted-foreground/50";
    case "tool": return "bg-amber-500";
    default: return "bg-foreground/30";
  }
}

function roleTextColor(role: string): string {
  switch (role) {
    case "user": return "text-accent-brand font-medium";
    case "assistant": return "text-emerald-600 dark:text-emerald-400 font-medium";
    case "system": return "text-foreground/80 font-medium";
    case "tool": return "text-amber-600 dark:text-amber-400 font-medium";
    default: return "text-muted-foreground";
  }
}

function blockTypeBadges(blocks: NormalizedMessageBlock[]): string[] {
  const types = new Set<string>();
  for (const block of blocks) {
    types.add(block.type);
  }
  return Array.from(types);
}

const BLOCK_TYPE_COLORS: Record<string, string> = {
  text: "bg-muted text-muted-foreground",
  reasoning: "bg-fuchsia-400/10 text-fuchsia-400",
  "tool-call": "bg-blue-400/10 text-blue-400",
  "tool-result": "bg-green-400/10 text-green-400",
  unknown: "bg-muted text-muted-foreground",
};

export function MessageBlock({
  message,
  roundNumber = null,
  rawMode,
}: MessageBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const copyText = rawMode
    ? JSON.stringify(message.blocks, null, 2)
    : extractText(message.blocks);

  if (rawMode) {
    return (
      <div className="p-4 space-y-2 relative group bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", roleDotColor(message.role))} />
            <span className={roleTextColor(message.role)}>{message.role.toUpperCase()}</span>
            {blockTypeBadges(message.blocks).map((t) => (
              <span key={t} className={cn("text-[10px] px-1.5 py-0 rounded-sm", BLOCK_TYPE_COLORS[t] ?? BLOCK_TYPE_COLORS.unknown)}>
                {t}
              </span>
            ))}
          </span>
          <div className="relative h-4 w-8 shrink-0">
            {roundNumber !== null && (
              <Badge
                variant="outline"
                className="absolute right-0 top-0 h-4 px-1.5 text-[10px] transition-opacity group-hover:opacity-0"
              >
                #{roundNumber}
              </Badge>
            )}
            <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100">
              <CopyButton text={copyText} />
            </div>
          </div>
        </div>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-auto">
          {JSON.stringify(message.blocks, null, 2)}
        </pre>
      </div>
    );
  }

  const contentBlocks = normalizeContent(message);
  const previewText = extractText(contentBlocks);

  return (
    <div
      className={cn(
        "p-4 space-y-2 relative group bg-card border border-border rounded-lg transition-colors",
        !expanded && "cursor-pointer hover:bg-accent/30"
      )}
      onClick={!expanded ? () => setExpanded(true) : undefined}
    >
      <div
        className={cn(
          "flex items-center justify-between",
          expanded && "sticky top-0 z-10 bg-card cursor-pointer -mx-4 -mt-4 px-4 pt-4 pb-2 border-b border-border/50 transition-colors hover:brightness-95 dark:hover:brightness-110 rounded-t-lg"
        )}
        onClick={expanded ? () => setExpanded(false) : undefined}
      >
        <span className="flex items-center gap-1.5 text-xs">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
              expanded && "rotate-90"
            )}
          />
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", roleDotColor(message.role))} />
          <span className={roleTextColor(message.role)}>{message.role.toUpperCase()}</span>
          {blockTypeBadges(message.blocks).map((t) => (
            <span key={t} className={cn("text-[10px] px-1.5 py-0 rounded-sm", BLOCK_TYPE_COLORS[t] ?? BLOCK_TYPE_COLORS.unknown)}>
              {t}
            </span>
          ))}
        </span>
        <div
          className="relative h-4 w-8 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {roundNumber !== null && (
            <Badge
              variant="outline"
              className="absolute right-0 top-0 h-4 px-1.5 text-[10px] transition-opacity group-hover:opacity-0"
            >
              #{roundNumber}
            </Badge>
          )}
          <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={copyText} />
          </div>
        </div>
      </div>
      {expanded ? (
        <div className="space-y-2 pl-1">
          {contentBlocks.map((block, i) => (
            <ContentBlock key={`${block.type}-${i}`} block={block} />
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/70 pl-1 whitespace-pre-wrap line-clamp-3 leading-relaxed">
          {previewText}
        </div>
      )}
    </div>
  );
}
