import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getDb } from "./data/db";
import { requestPersistentStorage } from "./data/storage";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root")!);

function FatalScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6">
      <div className="max-w-md rounded-2xl bg-white border border-border p-6 shadow-card text-center">
        <h1 className="text-lg font-semibold text-ink">No se pudieron cargar tus datos</h1>
        <p className="text-sm text-ink-soft mt-2">{message}</p>
        <p className="text-xs text-ink-faint mt-3">
          Tus datos no se han modificado. Puedes cerrar la app e intentarlo de nuevo.
        </p>
        <button
          className="mt-5 rounded-xl px-4 py-2.5 text-sm font-medium bg-accent text-white"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

// La app usa HashRouter (#/ruta) porque en escritorio se carga desde un
// archivo local y en Android desde el WebView, donde no hay servidor que
// resuelva rutas como /cuentas.
getDb()
  .then(() => {
    requestPersistentStorage();
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <HashRouter>
              <App />
            </HashRouter>
          </QueryClientProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  })
  .catch((err: Error) => {
    root.render(<FatalScreen message={err.message} />);
  });
