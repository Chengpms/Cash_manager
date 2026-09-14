import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, ExternalLink, FileSpreadsheet, RefreshCw, XCircle } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useDisconnectGoogle, useGoogleStatus, useImportGoogle, useSyncGoogle } from "../hooks/queries";
import { getGoogleAuthUrl } from "../api/client";
import { formatDate } from "../utils/format";
import type { GoogleImportResult } from "../types";

function summarizeImport(result: GoogleImportResult): string {
  const totalCreated = Object.values(result.created).reduce((a, b) => a + b, 0);
  const totalUpdated = Object.values(result.updated).reduce((a, b) => a + b, 0);
  const totalDeleted = Object.values(result.deleted).reduce((a, b) => a + b, 0);

  if (totalCreated === 0 && totalUpdated === 0 && totalDeleted === 0) {
    return "No había cambios nuevos en la hoja.";
  }

  const parts: string[] = [];
  if (totalCreated) parts.push(`${totalCreated} nuevo(s)`);
  if (totalUpdated) parts.push(`${totalUpdated} actualizado(s)`);
  if (totalDeleted) parts.push(`${totalDeleted} eliminado(s)`);
  return `Importado desde Sheets: ${parts.join(", ")}.`;
}

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: status, isLoading } = useGoogleStatus();
  const syncMutation = useSyncGoogle();
  const importMutation = useImportGoogle();
  const disconnectMutation = useDisconnectGoogle();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<{ summary: string; warnings: string[] } | null>(null);

  const googleParam = searchParams.get("google");

  useEffect(() => {
    if (googleParam) {
      // Limpia el parámetro de la URL sin recargar la página
      searchParams.delete("google");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleParam]);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const { url } = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || "No se pudo iniciar la conexión con Google");
      setConnecting(false);
    }
  }

  async function handleSync() {
    setError(null);
    setImportInfo(null);
    try {
      await syncMutation.mutateAsync();
    } catch (err: any) {
      setError(err.message || "No se pudo sincronizar con Google Sheets");
    }
  }

  async function handleImport() {
    setError(null);
    setImportInfo(null);
    try {
      const result = await importMutation.mutateAsync({ allowDeletes: true });
      setImportInfo({ summary: summarizeImport(result), warnings: result.warnings });
    } catch (err: any) {
      setError(err.message || "No se pudo importar los cambios desde Google Sheets");
    }
  }

  async function handleDisconnect() {
    if (!confirm("¿Desconectar tu cuenta de Google? Podrás volver a conectarla cuando quieras.")) return;
    await disconnectMutation.mutateAsync();
  }

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Copia de seguridad en Google Drive" />

      <Card>
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <FileSpreadsheet size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-ink">Google Drive · Sheets</h2>
            <p className="text-sm text-ink-soft mt-1">
              Conecta tu cuenta de Google para guardar una copia de tus cuentas, categorías,
              transacciones y transferencias en una hoja de cálculo de tu Google Drive.
            </p>

            {googleParam === "connected" && (
              <div className="mt-3 flex items-center gap-2 text-sm text-positive bg-positive/10 rounded-xl px-3 py-2">
                <CheckCircle2 size={15} />
                Cuenta de Google conectada correctamente.
              </div>
            )}
            {googleParam === "error" && (
              <div className="mt-3 flex items-center gap-2 text-sm text-negative bg-negative/10 rounded-xl px-3 py-2">
                <XCircle size={15} />
                No se pudo completar la conexión con Google. Revisa GOOGLE_SETUP.md e inténtalo de nuevo.
              </div>
            )}
            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-negative bg-negative/10 rounded-xl px-3 py-2">
                <XCircle size={15} />
                {error}
              </div>
            )}
            {importInfo && (
              <div className="mt-3 text-sm text-ink-soft bg-cream-soft rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 text-ink font-medium">
                  <CheckCircle2 size={15} className="text-positive shrink-0" />
                  {importInfo.summary}
                </div>
                {importInfo.warnings.length > 0 && (
                  <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-ink-soft">
                    {importInfo.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-5">
              {isLoading ? (
                <div className="h-10 w-40 rounded-xl bg-cream-dark/60 animate-pulse" />
              ) : status?.connected ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-positive font-medium">
                      <CheckCircle2 size={15} />
                      Conectado como {status.email}
                    </span>
                  </div>

                  <p className="text-xs text-ink-soft">
                    {status.lastSyncedAt
                      ? `Última sincronización: ${formatDate(status.lastSyncedAt)}`
                      : "Todavía no has sincronizado tus datos."}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSync} disabled={syncMutation.isPending}>
                      <RefreshCw size={15} className={syncMutation.isPending ? "animate-spin" : ""} />
                      {syncMutation.isPending ? "Sincronizando..." : "Sincronizar ahora"}
                    </Button>
                    <Button variant="secondary" onClick={handleImport} disabled={importMutation.isPending}>
                      <Download size={15} className={importMutation.isPending ? "animate-spin" : ""} />
                      {importMutation.isPending ? "Importando..." : "Importar cambios"}
                    </Button>
                    {status.spreadsheetUrl && (
                      <a
                        href={status.spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 text-sm font-medium rounded-xl px-4 py-2.5 bg-white text-ink border border-border hover:bg-cream-soft transition-colors"
                      >
                        <ExternalLink size={15} />
                        Abrir hoja de cálculo
                      </a>
                    )}
                    <Button variant="ghost" onClick={handleDisconnect} disabled={disconnectMutation.isPending}>
                      Desconectar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={handleConnect} disabled={connecting}>
                  {connecting ? "Conectando..." : "Conectar con Google"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="font-semibold text-ink mb-2">¿Cómo funciona?</h2>
        <div className="text-sm text-ink-soft leading-relaxed space-y-3">
          <p>
            Al pulsar <strong>"Sincronizar ahora"</strong> se crea (la primera vez) una hoja de cálculo
            llamada "Gestor de Dinero" en tu Google Drive, con una pestaña para cada tipo de dato:
            Cuentas, Categorías, Transacciones y Transferencias. Sube el estado actual de tu app a la hoja.
          </p>
          <p>
            La app también revisa esa hoja <strong>automáticamente cada ~45 segundos</strong> mientras la
            tienes abierta: si editas una fila o añades una nueva directamente en Sheets (respetando los
            nombres de cuenta/categoría existentes), aparecerá aquí sola, sin que tengas que hacer nada.
            Por seguridad, esta revisión automática nunca borra datos.
          </p>
          <p>
            Si borraste alguna fila en la hoja y quieres que también desaparezca de la app, usa el botón{" "}
            <strong>"Importar cambios"</strong> — esa importación manual sí aplica los borrados (archivando
            en vez de borrar las cuentas que tengan movimientos, para no perder el histórico).
          </p>
          <p className="text-xs">
            No borres ni edites la columna <strong>ID</strong> de la hoja: es lo que usa la app para
            reconocer cada fila al volver a importar. Una fila con la columna ID vacía se trata como un
            registro nuevo.
          </p>
        </div>
      </Card>
    </div>
  );
}
