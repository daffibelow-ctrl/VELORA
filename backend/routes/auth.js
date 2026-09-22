import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../config/db.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(6).max(30).optional(),
  password: z.string().min(8).max(128),
  username: z.string().regex(/^[a-z0-9_-]{3,30}$/)
});

const loginSchema = z.object({
  identifier: z.string().min(3).max(255),
  password: z.string().min(8).max(128)
});

function sign(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
}

router.post("/register", validate(registerSchema), async (req, res) => {
  const { name, email, phone, password, username } = req.body;
  const client = await (await import("../config/db.js")).pool.connect();
  try {
    await client.query("BEGIN");
    const hash = await bcrypt.hash(password, 12);
    const u = await client.query(
      `INSERT INTO users (name,email,phone,password_hash,username)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,name,email,phone,username,role,created_at`,
      [name,email,phone || null,hash,username]
    );
    const user = u.rows[0];
    await client.query(
      `INSERT INTO stores (user_id, name, slug, bio)
       VALUES ($1,$2,$3,$4)`,
      [user.id, name + " Store", username, ""]
    );
    await client.query(
      `INSERT INTO wallets (user_id, available_balance, pending_balance)
       VALUES ($1,0,0)`,
      [user.id]
    );
    await client.query("COMMIT");
    res.status(201).json({ user, token: sign(user) });
  } catch (e) {
    await client.query("ROLLBACK");
    const duplicate = e.code === "23505";
    res.status(duplicate ? 409 : 500).json({
      error: duplicate ? "Email, username, or phone already exists" : "Registration failed"
    });
  } finally {
    client.release();
  }
});

router.post("/login", validate(loginSchema), async (req, res) => {
  const { identifier, password } = req.body;
  const r = await query(
    `SELECT id,name,email,phone,username,role,password_hash
     FROM users
     WHERE lower(email)=lower($1) OR phone=$1 OR username=$1
     LIMIT 1`,
    [identifier]
  );
  if (!r.rows.length) return res.status(401).json({ error: "Invalid credentials" });
  const user = r.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  delete user.password_hash;
  res.json({ user, token: sign(user) });
});

export default router;
