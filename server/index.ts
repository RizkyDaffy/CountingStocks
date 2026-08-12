import express from "express";
import dotenv from "dotenv";
import qrRoutes from "./routes/qr.js";
import stockRoutes from "./routes/stock.js";
import taskRoutes from "./routes/tasks.js";
import deviceRoutes from "./routes/devices.js";
import scanRoutes from "./routes/scan.js";
import masterPartsRoutes from "./routes/masterParts.js";
import mesinRoutes from "./routes/mesin.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import categoriesRoutes from "./routes/categories.js";
import modelsRoutes from "./routes/models.js";
import customersRoutes from "./routes/customers.js";
import factoriesRoutes from "./routes/factories.js";
import privilegesRoutes from "./routes/privileges.js";
import stockAnalyticsRoutes from "./routes/stockAnalytics.js";
import teiteiRoutes from "./routes/teitei.js";

import iotStateRoutes from "./routes/iotState.js";
import { requireAuth } from "./middleware/authMiddleware.js";
import { configuredCors, securityHeaders } from "./middleware/securityMiddleware.js";
import { loginRateLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/logger.js";
import { notFoundHandler, globalErrorHandler } from "./middleware/errorHandler.js";
import pool from "./db.js";
import type { RowDataPacket } from "mysql2";

dotenv.config();

const app = express();
const PORT = Number(process.env.API_PORT) || 4000;

app.use(securityHeaders);
app.use(configuredCors);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);

app.use("/iot", iotStateRoutes);
app.use("/webhook", iotStateRoutes);
const dbErr = (e: unknown): string => {
  if (!e) return "unknown error";
  if (typeof e !== "object") return String(e);
  const o = e as Record<string, unknown>;
  return JSON.stringify({
    message: o.message,
    code: o.code,
    errno: o.errno,
    sqlState: o.sqlState,
    sqlMessage: o.sqlMessage,
    name: (e as Error).name,
  });
};

app.get("/api/v1/mc-list", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, machine_code, machine_name, description, status, created_at, updated_at, factory FROM mesin ORDER BY factory ASC, machine_code ASC",
    );
    const [qrRows] = await pool.query<RowDataPacket[]>(
      "SELECT machine_origin, GROUP_CONCAT(qr_id ORDER BY created_at ASC SEPARATOR ', ') AS qr_origin FROM qr_codes WHERE machine_origin IS NOT NULL AND machine_origin != '' GROUP BY machine_origin",
    );
    const qrByMachine = new Map<string, string>(
      qrRows.map((r: RowDataPacket) => [String(r.machine_origin), String(r.qr_origin)]),
    );

    const factories: Record<string, unknown[]> = {};
    for (const row of rows) {
      const f =
        row.factory && String(row.factory).trim() ? String(row.factory).trim() : "Unassigned";
      if (!factories[f]) factories[f] = [];
      factories[f].push({
        mc: String(row.machine_code),
        id: row.id,
        machine_code: row.machine_code,
        machine_name: row.machine_name,
        description: row.description ?? "",
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        factory: row.factory ?? "",
        qr_origin: qrByMachine.get(String(row.machine_code)) ?? null,
      });
    }
    res.json({ factories });
  } catch (err: unknown) {
    console.error("[api/v1/mc-list]", err);
    res.status(500).json({ error: "Failed to fetch mc-list", details: dbErr(err) });
  }
});

app.get("/api/v1/qr-list", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT qr_id as qr, id, batch_id, part_name, factory, material, qr_value, units, token, short_token, qr_image_base64, status, created_at, updated_at, part_id, machine_origin FROM qr_codes",
    );
    res.json(rows);
  } catch (err: unknown) {
    console.error("[api/v1/qr-list]", err);
    res.status(500).json({ error: "Failed to fetch qr-list", details: dbErr(err) });
  }
});

app.use("/api/auth/login", loginRateLimiter);
app.use("/api/devices/station-login", loginRateLimiter);

app.use(requireAuth);

app.get("/api/health", async (_req, res) => {
  let dbStatus = "ok";
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbStatus = "error";
  }
  res.json({
    status: "Sehat Wal'afiat",
    creator: "di rancang oleh @RizkyDaffy",
    time: new Date().toISOString(),
    db: dbStatus,
    db_latency_ms: dbLatencyMs,
    uptime_s: Math.floor(process.uptime()),
  });
});

app.use("/api/qr", qrRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/scans", scanRoutes);
app.use("/api/master-parts", masterPartsRoutes);
app.use("/api/mesin", mesinRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/models", modelsRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/factories", factoriesRoutes);
app.use("/api/privileges", privilegesRoutes);
app.use("/api/stock-analytics", stockAnalyticsRoutes);
app.use("/api/teitei", teiteiRoutes);

app.use(notFoundHandler);

app.use(globalErrorHandler);

const server = app.listen(PORT, async () => {
  console.log(`🚀 API server berajalan di http://localhost:${PORT}`);
  console.log(`   check kesehata nyah: http://localhost:${PORT}/api/health`);
});

function gracefulShutdown(signal: string) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: "shutdown", signal }));
  server.close(async () => {
    try {
      await pool.end();
      console.log(
        JSON.stringify({ timestamp: new Date().toISOString(), event: "shutdown_complete" }),
      );
    } catch { }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
