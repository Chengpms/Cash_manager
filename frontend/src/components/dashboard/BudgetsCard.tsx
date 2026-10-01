import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { Card } from "../ui/Card";
import { useBudgets } from "../../hooks/queries";
import { getIcon } from "../../utils/constants";
import { formatCurrency } from "../../utils/format";

// Progreso del gasto del mes frente al presupuesto de cada categoría. Solo se
// muestra si hay alguna categoría con presupuesto.
export function BudgetsCard() {
  const { data: budgets = [] } = useBudgets();
  if (budgets.length === 0) return null;

  return (
    <Card className="mt-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-ink">Presupuestos del mes</h2>
        <Link
          to="/categorias"
          className="text-xs font-medium text-accent hover:text-accent-dark inline-flex items-center gap-1"
        >
          Editar <ArrowRight size={12} />
        </Link>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {budgets.map(({ category, budget, spent, ratio }) => {
          const Icon = getIcon(category.icon);
          const over = ratio > 1;
          const warn = ratio >= 0.8;
          return (
            <li key={category.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${category.color}1A`, color: category.color }}
                >
                  <Icon size={13} />
                </div>
                <span className="text-sm text-ink flex-1 truncate">{category.name}</span>
                <span className={clsx("text-xs font-medium", over ? "text-negative" : "text-ink-soft")}>
                  {formatCurrency(spent)} / {formatCurrency(budget)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-cream-dark overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all",
                    over ? "bg-negative" : warn ? "bg-gold" : "bg-positive"
                  )}
                  style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                />
              </div>
              {over && (
                <p className="text-[11px] text-negative mt-1">
                  Te has pasado en {formatCurrency(spent - budget)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
