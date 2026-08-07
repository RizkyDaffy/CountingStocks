import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    let query = "SELECT * FROM mesin";
    const params: string[] = [];

    if (search) {
      query += " WHERE machine_code LIKE ? OR machine_name LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
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
      machineCode,
      machineName,
      description = "",
      status = "active",
      factory = "",
    } = req.body;

    if (!machineCode || !machineName) {
      return res.status(400).json({
        success: false,
        error: "Machine Code dan Machine Name wajib diisi.",
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO mesin (machine_code, machine_name, description, status, factory) VALUES (?, ?, ?, ?, ?)`,
      [
        machineCode.trim().toUpperCase(),
        machineName.trim(),
        description.trim(),
        status,
        String(factory).trim(),
      ],
    );

    const [newRow] = await pool.query<RowDataPacket[]>("SELECT * FROM mesin WHERE id = ?", [
      result.insertId,
    ]);

    res.status(201).json({ success: true, data: newRow[0] });
  } catch (err: unknown) {
    const msg = (err as Error).message || "";
    if (msg.includes("Duplicate entry")) {
      return res.status(409).json({
        success: false,
        error: "Machine Code sudah terdaftar. Gunakan kode yang berbeda.",
      });
    }
    res.status(500).json({ success: false, error: msg });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      machineCode,
      machineName,
      description = "",
      status = "active",
      factory = "",
    } = req.body;

    if (!machineCode || !machineName) {
      return res.status(400).json({
        success: false,
        error: "Machine Code dan Machine Name wajib diisi.",
      });
    }

    await pool.query(
      `UPDATE mesin SET machine_code = ?, machine_name = ?, description = ?, status = ?, factory = ? WHERE id = ?`,
      [
        machineCode.trim().toUpperCase(),
        machineName.trim(),
        description.trim(),
        status,
        String(factory).trim(),
        id,
      ],
    );

    const [updatedRow] = await pool.query<RowDataPacket[]>("SELECT * FROM mesin WHERE id = ?", [
      id,
    ]);

    res.json({ success: true, data: updatedRow[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.patch("/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE mesin SET status = IF(status = 'active', 'inactive', 'active') WHERE id = ?`,
      [id],
    );
    const [row] = await pool.query<RowDataPacket[]>("SELECT * FROM mesin WHERE id = ?", [id]);
    res.json({ success: true, data: row[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM mesin WHERE id = ?", [id]);
    res.json({ success: true, message: "Mesin berhasil dihapus." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
