import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "../db";
import { isAdmin, secret } from "../middleware/auth.middleware";
import { route } from "../route";
export const auth = Router();
auth.post(
  "/login",
  rateLimit({ windowMs: 900000, limit: 20 }),
  route(async (req, res) => {
    const body = z
      .object({ username: z.string().max(100), password: z.string().max(200) })
      .parse(req.body);
    const admin = await db.admin.findUnique({
      where: { username: body.username },
    });
    if (!admin || !(await bcrypt.compare(body.password, admin.passwordHash))) {
      res.status(401).json({ error: "Неверный логин или пароль" });
      return;
    }
    res.cookie(
      "session",
      jwt.sign({}, secret!, { subject: admin.id, expiresIn: "8h" }),
      {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.COOKIE_SECURE === "true",
        maxAge: 28800000,
      },
    );
    res.json({ id: admin.id, username: admin.username });
  }),
);
auth.get("/me", isAdmin, (_req, res) => res.json(res.locals.admin));
auth.post("/logout", (_req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});
