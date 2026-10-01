import { type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { formatCurrency } from "../../utils/format";

interface StatMiniProps {
  label: string;
  amount: number;
  icon: LucideIcon;
  tone: "positive" | "negative";
  // Importe del mes anterior, para mostrar la variación
  previous?: number;
}

function Change({ amount, previous, tone }: { amount: number; previous: number; tone: "positive" | "negative" }) {
  if (previous === 0) return null;
  const pct = Math.round(((amount - previous) / previous) * 100);
  if (!Number.isFinite(pct)) return null;
  // Subir ingresos es bueno; subir gastos, malo
  const good = tone === "positive" ? pct >= 0 : pct <= 0;
  return (
    <span className={clsx("text-[11px] font-medium", good ? "text-positive" : "text-negative")}>
      {pct > 0 ? "+" : ""}
      {pct}% vs mes anterior
    </span>
  );
}

export function StatMini({ label, amount, icon: Icon, tone, previous }: StatMiniProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white border border-border p-4 shadow-soft flex-1">
      <div
        className={clsx(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          tone === "positive" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
        )}
      >
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-soft truncate">{label}</p>
        <p className="text-base font-semibold text-ink truncate">{formatCurrency(amount)}</p>
        {previous !== undefined && <Change amount={amount} previous={previous} tone={tone} />}
      </div>
    </div>
  );
}
