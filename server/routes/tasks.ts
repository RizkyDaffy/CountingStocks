import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket } from "mysql2";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM tasks ORDER BY created_at DESC",
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, type, status, user } = req.body;

    if (!title || !type || !user) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const [maxRow] = await pool.query<RowDataPacket[]>(
      "SELECT task_id FROM tasks ORDER BY id DESC LIMIT 1",
    );
    let nextNum = 1001;
    if (maxRow.length > 0) {
      const lastNum = parseInt(maxRow[0].task_id.replace("T-", ""), 10);
      nextNum = lastNum + 1;
    }
    const task_id = `T-${nextNum}`;

    await pool.query(
      "INSERT INTO tasks (task_id, title, type, status, user) VALUES (?, ?, ?, ?, ?)",
      [task_id, title, type, status || "pending", user],
    );

    res.status(201).json({ success: true, data: { task_id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
