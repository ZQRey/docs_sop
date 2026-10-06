import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { route } from "../route";
import { isAdmin } from "../middleware/auth.middleware";
import { removeFiles } from "../services/storage.service";
export const categories = Router();
categories.get(
  "/tree",
  route(async (_req, res) => {
    const rows = await db.category.findMany({
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
      include: { _count: { select: { documents: true } } },
    });
    type Tree = {
      id: string;
      name: string;
      parentId: string | null;
      orderIndex: number;
      count: number;
      children: Tree[];
    };
    const build = (parentId: string | null): Tree[] =>
      rows
        .filter((r) => r.parentId === parentId)
        .map((r) => {
          const children = build(r.id);
          return {
            id: r.id,
            name: r.name,
            parentId: r.parentId,
            orderIndex: r.orderIndex,
            count:
              r._count.documents + children.reduce((n, c) => n + c.count, 0),
            children,
          };
        });
    res.json(build(null));
  }),
);
categories.post(
  "/",
  isAdmin,
  route(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(150),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(req.body);
    res.status(201).json(await db.category.create({ data }));
  }),
);
categories.patch(
  "/:id",
  isAdmin,
  route(async (req, res) => {
    const data = z
      .object({ name: z.string().trim().min(1).max(150) })
      .parse(req.body);
    res.json(await db.category.update({ where: { id: req.params.id }, data }));
  }),
);
categories.delete(
  "/:id",
  isAdmin,
  route(async (req, res) => {
    const rows = await db.category.findMany({
      select: { id: true, parentId: true },
    });
    const ids = new Set([req.params.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows)
        if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) {
          ids.add(row.id);
          changed = true;
        }
    }
    const docs = await db.document.findMany({
      where: { categoryId: { in: [...ids] } },
    });
    await db.category.delete({ where: { id: req.params.id } });
    await removeFiles(docs.flatMap((d) => [d.filePath, d.pdfPath]));
    res.json({ ok: true });
  }),
);
