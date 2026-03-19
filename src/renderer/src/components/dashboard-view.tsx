import { useEffect } from "react";
import { useSessionStore } from "../stores/session-store";
import { useDashboardStore } from "../stores/dashboard-store";
import { useTraceStore } from "../stores/trace-store";
import { DashboardStatsCards } from "./dashboard-stats-cards";
import { DashboardCharts } from "./dashboard-charts";
import { ScrollArea } from "./ui/scroll-area";

export function DashboardView() {
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);
  const contentTab = useTraceStore((s) => s.contentTab);
  const dashboard = useDashboardStore((s) => s.dashboard);
  const loading = useDashboardStore((s) => s.loading);
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);

  useEffect(() => {
    if (contentTab === "dashboard" && selectedSessionId) {
      void loadDashboard(selectedSessionId);
    }
  }, [contentTab, selectedSessionId, loadDashboard]);

  if (loading && !dashboard) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto space-y-3">
        <DashboardStatsCards
          tokens={dashboard.tokens}
          exchangeCount={dashboard.exchangeCount}
          totalDurationMs={dashboard.totalDurationMs}
          errorCount={dashboard.errorCount}
        />
        <DashboardCharts
          timeline={dashboard.timeline}
          modelBreakdown={dashboard.modelBreakdown}
          toolCalls={dashboard.toolCalls}
          stopReasons={dashboard.stopReasons}
        />
      </div>
    </ScrollArea>
  );
}
