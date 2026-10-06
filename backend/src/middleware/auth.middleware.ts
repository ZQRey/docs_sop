import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
export const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32)
  throw new Error("JWT_SECRET must contain at least 32 characters");
export const isAdmin: RequestHandler = (req, res, next) => {
  try {
    const payload = jwt.verify(
      req.cookies.session || "",
      secret,
    ) as jwt.JwtPayload;
    db.admin
      .findUnique({
        where: { id: String(payload.sub) },
        select: { id: true, username: true },
      })
      .then((admin) => {
        if (!admin) {
          res.status(401).json({ error: "Требуется вход" });
          return;
        }
        res.locals.admin = admin;
        next();
      })
      .catch(next);
  } catch {
    res.status(401).json({ error: "Требуется вход" });
  }
};
