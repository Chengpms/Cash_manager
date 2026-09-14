import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

const router = Router();

const transactionSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["income", "expense"]),
  description: z.string().optional().nullable(),
  date: z.coerce.date().optional(),
  accountId: z.string(),
  categoryId: z.string().optional().nullable(),
});

// GET /api/transactions?accountId=&categoryId=&type=&from=&to=&search=&limit=
router.get("/", async (req, res, next) => {
  try {
    const { accountId, categoryId, type, from, to, search, limit } = req.query;

    const where: any = {};
    if (accountId) where.accountId = String(accountId);
    if (categoryId) where.categoryId = String(categoryId);
    if (type) where.type = String(type);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(String(from));
      if (to) where.date.lte = new Date(String(to));
    }
    if (search) where.description = { contains: String(search) };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit ? Number(limit) : undefined,
      include: { account: true, category: true },
    });

    res.json(transactions);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);
    const transaction = await prisma.transaction.create({
      data,
      include: { account: true, category: true },
    });
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const data = transactionSchema.partial().parse(req.body);
    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data,
      include: { account: true, category: true },
    });
    res.json(transaction);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.transaction.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
