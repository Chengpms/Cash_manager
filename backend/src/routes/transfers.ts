import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

const router = Router();

const transferSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional().nullable(),
  date: z.coerce.date().optional(),
  fromAccountId: z.string(),
  toAccountId: z.string(),
});

router.get("/", async (req, res, next) => {
  try {
    const { limit } = req.query;
    const transfers = await prisma.transfer.findMany({
      orderBy: { date: "desc" },
      take: limit ? Number(limit) : undefined,
      include: { fromAccount: true, toAccount: true },
    });
    res.json(transfers);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = transferSchema.parse(req.body);
    if (data.fromAccountId === data.toAccountId) {
      return res.status(400).json({ error: "La cuenta de origen y destino no pueden ser la misma" });
    }
    const transfer = await prisma.transfer.create({
      data,
      include: { fromAccount: true, toAccount: true },
    });
    res.status(201).json(transfer);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.transfer.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
