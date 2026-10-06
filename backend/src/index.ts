import express, { ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { auth } from "./modules/auth";
import { categories } from "./modules/categories";
import { documents } from "./modules/documents";
import { initializeStorage } from "./services/storage.service";
import { db } from "./db";
const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: { action: "sameorigin" },
  }),
  express.json({ limit: "32kb" }),
  cookieParser(),
);
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && new URL(origin).host !== req.get("host")) {
      res.status(403).json({ error: "Недопустимый источник запроса" });
      return;
    }
  }
  next();
});
app.get("/api/health", async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});
app.use("/api/auth", auth);
app.use("/api/categories", categories);
app.use("/api/documents", documents);
app.use((_req, res) => res.status(404).json({ error: "Маршрут не найден" }));
const errors: ErrorRequestHandler = (
  err: Error & { status?: number },
  _req,
  res,
  _next,
) => {
  console.error(err);
  let status = err.status || 500;
  if (err instanceof ZodError || err instanceof multer.MulterError)
    status = 400;
  if (err instanceof Prisma.PrismaClientKnownRequestError)
    status = err.code === "P2025" ? 404 : 400;
  res
    .status(status)
    .json({
      error:
        status === 500
          ? "Ошибка сервера"
          : err instanceof ZodError
            ? "Проверьте поля формы"
            : err.message,
    });
};
app.use(errors);
initializeStorage()
  .then(() =>
    app.listen(3000, "0.0.0.0", () => console.log("API listening on 3000")),
  )
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
