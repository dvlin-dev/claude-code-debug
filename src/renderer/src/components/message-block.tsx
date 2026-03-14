import { useState } from "react";
import { ContentBlock } from "./content-block";
import { cn } from "../lib/utils";
import { Copy, Check } from "lucide-react";
import type {
  NormalizedMessage,
  NormalizedMessageBlock,
} from "../../../shared/contracts";

interface MessageBlockProps {
  message: NormalizedMessage;
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
      className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function roleDotColor(role: string): string {
  switch (role) {
    case "user": return "bg-accent-brand";
    case "system": return "bg-muted-foreground/50";
    default: return "bg-foreground/30";
  }
}

export function MessageBlock({ message, rawMode }: MessageBlockProps) {
  const copyText = rawMode
    ? JSON.stringify(message.blocks, null, 2)
    : extractText(message.blocks);

  if (rawMode) {
    return (
      <div className="p-4 space-y-2 relative group bg-card border border-border">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", roleDotColor(message.role))} />
            {message.role}
          </span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={copyText} />
          </div>
        </div>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-auto">
          {JSON.stringify(message.blocks, null, 2)}
        </pre>
      </div>
    );
  }

  const contentBlocks = normalizeContent(message);

  return (
    <div className="p-4 space-y-2 relative group bg-card border border-border">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", roleDotColor(message.role))} />
          {message.role}
        </span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={copyText} />
        </div>
      </div>
      <div className="space-y-2 pl-1">
        {contentBlocks.map((block, i) => (
          <ContentBlock key={`${block.type}-${i}`} block={block} />
        ))}
      </div>
    </div>
  );
}
