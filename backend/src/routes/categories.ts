import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

const router = Router();

const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["income", "expense"]),
  color: z.string().default("#8A7A6D"),
  icon: z.string().default("tag"),
});

router.get("/", async (req, res, next) => {
  try {
    const { type } = req.query;
    const categories = await prisma.category.findMany({
      where: type ? { type: String(type) } : undefined,
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const data = categorySchema.partial().parse(req.body);
    const category = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json(category);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
