import { useEffect, useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useSessionStore } from "../stores/session-store";
import { useProfileStore } from "../stores/profile-store";
import { useAppStore } from "../stores/app-store";
import { cn } from "../lib/utils";

export function CommandPalette() {
  const open = useAppStore((state) => state.commandPaletteOpen);
  const setOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const sessions = useSessionStore((state) => state.sessions);
  const selectSession = useSessionStore((state) => state.selectSession);
  const clearHistory = useSessionStore((state) => state.clearHistory);
  const profiles = useProfileStore((state) => state.profiles);
  const statuses = useProfileStore((state) => state.statuses);
  const startProfile = useProfileStore((state) => state.startProfile);
  const stopProfile = useProfileStore((state) => state.stopProfile);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchingSessions = useMemo(() => {
    if (!normalizedQuery) return sessions.slice(0, 8);
    return sessions.filter((session) =>
      [session.title, session.providerLabel, session.model]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, sessions]);

  const matchingProfiles = useMemo(() => {
    if (!normalizedQuery) return profiles;
    return profiles.filter((profile) =>
      [profile.name, profile.providerId, profile.upstreamBaseUrl]
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, profiles]);

  function providerBadgeClass(providerId: string) {
    if (providerId === "anthropic") return "bg-accent-brand-muted text-accent-brand";
    if (providerId === "codex") return "bg-success-muted text-success";
    return "bg-muted text-muted-foreground";
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[30%] translate-y-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>Search sessions, profiles, or actions</DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput
            placeholder="Search sessions, profiles, or actions..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {matchingSessions.length > 0 && (
              <CommandGroup heading="Sessions">
                {matchingSessions.map((session) => (
                  <CommandItem
                    key={session.sessionId}
                    onSelect={() => {
                      selectSession(session.sessionId);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate">{session.title}</span>
                    <span className={cn("text-[11px] font-semibold px-1.5 py-0.5", providerBadgeClass(session.providerId))}>
                      {session.providerLabel}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchingProfiles.length > 0 && (
              <CommandGroup heading="Profiles">
                {matchingProfiles.map((profile) => {
                  const isRunning = statuses[profile.id]?.isRunning ?? false;
                  return (
                    <CommandItem
                      key={profile.id}
                      onSelect={() => {
                        void (isRunning
                          ? stopProfile(profile.id)
                          : startProfile(profile.id));
                        setOpen(false);
                      }}
                    >
                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", isRunning ? "bg-success" : "bg-muted-foreground/30")} />
                      <span className="flex-1 truncate">{profile.name}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">:{profile.localPort}</span>
                      <span className={cn("text-[11px]", isRunning ? "text-success" : "text-muted-foreground")}>
                        {isRunning ? "Running" : "Start"}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  void clearHistory();
                  setOpen(false);
                }}
              >
                <span className="text-destructive">Clear history</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
