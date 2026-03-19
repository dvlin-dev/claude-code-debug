import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";
import { ConversationHeader } from "./conversation-header";
import { ContentTabBar } from "./content-tab-bar";
import { ConversationView } from "./conversation-view";
import { SystemView } from "./system-view";
import { ToolsView } from "./tools-view";
import { OtherView } from "./other-view";
import { DashboardView } from "./dashboard-view";
import { InspectorPanel } from "./inspector-panel";
import { useSessionStore } from "../stores/session-store";
import { useTraceStore } from "../stores/trace-store";
import { useProfileStore } from "../stores/profile-store";
import { PROVIDERS } from "../features/profiles/constants";
import { cn } from "../lib/utils";

function WaitingGuide() {
  const profiles = useProfileStore((s) => s.profiles);
  const statuses = useProfileStore((s) => s.statuses);
  const [copied, setCopied] = useState(false);

  const activeProfile = profiles.find((p) => statuses[p.id]?.isRunning) ?? profiles[0];
  const provider = activeProfile
    ? PROVIDERS.find((p) => p.id === activeProfile.providerId)
    : undefined;

  const port = activeProfile
    ? statuses[activeProfile.id]?.port ?? activeProfile.localPort
    : null;

  const exportCmd = provider && port
    ? `export ${provider.envVar}=http://127.0.0.1:${port}`
    : null;

  function handleCopy() {
    if (!exportCmd) return;
    navigator.clipboard.writeText(exportCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-5 text-center max-w-sm">
        {/* Pulse indicator */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-30" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-xs text-success font-medium">
            Waiting for first request...
          </span>
        </div>

        {exportCmd && (
          <div className="w-full space-y-3 text-left">
            {/* Step 1 */}
            <div className="flex gap-2.5 text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent-brand text-white text-[10px] font-bold shrink-0 mt-0.5">
                1
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium mb-2">Set the environment variable</div>
                <div className="border border-border bg-[#0a0a0a] p-2.5 rounded-md">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-success font-mono flex-1 min-w-0 overflow-x-auto">
                      {exportCmd}
                    </code>
                    <button
                      className="shrink-0 flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200 px-2 py-1 border border-neutral-700 bg-neutral-800 rounded-sm transition-colors"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-2.5 text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent-brand text-white text-[10px] font-bold shrink-0 mt-0.5">
                2
              </span>
              <div>
                <div className="text-sm font-medium mb-0.5">
                  Use {provider?.label ?? "your agent"} as usual
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Traffic will appear here automatically.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MainContent() {
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const loadTrace = useTraceStore((state) => state.loadTrace);
  const inspectorOpen = useTraceStore((state) => state.inspectorOpen);
  const contentTab = useTraceStore((state) => state.contentTab);

  useEffect(() => {
    if (selectedSessionId) {
      void loadTrace(selectedSessionId);
    }
  }, [loadTrace, selectedSessionId]);

  // No sessions at all — show onboarding guide
  if (sessions.length === 0) {
    return <WaitingGuide />;
  }

  // Sessions exist but none selected
  if (!selectedSessionId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a session to view requests
      </div>
    );
  }

  const contentArea = (
    <>
      <div className={cn("h-full", contentTab !== "messages" && "hidden")}><ConversationView /></div>
      <div className={cn("h-full", contentTab !== "system" && "hidden")}><SystemView /></div>
      <div className={cn("h-full", contentTab !== "tools" && "hidden")}><ToolsView /></div>
      <div className={cn("h-full", contentTab !== "other" && "hidden")}><OtherView /></div>
      <div className={cn("h-full", contentTab !== "dashboard" && "hidden")}><DashboardView /></div>
    </>
  );

  if (inspectorOpen) {
    return (
      <div className="flex h-full flex-col">
        <ConversationHeader />
        <ContentTabBar />
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize="65%" minSize="40%">
            {contentArea}
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize="35%" minSize="25%">
            <InspectorPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ConversationHeader />
      <ContentTabBar />
      <div className="flex-1 overflow-hidden">
        {contentArea}
      </div>
    </div>
  );
}
