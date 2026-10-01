import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { LayoutDashboard, Landmark, List, Tags, ArrowLeftRight, Settings as SettingsIcon } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Resumen", icon: LayoutDashboard, end: true },
  { to: "/cuentas", label: "Cuentas", icon: Landmark },
  { to: "/transacciones", label: "Movs.", icon: List },
  { to: "/categorias", label: "Categ.", icon: Tags },
  { to: "/transferencias", label: "Transf.", icon: ArrowLeftRight },
  { to: "/ajustes", label: "Ajustes", icon: SettingsIcon },
];

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-cream-soft border-t border-border px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-between">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            clsx(
              "flex flex-1 flex-col items-center gap-0.5 py-1.5 rounded-xl text-[10px] font-medium",
              isActive ? "text-accent" : "text-ink-soft"
            )
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
