import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket } from "mysql2";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    const factory = (req.query.factory as string) || "";

    let query = "SELECT * FROM stock WHERE 1=1";
    const params: string[] = [];

    if (search) {
      query += " AND part_name LIKE ?";
      params.push(`%${search}%`);
    }

    if (factory && factory !== "All") {
      query += " AND factory = ?";
      params.push(factory);
    }

    const limit = Number(req.query.limit) || 1000;
    query += " ORDER BY part_name ASC LIMIT ?";
    params.push(limit as any);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stock/stats - summary stats
router.get("/stats", async (req, res) => {
  try {
    const [totalResult] = await pool.query<RowDataPacket[]>(
      "SELECT COALESCE(SUM(units), 0) AS total_units, COUNT(*) AS sku_count FROM stock",
    );
    const [lowStockResult] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS low_stock FROM stock WHERE units < 100",
    );

    res.json({
      success: true,
      data: {
        totalUnits: totalResult[0].total_units,
        skuCount: totalResult[0].sku_count,
        lowStock: lowStockResult[0].low_stock,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stock/factories - list distinct factories
router.get("/factories", async (req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT DISTINCT factory FROM stock ORDER BY factory",
    );
    const factories = rows.map((r) => r.factory);
    res.json({ success: true, data: factories });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
