import { useEffect } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";
import { ConversationHeader } from "./conversation-header";
import { ConversationView } from "./conversation-view";
import { InspectorPanel } from "./inspector-panel";
import { useSessionStore } from "../stores/session-store";
import { useTraceStore } from "../stores/trace-store";

export function MainContent() {
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);
  const loadTrace = useTraceStore((state) => state.loadTrace);
  const inspectorOpen = useTraceStore((state) => state.inspectorOpen);

  useEffect(() => {
    if (selectedSessionId) {
      void loadTrace(selectedSessionId);
    }
  }, [loadTrace, selectedSessionId]);

  if (!selectedSessionId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a session to view requests
      </div>
    );
  }

  if (inspectorOpen) {
    return (
      <div className="flex h-full flex-col">
        <ConversationHeader />
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize="65%" minSize="30%">
            <ConversationView />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize="35%" minSize="20%">
            <InspectorPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ConversationHeader />
      <div className="flex-1 overflow-hidden">
        <ConversationView />
      </div>
    </div>
  );
}
