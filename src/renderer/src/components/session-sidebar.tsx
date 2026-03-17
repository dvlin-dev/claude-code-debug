import { useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { SessionItem } from "./session-item";
import { EmptyState } from "./empty-state";
import { useSessionStore } from "../stores/session-store";
import { cn } from "../lib/utils";

const PROVIDER_TABS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Anthropic", value: "anthropic" },
  { label: "Codex", value: "codex" },
];

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  if (date >= startOfWeek) return "This Week";
  return "Earlier";
}

const DATE_GROUP_ORDER = ["Today", "Yesterday", "This Week", "Earlier"];

export function SessionSidebar() {
  const {
    sessions,
    selectedSessionId,
    searchQuery,
    providerFilter,
    loadSessions,
    selectSession,
    setSearchQuery,
    setProviderFilter,
  } = useSessionStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filtered = useMemo(() => {
    let result = sessions;

    if (providerFilter) {
      result = result.filter((s) => s.providerId === providerFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.providerLabel.toLowerCase().includes(q) ||
          (s.model && s.model.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [sessions, searchQuery, providerFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const session of filtered) {
      const group = getDateGroup(session.updatedAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(session);
    }
    return DATE_GROUP_ORDER
      .filter((g) => groups[g]?.length)
      .map((g) => ({ label: g, sessions: groups[g] }));
  }, [filtered]);

  return (
    <div className="flex h-full flex-col border-r border-border overflow-hidden select-none">
      {/* Search & Filter */}
      <div className="p-3 space-y-3 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>

        <div className="flex gap-1">
          {PROVIDER_TABS.map((tab) => (
            <button
              key={tab.label}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors rounded-md",
                providerFilter === tab.value
                  ? "bg-accent-brand-muted text-accent-brand"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => setProviderFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Session List */}
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div>
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="px-4 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 bg-muted/30">
                  {group.label}
                </div>
                <div>
                  {group.sessions.map((session) => (
                    <SessionItem
                      key={session.sessionId}
                      session={session}
                      isSelected={session.sessionId === selectedSessionId}
                      onClick={() => selectSession(session.sessionId)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
