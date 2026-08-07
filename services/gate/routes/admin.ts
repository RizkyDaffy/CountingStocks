import { Router, Request, Response } from "express";
import pool from "../../../server/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import crypto from "crypto";
import QRCode from "qrcode";

const router = Router();

function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = req.user as { role?: string } | undefined;
  if (!user || !["admin", "superadmin"].includes(user.role ?? "")) {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}

router.get("/devices", requireAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         d.id,
         d.machine_id,
         d.station_id,
         d.direction,
         d.location_label,
         d.is_active,
         d.last_seen,
         d.connection_status,
         d.created_at,
         d.updated_at,
         m.machine_name,
         m.machine_code,
         dev.name AS station_name,
         (SELECT COUNT(*) FROM esp32_user_privileges p WHERE p.esp32_device_id = d.id) AS privilege_count
       FROM esp32_devices d
       LEFT JOIN mesin m    ON m.id = d.machine_id
       LEFT JOIN devices dev ON dev.id = d.station_id
       ORDER BY d.created_at DESC`,
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/devices", requireAdmin, async (req, res) => {
  try {
    const { id, machine_id, station_id, direction, location_label, auth_token } = req.body;

    if (!id || !machine_id || !station_id || !direction || !auth_token) {
      return res.status(400).json({
        success: false,
        error: "Required: id, machine_id, station_id, direction, auth_token",
      });
    }
    if (!["in", "out"].includes(direction)) {
      return res.status(400).json({ success: false, error: "direction must be 'in' or 'out'" });
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO esp32_devices (id, machine_id, station_id, direction, location_label, auth_token)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, machine_id, station_id, direction, location_label ?? "", auth_token],
    );

    const [newRow] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM esp32_devices WHERE id = ? LIMIT 1",
      [id],
    );
    res.status(201).json({ success: true, data: newRow[0] });
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { code?: string };
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, error: "Device ID already exists" });
    }
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put("/devices/:id", requireAdmin, async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { location_label, auth_token, is_active, station_id, machine_id } = req.body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (location_label !== undefined) {
      updates.push("location_label = ?");
      values.push(location_label);
    }
    if (auth_token !== undefined) {
      updates.push("auth_token = ?");
      values.push(auth_token);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(is_active ? 1 : 0);
    }
    if (station_id !== undefined) {
      updates.push("station_id = ?");
      values.push(station_id);
    }
    if (machine_id !== undefined) {
      updates.push("machine_id = ?");
      values.push(machine_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: "No fields to update" });
    }

    values.push(deviceId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE esp32_devices SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Device not found" });
    }

    const [updated] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM esp32_devices WHERE id = ? LIMIT 1",
      [deviceId],
    );
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/devices/:id/status", requireAdmin, async (req, res) => {
  try {
    const deviceId = req.params.id;

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, connection_status, last_seen FROM esp32_devices WHERE id = ? LIMIT 1",
      [deviceId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Device not found" });
    }

    const GATE_HTTP_PORT = Number(process.env.GATE_HTTP_PORT) || 4001;
    let liveStatus: { online: boolean; lastSeen?: string } = {
      online: rows[0].connection_status === "online",
      lastSeen: rows[0].last_seen,
    };

    try {
      const resp = await fetch(`http://127.0.0.1:${GATE_HTTP_PORT}/internal/devices/status`);
      if (resp.ok) {
        const json = (await resp.json()) as {
          data?: { devices?: Array<{ device_id: string; last_seen: string }> };
        };
        const liveDevice = json.data?.devices?.find((d) => d.device_id === deviceId);
        liveStatus = { online: !!liveDevice, lastSeen: liveDevice?.last_seen };
      }
    } catch {}

    res.json({ success: true, data: { ...rows[0], live: liveStatus } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/devices/:id/privileges", requireAdmin, async (req, res) => {
  try {
    const deviceId = req.params.id;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         p.id,
         p.user_id,
         p.granted_by,
         p.granted_at,
         u.username,
         u.role
       FROM esp32_user_privileges p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.esp32_device_id = ?
       ORDER BY p.granted_at DESC`,
      [deviceId],
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/devices/:id/privileges", requireAdmin, async (req, res) => {
  try {
    const deviceId = req.params.id;
    const adminUser = req.user as { id: number };
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: "user_id is required" });
    }

    const [dev] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM esp32_devices WHERE id = ? LIMIT 1",
      [deviceId],
    );
    if (dev.length === 0) {
      return res.status(404).json({ success: false, error: "Device not found" });
    }

    await pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO esp32_user_privileges (esp32_device_id, user_id, granted_by)
       VALUES (?, ?, ?)`,
      [deviceId, user_id, adminUser.id],
    );

    res
      .status(201)
      .json({ success: true, message: `User ${user_id} granted access to ${deviceId}` });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/devices/:id/privileges/:user_id", requireAdmin, async (req, res) => {
  try {
    const deviceId = req.params.id;
    const userId = Number(req.params.user_id);

    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM esp32_user_privileges WHERE esp32_device_id = ? AND user_id = ?",
      [deviceId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Privilege record not found" });
    }

    res.json({ success: true, message: `User ${userId} revoked from ${deviceId}` });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/log", requireAdmin, async (req, res) => {
  try {
    const { device_id, user_id, limit = "50" } = req.query as Record<string, string>;
    let query = "SELECT * FROM gate_command_log WHERE 1=1";
    const params: (string | number)[] = [];

    if (device_id) {
      query += " AND esp32_device_id = ?";
      params.push(device_id);
    }
    if (user_id) {
      query += " AND user_id = ?";
      params.push(Number(user_id));
    }
    query += " ORDER BY dispatched_at DESC LIMIT ?";
    params.push(Math.min(Number(limit) || 50, 500));

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/devices/generate-provision-qr", requireAdmin, async (req, res) => {
  try {
    const { machine_id, direction, location_label, wifi_ssid, server_ip } = req.body;

    if (!machine_id || !direction) {
      return res
        .status(400)
        .json({ success: false, error: "machine_id and direction are required" });
    }
    if (!["in", "out"].includes(direction)) {
      return res.status(400).json({ success: false, error: "direction must be 'in' or 'out'" });
    }

    const [seqRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM esp32_devices WHERE machine_id = ? AND direction = ?",
      [machine_id, direction],
    );
    const seq = (Number(seqRows[0]?.cnt ?? 0) + 1).toString().padStart(3, "0");
    const device_id = `ESP-MC${machine_id}-${direction.toUpperCase()}-${seq}`;
    const auth_token = crypto.randomBytes(32).toString("hex"); 

    const gate_server_ip = server_ip || process.env.GATE_SERVER_IP || "192.168.1.100";
    const gate_server_port = Number(process.env.GATE_TCP_PORT) || 4000;

    // Insert pending record (station_id = 0 until linked; update via PUT /devices/:id)
    await pool.query<ResultSetHeader>(
      `INSERT INTO esp32_devices
         (id, machine_id, station_id, direction, location_label, auth_token, connection_status)
       VALUES (?, ?, 0, ?, ?, ?, 'pending_provision')
       ON DUPLICATE KEY UPDATE
         auth_token = VALUES(auth_token),
         location_label = VALUES(location_label),
         connection_status = 'pending_provision'`,
      [device_id, machine_id, direction, location_label ?? "", auth_token],
    );

    // Build provisioning URI — parsed by ESP32 captive portal QR input box
    const qr_payload = [
      `riski://provision?server=${encodeURIComponent(gate_server_ip)}`,
      `port=${gate_server_port}`,
      `device_id=${encodeURIComponent(device_id)}`,
      `token=${auth_token}`,
      `direction=${direction}`,
      `label=${encodeURIComponent(location_label ?? "")}`,
      `ssid=${encodeURIComponent(wifi_ssid ?? "")}`,
    ].join("&");

    const qr_image_base64 = await QRCode.toDataURL(qr_payload, {
      width: 320,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    res.json({
      success: true,
      data: {
        device_id,
        auth_token,
        qr_payload,
        qr_image_base64,
        gate_server_ip,
        gate_server_port,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
