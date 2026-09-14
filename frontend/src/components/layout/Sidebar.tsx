import { NavLink } from "react-router-dom";
import clsx from "clsx";
import {
  LayoutDashboard,
  Landmark,
  List,
  Tags,
  ArrowLeftRight,
  Wallet,
  Settings as SettingsIcon,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Resumen", icon: LayoutDashboard, end: true },
  { to: "/cuentas", label: "Cuentas", icon: Landmark },
  { to: "/transacciones", label: "Transacciones", icon: List },
  { to: "/categorias", label: "Categorías", icon: Tags },
  { to: "/transferencias", label: "Transferencias", icon: ArrowLeftRight },
  { to: "/ajustes", label: "Ajustes", icon: SettingsIcon },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 flex-col shrink-0 py-6 px-4">
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent-light to-accent-dark flex items-center justify-center shadow-glow">
          <Wallet size={18} className="text-white" />
        </div>
        <div>
          <p className="font-semibold text-ink leading-tight">Gestor</p>
          <p className="text-xs text-ink-soft leading-tight">de Dinero</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-gradient-to-br from-accent-light to-accent-dark text-white shadow-glow"
                  : "text-ink-soft hover:bg-cream-dark hover:text-ink"
              )
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2 pt-6">
        <div className="rounded-2xl bg-cream-dark/60 p-4">
          <p className="text-xs text-ink-soft leading-relaxed">
            Controla tus finanzas de forma visual: cuentas, categorías y tendencias en un solo lugar.
          </p>
        </div>
      </div>
    </aside>
  );
}
