import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { computeAccountBalance } from "../utils";

const router = Router();

const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["checking", "savings", "cash", "credit", "investment"]),
  currency: z.string().default("EUR"),
  color: z.string().default("#E8703A"),
  icon: z.string().default("wallet"),
  initialBalance: z.number().default(0),
});

// GET /api/accounts - lista todas las cuentas con su balance calculado
router.get("/", async (_req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { archived: false },
      orderBy: { createdAt: "asc" },
      include: {
        transactions: true,
        transfersFrom: true,
        transfersTo: true,
      },
    });

    const result = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      color: a.color,
      icon: a.icon,
      initialBalance: a.initialBalance,
      createdAt: a.createdAt,
      balance: computeAccountBalance(a, a.transactions, a.transfersFrom, a.transfersTo),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/accounts/:id
router.get("/:id", async (req, res, next) => {
  try {
    const a = await prisma.account.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { transactions: true, transfersFrom: true, transfersTo: true },
    });
    res.json({
      ...a,
      balance: computeAccountBalance(a, a.transactions, a.transfersFrom, a.transfersTo),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/accounts
router.post("/", async (req, res, next) => {
  try {
    const data = accountSchema.parse(req.body);
    const account = await prisma.account.create({ data });
    res.status(201).json({ ...account, balance: account.initialBalance });
  } catch (err) {
    next(err);
  }
});

// PUT /api/accounts/:id
router.put("/:id", async (req, res, next) => {
  try {
    const data = accountSchema.partial().parse(req.body);
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data,
      include: { transactions: true, transfersFrom: true, transfersTo: true },
    });
    res.json({
      ...account,
      balance: computeAccountBalance(account, account.transactions, account.transfersFrom, account.transfersTo),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/accounts/:id (archivar en vez de borrar si tiene movimientos o transferencias)
router.delete("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const [txCount, transferCount] = await Promise.all([
      prisma.transaction.count({ where: { accountId: id } }),
      prisma.transfer.count({ where: { OR: [{ fromAccountId: id }, { toAccountId: id }] } }),
    ]);

    if (txCount > 0 || transferCount > 0) {
      await prisma.account.update({ where: { id }, data: { archived: true } });
      return res.json({ archived: true });
    }
    await prisma.account.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
