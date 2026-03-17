import { Settings, Github } from "lucide-react";
import { Button } from "./ui/button";
import { ProfileDropdown } from "./profile-dropdown";

interface StatusBarProps {
  onSettingsClick: () => void;
}

export function StatusBar({ onSettingsClick }: StatusBarProps) {
  return (
    <div
      className="drag-region flex h-10 items-center border-b px-4 shrink-0 select-none"
    >
      {/* Left spacer — balances the right buttons so the center content stays centered */}
      <div className="flex-1" />

      {/* Center: Profiles */}
      <ProfileDropdown />

      {/* Right: Action Buttons */}
      <div className="flex flex-1 items-center justify-end gap-2">
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
          onClick={() => void window.electronAPI.openExternal("https://github.com/dvlin-dev/agent-trace")}
          title="GitHub"
        >
          <Github className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
