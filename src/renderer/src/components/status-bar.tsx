import { Settings } from "lucide-react";
import { Button } from "./ui/button";
import { useProfileStore } from "../stores/profile-store";
import { useSessionStore } from "../stores/session-store";
import { useAppStore } from "../stores/app-store";

interface StatusBarProps {
  onSettingsClick: () => void;
}

export function StatusBar({ onSettingsClick }: StatusBarProps) {
  const profiles = useProfileStore((state) => state.profiles);
  const statuses = useProfileStore((state) => state.statuses);
  const sessions = useSessionStore((state) => state.sessions);
  const toggleCommandPalette = useAppStore((state) => state.toggleCommandPalette);

  const runningProfiles = profiles.filter(
    (profile) => statuses[profile.id]?.isRunning,
  );
  const runningProfile = runningProfiles[0] ?? null;
  const primaryPort = runningProfile
    ? statuses[runningProfile.id]?.port ?? runningProfile.localPort
    : null;

  return (
    <div className="drag-region flex h-10 items-center justify-between border-b px-4 shrink-0">
      <span className="pl-16 text-xs font-semibold">Agent Trace</span>

      <div className="flex items-center gap-2">
        {primaryPort ? (
          <span className="flex items-center gap-1.5 border border-border px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_4px_rgba(52,211,153,0.4)]" />
            <span className="uppercase tracking-wider font-medium text-success">Listening</span>
            <span className="text-muted-foreground/70">:{primaryPort}</span>
          </span>
        ) : profiles.length > 0 ? (
          <span className="flex items-center gap-1.5 border border-border px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
            Stopped
          </span>
        ) : null}

        <span className="h-4 w-px bg-border" />

        <span className="text-[11px] text-muted-foreground">
          {sessions.length} sessions
        </span>

        <span className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSettingsClick}
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
        <button
          className="border border-border px-1.5 py-0.5 text-xs font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={toggleCommandPalette}
          title="Command palette"
        >
          ⌘K
        </button>
      </div>
    </div>
  );
}
