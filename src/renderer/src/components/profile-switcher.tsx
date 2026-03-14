import { useState } from "react";
import { useProfileStore } from "../stores/profile-store";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import type { ProviderId } from "../../../shared/contracts";

function providerTag(providerId: ProviderId): { label: string; className: string } {
  switch (providerId) {
    case "anthropic":
      return { label: "AN", className: "bg-orange-500/10 text-orange-500" };
    case "codex":
      return { label: "CX", className: "bg-emerald-500/10 text-emerald-500" };
  }
}

export function ProfileSwitcher() {
  const profiles = useProfileStore((s) => s.profiles);
  const statuses = useProfileStore((s) => s.statuses);
  const startProfile = useProfileStore((s) => s.startProfile);
  const stopProfile = useProfileStore((s) => s.stopProfile);

  if (profiles.length === 0) {
    return (
      <div className="px-2 py-3 text-center text-[10px] text-muted-foreground">
        No profiles configured
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {profiles.map((profile) => (
        <ProfileRow
          key={profile.id}
          name={profile.name}
          providerId={profile.providerId}
          port={statuses[profile.id]?.port ?? profile.localPort}
          isRunning={statuses[profile.id]?.isRunning ?? false}
          onToggle={async () => {
            try {
              if (statuses[profile.id]?.isRunning) {
                await stopProfile(profile.id);
              } else {
                await startProfile(profile.id);
              }
            } catch (error) {
              toast.error("Profile Error", {
                description: error instanceof Error ? error.message : String(error),
              });
            }
          }}
        />
      ))}
    </div>
  );
}

interface ProfileRowProps {
  name: string;
  providerId: ProviderId;
  port: number;
  isRunning: boolean;
  onToggle: () => void;
}

function ProfileRow({ name, providerId, port, isRunning, onToggle }: ProfileRowProps) {
  const [hovered, setHovered] = useState(false);
  const tag = providerTag(providerId);

  return (
    <div className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-muted/50 transition-colors">
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full shrink-0",
          isRunning ? "bg-emerald-500 shadow-[0_0_4px_rgba(52,211,153,0.4)]" : "bg-muted-foreground/30",
        )}
      />
      <span className={cn("text-[8px] font-bold shrink-0 px-1", tag.className)}>
        {tag.label}
      </span>
      <span className="text-[10px] font-medium truncate flex-1">{name}</span>
      <span className="text-[9px] font-mono text-muted-foreground shrink-0">:{port}</span>
      <button
        className={cn(
          "text-[9px] px-1.5 py-0.5 border shrink-0 min-w-[50px] text-center transition-all",
          isRunning
            ? hovered
              ? "text-red-400 border-red-400/30 bg-red-400/10"
              : "text-emerald-500 border-emerald-500/25 bg-emerald-500/10"
            : hovered
              ? "text-emerald-500 border-emerald-500/25 bg-emerald-500/10"
              : "text-muted-foreground border-border",
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onToggle}
      >
        {isRunning ? (hovered ? "Stop" : "Listening") : "Start"}
      </button>
    </div>
  );
}
