import { Router } from "express";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import crypto from "crypto";
import { z } from "zod";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { config } from "../config.js";
import { resolveShortToken } from "../lib/resolveToken.js";
import { syncStockAnalyticsOnScan } from "../lib/stockAnalyticsService.js";
import { dispatchToGateService, triggerMachineWebhook } from "../../services/gate/gateHook.js";
import { setIotScanned } from "./iotState.js";

const router = Router();

const SECRET_KEY = config.JWT_SECRET;

function generateShortToken(): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(8);
  let token = "";
  for (const byte of bytes) {
    token += charset[byte % charset.length];
  }
  return token;
}

async function nextQrId(): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT MAX(CAST(SUBSTRING(qr_id, 4) AS UNSIGNED)) AS max_num FROM qr_codes",
  );
  const maxNum = rows[0]?.max_num ?? 1000;
  return `QR-${Number(maxNum) + 1}`;
}

async function nextTaskId(): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT MAX(CAST(SUBSTRING(task_id, 3) AS UNSIGNED)) AS max_num FROM tasks",
  );
  const maxNum = rows[0]?.max_num ?? 1000;
  return `T-${Number(maxNum) + 1}`;
}

async function updateStock(
  batchId: string,
  action: "SCAN_IN" | "SCAN_OUT",
  unitValue: number,
  conn: any = pool,
): Promise<void> {
  const [rows] = await conn.query(
    "SELECT id, current_stock, unit_value FROM stock WHERE batch_id = ?",
    [batchId],
  );
  if (rows.length === 0) return; 

  const currentStock = Number(rows[0].current_stock);
  const uv = Number(rows[0].unit_value);

  let newStock: number;
  let trend: "up" | "down" | "none" = "none";

  if (action === "SCAN_IN") {
    newStock = currentStock + unitValue;
    trend = currentStock < newStock ? "up" : "none";
  } else {
    newStock = Math.max(0, currentStock - unitValue);
    trend = currentStock > newStock ? "down" : "none";
  }

  const percentage = uv > 0 ? parseFloat(((newStock / uv) * 100).toFixed(2)) : 0;

  await conn.query(
    "UPDATE stock SET current_stock = ?, trend = ?, percentage = ? WHERE batch_id = ?",
    [newStock, trend, percentage, batchId],
  );
}

router.get("/", async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    const machineCode = (req.query.machine_code as string) || "";
    let query = "SELECT * FROM qr_codes";
    const params: string[] = [];
    const conditions: string[] = [];

    if (search) {
      conditions.push("(part_name LIKE ? OR qr_id LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (machineCode) {
      conditions.push("machine_origin = ?");
      params.push(machineCode);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    const limit = Number(req.query.limit) || 1000;
    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit as any);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

const generateSchema = z.object({
  partName: z.string().min(1, "partName is required"),
  factoryOrigin: z.string().min(1, "factoryOrigin is required"),
  value: z.number().or(z.string().transform(Number)),
  machineOrigin: z.string().optional(),
  partId: z.number().optional(),
});

router.post("/generate", async (req, res) => {
  try {
    const parseResult = generateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }
    const { partName, factoryOrigin, value, machineOrigin, partId } = parseResult.data;

    const batchId = `BATCH-${Date.now()}`;
    const qrId = await nextQrId();
    const unitValue = Number(value);

    const token = jwt.sign(
      { batchId, partName, factoryOrigin, value: unitValue, machineOrigin: machineOrigin ?? "" },
      SECRET_KEY,
      { expiresIn: "10y" },
    );

    let shortToken = generateShortToken();
    for (let attempt = 0; attempt < 3; attempt++) {
      const [existing] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM qr_codes WHERE short_token = ? LIMIT 1",
        [shortToken],
      );
      if (existing.length === 0) break;
      shortToken = generateShortToken();
    }

    const qrImageBase64 = await QRCode.toDataURL(shortToken, {
      width: 400,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const partIdValue = partId ? Number(partId) : null;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO qr_codes (qr_id, batch_id, part_name, factory, material, qr_value, units, token, short_token, qr_image_base64, status, part_id, machine_origin)
       VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, 'out', ?, ?)`,
      [
        qrId,
        batchId,
        partName,
        factoryOrigin,
        String(unitValue),
        unitValue,
        token,
        shortToken,
        qrImageBase64,
        partIdValue,
        machineOrigin ?? "",
      ],
    );

    await pool.query(
      `INSERT INTO stock (batch_id, qr_id, part_name, factory, unit_value, current_stock, trend, percentage)
       VALUES (?, ?, ?, ?, ?, 0, 'none', 0.00)
       ON DUPLICATE KEY UPDATE part_name = VALUES(part_name), factory = VALUES(factory), unit_value = VALUES(unit_value)`,
      [batchId, qrId, partName, factoryOrigin, unitValue],
    );

    const taskId = await nextTaskId();
    await pool.query(
      "INSERT INTO tasks (task_id, title, type, status, user) VALUES (?, ?, 'QR Created', 'completed', 'System')",
      [taskId, `QR for ${partName} (×${unitValue})`],
    );

    const [newRow] = await pool.query<RowDataPacket[]>("SELECT * FROM qr_codes WHERE id = ?", [
      result.insertId,
    ]);

    res.status(201).json({
      success: true,
      message: "QR Code berhasil dibuat",
      data: {
        batchId,
        qrId,
        shortToken,
        qrImageBase64,
        partName,
        factoryOrigin,
        value: unitValue,
        status: "out",
        row: newRow[0],
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/regenerate", async (req, res) => {
  try {
    const { oldShortToken, partName, factoryOrigin, value, machineOrigin, partId } = req.body;

    if (!oldShortToken || !partName || !factoryOrigin || value === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields for regeneration",
      });
    }

    const [existingQr] = await pool.query<RowDataPacket[]>(
      "SELECT id, batch_id, qr_id FROM qr_codes WHERE short_token = ? LIMIT 1",
      [oldShortToken],
    );

    if (existingQr.length === 0) {
      return res.status(404).json({ success: false, error: "Old QR not found." });
    }

    const { id: dbId, batch_id: batchId, qr_id: qrId } = existingQr[0];
    const unitValue = Number(value);

    const newToken = jwt.sign(
      { batchId, partName, factoryOrigin, value: unitValue, machineOrigin: machineOrigin ?? "" },
      SECRET_KEY,
      { expiresIn: "10y" },
    );

    let newShortToken = generateShortToken();
    for (let attempt = 0; attempt < 3; attempt++) {
      const [collide] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM qr_codes WHERE short_token = ? LIMIT 1",
        [newShortToken],
      );
      if (collide.length === 0) break;
      newShortToken = generateShortToken();
    }

    const qrImageBase64 = await QRCode.toDataURL(newShortToken, {
      width: 400,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const partIdValue = partId ? Number(partId) : null;
    await pool.query(
      `UPDATE qr_codes 
       SET part_name = ?, factory = ?, qr_value = ?, units = ?, token = ?, short_token = ?, qr_image_base64 = ?,
           part_id = COALESCE(?, part_id)
       WHERE id = ?`,
      [
        partName,
        factoryOrigin,
        String(unitValue),
        unitValue,
        newToken,
        newShortToken,
        qrImageBase64,
        partIdValue,
        dbId,
      ],
    );

    await pool.query(
      "INSERT INTO qr_aliases (old_short_token, new_short_token) VALUES (?, ?) ON DUPLICATE KEY UPDATE new_short_token = ?",
      [oldShortToken, newShortToken, newShortToken],
    );

    await pool.query(
      `INSERT INTO stock (batch_id, qr_id, part_name, factory, unit_value, current_stock, trend, percentage)
       VALUES (?, ?, ?, ?, ?, 0, 'none', 0.00)
       ON DUPLICATE KEY UPDATE part_name = VALUES(part_name), factory = VALUES(factory), unit_value = VALUES(unit_value)`,
      [batchId, qrId, partName, factoryOrigin, unitValue],
    );

    const taskId = await nextTaskId();
    await pool.query(
      "INSERT INTO tasks (task_id, title, type, status, user) VALUES (?, ?, 'QR Created', 'completed', 'System')",
      [taskId, `QR Regenerated for ${partName}`],
    );

    const [newRow] = await pool.query<RowDataPacket[]>("SELECT * FROM qr_codes WHERE id = ?", [
      dbId,
    ]);

    res.json({
      success: true,
      message: "QR Code berhasil diregenerate",
      data: {
        batchId,
        qrId,
        shortToken: newShortToken,
        qrImageBase64,
        partName,
        factoryOrigin,
        value: unitValue,
        status: newRow[0].status,
        row: newRow[0],
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/by-part/:partId", async (req, res) => {
  try {
    const partId = Number(req.params.partId);
    if (!partId || isNaN(partId)) {
      return res.status(400).json({ success: false, error: "Invalid partId" });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM qr_codes WHERE part_id = ? ORDER BY created_at DESC LIMIT 1`,
      [partId],
    );

    if (rows.length === 0) {
      
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/info", async (req, res) => {
  try {
    const { token } = req.query as { token: string };

    if (!token) {
      return res.status(400).json({ success: false, error: "Hmmm... Token hilang nih" });
    }

    const actualToken = await resolveShortToken(token);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT token, updated_at, machine_origin, status FROM qr_codes WHERE short_token = ? LIMIT 1",
      [actualToken],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "QR tidak dikenali - token tidak ditemukan" });
    }

    const fullJwt: string = rows[0].token;
    const updatedAt = rows[0].updated_at;
    const machineOrigin = rows[0].machine_origin;
    const dbStatus = rows[0].status;

    const decoded = jwt.verify(fullJwt, SECRET_KEY) as {
      batchId: string;
      partName: string;
      factoryOrigin: string;
      value: number;
      machineOrigin?: string; 
    };

    const { batchId, partName, factoryOrigin, value } = decoded;
    const resolvedMachineOrigin = machineOrigin || decoded.machineOrigin || "";
    // rizky: ceiling hit on in-memory map. Switched to DB read.
    const isIn = dbStatus === "in";
    const currentStatus = isIn ? "in" : "out";
    const nextAction = isIn ? "SCAN_OUT" : "SCAN_IN";

    res.json({
      success: true,
      data: {
        batchId,
        partName,
        factoryOrigin,
        value,
        machineOrigin: resolvedMachineOrigin,
        updatedAt,
        currentStatus,
        nextAction,
        message: isIn
          ? `${partName} is currently IN (active). Scanning will mark it OUT.`
          : `${partName} is currently OUT (idle). Scanning will mark it IN.`,
        token, // returns the short token back (clients use it for /process calls)
      },
    });
  } catch (err: unknown) {
    if (
      (err as Error).name === "JsonWebTokenError" ||
      (err as Error).name === "TokenExpiredError"
    ) {
      return res.status(401).json({ success: false, error: "Invalid or tampered QR token" });
    }
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

const processSchema = z.object({
  token: z.string().min(1, "Token required"),
  forceAction: z.enum(["SCAN_IN", "SCAN_OUT"]).optional(),
  partstats: z.enum(["reguler", "bcp"]).optional().default("reguler"),
});

router.post("/process", async (req, res) => {
  let conn: any = null;
  let isCommitted = false;
  try {
    const parseResult = processSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }
    const { token, forceAction, partstats } = parseResult.data;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    let fullJwt = token;
    if (token.length <= 16) {
      const actualToken = await resolveShortToken(token);
      const [rows] = await conn.query("SELECT token FROM qr_codes WHERE short_token = ? LIMIT 1", [
        actualToken,
      ]);

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "QR tidak dikenali - token tidak ditemukan" });
      }
      fullJwt = rows[0].token;
    }

    const decoded = jwt.verify(fullJwt, SECRET_KEY) as {
      batchId: string;
      partName: string;
      factoryOrigin: string;
      value: number;
    };

    const { batchId, partName, factoryOrigin, value } = decoded;

    const requestUser = req.user as
      | { device_id?: number; type?: string; username?: string }
      | undefined;
    if (requestUser?.type === "station" && requestUser?.device_id) {
      const deviceId = requestUser.device_id;

      const [countRows] = await conn.query(
        "SELECT COUNT(*) as cnt FROM station_qr_privileges WHERE station_id = ?",
        [deviceId],
      );
      const totalPrivileges = Number(countRows[0]?.cnt ?? 0);

      if (totalPrivileges > 0) {
        const [qrLookup] = await conn.query("SELECT id FROM qr_codes WHERE batch_id = ? LIMIT 1", [
          batchId,
        ]);

        if (qrLookup.length > 0) {
          const qrDbId = qrLookup[0].id;
          const [allowedRows] = await conn.query(
            "SELECT id FROM station_qr_privileges WHERE station_id = ? AND qr_id = ? LIMIT 1",
            [deviceId, qrDbId],
          );

          if (allowedRows.length === 0) {
            return res.status(403).json({
              success: false,
              error: "QR_NOT_ALLOWED",
            });
          }
        }
        
      }
    }
    const [qrStateRows] = await conn.query(
      "SELECT q.status AS qr_status, s.current_stock FROM qr_codes q LEFT JOIN stock s ON q.batch_id = s.batch_id WHERE q.batch_id = ? LIMIT 1",
      [batchId],
    );
    const dbQrStatus = qrStateRows[0]?.qr_status;
    const currentStock =
      qrStateRows[0]?.current_stock !== null && qrStateRows[0]?.current_stock !== undefined
        ? Number(qrStateRows[0].current_stock)
        : null;
    const isIn = dbQrStatus === "in";

    let action: "SCAN_IN" | "SCAN_OUT";
    let newStatus: "in" | "out";
    let message: string;

    if (forceAction === "SCAN_IN") {
      action = "SCAN_IN";
      newStatus = "in";
      message = `${partName} Berhasil di SCAN IN (${value} unit).`;
    } else if (forceAction === "SCAN_OUT") {
      if (currentStock !== null && currentStock === 0) {
        return res.status(409).json({
          success: false,
          error: `Tidak bisa SCAN OUT - stok ${partName} sudah 0 unit.`,
        });
      }

      action = "SCAN_OUT";
      newStatus = "out";
      message = `${partName} Berhasil di SCAN OUT (${value} unit).`;
    } else {
      if (isIn) {
        if (currentStock !== null && currentStock === 0) {
          return res.status(409).json({
            success: false,
            error: `Tidak bisa SCAN OUT - stok ${partName} sudah 0 unit.`,
          });
        }

        action = "SCAN_OUT";
        newStatus = "out";
        message = `${partName} sejumlah ${value} unit berhasil di SCAN OUT.`;
      } else {
        action = "SCAN_IN";
        newStatus = "in";
        message = `${partName} sejumlah ${value} unit masuk proses (SCAN IN).`;
      }
    }

    const [qrRows] = await conn.query(
      "SELECT qr_id, machine_origin FROM qr_codes WHERE batch_id = ? LIMIT 1",
      [batchId],
    );
    const qrId = qrRows.length > 0 ? qrRows[0].qr_id : batchId;
    const machineOriginForWebhook: string = qrRows.length > 0 ? qrRows[0].machine_origin || "" : "";
    await conn.query("UPDATE qr_codes SET status = ? WHERE batch_id = ?", [newStatus, batchId]);
    await updateStock(batchId, action, value, conn);

    const scannerUsername =
      requestUser?.username?.trim() || (requestUser?.type === "station" ? "Scanner" : "unknown");

    await syncStockAnalyticsOnScan(partName, scannerUsername, batchId, conn);

    // Log scan record
    await conn.query(
      "INSERT INTO scan_records (batch_id, qr_id, label, factory, action, scanned_by, partstats) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [batchId, qrId, partName, factoryOrigin, action, scannerUsername, partstats],
    );

    // Log task
    const taskId = await nextTaskId();
    const taskType = action === "SCAN_IN" ? "Scan In" : "Scan Out";
    await conn.query(
      "INSERT INTO tasks (task_id, title, type, status, user) VALUES (?, ?, ?, 'completed', ?)",
      [
        taskId,
        `${action === "SCAN_IN" ? "IN" : "OUT"}: ${partName} (×${value})`,
        taskType,
        scannerUsername,
      ],
    );

    await conn.commit();
    isCommitted = true;

    res.json({
      success: true,
      data: {
        action,
        newStatus,
        message,
        batchId,
        partName,
        factoryOrigin,
        value,
      },
    });

    if (requestUser?.type === "station" && requestUser?.device_id) {
      if (machineOriginForWebhook) {
        const mc = machineOriginForWebhook.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normalizedQrId = qrId.toUpperCase();
        const iotPath = `/webhook/${mc}/${normalizedQrId}`;
        const iotPathRaw = `/webhook/${machineOriginForWebhook}/${factoryOrigin}/${normalizedQrId}`;
        setIotScanned(iotPath, 10_000);
        setIotScanned(iotPathRaw, 10_000);
        triggerMachineWebhook({ machine_code: machineOriginForWebhook, qr_code_id: qrId });
      } else {
        dispatchToGateService({ qr_code_id: qrId });
      }
    } else {
    }

  } catch (err: unknown) {
    if ((err as Error).name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, error: "Token QR Manipulasi / Invalid" });
    }
    res.status(500).json({ success: false, error: (err as Error).message });
  } finally {
    if (conn) {
      if (!isCommitted) await conn.rollback();
      conn.release();
    }
  }
});

router.get("/history", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, batch_id, qr_id, label, factory, action, scanned_by, created_at
       FROM scan_records
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/stock", async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    const factory = (req.query.factory as string) || "";

    let query = "SELECT * FROM stock WHERE 1=1";
    const params: string[] = [];

    if (search) {
      query += " AND (part_name LIKE ? OR qr_id LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (factory && factory !== "All") {
      query += " AND factory = ?";
      params.push(factory);
    }

    query += " ORDER BY updated_at DESC";

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/stock/stats", async (_req, res) => {
  try {
    const [totalRow] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(current_stock) as totalUnits, COUNT(*) as skuCount FROM stock",
    );
    const [emptyRow] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as emptyCount FROM stock WHERE current_stock = 0 AND trend != 'none'",
    );
    res.json({
      success: true,
      data: {
        totalUnits: totalRow[0]?.totalUnits ?? 0,
        skuCount: totalRow[0]?.skuCount ?? 0,
        emptyStock: emptyRow[0]?.emptyCount ?? 0,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/stock/factories", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT DISTINCT factory FROM stock ORDER BY factory",
    );
    res.json({ success: true, data: rows.map((r) => r.factory) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [qrRows] = await pool.query<RowDataPacket[]>(
      "SELECT batch_id FROM qr_codes WHERE id = ?",
      [id],
    );

    if (qrRows.length > 0) {
      const batchId = qrRows[0].batch_id;
      await pool.query("DELETE FROM qr_codes WHERE id = ?", [id]);
      await pool.query("DELETE FROM stock WHERE batch_id = ?", [batchId]);
    } else {
      await pool.query("DELETE FROM qr_codes WHERE id = ?", [id]);
    }

    res.json({ success: true, message: "QR Code berhasil dihapus" });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
