import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { root } from "../services/storage.service";
export const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(root, "originals"),
    filename: (_req, file, cb) =>
      cb(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 3 },
  fileFilter: (_req, file, cb) => {
    if (
      ![".pdf", ".doc", ".docx"].includes(
        path.extname(file.originalname).toLowerCase(),
      )
    )
      cb(
        Object.assign(new Error("Разрешены PDF, DOC и DOCX"), { status: 400 }),
      );
    else cb(null, true);
  },
});
