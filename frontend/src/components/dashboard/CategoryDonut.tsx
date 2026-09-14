import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { getIcon, CATEGORY_CHART_PALETTE } from "../../utils/constants";
import { formatCurrency } from "../../utils/format";
import { EmptyState } from "../ui/EmptyState";
import type { CategoryBreakdown } from "../../types";

interface CategoryDonutProps {
  data: CategoryBreakdown[];
  isLoading?: boolean;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as CategoryBreakdown;
  return (
    <div className="rounded-xl bg-ink text-white text-xs px-3 py-2 shadow-card">
      {item.name}: {formatCurrency(item.total)}
    </div>
  );
}

export function CategoryDonut({ data, isLoading }: CategoryDonutProps) {
  if (isLoading) {
    return <div className="h-56 rounded-xl bg-cream-dark/60 animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={PieIcon}
        title="Sin gastos este mes"
        description="Los gastos categorizados aparecerán aquí."
      />
    );
  }

  const total = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={entry.color || CATEGORY_CHART_PALETTE[i % CATEGORY_CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-2.5 max-h-40 overflow-y-auto scrollbar-thin pr-1">
        {data.slice(0, 6).map((c, i) => {
          const Icon = getIcon(c.icon);
          const color = c.color || CATEGORY_CHART_PALETTE[i % CATEGORY_CHART_PALETTE.length];
          const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
          return (
            <li key={c.name} className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}1A`, color }}
              >
                <Icon size={13} />
              </div>
              <span className="text-sm text-ink flex-1 truncate">{c.name}</span>
              <span className="text-xs text-ink-soft">{pct}%</span>
              <span className="text-sm font-medium text-ink w-20 text-right">
                {formatCurrency(c.total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
