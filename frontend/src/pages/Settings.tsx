import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CloudUpload,
  Database as DatabaseIcon,
  Download,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FormField, inputClasses } from "../components/ui/FormField";
import {
  useConnectGoogle,
  useDisconnectGoogle,
  useGoogleStatus,
  useImportGoogle,
  useSyncGoogle,
} from "../hooks/queries";
import { getGoogleCredentials, googleAvailable, saveGoogleCredentials } from "../api/client";
import { exportBackup, exportTransactionsCsv, parseBackup, restoreBackup } from "../data/backup";
import { loadWarning } from "../data/db";
import { desktop, openExternal, platform } from "../data/platform";
import { formatDate, formatRelativeTime } from "../utils/format";
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

function Alert({ tone, children }: { tone: "ok" | "error" | "info"; children: React.ReactNode }) {
  const styles = {
    ok: "text-positive bg-positive/10",
    error: "text-negative bg-negative/10",
    info: "text-ink-soft bg-cream-soft",
  }[tone];
  const Icon = tone === "error" ? XCircle : CheckCircle2;
  return (
    <div className={`mt-3 flex items-start gap-2 text-sm rounded-xl px-3 py-2 ${styles}`}>
      <Icon size={15} className="shrink-0 mt-0.5" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

// ---------- Copias de seguridad ----------

function DataCard() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [dataPath, setDataPath] = useState<string | null>(null);

  useEffect(() => {
    desktop?.dataPath().then(setDataPath).catch(() => undefined);
  }, []);

  async function run(action: () => Promise<string | null | void>, okText: (r: string) => string) {
    setMessage(null);
    setBusy(true);
    try {
      const result = await action();
      if (result) setMessage({ tone: "ok", text: okText(result) });
    } catch (err: any) {
      setMessage({ tone: "error", text: err.message || "Ha ocurrido un error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await run(async () => {
      const { db, summary } = parseBackup(await file.text());
      const details =
        `${summary.accounts} cuentas, ${summary.categories} categorías, ` +
        `${summary.transactions} movimientos y ${summary.transfers} transferencias`;
      if (
        !confirm(
          `¿Restaurar la copia "${file.name}"?\n\nContiene ${details}.\n\n` +
            "Esto SUSTITUYE todos los datos actuales de este dispositivo. " +
            "Si no estás seguro, exporta antes una copia de los datos actuales."
        )
      ) {
        return null;
      }
      await restoreBackup(db);
      await qc.invalidateQueries();
      const skipped = summary.dropped ? ` (${summary.dropped} registro(s) inválido(s) se omitieron)` : "";
      return `Copia restaurada: ${details}${skipped}.`;
    }, (r) => r);
  }

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <DatabaseIcon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-ink">Tus datos</h2>
          <p className="text-sm text-ink-soft mt-1">
            Tus datos se guardan solo en este dispositivo. Exporta una copia de seguridad de vez en cuando, o úsala
            para pasar tus datos del ordenador al móvil (y al revés).
          </p>
          {dataPath && (
            <p className="text-xs text-ink-faint mt-2 break-all">
              Archivo de datos: <code>{dataPath}</code>
            </p>
          )}

          {loadWarning && <Alert tone="info">{loadWarning}</Alert>}
          {message && <Alert tone={message.tone}>{message.text}</Alert>}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => run(exportBackup, (f) => `Copia guardada: ${f}`)} disabled={busy}>
              <Download size={15} />
              Exportar copia
            </Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
              <Upload size={15} />
              Restaurar copia
            </Button>
            <Button
              variant="secondary"
              onClick={() => run(() => exportTransactionsCsv(), (f) => `Movimientos exportados: ${f}`)}
              disabled={busy}
            >
              <FileSpreadsheet size={15} />
              Exportar movimientos (CSV)
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------- Google Sheets ----------

function GoogleCredentialsForm({ onSaved }: { onSaved?: () => void }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasBuiltIn, setHasBuiltIn] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getGoogleCredentials().then((c) => {
      setClientId(c.clientId);
      setClientSecret(c.clientSecret);
      setHasBuiltIn(c.hasBuiltIn);
    });
  }, []);

  async function handleSave() {
    await saveGoogleCredentials(clientId, clientSecret);
    setSaved(true);
    onSaved?.();
  }

  return (
    <div className="rounded-xl border border-border p-4 bg-cream-soft/50">
      <p className="text-xs text-ink-soft mb-3">
        Credenciales OAuth de tu proyecto de Google Cloud (ver <strong>GOOGLE_SETUP.md</strong>).
        {hasBuiltIn && " Esta versión ya trae unas incluidas; rellénalas solo si quieres usar otras."}
      </p>
      <FormField label="Client ID">
        <input
          className={inputClasses}
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setSaved(false);
          }}
          placeholder="xxxx.apps.googleusercontent.com"
          spellCheck={false}
        />
      </FormField>
      <FormField label="Client Secret">
        <input
          className={inputClasses}
          type="password"
          value={clientSecret}
          onChange={(e) => {
            setClientSecret(e.target.value);
            setSaved(false);
          }}
          spellCheck={false}
        />
      </FormField>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={handleSave}>
          Guardar credenciales
        </Button>
        {saved && <span className="text-xs text-positive">Guardadas</span>}
      </div>
    </div>
  );
}

function GoogleCard() {
  const { data: status, isLoading } = useGoogleStatus();
  const connectMutation = useConnectGoogle();
  const syncMutation = useSyncGoogle();
  const importMutation = useImportGoogle();
  const disconnectMutation = useDisconnectGoogle();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<{ summary: string; warnings: string[] } | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  function reset() {
    setError(null);
    setSuccess(null);
    setImportInfo(null);
  }

  async function handleConnect() {
    reset();
    try {
      await connectMutation.mutateAsync();
      setSuccess("Cuenta de Google conectada correctamente. Pulsa \"Sincronizar ahora\" para crear la hoja.");
    } catch (err: any) {
      setError(err.message || "No se pudo completar la conexión con Google");
      if (/Client ID|Client Secret|credenciales/i.test(err.message || "")) setShowCredentials(true);
    }
  }

  async function handleSync() {
    reset();
    try {
      await syncMutation.mutateAsync();
      setSuccess("Hoja de cálculo actualizada.");
    } catch (err: any) {
      setError(err.message || "No se pudo sincronizar con Google Sheets");
    }
  }

  async function handleImport() {
    reset();
    try {
      const result = await importMutation.mutateAsync({ allowDeletes: true });
      setImportInfo({ summary: summarizeImport(result), warnings: result.warnings });
    } catch (err: any) {
      setError(err.message || "No se pudo importar los cambios desde Google Sheets");
    }
  }

  async function handleDisconnect() {
    if (!confirm("¿Desconectar tu cuenta de Google? Podrás volver a conectarla cuando quieras.")) return;
    reset();
    await disconnectMutation.mutateAsync();
  }

  return (
    <Card className="mt-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <FileSpreadsheet size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-ink">Google Drive · Sheets</h2>
          <p className="text-sm text-ink-soft mt-1">
            Guarda una copia de tus cuentas, categorías, transacciones y transferencias en una hoja de cálculo de tu
            Google Drive, y edítala desde allí si quieres.
          </p>

          {!googleAvailable ? (
            <Alert tone="info">
              La sincronización con Google Sheets está disponible en la versión de escritorio (Linux y Windows). En{" "}
              {platform === "android" ? "el móvil" : "esta versión"} usa <strong>Exportar copia</strong> /{" "}
              <strong>Restaurar copia</strong> para mover tus datos entre dispositivos.
            </Alert>
          ) : (
            <>
              {success && <Alert tone="ok">{success}</Alert>}
              {error && <Alert tone="error">{error}</Alert>}
              {importInfo && (
                <Alert tone="ok">
                  <span className="text-ink font-medium">{importInfo.summary}</span>
                  {importInfo.warnings.length > 0 && (
                    <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-ink-soft">
                      {importInfo.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </Alert>
              )}

              <div className="mt-5">
                {isLoading ? (
                  <div className="h-10 w-40 rounded-xl bg-cream-dark/60 animate-pulse" />
                ) : status?.connected ? (
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-1.5 text-sm text-positive font-medium">
                      <CheckCircle2 size={15} />
                      Conectado como {status.email}
                    </span>

                    <p className="text-xs text-ink-soft flex items-center gap-1.5 flex-wrap">
                      {status.lastSyncedAt
                        ? `Última sincronización: ${formatRelativeTime(status.lastSyncedAt)} (${formatDate(status.lastSyncedAt)})`
                        : "Todavía no has sincronizado tus datos."}
                      {status.pendingPush && (
                        <span className="inline-flex items-center gap-1 text-gold-dark">
                          <CloudUpload size={12} /> cambios pendientes de subir
                        </span>
                      )}
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
                        <Button variant="secondary" onClick={() => openExternal(status.spreadsheetUrl!)}>
                          <ExternalLink size={15} />
                          Abrir hoja de cálculo
                        </Button>
                      )}
                      <Button variant="ghost" onClick={handleDisconnect} disabled={disconnectMutation.isPending}>
                        Desconectar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleConnect} disabled={connectMutation.isPending}>
                        {connectMutation.isPending ? "Esperando a Google (mira tu navegador)..." : "Conectar con Google"}
                      </Button>
                      <Button variant="ghost" onClick={() => setShowCredentials((v) => !v)}>
                        <KeyRound size={15} />
                        Credenciales
                      </Button>
                    </div>
                    {showCredentials && <GoogleCredentialsForm />}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export function Settings() {
  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Copias de seguridad y sincronización" />

      <DataCard />
      <GoogleCard />

      {googleAvailable && (
        <Card className="mt-5">
          <h2 className="font-semibold text-ink mb-2">¿Cómo funciona la sincronización?</h2>
          <div className="text-sm text-ink-soft leading-relaxed space-y-3">
            <p>
              Al pulsar <strong>"Sincronizar ahora"</strong> se crea (la primera vez) una hoja de cálculo llamada
              "Gestor de Dinero" en tu Google Drive, con una pestaña para cada tipo de dato: Cuentas, Categorías,
              Transacciones y Transferencias.
            </p>
            <p>
              Mientras la app está abierta, tus cambios se suben solos a los pocos segundos, y la app revisa la hoja
              <strong> cada ~45 segundos</strong>: si editas una fila o añades una nueva directamente en Sheets
              (respetando los nombres de cuenta/categoría existentes), aparecerá aquí sola. Si hay cambios en los dos
              sitios a la vez, los de la app tienen prioridad. La revisión automática nunca borra datos.
            </p>
            <p>
              Si borraste alguna fila en la hoja y quieres que también desaparezca de la app, usa{" "}
              <strong>"Importar cambios"</strong>. Solo se borran registros que ya estaban en la hoja (nunca algo que
              aún no se había subido), y las cuentas con movimientos se archivan en vez de borrarse.
            </p>
            <p className="text-xs">
              No borres ni edites la columna <strong>ID</strong> de la hoja: es lo que usa la app para reconocer cada
              fila. Una fila con la columna ID vacía se trata como un registro nuevo.
            </p>
          </div>
        </Card>
      )}

      <p className="text-xs text-ink-faint text-center mt-6">
        Gestor de Dinero v{__APP_VERSION__} ·{" "}
        {platform === "desktop" ? "Escritorio" : platform === "android" ? "Android" : "Web"}
      </p>
    </div>
  );
}
