import { useTraceStore, type ContentTab } from "../stores/trace-store";
import { cn } from "../lib/utils";

const TABS: { id: ContentTab; label: string }[] = [
  { id: "messages", label: "Messages" },
  { id: "system", label: "System" },
  { id: "tools", label: "Tools" },
  { id: "other", label: "Other" },
];

export function ContentTabBar() {
  const contentTab = useTraceStore((state) => state.contentTab);
  const setContentTab = useTraceStore((state) => state.setContentTab);

  return (
    <div className="flex gap-1 border-b px-4 pt-1 shrink-0">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          className={cn(
            "px-3 py-2 text-xs transition-colors relative",
            contentTab === id
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setContentTab(id)}
        >
          {label}
          {contentTab === id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
          )}
        </button>
      ))}
    </div>
  );
}
