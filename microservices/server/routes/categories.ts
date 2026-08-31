import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM categories ORDER BY created_at DESC",
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Nama kategori dibutuhkan." });

    const [result] = await pool.query<ResultSetHeader>("INSERT INTO categories (name) VALUES (?)", [
      name.trim(),
    ]);
    const [newRow] = await pool.query<RowDataPacket[]>("SELECT * FROM categories WHERE id = ?", [
      result.insertId,
    ]);
    res.status(201).json({ success: true, data: newRow[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Nama kategori dibutuhkan." });

    await pool.query("UPDATE categories SET name = ? WHERE id = ?", [name.trim(), id]);
    const [updatedRow] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM categories WHERE id = ?",
      [id],
    );
    res.json({ success: true, data: updatedRow[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM categories WHERE id = ?", [id]);
    res.json({ success: true, message: "Kategori berhasil dihapus." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
