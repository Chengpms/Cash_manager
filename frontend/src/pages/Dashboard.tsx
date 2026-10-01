import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { BalanceCard } from "../components/dashboard/BalanceCard";
import { StatMini } from "../components/dashboard/StatMini";
import { TrendChart } from "../components/dashboard/TrendChart";
import { CategoryDonut } from "../components/dashboard/CategoryDonut";
import { BudgetsCard } from "../components/dashboard/BudgetsCard";
import { TransactionList } from "../components/transactions/TransactionList";
import { AccountCard } from "../components/accounts/AccountCard";
import { Modal } from "../components/ui/Modal";
import { TransactionForm } from "../components/forms/TransactionForm";
import { useAccounts, useByCategory, useSummary, useTransactions, useTrend } from "../hooks/queries";

const TODAY = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

export function Dashboard() {
  const [showForm, setShowForm] = useState(false);
  const { data: summary, isLoading: loadingSummary } = useSummary();
  const { data: trend = [], isLoading: loadingTrend } = useTrend(6);
  const { data: byCategory = [], isLoading: loadingCategory } = useByCategory("expense");
  const { data: recentTx = [], isLoading: loadingTx } = useTransactions({ limit: 6 });
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();

  return (
    <div>
      <PageHeader
        title="Hola 👋"
        subtitle={TODAY.charAt(0).toUpperCase() + TODAY.slice(1)}
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Nueva transacción
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 flex flex-col gap-4">
          <BalanceCard
            totalBalance={summary?.totalBalance ?? 0}
            accountsCount={summary?.accountsCount ?? 0}
          />
          <div className="flex flex-col sm:flex-row lg:flex-col gap-4">
            <StatMini label="Ingresos del mes" amount={summary?.monthIncome ?? 0} previous={summary?.prevMonthIncome} icon={TrendingUp} tone="positive" />
            <StatMini label="Gastos del mes" amount={summary?.monthExpense ?? 0} previous={summary?.prevMonthExpense} icon={TrendingDown} tone="negative" />
          </div>
        </div>

        <Card className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-ink">Tendencia</h2>
            <p className="text-xs text-ink-soft">Últimos 6 meses</p>
          </div>
          <div className="flex-1">
            <TrendChart data={trend} isLoading={loadingTrend || loadingSummary} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-ink">Movimientos recientes</h2>
            <Link
              to="/transacciones"
              className="text-xs font-medium text-accent hover:text-accent-dark inline-flex items-center gap-1"
            >
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <TransactionList transactions={recentTx} isLoading={loadingTx} showAccount />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink">Gastos por categoría</h2>
            <p className="text-xs text-ink-soft">Este mes</p>
          </div>
          <CategoryDonut data={byCategory} isLoading={loadingCategory} />
        </Card>
      </div>

      <BudgetsCard />

      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink">Tus cuentas</h2>
          <Link
            to="/cuentas"
            className="text-xs font-medium text-accent hover:text-accent-dark inline-flex items-center gap-1"
          >
            Gestionar <ArrowRight size={12} />
          </Link>
        </div>
        {loadingAccounts ? (
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-44 h-24 rounded-2xl bg-cream-dark/60 animate-pulse shrink-0" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              Aún no tienes cuentas.{" "}
              <Link to="/cuentas" className="text-accent font-medium">
                Añade tu primera cuenta
              </Link>{" "}
              para empezar a registrar movimientos.
            </p>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} compact />
            ))}
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva transacción">
        <TransactionForm onClose={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
