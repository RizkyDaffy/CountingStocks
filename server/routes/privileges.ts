import { Router } from "express";
import pool from "../db.js";
import { requireInternalKey } from "../middleware/internalKeyMiddleware.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

const router = Router();

router.use(requireInternalKey);

router.get("/stations", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         d.id,
         d.device_code,
         d.name,
         d.location,
         d.device_role,
         d.active_status,
         COUNT(sqp.id) AS privilege_count
       FROM devices d
       LEFT JOIN station_qr_privileges sqp ON sqp.station_id = d.id
       GROUP BY d.id
       ORDER BY d.name ASC`,
    );

    const data = rows.map((r) => ({
      id: r.id,
      device_code: r.device_code,
      name: r.name,
      location: r.location,
      device_role: r.device_role,
      active_status: r.active_status,
      privilege_mode: Number(r.privilege_count) === 0 ? "open" : "restricted",
      privilege_count: Number(r.privilege_count),
    }));

    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/station/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const stationId = parseInt(id, 10);

    if (isNaN(stationId)) {
      return res.status(400).json({ success: false, error: "ID station tidak valid." });
    }

    const [allQrs] = await pool.query<RowDataPacket[]>(
      `SELECT id, qr_id, part_name, factory, status
       FROM qr_codes
       ORDER BY created_at DESC`,
    );

    const [privilegeRows] = await pool.query<RowDataPacket[]>(
      `SELECT qr_id FROM station_qr_privileges WHERE station_id = ?`,
      [stationId],
    );

    const allowedQrIds = new Set(privilegeRows.map((r) => Number(r.qr_id)));

    const allQrsMapped = allQrs.map((q) => ({
      id: q.id,
      qr_id: q.qr_id,
      part_name: q.part_name,
      factory: q.factory,
      status: q.status,
      is_allowed: allowedQrIds.has(Number(q.id)),
    }));

    res.json({
      success: true,
      data: {
        station_id: stationId,
        privilege_mode: allowedQrIds.size === 0 ? "open" : "restricted",
        allowed_count: allowedQrIds.size,
        qr_list: allQrsMapped,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/station/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const stationId = parseInt(id, 10);

    if (isNaN(stationId)) {
      return res.status(400).json({ success: false, error: "ID station tidak valid." });
    }

    const { qr_ids } = req.body as { qr_ids: number[] };

    if (!Array.isArray(qr_ids)) {
      return res.status(400).json({ success: false, error: "qr_ids harus berupa array." });
    }

    const [stationRows] = await pool.query<RowDataPacket[]>("SELECT id FROM devices WHERE id = ?", [
      stationId,
    ]);
    if (stationRows.length === 0) {
      return res.status(404).json({ success: false, error: "Station tidak ditemukan." });
    }

    if (qr_ids.length > 0) {
      const [qrRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM qr_codes WHERE id IN (${qr_ids.map(() => "?").join(",")})`,
        qr_ids,
      );
      if (qrRows.length !== qr_ids.length) {
        return res.status(400).json({ success: false, error: "Beberapa QR ID tidak valid." });
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query("DELETE FROM station_qr_privileges WHERE station_id = ?", [stationId]);

      if (qr_ids.length > 0) {
        const values = qr_ids.map((qrId) => [stationId, qrId]);
        await conn.query("INSERT INTO station_qr_privileges (station_id, qr_id) VALUES ?", [
          values,
        ]);
      }

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    res.json({
      success: true,
      message:
        qr_ids.length === 0
          ? "Privilege direset ke default (open access)."
          : `Privilege berhasil disimpan: ${qr_ids.length} QR diizinkan.`,
      data: { station_id: stationId, allowed_count: qr_ids.length },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/station/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const stationId = parseInt(id, 10);

    if (isNaN(stationId)) {
      return res.status(400).json({ success: false, error: "ID station tidak valid." });
    }

    await pool.query("DELETE FROM station_qr_privileges WHERE station_id = ?", [stationId]);

    res.json({
      success: true,
      message: "Privilege station berhasil direset ke default (open access).",
      data: { station_id: stationId },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/check", async (req, res) => {
  try {
    const stationId = parseInt(req.query.station_id as string, 10);
    const qrDbId = parseInt(req.query.qr_db_id as string, 10);

    if (isNaN(stationId) || isNaN(qrDbId)) {
      return res.status(400).json({ success: false, error: "Parameter tidak valid." });
    }

    const [countRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM station_qr_privileges WHERE station_id = ?",
      [stationId],
    );
    const totalPrivileges = Number(countRows[0]?.cnt ?? 0);

    if (totalPrivileges === 0) {
      return res.json({ success: true, data: { allowed: true, mode: "open" } });
    }

    const [checkRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM station_qr_privileges WHERE station_id = ? AND qr_id = ? LIMIT 1",
      [stationId, qrDbId],
    );

    const allowed = checkRows.length > 0;
    res.json({ success: true, data: { allowed, mode: "restricted" } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
