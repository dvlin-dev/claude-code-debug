import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { RequestItem } from "./request-item";
import type {
  ExchangeListItemVM,
  InspectorDocument,
  InspectorSection,
} from "../../../shared/contracts";
import { useTraceStore } from "../stores/trace-store";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

interface InspectorPanelProps {
  inspector?: InspectorDocument | null;
  exchanges?: ExchangeListItemVM[];
  selectedExchangeId?: string | null;
  onSelectExchange?: (id: string | null) => void | Promise<void>;
  onClose?: () => void;
}

export function InspectorPanel({
  inspector,
  exchanges,
  selectedExchangeId,
  onSelectExchange,
  onClose,
}: InspectorPanelProps) {
  const trace = useTraceStore((state) => state.trace);
  const selectedDetail = useTraceStore((state) => state.selectedExchangeDetail);
  const exchangeDetails = useTraceStore((state) => state.exchangeDetails);
  const storeSelectedExchangeId = useTraceStore((state) => state.selectedExchangeId);
  const storeSelectExchange = useTraceStore((state) => state.selectExchange);
  const toggleInspector = useTraceStore((state) => state.toggleInspector);
  const activeSelectedExchangeId =
    selectedExchangeId ?? storeSelectedExchangeId ?? null;
  const fallbackDetail =
    activeSelectedExchangeId ? exchangeDetails[activeSelectedExchangeId] ?? null : null;
  const activeExchanges = exchanges ?? trace?.exchanges ?? [];
  const resolvedInspector =
    inspector ?? selectedDetail?.inspector ?? fallbackDetail?.inspector ?? null;
  const handleSelectExchange = onSelectExchange ?? storeSelectExchange;
  const [activeTab, setActiveTab] = useState<string>("requests");

  const sectionTabs = useMemo(
    () =>
      resolvedInspector?.sections.map((section, index) => ({
        id: `section-${index}`,
        label: section.title,
        section,
      })) ?? [],
    [resolvedInspector],
  );

  useEffect(() => {
    setActiveTab(sectionTabs[0]?.id ?? "requests");
  }, [sectionTabs]);

  return (
    <div className="flex h-full flex-col border-l">
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <span className="text-xs font-medium">Inspector</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose ?? toggleInspector}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex gap-1 border-b px-3 py-2 shrink-0 overflow-x-auto">
        {sectionTabs.map(({ id, label }) => (
          <button
            key={id}
            className={cn(
              "px-2 py-1 text-xs whitespace-nowrap transition-colors",
              activeTab === id
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
        <button
          className={cn(
            "px-2 py-1 text-xs whitespace-nowrap transition-colors",
            activeTab === "requests"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
          onClick={() => setActiveTab("requests")}
        >
          {`Requests (${activeExchanges.length})`}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "requests" && (
          <RequestListSection
            requests={activeExchanges}
            selectedExchangeId={activeSelectedExchangeId}
            onSelect={handleSelectExchange}
          />
        )}
        {activeTab !== "requests" && (
          <InspectorSectionView
            section={
              sectionTabs.find((entry) => entry.id === activeTab)?.section ?? null
            }
          />
        )}
      </div>
    </div>
  );
}

function RequestListSection({
  requests,
  selectedExchangeId,
  onSelect,
}: {
  requests: ExchangeListItemVM[];
  selectedExchangeId: string | null;
  onSelect: (id: string | null) => void | Promise<void>;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-0.5 p-2">
        {requests.map((req) => (
          <RequestItem
            key={req.exchangeId}
            request={req}
            isSelected={req.exchangeId === selectedExchangeId}
            onClick={() => void onSelect(req.exchangeId)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function statusBadgeColor(value: string): string {
  if (value.startsWith("2")) return "text-success bg-success-muted";
  if (value.startsWith("4")) return "text-warning bg-warning-muted";
  if (value.startsWith("5")) return "text-destructive bg-destructive/10";
  return "text-muted-foreground bg-muted";
}

function providerBadgeColor(value: string): string {
  if (value === "Anthropic") return "bg-accent-brand-muted text-accent-brand";
  if (value === "Codex") return "bg-success-muted text-success";
  return "text-muted-foreground bg-muted";
}

function OverviewSection({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  const tokenItems = items.filter((item) => item.label.includes("Tokens"));
  const otherItems = items.filter((item) => !item.label.includes("Tokens"));

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        {otherItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 border px-3 py-2 text-sm"
          >
            <span className="text-muted-foreground">{item.label}</span>
            {item.label === "Status" ? (
              <span
                className={cn(
                  "font-medium px-1.5 py-0.5 text-xs",
                  statusBadgeColor(item.value),
                )}
              >
                {item.value}
              </span>
            ) : item.label === "Provider" ? (
              <span
                className={cn(
                  "font-medium px-1.5 py-0.5 text-xs",
                  providerBadgeColor(item.value),
                )}
              >
                {item.value}
              </span>
            ) : (
              <span className="font-medium">{item.value}</span>
            )}
          </div>
        ))}
        {tokenItems.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {tokenItems.map((item) => (
              <div
                key={item.label}
                className="border border-border bg-muted/30 p-2.5"
              >
                <div className="text-base font-bold font-mono tabular-nums">
                  {item.value}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function InspectorSectionView({
  section,
}: {
  section: InspectorSection | null;
}) {
  if (!section) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        No inspector section
      </div>
    );
  }

  if (section.kind === "overview") {
    return <OverviewSection items={section.items} />;
  }

  if (section.kind === "text") {
    return (
      <ScrollArea className="h-full">
        <pre className="p-3 text-xs whitespace-pre-wrap">{section.text}</pre>
      </ScrollArea>
    );
  }

  if (section.kind === "tool-list") {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-2 p-3">
          <Badge variant="secondary" className="text-xs">
            {section.tools.length} tools
          </Badge>
          {section.tools.map((tool) => (
            <div key={tool.name} className="border px-3 py-2">
              <div className="font-mono text-xs font-medium">{tool.name}</div>
              {tool.description ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {tool.description}
                </p>
              ) : null}
              <pre className="mt-2 text-xs overflow-auto">
                {JSON.stringify(tool.inputSchema, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (section.kind === "json") {
    return (
      <ScrollArea className="h-full">
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(section.json, null, 2)}
        </pre>
      </ScrollArea>
    );
  }

  return <RawSection content={section.content} />;
}

function RawSection({ content }: { content: string | null }) {
  if (!content) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        No data
      </div>
    );
  }

  let displayContent = content;
  try {
    displayContent = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // ignore non-json payloads
  }

  return (
    <ScrollArea className="h-full">
      <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
        {displayContent}
      </pre>
    </ScrollArea>
  );
}
