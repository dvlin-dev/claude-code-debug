import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useTraceStore } from "../stores/trace-store";
import { useProfileStore } from "../stores/profile-store";
import { Code, PanelRight } from "lucide-react";
import { cn } from "../lib/utils";
import { stripXmlTags } from "../../../shared/strip-xml";

export function ConversationHeader() {
  const trace = useTraceStore((state) => state.trace);
  const rawMode = useTraceStore((state) => state.rawMode);
  const inspectorOpen = useTraceStore((state) => state.inspectorOpen);
  const toggleRawMode = useTraceStore((state) => state.toggleRawMode);
  const toggleInspector = useTraceStore((state) => state.toggleInspector);

  const profiles = useProfileStore((s) => s.profiles);
  const statuses = useProfileStore((s) => s.statuses);
  const runningProfile = profiles.find((p) => statuses[p.id]?.isRunning);

  const model = trace?.exchanges.at(-1)?.model ?? null;
  const title = trace ? stripXmlTags(trace.title) : "Conversation";

  return (
    <div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
      <h2 className="text-sm font-medium truncate flex-1">{title}</h2>
      {model && (
        <Badge variant="secondary" className="text-[11px] px-1.5 py-0 shrink-0">
          {model}
        </Badge>
      )}
      {runningProfile && (
        <span className="text-[11px] font-mono text-muted-foreground">
          127.0.0.1:{statuses[runningProfile.id]?.port ?? runningProfile.localPort}
        </span>
      )}
      <Button
        variant={rawMode ? "default" : "ghost"}
        size="sm"
        className="h-7 text-xs gap-1 shrink-0"
        onClick={toggleRawMode}
      >
        <Code className="h-3 w-3" />
        Raw
      </Button>
      <Button
        variant={inspectorOpen ? "default" : "ghost"}
        size="sm"
        className={cn("h-7 text-xs gap-1 shrink-0")}
        onClick={toggleInspector}
      >
        <PanelRight className="h-3 w-3" />
        Inspector
      </Button>
    </div>
  );
}
