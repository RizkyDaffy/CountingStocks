import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { syncShikakeSettingsToAnalytics } from "../lib/stockAnalyticsService.js";

const router = Router();

interface TeiteiRow extends RowDataPacket {
  id: number;
  master_part_id: number;
  shikake_value: number | string;
  min_val?: number | string;
  qty_per_day?: number | string;
  part_number: string;
  part_name: string;
  model: string;
  factory_origin: string;
  created_at: string;
  updated_at: string;
}

function mapTeitei(r: TeiteiRow) {
  return {
    id: r.id,
    masterPartId: r.master_part_id,
    teiteiValue: Number(r.shikake_value),
    minVal: Number(r.min_val ?? 0),
    qtyPerDay: Number(r.qty_per_day ?? 0),
    partNumber: r.part_number,
    partName: r.part_name,
    model: r.model,
    factoryOrigin: r.factory_origin,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query<TeiteiRow[]>(
      `SELECT s.id, s.master_part_id, s.shikake_value, s.min_val, s.qty_per_day, s.created_at, s.updated_at,
              mp.part_number, mp.part_name, mp.model, mp.factory_origin,
              sa.min_val AS analytics_min
       FROM shikake_settings s
       LEFT JOIN master_parts mp ON mp.id = s.master_part_id
       LEFT JOIN stock_analytics sa ON UPPER(sa.part_number) = UPPER(mp.part_number)
       GROUP BY s.id
       ORDER BY mp.part_number ASC`,
    );
    res.json({
      success: true,
      data: rows.map(mapTeitei),
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/parts", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT mp.id, mp.part_number, mp.part_name, mp.model, mp.factory_origin
       FROM master_parts mp
       WHERE mp.status = 'active'
       ORDER BY mp.part_number ASC`,
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        partNumber: r.part_number,
        partName: r.part_name,
        model: r.model,
        factoryOrigin: r.factory_origin,
      })),
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { masterPartId, teiteiValue, minVal = 0, qtyPerDay = 0 } = req.body;
    if (!masterPartId || teiteiValue == null) {
      return res.status(400).json({
        success: false,
        error: "Master part dan nilai teitei wajib diisi.",
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO shikake_settings (master_part_id, shikake_value, min_val, qty_per_day) VALUES (?, ?, ?, ?)",
      [masterPartId, Number(teiteiValue), Number(minVal), Number(qtyPerDay)],
    );

    const [mpRows] = await pool.query<RowDataPacket[]>(
      "SELECT part_number FROM master_parts WHERE id = ?",
      [masterPartId],
    );
    if (mpRows[0]?.part_number) {
      await syncShikakeSettingsToAnalytics(mpRows[0].part_number as string);
    }

    const [rows] = await pool.query<TeiteiRow[]>(
      `SELECT s.id, s.master_part_id, s.shikake_value, s.min_val, s.qty_per_day, mp.part_number, mp.part_name
       FROM shikake_settings s
       LEFT JOIN master_parts mp ON mp.id = s.master_part_id
       WHERE s.id = ?`,
      [result.insertId],
    );

    res.status(201).json({ success: true, data: mapTeitei(rows[0]) });
  } catch (err: unknown) {
    const msg = (err as Error).message || "";
    if (msg.includes("Duplicate")) {
      return res.status(409).json({
        success: false,
        error: "Teitei untuk part ini sudah ada.",
      });
    }
    res.status(500).json({ success: false, error: msg });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { teiteiValue, minVal, qtyPerDay } = req.body;

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, mp.part_number FROM shikake_settings s
       LEFT JOIN master_parts mp ON mp.id = s.master_part_id
       WHERE s.id = ?`,
      [req.params.id],
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    if (teiteiValue != null) {
      updates.push("shikake_value = ?");
      values.push(Number(teiteiValue));
    }
    if (minVal != null) {
      updates.push("min_val = ?");
      values.push(Number(minVal));
    }
    if (qtyPerDay != null) {
      updates.push("qty_per_day = ?");
      values.push(Number(qtyPerDay));
    }
    if (updates.length) {
      values.push(req.params.id);
      await pool.query(`UPDATE shikake_settings SET ${updates.join(", ")} WHERE id = ?`, values);
    }

    const partNumber = existing[0].part_number as string;
    if (partNumber) {
      await syncShikakeSettingsToAnalytics(partNumber);
    }

    const [rows] = await pool.query<TeiteiRow[]>(
      `SELECT s.id, s.master_part_id, s.shikake_value, s.min_val, s.qty_per_day, mp.part_number, mp.part_name
       FROM shikake_settings s
       LEFT JOIN master_parts mp ON mp.id = s.master_part_id
       WHERE s.id = ?`,
      [req.params.id],
    );
    res.json({ success: true, data: mapTeitei(rows[0]) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/teitei/:id
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM shikake_settings WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Teitei dihapus." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
