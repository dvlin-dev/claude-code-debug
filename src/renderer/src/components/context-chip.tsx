import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import type { ContextType } from "../../../shared/contracts";

interface ContextChipProps {
  contextType: ContextType | null;
  label: string;
  charCount: number;
  content: string;
  defaultExpanded: boolean;
}

const LABEL_MAP: Record<string, string> = {
  "system-reminder": "System Reminder",
  "hook-output": "Hook Output",
  "skills-list": "Skills List",
  "claude-md": "CLAUDE.md Context",
  "command-context": "Command Context",
  "agent-context": "Agent Context",
  "suggestion-mode": "Suggestion Mode",
};

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  "system-reminder": {
    border: "border-l-cyan-400/70",
    bg: "bg-cyan-400/3",
    text: "text-cyan-700 dark:text-cyan-300",
    badge: "bg-cyan-400/8 text-cyan-600 dark:text-cyan-400",
  },
  "hook-output": {
    border: "border-l-amber-400/70",
    bg: "bg-amber-400/3",
    text: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-400/8 text-amber-600 dark:text-amber-400",
  },
  "skills-list": {
    border: "border-l-purple-400/70",
    bg: "bg-purple-400/3",
    text: "text-purple-700 dark:text-purple-300",
    badge: "bg-purple-400/8 text-purple-600 dark:text-purple-400",
  },
  "claude-md": {
    border: "border-l-teal-400/70",
    bg: "bg-teal-400/3",
    text: "text-teal-700 dark:text-teal-300",
    badge: "bg-teal-400/8 text-teal-600 dark:text-teal-400",
  },
  "command-context": {
    border: "border-l-slate-400/70",
    bg: "bg-slate-400/3",
    text: "text-slate-700 dark:text-slate-300",
    badge: "bg-slate-400/8 text-slate-600 dark:text-slate-400",
  },
  "agent-context": {
    border: "border-l-indigo-400/70",
    bg: "bg-indigo-400/3",
    text: "text-indigo-700 dark:text-indigo-300",
    badge: "bg-indigo-400/8 text-indigo-600 dark:text-indigo-400",
  },
  "suggestion-mode": {
    border: "border-l-rose-400/70",
    bg: "bg-rose-400/3",
    text: "text-rose-700 dark:text-rose-300",
    badge: "bg-rose-400/8 text-rose-600 dark:text-rose-400",
  },
};

const DEFAULT_COLORS = {
  border: "border-l-gray-400",
  bg: "bg-muted/30",
  text: "text-muted-foreground",
  badge: "bg-muted text-muted-foreground",
};

function formatCharCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export function ContextChip({
  contextType,
  label,
  charCount,
  content,
  defaultExpanded,
}: ContextChipProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const colors = contextType ? COLOR_MAP[contextType] ?? DEFAULT_COLORS : DEFAULT_COLORS;
  const displayLabel = label || (contextType ? LABEL_MAP[contextType] : null) || "Injected Context";

  return (
    <div
      className={cn("border-l-2 rounded-md cursor-pointer", colors.border, colors.bg)}
      onClick={() => setExpanded(!expanded)}
    >
      <div className={cn("flex items-center gap-1.5 px-3 py-1.5", colors.text)}>
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 transition-transform", expanded && "rotate-90")}
        />
        <span className="text-[11px] font-medium truncate">{displayLabel}</span>
        <span className={cn("text-[11px] px-1.5 py-0 shrink-0 font-mono", colors.badge)}>
          {formatCharCount(charCount)} chars
        </span>
      </div>
      {expanded && (
        <div className="px-3 pb-2 max-h-64 overflow-auto">
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-muted-foreground leading-relaxed">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
