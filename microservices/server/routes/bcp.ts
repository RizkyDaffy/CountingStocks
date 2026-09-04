/**
 * BCP (Business Continuity Plan) Routes
 *
 * /api/bcp
 *   GET  /            - list all bcp_links
 *   GET  /parts       - all master_parts (for the part selector)
 *   GET  /sheets      - proxy: list sheets from gsheet microservice
 *   GET  /sheets/:key/rows - proxy: rawValues for one sheet tab (for part matching)
 *   POST /            - create/update a link (upsert by part_id)
 *   POST /sync        - trigger immediate background sync
 *   DELETE /:id       - remove a link
 */

import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { syncOnce } from "../lib/bcpSyncService.js";

const router = Router();

const GSHEET_BASE = process.env.GSHEET_SERVICE_URL || "http://localhost:4002";
// Same spreadsheet the gsheet microservice reads; stored per link row.
const SPREADSHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID || "18A9v3_zzugc0obDRY1BfvZliMsp4ceI0M6cFJRWpv9A";

async function proxyGsheet(path: string): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(`${GSHEET_BASE}/api/v1/${path}`, {
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, data: { error: String(err) } };
  }
}

// GET /api/bcp - current links
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM bcp_links ORDER BY part_name ASC",
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/bcp/parts - all master_parts for selection
router.get("/parts", async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    let query = "SELECT id, part_name, part_number, machine, factory_origin FROM master_parts";
    const params: string[] = [];
    if (search) {
      query += " WHERE part_name LIKE ? OR part_number LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }
    query += " ORDER BY part_name ASC";
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/bcp/sheets - list all sheet tabs from gsheet service
router.get("/sheets", async (_req, res) => {
  const { ok, data } = await proxyGsheet("sheets/analyze");
  if (!ok) {
    return res.status(502).json({
      success: false,
      error: "Gagal menghubungi layanan Google Sheets. Pastikan service aktif.",
      data,
    });
  }
  const payload = data as { sheets?: { sheetTitle: string; sheetId: number }[] };
  const sheets = (payload.sheets ?? []).map((s) => ({
    sheetTitle: s.sheetTitle,
    sheetId: s.sheetId,
  }));
  res.json({ success: true, data: sheets });
});

// GET /api/bcp/sheets/:key/rows - rawValues for a single sheet tab
router.get("/sheets/:key/rows", async (req, res) => {
  const { ok, data } = await proxyGsheet(`sheets/${encodeURIComponent(req.params.key)}`);
  if (!ok) {
    return res.status(502).json({
      success: false,
      error: "Sheet tidak ditemukan atau layanan Google Sheets tidak tersedia.",
      data,
    });
  }
  const payload = data as { sheet?: { rawValues: string[][] } };
  res.json({ success: true, data: payload.sheet?.rawValues ?? [] });
});

// POST /api/bcp - upsert link
router.post("/", async (req, res) => {
  try {
    const { partId, partName, sheetId, sheetTitle, rowKey } = req.body as {
      partId: number;
      partName: string;
      sheetId: number;
      sheetTitle: string;
      rowKey: string;
    };

    if (!partId || !partName || !sheetId || !sheetTitle || !rowKey) {
      return res.status(400).json({
        success: false,
        error: "partId, partName, sheetId, sheetTitle, rowKey wajib diisi.",
      });
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO bcp_links (part_id, part_name, spreadsheet_id, sheet_id, sheet_title, row_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         part_name      = VALUES(part_name),
         spreadsheet_id = VALUES(spreadsheet_id),
         sheet_id       = VALUES(sheet_id),
         sheet_title    = VALUES(sheet_title),
         row_key        = VALUES(row_key),
         updated_at     = NOW()`,
      [partId, partName, SPREADSHEET_ID, sheetId, sheetTitle, rowKey],
    );

    const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM bcp_links WHERE part_id = ?", [
      partId,
    ]);

    // Trigger immediate sync in the background so stock is calculated right away
    syncOnce().catch((e) => console.error("[BCP] immediate sync error:", e));

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/bcp/sync - manually trigger sync
router.post("/sync", async (_req, res) => {
  try {
    await syncOnce();
    res.json({
      success: true,
      data: { message: "Sinkronisasi Google Sheet BCP selesai." },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/bcp/:id - remove link
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.query<ResultSetHeader>("DELETE FROM bcp_links WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Link BCP tidak ditemukan." });
    }

    res.json({ success: true, data: { message: "Link BCP berhasil dihapus." } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
