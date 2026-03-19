import type { TokenStats } from "../../../shared/contracts";

interface StatsCardsProps {
  tokens: TokenStats;
  exchangeCount: number;
  totalDurationMs: number;
  errorCount: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-card px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function DashboardStatsCards({ tokens, exchangeCount, totalDurationMs, errorCount }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-7 gap-2">
      <StatCard label="Total Tokens" value={formatNumber(tokens.totalTokens)} />
      <StatCard label="Input Tokens" value={formatNumber(tokens.inputTokens)} />
      <StatCard label="Output Tokens" value={formatNumber(tokens.outputTokens)} />
      <StatCard label="Reasoning Tokens" value={formatNumber(tokens.reasoningTokens)} />
      <StatCard label="Exchanges" value={exchangeCount.toLocaleString()} />
      <StatCard label="Total Duration" value={formatDuration(totalDurationMs)} />
      <StatCard label="Errors" value={errorCount.toLocaleString()} />
    </div>
  );
}
