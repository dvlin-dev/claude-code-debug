import { useState } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "../components/ui/resizable";
import { StatusBar } from "../components/status-bar";
import { SessionSidebar } from "../components/session-sidebar";
import { MainContent } from "../components/main-content";
import { SettingsDialog } from "../components/settings-dialog";
import { CommandPalette } from "../components/command-palette";
import { KeyboardNavigator } from "../components/keyboard-navigator";
import { useProxyEvents } from "../hooks/use-proxy-events";

export function WorkspacePage() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useProxyEvents();

  return (
    <KeyboardNavigator>
      <div className="flex h-screen flex-col">
        <StatusBar onSettingsClick={() => setSettingsOpen(true)} />
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize="25%" minSize="15%" maxSize="40%">
              <SessionSidebar />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize="75%">
              <MainContent />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <CommandPalette />
      </div>
    </KeyboardNavigator>
  );
}
