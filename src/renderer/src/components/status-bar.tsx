import { Settings, Github, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

interface StatusBarProps {
  onSettingsClick: () => void;
}

export function StatusBar({ onSettingsClick }: StatusBarProps) {
  return (
    <div className="drag-region flex h-10 items-center justify-between border-b px-4 shrink-0">
      <span className="pl-16 text-xs font-semibold">Agent Trace</span>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSettingsClick}
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => window.open("https://github.com/dvlin-dev/agent-trace", "_blank")}
          title="GitHub"
        >
          <Github className="h-3.5 w-3.5" />
        </Button>
        <button
          className="flex items-center gap-1 border border-accent-brand/30 bg-accent-brand-muted px-2 py-0.5 text-[11px] font-medium text-accent-brand hover:bg-accent-brand/20 transition-colors"
          onClick={() => window.open("https://moryflow.com", "_blank")}
          title="Moryflow — Local-first AI Agent Workspace"
        >
          <Sparkles className="h-3 w-3" />
          New
        </button>
      </div>
    </div>
  );
}
