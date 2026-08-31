import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket } from "mysql2";

const router = Router();

router.get("/recent", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM scan_records ORDER BY created_at DESC LIMIT ?",
      [limit],
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { qr_id, label, factory, scanned_by } = req.body;

    if (!qr_id || !label) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    await pool.query(
      "INSERT INTO scan_records (qr_id, label, factory, scanned_by) VALUES (?, ?, ?, ?)",
      [qr_id, label, factory || "", scanned_by || "System"],
    );

    const [maxTask] = await pool.query<RowDataPacket[]>(
      "SELECT task_id FROM tasks ORDER BY id DESC LIMIT 1",
    );
    let nextNum = 1001;
    if (maxTask.length > 0) {
      const lastNum = parseInt(maxTask[0].task_id.replace("T-", ""), 10);
      nextNum = lastNum + 1;
    }
    const task_id = `T-${nextNum}`;

    await pool.query(
      "INSERT INTO tasks (task_id, title, type, status, user) VALUES (?, ?, 'Scan In', 'completed', ?)",
      [task_id, `Scanned ${label} (${qr_id})`, scanned_by || "System"],
    );

    res.status(201).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
