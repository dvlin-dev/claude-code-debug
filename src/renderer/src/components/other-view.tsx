import { ScrollArea } from "./ui/scroll-area";
import { ContextChip } from "./context-chip";
import type {
  ContextType,
  InspectorSection,
  NormalizedMessage,
  NormalizedMessageBlock,
} from "../../../shared/contracts";
import { useTraceStore } from "../stores/trace-store";

/** Inspector section kinds shown elsewhere */
const EXCLUDED_KINDS = new Set(["overview", "tool-list", "raw-request", "raw-response"]);
const EXCLUDED_TITLES = new Set(["Instructions"]);

function isOtherSection(section: InspectorSection): boolean {
  if (EXCLUDED_KINDS.has(section.kind)) return false;
  if (EXCLUDED_TITLES.has(section.title)) return false;
  return true;
}

const CONTEXT_LABELS: Record<string, string> = {
  "system-reminder": "System Reminder",
  "hook-output": "Hook Output",
  "skills-list": "Skills List",
  "claude-md": "CLAUDE.md Context",
  "command-context": "Command Context",
  "agent-context": "Agent Context",
  "suggestion-mode": "Suggestion Mode",
};

interface InjectedItem {
  contextType: ContextType | null;
  label: string;
  content: string;
  charCount: number;
}

function extractInjectedItems(messages: NormalizedMessage[]): InjectedItem[] {
  const items: InjectedItem[] = [];
  for (const msg of messages) {
    for (const block of msg.blocks) {
      if (block.meta?.injected && block.type === "text") {
        const ct = block.meta.contextType;
        items.push({
          contextType: ct,
          label: ct ? CONTEXT_LABELS[ct] ?? "Injected Context" : "Injected Context",
          content: block.text,
          charCount: block.meta.charCount,
        });
      }
    }
  }
  return items;
}

function SectionContent({ section }: { section: InspectorSection }) {
  if (section.kind === "text") {
    return (
      <pre className="text-xs text-foreground/75 whitespace-pre-wrap break-words leading-relaxed">
        {section.text}
      </pre>
    );
  }
  if (section.kind === "json") {
    return (
      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
        {JSON.stringify(section.json, null, 2)}
      </pre>
    );
  }
  return null;
}

export function OtherView() {
  const trace = useTraceStore((state) => state.trace);
  const selectedDetail = useTraceStore((state) => state.selectedExchangeDetail);
  const rawMode = useTraceStore((state) => state.rawMode);

  const messages = trace?.timeline.messages ?? [];
  const injectedItems = extractInjectedItems(messages);

  const inspectorSections = selectedDetail
    ? selectedDetail.inspector.sections.filter(isOtherSection)
    : [];

  if (injectedItems.length === 0 && inspectorSections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No additional data
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-6 max-w-4xl mx-auto">
        {/* Injected context blocks from messages */}
        {injectedItems.map((item, i) =>
          rawMode ? (
            <div key={`inj-${i}`} className="p-4 bg-card border border-border rounded-lg space-y-2">
              <span className="text-xs text-muted-foreground font-medium">
                {item.label}
              </span>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-auto">
                {item.content}
              </pre>
            </div>
          ) : (
            <ContextChip
              key={`inj-${i}`}
              contextType={item.contextType}
              label={item.label}
              charCount={item.charCount}
              content={item.content}
              defaultExpanded={false}
            />
          ),
        )}

        {/* Extra inspector sections */}
        {inspectorSections.map((section, i) => (
          <div key={`sec-${i}`} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {section.title}
            </div>
            {rawMode ? (
              <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-auto">
                {JSON.stringify(section, null, 2)}
              </pre>
            ) : (
              <SectionContent section={section} />
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
