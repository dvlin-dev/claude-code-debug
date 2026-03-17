import { useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "../lib/utils";
import { SchemaFieldRenderer } from "./ui/schema-field-renderer";
import type { InspectorSection, NormalizedTool } from "../../../shared/contracts";
import { useTraceStore } from "../stores/trace-store";

function getToolsFromInspector(): NormalizedTool[] {
  const detail = useTraceStore.getState().selectedExchangeDetail;
  if (!detail) return [];
  const section = detail.inspector.sections.find(
    (s): s is Extract<InspectorSection, { kind: "tool-list" }> =>
      s.kind === "tool-list",
  );
  return section?.tools ?? [];
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
      className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ToolItem({ tool, rawMode }: { tool: NormalizedTool; rawMode: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const copyText = rawMode ? JSON.stringify(tool, null, 2) : JSON.stringify(tool, null, 2);

  if (rawMode) {
    return (
      <div className="p-4 bg-card border border-border rounded-lg relative group">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={copyText} />
        </div>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-auto">
          {JSON.stringify(tool, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className={cn(
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
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
              expanded && "rotate-90"
            )}
          />
          <span className="text-sm font-medium font-mono">{tool.name}</span>
          {!expanded && tool.description && (
            <span className="text-xs text-muted-foreground truncate">
              {tool.description}
            </span>
          )}
        </div>
        <div className={cn(
          "opacity-0 transition-opacity shrink-0",
          expanded ? "group-hover:opacity-100" : "group-hover:opacity-100"
        )} onClick={(e) => e.stopPropagation()}>
          <CopyButton text={copyText} />
        </div>
      </div>
      {expanded && (
        <div className="space-y-3 pl-1">
          {tool.description && (
            <div>
              <div
                className="flex items-center gap-1 cursor-pointer hover:bg-accent/20 -mx-2 px-2 py-1 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setDescExpanded(!descExpanded);
                }}
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                    descExpanded && "rotate-90"
                  )}
                />
                <span className="text-xs font-medium text-muted-foreground">Description</span>
              </div>
              {descExpanded && (
                <div className="text-xs text-foreground/80 mt-2 pl-5 whitespace-pre-wrap">
                  {tool.description}
                </div>
              )}
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Input Schema:</div>
            <SchemaFieldRenderer schema={tool.inputSchema} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ToolsView() {
  const rawMode = useTraceStore((state) => state.rawMode);
  const selectedDetail = useTraceStore((state) => state.selectedExchangeDetail);

  // Re-derive tools when selectedDetail changes
  const tools = selectedDetail
    ? (selectedDetail.inspector.sections.find(
        (s): s is Extract<InspectorSection, { kind: "tool-list" }> =>
          s.kind === "tool-list",
      )?.tools ?? [])
    : [];

  if (tools.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No tools defined
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-6 max-w-4xl mx-auto">
        <div className="text-xs text-muted-foreground mb-3">
          {tools.length} tool{tools.length !== 1 ? "s" : ""} defined
        </div>
        {tools.map((tool) => (
          <ToolItem key={tool.name} tool={tool} rawMode={rawMode} />
        ))}
      </div>
    </ScrollArea>
  );
}
