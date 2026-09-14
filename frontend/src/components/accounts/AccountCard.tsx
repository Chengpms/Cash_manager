import { Pencil, Trash2 } from "lucide-react";
import { Card } from "../ui/Card";
import { getIcon, ACCOUNT_TYPE_LABELS } from "../../utils/constants";
import { formatCurrency } from "../../utils/format";
import type { Account } from "../../types";

interface AccountCardProps {
  account: Account;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AccountCard({ account, compact, onEdit, onDelete }: AccountCardProps) {
  const Icon = getIcon(account.icon);

  if (compact) {
    return (
      <div className="shrink-0 w-44 rounded-2xl bg-white border border-border p-4 shadow-soft">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
          style={{ backgroundColor: `${account.color}1A`, color: account.color }}
        >
          <Icon size={16} />
        </div>
        <p className="text-xs text-ink-soft truncate">{account.name}</p>
        <p className="text-base font-semibold text-ink mt-0.5 truncate">
          {formatCurrency(account.balance, account.currency)}
        </p>
      </div>
    );
  }

  return (
    <Card className="group relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${account.color}1A`, color: account.color }}
        >
          <Icon size={20} />
        </div>
        {(onEdit || onDelete) && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-ink-soft hover:bg-cream-dark"
                aria-label="Editar cuenta"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-negative hover:bg-negative/10"
                aria-label="Eliminar cuenta"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      <p className="text-sm text-ink-soft mt-4">{account.name}</p>
      <p className="text-2xl font-semibold text-ink mt-1">
        {formatCurrency(account.balance, account.currency)}
      </p>
      <p className="text-xs text-ink-faint mt-2">{ACCOUNT_TYPE_LABELS[account.type]}</p>
    </Card>
  );
}
