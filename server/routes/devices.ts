import { Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { config } from "../config.js";
import { hashPin, verifyHash } from "../lib/crypto.js";

const router = Router();
const SECRET_KEY = config.JWT_SECRET;

router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, device_code, name, model, type, location, device_role, active_status, status, battery, last_sync FROM devices ORDER BY status ASC, name ASC",
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      device_code,
      name,
      location = "",
      device_role = "IN",
      pin,
      model = "Scanner",
      type = "phone",
      active_status = "active",
    } = req.body;

    if (!device_code || !name || !pin) {
      return res.status(400).json({
        success: false,
        error: "Device Code, Device Name, dan PIN wajib diisi.",
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO devices 
        (device_code, name, model, type, location, device_role, pin_hash, active_status, status, battery, last_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline', 0, NOW())`,
      [
        device_code.trim(),
        name.trim(),
        model.trim(),
        type,
        location.trim(),
        device_role,
        await hashPin(String(pin)),
        active_status,
      ],
    );

    const [newRow] = await pool.query<RowDataPacket[]>("SELECT * FROM devices WHERE id = ?", [
      result.insertId,
    ]);

    res.status(201).json({ success: true, data: newRow[0] });
  } catch (err: unknown) {
    if ((err as Error).message?.includes("Duplicate entry")) {
      return res.status(409).json({ success: false, error: "Device Code sudah digunakan." });
    }
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      battery,
      location,
      device_code,
      name,
      model,
      type,
      device_role,
      pin,
      active_status,
    } = req.body;

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (battery !== undefined) {
      updates.push("battery = ?");
      params.push(battery);
    }
    if (location !== undefined) {
      updates.push("location = ?");
      params.push(location);
    }
    if (device_code !== undefined) {
      updates.push("device_code = ?");
      params.push(device_code.trim());
    }
    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name.trim());
    }
    if (model !== undefined) {
      updates.push("model = ?");
      params.push(model.trim());
    }
    if (type !== undefined) {
      updates.push("type = ?");
      params.push(type);
    }
    if (device_role !== undefined) {
      updates.push("device_role = ?");
      params.push(device_role);
    }
    if (active_status !== undefined) {
      updates.push("active_status = ?");
      params.push(active_status);
    }
    if (pin !== undefined && String(pin).trim() !== "") {
      updates.push("pin_hash = ?");
      params.push(await hashPin(String(pin)));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: "No fields to update" });
    }

    updates.push("last_sync = NOW()");
    params.push(Number(id));

    await pool.query(`UPDATE devices SET ${updates.join(", ")} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err: unknown) {
    if ((err as Error).message?.includes("Duplicate entry")) {
      return res.status(409).json({ success: false, error: "Device Code sudah digunakan." });
    }
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM devices WHERE id = ?", [id]);
    res.json({ success: true, message: "Device berhasil dihapus." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/station-login", async (req, res) => {
  try {
    const { device_code, pin } = req.body;

    if (!device_code || !pin) {
      return res.status(400).json({
        success: false,
        error: "ID Perangkat dan PIN dibutuhkan.",
      });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM devices WHERE device_code = ? AND active_status = 'active'",
      [device_code.trim()],
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, error: "ID Perangkat tidak ditemukan atau tidak aktif." });
    }

    const device = rows[0];
    const { valid, needsRehash } = await verifyHash(String(pin), device.pin_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: "PIN salah." });
    }

    if (needsRehash) {
      const newHash = await hashPin(String(pin));
      await pool.query("UPDATE devices SET pin_hash = ? WHERE id = ?", [newHash, device.id]);
    }

    await pool.query("UPDATE devices SET status = 'online', last_sync = NOW() WHERE id = ?", [
      device.id,
    ]);

    const token = jwt.sign(
      {
        device_id: device.id,
        device_code: device.device_code,
        device_name: device.name,
        device_role: device.device_role,
        type: "station",
      },
      SECRET_KEY,
      { expiresIn: "12h" },
    );

    res.json({
      success: true,
      data: {
        token,
        device: {
          id: device.id,
          device_code: device.device_code,
          name: device.name,
          device_role: device.device_role,
          location: device.location,
        },
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
