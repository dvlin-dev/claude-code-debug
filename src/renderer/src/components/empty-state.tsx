import { Radio } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <Radio className="h-12 w-12 text-muted-foreground/50" />
      <div className="space-y-1">
        <p className="text-sm font-medium">No sessions yet</p>
        <p className="text-xs text-muted-foreground">
          Start listening to capture agent traffic
        </p>
      </div>
    </div>
  );
}
