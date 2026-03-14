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
  if (code >= 200 && code < 300) return "text-green-600 dark:text-green-400";
  if (code >= 400 && code < 500) return "text-orange-600 dark:text-orange-400";
  if (code >= 500) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes}B`;
  return `${Math.round(bytes / 1024)}KB`;
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
        "hover:bg-accent",
        isSelected && "bg-accent",
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="font-medium">{request.method}</span>
        <span className="truncate flex-1 text-muted-foreground">
          {request.path}
        </span>
        <span className={statusColor(request.statusCode)}>
          {request.statusCode ?? "..."}
        </span>
        <span className="text-muted-foreground">
          {formatDuration(request.durationMs)}
        </span>
        {request.model && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            {request.model}
          </Badge>
        )}
      </div>
    </button>
  );
}
