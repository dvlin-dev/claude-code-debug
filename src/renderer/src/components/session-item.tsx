import { Badge } from "./ui/badge";
import type { SessionListItemVM } from "../../../shared/contracts";
import { cn } from "../lib/utils";
import { stripXmlTags } from "../../../shared/strip-xml";

interface SessionItemProps {
  session: SessionListItemVM;
  isSelected: boolean;
  onClick: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getProviderBadgeClasses(providerId: string): string {
  switch (providerId) {
    case "anthropic":
      return "bg-accent-brand-muted text-accent-brand";
    case "codex":
      return "bg-success-muted text-success";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function SessionItem({ session, isSelected, onClick }: SessionItemProps) {
  return (
    <button
      className={cn(
        "w-full text-left px-4 py-3 transition-colors duration-150 border-b border-border/50",
        "hover:bg-muted/50",
        isSelected && "bg-accent-brand-muted border-l-2 border-l-accent-brand",
        !isSelected && "border-l-2 border-l-transparent",
      )}
      onClick={onClick}
    >
      <div className="overflow-hidden">
        <p className="text-sm font-medium truncate">{stripXmlTags(session.title)}</p>
      </div>
      <div className="relative mt-1.5 overflow-hidden">
        <div className="flex items-center gap-1.5 pr-16">
          <Badge
            variant="secondary"
            className={cn(
              "text-[11px] px-1.5 py-0 border-0 shrink-0",
              getProviderBadgeClasses(session.providerId),
            )}
          >
            {session.providerLabel}
          </Badge>
          {session.model && (
            <Badge variant="secondary" className="text-[11px] px-1.5 py-0 truncate min-w-0">
              {session.model}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-mono shrink-0">
            {session.exchangeCount}
          </Badge>
        </div>
        <span className="absolute right-0 top-0 bottom-0 flex items-center">
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0 shrink-0">
            {formatTimeAgo(session.updatedAt)}
          </Badge>
        </span>
      </div>
    </button>
  );
}
