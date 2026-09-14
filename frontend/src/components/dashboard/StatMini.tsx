import { type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { formatCurrency } from "../../utils/format";

interface StatMiniProps {
  label: string;
  amount: number;
  icon: LucideIcon;
  tone: "positive" | "negative";
}

export function StatMini({ label, amount, icon: Icon, tone }: StatMiniProps) {
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
      </div>
    </div>
  );
}
