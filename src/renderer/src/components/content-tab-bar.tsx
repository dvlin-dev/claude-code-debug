import { ArrowUpDown } from "lucide-react";
import { Button } from "./ui/button";
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
  const messageOrder = useTraceStore((state) => state.messageOrder);
  const setContentTab = useTraceStore((state) => state.setContentTab);
  const toggleMessageOrder = useTraceStore((state) => state.toggleMessageOrder);

  return (
    <div className="relative flex gap-1 border-b px-4 pt-1 shrink-0">
      <div className="flex gap-1">
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
      <div className="absolute right-4 bottom-1">
        {contentTab === "messages" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 shrink-0"
            onClick={toggleMessageOrder}
            title={messageOrder === "asc" ? "Show newest first" : "Show oldest first"}
          >
            <ArrowUpDown className="h-3 w-3" />
            {messageOrder === "asc" ? "Oldest first" : "Newest first"}
          </Button>
        )}
      </div>
    </div>
  );
}
