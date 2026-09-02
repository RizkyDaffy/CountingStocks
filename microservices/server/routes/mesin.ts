import { Router } from "express";
import crypto from "crypto";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const router = Router();

function generateUuid(): string {
  return crypto.randomUUID();
}

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
      machineDesc = "",
      machineStatus = "active",
      machineSc = "",
      machineFactory = "",
      uuid,
    } = req.body;
    const machineUuid = uuid || generateUuid();

    if (!machineCode || !machineName) {
      return res.status(400).json({
        success: false,
        error: "Machine Code dan Machine Name wajib diisi.",
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO mesin (uuid, machine_code, machine_name, machine_desc, machine_status, machine_sc, machine_factory) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        machineUuid,
        machineCode.trim().toUpperCase(),
        machineName.trim(),
        machineDesc.trim(),
        machineStatus,
        String(machineSc).trim(),
        String(machineFactory).trim(),
      ],
    );

    const [newRow] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM mesin WHERE uuid = ?",
      [machineUuid],
    );

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

router.put("/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const {
      machineCode,
      machineName,
      machineDesc = "",
      machineStatus = "active",
      machineSc = "",
      machineFactory = "",
    } = req.body;

    if (!machineCode || !machineName) {
      return res.status(400).json({
        success: false,
        error: "Machine Code dan Machine Name wajib diisi.",
      });
    }

    await pool.query(
      `UPDATE mesin SET machine_code = ?, machine_name = ?, machine_desc = ?, machine_status = ?, machine_sc = ?, machine_factory = ? WHERE uuid = ?`,
      [
        machineCode.trim().toUpperCase(),
        machineName.trim(),
        machineDesc.trim(),
        machineStatus,
        String(machineSc).trim(),
        String(machineFactory).trim(),
        uuid,
      ],
    );

    const [updatedRow] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM mesin WHERE uuid = ?",
      [uuid],
    );

    res.json({ success: true, data: updatedRow[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.patch("/:uuid/toggle", async (req, res) => {
  try {
    const { uuid } = req.params;
    await pool.query(
      `UPDATE mesin SET machine_status = IF(machine_status = 'active', 'inactive', 'active') WHERE uuid = ?`,
      [uuid],
    );
    const [row] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM mesin WHERE uuid = ?",
      [uuid],
    );
    res.json({ success: true, data: row[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    await pool.query("DELETE FROM mesin WHERE uuid = ?", [uuid]);
    res.json({ success: true, message: "Mesin berhasil dihapus." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
