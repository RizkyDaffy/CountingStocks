import { Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import type { RowDataPacket } from "mysql2";
import { config } from "../config.js";
import { verifyHash, hashPassword } from "../lib/crypto.js";
import { normalizeRole } from "../lib/roles.js";

const router = Router();
const SECRET_KEY = config.JWT_SECRET;

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username/NIK dan password dibutuhkan",
      });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM users WHERE (username = ? OR nik = ?) AND status = 'active'",
      [username, username],
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: "Username atau password salah" });
    }

    const user = rows[0];
    const { valid, needsRehash } = await verifyHash(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Username atau password salah" });
    }

    if (needsRehash) {
      const newHash = await hashPassword(password);
      await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, user.id]);
    }

    const role = normalizeRole(String(user.role));

    const token = jwt.sign({ id: user.id, username: user.username, role }, SECRET_KEY, {
      expiresIn: "8h",
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role,
          tvFactory: user.tv_factory ?? "",
          tvShift: user.tv_shift ?? "A",
          tvTheme: user.tv_theme ?? "default",
        },
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
