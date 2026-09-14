import { Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { MobileNav } from "./components/layout/MobileNav";
import { Dashboard } from "./pages/Dashboard";
import { Accounts } from "./pages/Accounts";
import { Transactions } from "./pages/Transactions";
import { Categories } from "./pages/Categories";
import { Transfers } from "./pages/Transfers";
import { Settings } from "./pages/Settings";
import { useGoogleAutoSync } from "./hooks/queries";

export default function App() {
  // Revisa en segundo plano si hay cambios hechos a mano en Google Sheets
  // (no hace nada si no hay ninguna cuenta de Google conectada).
  useGoogleAutoSync();

  return (
    <div className="min-h-screen flex bg-cream">
      <Sidebar />
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        <div className="max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cuentas" element={<Accounts />} />
            <Route path="/transacciones" element={<Transactions />} />
            <Route path="/categorias" element={<Categories />} />
            <Route path="/transferencias" element={<Transfers />} />
            <Route path="/ajustes" element={<Settings />} />
          </Routes>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
