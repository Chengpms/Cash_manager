import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import accountsRouter from "./routes/accounts";
import categoriesRouter from "./routes/categories";
import transactionsRouter from "./routes/transactions";
import transfersRouter from "./routes/transfers";
import statsRouter from "./routes/stats";
import googleRouter from "./routes/google";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/accounts", accountsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/stats", statsRouter);
app.use("/api/google", googleRouter);

// Manejador de errores centralizado
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`Gestor de Dinero API escuchando en http://localhost:${PORT}`);
});
