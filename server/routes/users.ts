import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { hashPassword } from "../lib/crypto.js";
import { normalizeRole } from "../lib/roles.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    let query =
      "SELECT id, username, nik, role, status, tv_factory, tv_shift, tv_theme, created_at, updated_at FROM users";
    const params: string[] = [];

    if (search) {
      query += " WHERE username LIKE ? OR nik LIKE ? OR role LIKE ?";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += " ORDER BY created_at DESC";
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      username,
      nik = "",
      password,
      role = "operator",
      status = "active",
      tvFactory = "",
      tvShift = "A",
      tvTheme = "default",
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username dan password wajib diisi.",
      });
    }

    const normalizedRole = normalizeRole(role);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (username, nik, password_hash, role, status, tv_factory, tv_shift, tv_theme)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username.trim(),
        nik.trim(),
        await hashPassword(password),
        normalizedRole,
        status,
        tvFactory,
        tvShift,
        tvTheme,
      ],
    );

    const [newRow] = await pool.query<RowDataPacket[]>(
      `SELECT id, username, nik, role, status, tv_factory, tv_shift, tv_theme, created_at, updated_at
       FROM users WHERE id = ?`,
      [result.insertId],
    );

    res.status(201).json({ success: true, data: newRow[0] });
  } catch (err: unknown) {
    const msg = (err as Error).message || "";
    if (msg.includes("Duplicate entry")) {
      return res.status(409).json({ success: false, error: "Username sudah digunakan." });
    }
    res.status(500).json({ success: false, error: msg });
  }
});

router.put("/:id", async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, error: "Hanya admin yang bisa mengubah user." });
  }

  try {
    const { id } = req.params;
    const {
      username,
      nik = "",
      password,
      role = "operator",
      status = "active",
      tvFactory = "",
      tvShift = "A",
      tvTheme = "default",
    } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, error: "Username wajib diisi." });
    }

    const normalizedRole = normalizeRole(role);

    const fields = [
      "username = ?",
      "nik = ?",
      "role = ?",
      "status = ?",
      "tv_factory = ?",
      "tv_shift = ?",
      "tv_theme = ?",
    ];
    const values: unknown[] = [
      username.trim(),
      nik.trim(),
      normalizedRole,
      status,
      tvFactory,
      tvShift,
      tvTheme,
    ];

    if (password) {
      fields.push("password_hash = ?");
      values.push(await hashPassword(password));
    }

    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);

    const [updatedRow] = await pool.query<RowDataPacket[]>(
      `SELECT id, username, nik, role, status, tv_factory, tv_shift, tv_theme, created_at, updated_at
       FROM users WHERE id = ?`,
      [id],
    );

    res.json({ success: true, data: updatedRow[0] });
  } catch (err: unknown) {
    const msg = (err as Error).message || "";
    if (msg.includes("Duplicate entry")) {
      return res.status(409).json({ success: false, error: "Username sudah digunakan." });
    }
    res.status(500).json({ success: false, error: msg });
  }
});

router.delete("/:id", async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, error: "Hanya admin yang bisa menghapus user." });
  }

  try {
    const { id } = req.params;
    await pool.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ success: true, message: "User berhasil dihapus." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
