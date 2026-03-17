import { useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { ChevronRight } from "lucide-react";
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

function ToolItem({ tool, rawMode }: { tool: NormalizedTool; rawMode: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  if (rawMode) {
    return (
      <div className="p-4 bg-card border border-border">
        <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-auto">
          {JSON.stringify(tool, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border">
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
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
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
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
