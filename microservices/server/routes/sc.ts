import { Router } from "express";
import crypto from "crypto";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const router = Router();

function generateHexId(): string {
  return crypto.randomBytes(10).toString("hex");
}

router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM sc ORDER BY created_at DESC");
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { id, sc_id } = req.body;
    const scId = id || generateHexId();
    const scIdVal = sc_id || scId;

    const [existing] = await pool.query<RowDataPacket[]>("SELECT 1 FROM sc WHERE id = ? LIMIT 1", [
      scId,
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: "SC ID sudah ada." });
    }

    const [result] = await pool.query<ResultSetHeader>("INSERT INTO sc (id, sc_id) VALUES (?, ?)", [
      scId,
      scIdVal,
    ]);
    const [newRow] = await pool.query<RowDataPacket[]>("SELECT * FROM sc WHERE id = ?", [scId]);
    res.status(201).json({ success: true, data: newRow[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { sc_id } = req.body;
    if (!sc_id) return res.status(400).json({ success: false, error: "sc_id dibutuhkan." });

    await pool.query("UPDATE sc SET sc_id = ? WHERE id = ?", [sc_id, id]);
    const [updatedRow] = await pool.query<RowDataPacket[]>("SELECT * FROM sc WHERE id = ?", [id]);
    res.json({ success: true, data: updatedRow[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM sc WHERE id = ?", [id]);
    res.json({ success: true, message: "SC berhasil dihapus." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
