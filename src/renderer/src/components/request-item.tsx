import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import type { ExchangeListItemVM } from "../../../shared/contracts";

interface RequestItemProps {
  request?: ExchangeListItemVM;
  isSelected: boolean;
  onClick: () => void;
}

function statusColor(code: number | null): string {
  if (!code) return "text-muted-foreground";
  if (code >= 200 && code < 300) return "text-success";
  if (code >= 400 && code < 500) return "text-warning";
  if (code >= 500) return "text-destructive";
  return "text-muted-foreground";
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RequestItem({ request, isSelected, onClick }: RequestItemProps) {
  if (!request) {
    return null;
  }

  return (
    <button
      className={cn(
        "w-full text-left px-3 py-2 transition-colors duration-150",
        "hover:bg-muted/50",
        isSelected && "bg-accent-brand-muted",
      )}
      onClick={onClick}
    >
      <div className="text-xs font-mono truncate">
        <span className="font-medium">{request.method}</span>{" "}
        <span className="text-muted-foreground">{request.path}</span>
      </div>
      <div className="flex items-center gap-2 mt-1 text-[11px]">
        <span className={statusColor(request.statusCode)}>
          {request.statusCode ?? "..."}
        </span>
        <span className="text-muted-foreground">
          {formatDuration(request.durationMs)}
        </span>
        {request.model && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 truncate max-w-[220px]">
            {request.model}
          </Badge>
        )}
      </div>
    </button>
  );
}
