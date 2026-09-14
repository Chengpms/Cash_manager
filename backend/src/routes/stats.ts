import { Router } from "express";
import { prisma } from "../db";
import { computeAccountBalance, startOfMonth, endOfMonth, monthKey } from "../utils";

const router = Router();

// GET /api/stats/summary - balance total, ingresos/gastos del mes actual
router.get("/summary", async (_req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { archived: false },
      include: { transactions: true, transfersFrom: true, transfersTo: true },
    });

    const totalBalance = accounts.reduce(
      (sum, a) => sum + computeAccountBalance(a, a.transactions, a.transfersFrom, a.transfersTo),
      0
    );

    const now = new Date();
    const from = startOfMonth(now);
    const to = endOfMonth(now);

    const monthTx = await prisma.transaction.findMany({
      where: { date: { gte: from, lte: to } },
    });

    const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    res.json({
      totalBalance: Math.round(totalBalance * 100) / 100,
      monthIncome: Math.round(income * 100) / 100,
      monthExpense: Math.round(expense * 100) / 100,
      accountsCount: accounts.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/trend?months=6 - serie mensual de ingresos/gastos
router.get("/trend", async (req, res, next) => {
  try {
    const months = Number(req.query.months) || 6;
    const now = new Date();
    const from = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1));

    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: from } },
    });

    const buckets = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      buckets.set(monthKey(d), { income: 0, expense: 0 });
    }

    for (const t of transactions) {
      const key = monthKey(new Date(t.date));
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (t.type === "income") bucket.income += t.amount;
      else bucket.expense += t.amount;
    }

    const series = Array.from(buckets.entries()).map(([month, v]) => ({
      month,
      income: Math.round(v.income * 100) / 100,
      expense: Math.round(v.expense * 100) / 100,
    }));

    res.json(series);
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/by-category?type=expense&from=&to= - desglose por categoría
router.get("/by-category", async (req, res, next) => {
  try {
    const type = String(req.query.type || "expense");
    const now = new Date();
    const from = req.query.from ? new Date(String(req.query.from)) : startOfMonth(now);
    const to = req.query.to ? new Date(String(req.query.to)) : endOfMonth(now);

    const transactions = await prisma.transaction.findMany({
      where: { type, date: { gte: from, lte: to } },
      include: { category: true },
    });

    const byCategory = new Map<string, { name: string; color: string; icon: string; total: number }>();
    for (const t of transactions) {
      const key = t.categoryId || "sin-categoria";
      const existing = byCategory.get(key);
      if (existing) {
        existing.total += t.amount;
      } else {
        byCategory.set(key, {
          name: t.category?.name || "Sin categoría",
          color: t.category?.color || "#8A7A6D",
          icon: t.category?.icon || "tag",
          total: t.amount,
        });
      }
    }

    const result = Array.from(byCategory.values())
      .map((c) => ({ ...c, total: Math.round(c.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
