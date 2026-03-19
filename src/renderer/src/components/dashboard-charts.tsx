import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import type {
  ExchangeTimePoint,
  ModelTokenBreakdown,
  ToolCallStat,
  StopReasonStat,
} from "../../../shared/contracts";

// Monochrome palette — mid-to-light greys with good contrast on dark bg
const MONO = [
  "#c0c0c0",
  "#909090",
  "#686868",
  "#b0b0b0",
  "#808080",
  "#585858",
  "#a0a0a0",
  "#707070",
];

const AREA_COLORS = {
  input: "#c0c0c0",
  output: "#808080",
  reasoning: "#505050",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#252525",
  border: "1px solid #555",
  borderRadius: 6,
  fontSize: 11,
  color: "#e5e5e5",
};

const AXIS_COLOR = "#666";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-md border border-border bg-card p-3 select-none [&_*]:outline-none [&_*]:cursor-default">
      <span className="text-xs font-medium text-muted-foreground mb-2">{title}</span>
      {children}
    </div>
  );
}

function pieLabel(props: PieLabelRenderProps): React.ReactElement {
  const { x, y, name, percent } = props;
  const pct = ((percent ?? 0) * 100).toFixed(0);
  return (
    <text x={x} y={y} fill="#999" fontSize={10} textAnchor={(x ?? 0) > 200 ? "start" : "end"} dominantBaseline="central">
      {`${name ?? ""} ${pct}%`}
    </text>
  );
}

interface DashboardChartsProps {
  timeline: ExchangeTimePoint[];
  modelBreakdown: ModelTokenBreakdown[];
  toolCalls: ToolCallStat[];
  stopReasons: StopReasonStat[];
}

function TokenTimeline({ timeline }: { timeline: ExchangeTimePoint[] }) {
  if (timeline.length === 0) return <div className="text-xs text-muted-foreground">No data</div>;

  const data = timeline.map((p) => ({
    time: formatTime(p.startedAt),
    input: p.inputTokens,
    output: p.outputTokens,
    reasoning: p.reasoningTokens,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke={AXIS_COLOR} />
        <YAxis tickFormatter={formatTokens} tick={{ fontSize: 10 }} stroke={AXIS_COLOR} width={45} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e5e5e5" }} />
        <Area type="monotone" dataKey="input" stackId="1" stroke={AREA_COLORS.input} fill={AREA_COLORS.input} fillOpacity={0.4} name="Input" />
        <Area type="monotone" dataKey="output" stackId="1" stroke={AREA_COLORS.output} fill={AREA_COLORS.output} fillOpacity={0.4} name="Output" />
        <Area type="monotone" dataKey="reasoning" stackId="1" stroke={AREA_COLORS.reasoning} fill={AREA_COLORS.reasoning} fillOpacity={0.4} name="Reasoning" />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ModelBreakdownChart({ data }: { data: ModelTokenBreakdown[] }) {
  if (data.length === 0) return <div className="text-xs text-muted-foreground">No data</div>;

  const pieData = data.map((m) => ({ name: m.model, value: m.totalTokens }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
          dataKey="value"
          label={pieLabel}
          labelLine={false}
          style={{ fontSize: 10 }}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={MONO[i % MONO.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatTokens(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ToolUsageChart({ data }: { data: ToolCallStat[] }) {
  if (data.length === 0) return <div className="text-xs text-muted-foreground">No tool calls</div>;

  const top = data.slice(0, 15);

  const maxNameLen = useMemo(
    () => Math.min(200, Math.max(80, ...top.map((t) => t.name.length * 7))),
    [top],
  );

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, top.length * 28)}>
      <BarChart data={top} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} stroke={AXIS_COLOR} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke={AXIS_COLOR} width={maxNameLen} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#eee" }} />
        <Bar dataKey="callCount" fill="#b0b0b0" name="Calls" radius={[0, 2, 2, 0]} />
        <Bar dataKey="errorCount" fill="#505050" name="Errors" radius={[0, 2, 2, 0]} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function StopReasonsChart({ data }: { data: StopReasonStat[] }) {
  if (data.length === 0) return <div className="text-xs text-muted-foreground">No data</div>;

  const pieData = data.map((s) => ({ name: s.reason, value: s.count }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
          dataKey="value"
          label={pieLabel}
          labelLine={false}
          style={{ fontSize: 10 }}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={MONO[i % MONO.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DashboardCharts({ timeline, modelBreakdown, toolCalls, stopReasons }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ChartCard title="Token Timeline">
        <TokenTimeline timeline={timeline} />
      </ChartCard>
      <ChartCard title="Model Breakdown">
        <ModelBreakdownChart data={modelBreakdown} />
      </ChartCard>
      <ChartCard title="Tool Usage">
        <ToolUsageChart data={toolCalls} />
      </ChartCard>
      <ChartCard title="Stop Reasons">
        <StopReasonsChart data={stopReasons} />
      </ChartCard>
    </div>
  );
}
