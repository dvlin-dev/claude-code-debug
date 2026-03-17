import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { RequestItem } from "./request-item";
import type {
  ExchangeListItemVM,
  InspectorDocument,
  InspectorSection,
} from "../../../shared/contracts";
import { useTraceStore } from "../stores/trace-store";
import { cn } from "../lib/utils";

/** Sections kept in the inspector panel (instructions & tools moved to content tabs) */
const INSPECTOR_KINDS = new Set(["overview", "raw-response"]);

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
      resolvedInspector?.sections
        .map((section, index) => ({
          id: `section-${index}`,
          label: section.title,
          section,
        }))
        .filter(({ section }) => INSPECTOR_KINDS.has(section.kind)) ?? [],
    [resolvedInspector],
  );

  useEffect(() => {
    setActiveTab(sectionTabs[0]?.id ?? "requests");
  }, [sectionTabs]);

  return (
    <div className="flex h-full flex-col border-l max-w-full">
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
          Requests ({activeExchanges.length})
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "requests" ? (
          <ScrollArea className="h-full">
            <div className="p-2">
              {activeExchanges.map((exchange) => (
                <RequestItem
                  key={exchange.exchangeId}
                  request={exchange}
                  isSelected={exchange.exchangeId === activeSelectedExchangeId}
                  onClick={() => handleSelectExchange(exchange.exchangeId)}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          (() => {
            const tab = sectionTabs.find((t) => t.id === activeTab);
            if (!tab) return null;
            return <SectionContent section={tab.section} />;
          })()
        )}
      </div>
    </div>
  );
}

function SectionContent({ section }: { section: InspectorSection }) {
  if (section.kind === "overview") {
    return (
      <ScrollArea className="h-full">
        <div className="divide-y">
          {section.items.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2 text-xs">
              <span className="text-muted-foreground shrink-0">{label}</span>
              <span className="ml-auto font-mono truncate">
                {label === "Status" ? (
                  <StatusBadge code={value} />
                ) : label === "Provider" ? (
                  <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                    {value}
                  </Badge>
                ) : (
                  value
                )}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (section.kind === "raw-request" || section.kind === "raw-response") {
    return <RawSection content={section.content} />;
  }

  if (section.kind === "text") {
    return (
      <ScrollArea className="h-full">
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
          {section.text}
        </pre>
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

  return null;
}

function StatusBadge({ code }: { code: string }) {
  const num = Number(code);
  const variant =
    num >= 200 && num < 300
      ? "success"
      : num >= 400 && num < 500
        ? "warning"
        : num >= 500
          ? "destructive"
          : ("secondary" as const);
  return (
    <Badge variant={variant} className="text-[11px] px-1.5 py-0">
      {code}
    </Badge>
  );
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
