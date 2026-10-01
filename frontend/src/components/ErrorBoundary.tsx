import { Component, ReactNode } from "react";

interface State {
  error: Error | null;
}

// Si una pantalla falla al dibujarse, mostramos un aviso con opción de volver
// al inicio en vez de dejar la ventana en blanco. Los datos no se ven afectados.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-6">
        <div className="max-w-md rounded-2xl bg-white border border-border p-6 shadow-card text-center">
          <h1 className="text-lg font-semibold text-ink">Algo ha fallado</h1>
          <p className="text-sm text-ink-soft mt-2">
            Se produjo un error inesperado al mostrar esta pantalla. Tus datos están a salvo.
          </p>
          <pre className="text-xs text-ink-faint mt-3 whitespace-pre-wrap break-words">{this.state.error.message}</pre>
          <button
            className="mt-5 rounded-xl px-4 py-2.5 text-sm font-medium bg-accent text-white"
            onClick={() => {
              window.location.hash = "#/";
              window.location.reload();
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }
}
