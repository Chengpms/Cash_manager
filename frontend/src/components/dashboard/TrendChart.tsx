import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatCompactNumber, formatCurrency, monthLabel } from "../../utils/format";
import type { TrendPoint } from "../../types";

interface TrendChartProps {
  data: TrendPoint[];
  isLoading?: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-ink text-white text-xs px-3 py-2 shadow-card">
      <p className="font-medium mb-1 capitalize">{monthLabel(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          {p.dataKey === "income" ? "Ingresos" : "Gastos"}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data, isLoading }: TrendChartProps) {
  if (isLoading) {
    return <div className="h-full min-h-[220px] rounded-xl bg-cream-dark/60 animate-pulse" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={220}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5B7F5E" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#5B7F5E" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8703A" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#E8703A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#EAE0CD" />
        <XAxis
          dataKey="month"
          tickFormatter={(v) => monthLabel(v)}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8A7863", fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(v) => formatCompactNumber(v)}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8A7863", fontSize: 12 }}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#5B7F5E"
          strokeWidth={2.5}
          fill="url(#incomeGradient)"
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="#E8703A"
          strokeWidth={2.5}
          fill="url(#expenseGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
