import { Router } from "express";
import path from "node:path";
import { open } from "node:fs/promises";
import { z } from "zod";
import { db } from "../db";
import { route } from "../route";
import { isAdmin } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";
import { removeFiles, storagePath } from "../services/storage.service";
import { validSignature } from "../services/validation";
import { convert } from "../services/gotenberg.service";
export const documents = Router();
documents.get(
  "/",
  route(async (req, res) => {
    const q = z
      .object({
        categoryId: z.string().uuid().optional(),
        search: z.string().max(200).optional(),
        tag: z.string().max(80).optional(),
      })
      .parse(req.query);
    const docs = await db.document.findMany({
      where: {
        categoryId: q.categoryId,
        title: q.search
          ? { contains: q.search, mode: "insensitive" }
          : undefined,
        tags: q.tag ? { has: q.tag } : undefined,
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    res.json(
      docs.map(({ filePath, pdfPath, ...d }) => ({
        ...d,
        fileSize: Number(d.fileSize),
      })),
    );
  }),
);
documents.post(
  "/",
  isAdmin,
  upload.single("file"),
  route(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Выберите файл" });
      return;
    }
    const filePath = `originals/${req.file.filename}`;
    let pdfPath = filePath;
    try {
      const body = z
        .object({
          title: z.string().trim().min(1).max(300),
          categoryId: z.string().uuid(),
          tags: z.string().max(1000).default(""),
        })
        .parse(req.body);
      const ext = path.extname(req.file.filename);
      const handle = await open(storagePath(filePath), "r");
      const bytes = Buffer.alloc(8);
      try {
        await handle.read(bytes, 0, 8, 0);
      } finally {
        await handle.close();
      }
      if (!validSignature(ext, bytes))
        throw Object.assign(
          new Error("Содержимое файла не соответствует формату"),
          { status: 400 },
        );
      if (!(await db.category.findUnique({ where: { id: body.categoryId } })))
        throw Object.assign(new Error("Категория не найдена"), { status: 404 });
      if (ext !== ".pdf") {
        pdfPath = `pdf/${path.parse(req.file.filename).name}.pdf`;
        await convert(filePath, pdfPath, req.file.filename);
      }
      const doc = await db.document.create({
        data: {
          title: body.title,
          categoryId: body.categoryId,
          tags: [
            ...new Set(
              body.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            ),
          ].slice(0, 30),
          originalFilename: Buffer.from(
            req.file.originalname,
            "latin1",
          ).toString("utf8"),
          filePath,
          pdfPath,
          mimeType:
            ext === ".pdf"
              ? "application/pdf"
              : ext === ".doc"
                ? "application/msword"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileSize: BigInt(req.file.size),
        },
      });
      res.status(201).json({ id: doc.id });
    } catch (e) {
      await removeFiles([filePath, pdfPath]);
      throw e;
    }
  }),
);
documents.delete(
  "/:id",
  isAdmin,
  route(async (req, res) => {
    const doc = await db.document.delete({ where: { id: req.params.id } });
    await removeFiles([doc.filePath, doc.pdfPath]);
    res.json({ ok: true });
  }),
);
for (const mode of ["preview", "download"])
  documents.get(
    `/:id/${mode}`,
    route(async (req, res) => {
      const doc = await db.document.findUnique({
        where: { id: req.params.id },
      });
      if (!doc) {
        res.status(404).json({ error: "Документ не найден" });
        return;
      }
      if (mode === "preview") {
        res.type("pdf");
        res.setHeader("Content-Disposition", 'inline; filename="doc.pdf"');
        res.sendFile(storagePath(doc.pdfPath));
      } else res.download(storagePath(doc.filePath), doc.originalFilename);
    }),
  );
