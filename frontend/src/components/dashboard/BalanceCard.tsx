import { Wallet } from "lucide-react";
import { formatCurrency } from "../../utils/format";

interface BalanceCardProps {
  totalBalance: number;
  accountsCount: number;
}

export function BalanceCard({ totalBalance, accountsCount }: BalanceCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-light via-accent to-accent-dark p-6 shadow-glow h-full flex flex-col justify-between min-h-[168px]">
      <div
        className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10"
        aria-hidden="true"
      />
      <div
        className="absolute -right-4 bottom-6 w-24 h-24 rounded-full bg-white/10"
        aria-hidden="true"
      />
      <div className="relative flex items-center gap-2 text-white/85 text-sm font-medium">
        <Wallet size={16} />
        Balance total
      </div>
      <div className="relative">
        <p className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
          {formatCurrency(totalBalance)}
        </p>
        <p className="text-white/75 text-xs mt-2">
          {accountsCount} {accountsCount === 1 ? "cuenta activa" : "cuentas activas"}
        </p>
      </div>
    </div>
  );
}
