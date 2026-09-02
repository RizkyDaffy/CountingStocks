import { Router } from "express";
import crypto from "crypto";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const router = Router();

function generateUuid(): string {
  return crypto.randomUUID();
}

router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM factories ORDER BY created_at DESC",
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { uuid, factory_name, factory_code, factory_sc } = req.body;
    const factoryUuid = uuid || generateUuid();

    if (!factory_name) {
      return res.status(400).json({ success: false, error: "factory_name dibutuhkan." });
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM factories WHERE uuid = ? LIMIT 1",
      [factoryUuid],
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: "UUID sudah ada." });
    }

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO factories (uuid, factory_name, factory_code, factory_sc) VALUES (?, ?, ?, ?)",
      [factoryUuid, factory_name.trim(), (factory_code || "").trim(), (factory_sc || "").trim()],
    );
    const [newRow] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM factories WHERE uuid = ?",
      [factoryUuid],
    );
    res.status(201).json({ success: true, data: newRow[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put("/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const { factory_name, factory_code, factory_sc } = req.body;
    if (!factory_name) {
      return res.status(400).json({ success: false, error: "factory_name dibutuhkan." });
    }

    await pool.query(
      "UPDATE factories SET factory_name = ?, factory_code = ?, factory_sc = ? WHERE uuid = ?",
      [factory_name.trim(), (factory_code || "").trim(), (factory_sc || "").trim(), uuid],
    );
    const [updatedRow] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM factories WHERE uuid = ?",
      [uuid],
    );
    res.json({ success: true, data: updatedRow[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    await pool.query("DELETE FROM factories WHERE uuid = ?", [uuid]);
    res.json({ success: true, message: "Factory berhasil dihapus." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
