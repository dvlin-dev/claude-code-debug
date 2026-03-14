import { ChevronDown } from "lucide-react";
import { useProfileStore } from "../stores/profile-store";

export function ProfileSwitcher() {
  const profiles = useProfileStore((s) => s.profiles);
  const statuses = useProfileStore((s) => s.statuses);

  const runningProfile = profiles.find((p) => statuses[p.id]?.isRunning);
  const isAnyRunning = !!runningProfile;

  const displayName = runningProfile?.name ?? "No active profiles";
  const displayPort = runningProfile
    ? `:${statuses[runningProfile.id]?.port ?? runningProfile.localPort}`
    : null;

  return (
    <div className="flex items-center gap-2 border border-border bg-muted/50 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted">
      <span
        className={`inline-block h-2 w-2 rounded-full shrink-0 ${isAnyRunning ? "bg-green-500" : "bg-muted-foreground/40"}`}
      />
      <span className="truncate font-medium">{displayName}</span>
      {displayPort && (
        <span className="text-muted-foreground font-mono">{displayPort}</span>
      )}
      <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
    </div>
  );
}
