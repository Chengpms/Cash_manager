import { Router } from "express";
import { disconnect, getAuthUrl, getStatus, handleCallback, importFromSheets, syncToSheets } from "../google";

const router = Router();

// GET /api/google/auth-url - URL de consentimiento de Google para iniciar sesión
router.get("/auth-url", (_req, res) => {
  try {
    res.json({ url: getAuthUrl() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/google/callback - Google redirige aquí tras el consentimiento
router.get("/callback", async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const code = req.query.code as string | undefined;
  const errorParam = req.query.error as string | undefined;

  if (errorParam || !code) {
    return res.redirect(`${frontendUrl}/ajustes?google=error`);
  }

  try {
    await handleCallback(code);
    res.redirect(`${frontendUrl}/ajustes?google=connected`);
  } catch (err) {
    console.error(err);
    res.redirect(`${frontendUrl}/ajustes?google=error`);
  }
});

// GET /api/google/status
router.get("/status", async (_req, res, next) => {
  try {
    res.json(await getStatus());
  } catch (err) {
    next(err);
  }
});

// POST /api/google/sync - crea/actualiza la hoja de cálculo con los datos actuales
router.post("/sync", async (_req, res, next) => {
  try {
    const result = await syncToSheets();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "No se pudo sincronizar con Google Sheets" });
  }
});

// POST /api/google/import - importa cambios hechos a mano en la hoja de cálculo
// body: { allowDeletes?: boolean } - si es true, las filas borradas en la hoja
// se borran (o archivan, en el caso de cuentas con movimientos) también en la app
router.post("/import", async (req, res, next) => {
  try {
    const allowDeletes = req.body?.allowDeletes === true;
    const result = await importFromSheets(allowDeletes);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "No se pudo importar desde Google Sheets" });
  }
});

// POST /api/google/disconnect
router.post("/disconnect", async (_req, res, next) => {
  try {
    await disconnect();
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
});

export default router;
