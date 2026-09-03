import net from "net";
import http from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UI_PATH = path.join(__dirname, "ui", "index.html");

dotenv.config();

const TCP_PORT = Number(process.env.GATE_TCP_PORT) || 4000;
const HTTP_PORT = Number(process.env.GATE_HTTP_PORT) || 4001;
const HEARTBEAT_TIMEOUT_MS = 90_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_CONNECTIONS = 500;

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "outindb",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

interface DeviceConnection {
  socket: net.Socket;
  lastSeen: Date;
  registeredAt: Date;
  listenQrs: string[];
  machineCode?: string;
  webhookPath?: string;
}

const connections = new Map<string, DeviceConnection>();
const webhookConnections = new Map<string, DeviceConnection>();

interface WebhookScanState {
  scanned: boolean;
  ts: number;
  resetTimer?: ReturnType<typeof setTimeout>;
}
const webhookState = new Map<string, WebhookScanState>();
const WEBHOOK_STATE_TTL_MS = 30_000;

function setWebhookScanned(webhookPath: string): void {
  const prev = webhookState.get(webhookPath);
  if (prev?.resetTimer) clearTimeout(prev.resetTimer);

  const resetTimer = setTimeout(() => {
    const entry = webhookState.get(webhookPath);
    if (entry?.scanned) {
      webhookState.set(webhookPath, { scanned: false, ts: Date.now() });
      log("webhook_state_ttl_reset", {
        webhookPath,
        note: "No ack received within TTL; state reset to false",
      });
    }
  }, WEBHOOK_STATE_TTL_MS);

  webhookState.set(webhookPath, { scanned: true, ts: Date.now(), resetTimer });
  log("webhook_state_set_scanned", { webhookPath });
}

function resetWebhookScanned(webhookPath: string): void {
  const prev = webhookState.get(webhookPath);
  if (prev?.resetTimer) clearTimeout(prev.resetTimer);
  webhookState.set(webhookPath, { scanned: false, ts: Date.now() });
  log("webhook_state_reset_on_ack", { webhookPath });
}

function log(event: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

function socketWrite(socket: net.Socket, payload: unknown): boolean {
  if (socket.destroyed || !socket.writable) return false;
  try {
    socket.write(JSON.stringify(payload) + "\n");
    return true;
  } catch {
    return false;
  }
}

async function setDeviceStatus(
  deviceId: string,
  status: "online" | "offline" | "reconnecting",
  updateLastSeen = false,
) {
  try {
    const fields = updateLastSeen
      ? "connection_status = ?, last_seen = NOW()"
      : "connection_status = ?";
    const params = updateLastSeen ? [status, deviceId] : [status, deviceId];
    await pool.query(`UPDATE esp32_devices SET ${fields} WHERE id = ?`, params);
  } catch (err) {
    log("db_status_update_error", { deviceId, status, err: (err as Error).message });
  }
}

function handleDeviceConnection(socket: net.Socket) {
  if (connections.size >= MAX_CONNECTIONS) {
    socket.destroy();
    log("connection_rejected", { reason: "max_connections_reached", limit: MAX_CONNECTIONS });
    return;
  }

  const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
  let deviceId: string | null = null;
  let handshakeCompleted = false;
  let buffer = "";

  const handshakeTimer = setTimeout(() => {
    if (!handshakeCompleted) {
      log("handshake_timeout", { remoteAddr });
      socket.destroy();
    }
  }, 10_000);

  socket.setEncoding("utf8");
  socket.setKeepAlive(true, 15_000);

  socket.on("data", async (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        log("parse_error", { deviceId, remoteAddr, raw: trimmed.slice(0, 64) });
        continue;
      }

      if (!handshakeCompleted) {
        const did = (msg.mac as string) || (msg.device_id as string);
        const qrs = Array.isArray(msg.qrs) ? (msg.qrs as string[]) : [];
        const machineCode = (msg.machine_code as string) || "";
        const webhookPath = (msg.webhook_path as string) || "";

        if (!did) {
          socketWrite(socket, { type: "error", message: "Missing mac or device_id" });
          socket.destroy();
          return;
        }

        const existing = connections.get(did);
        if (existing) {
          log("evict_stale_connection", { deviceId: did });
          existing.socket.destroy();
          connections.delete(did);
          if (existing.webhookPath) {
            webhookConnections.delete(existing.webhookPath);
            log("evict_webhook_registration", { webhookPath: existing.webhookPath });
          }
        }

        deviceId = did;
        handshakeCompleted = true;
        clearTimeout(handshakeTimer);

        const connRecord: DeviceConnection = {
          socket,
          lastSeen: new Date(),
          registeredAt: new Date(),
          listenQrs: qrs,
          machineCode: machineCode || undefined,
          webhookPath: webhookPath || undefined,
        };
        connections.set(deviceId, connRecord);
        await setDeviceStatus(deviceId, "online", true);

        if (webhookPath) {
          webhookConnections.set(webhookPath, connRecord);
          const parts = webhookPath.split("/").filter(Boolean);
          if (parts.length >= 3) {
            const machineLevelPath = `/${parts[0]}/${parts[1]}`;
            if (!webhookConnections.has(machineLevelPath)) {
              webhookConnections.set(machineLevelPath, connRecord);
            }
          }
          log("webhook_registered", { deviceId, webhookPath, machineCode });
        }

        socketWrite(socket, { type: "handshake_ok", device_id: deviceId });
        log("device_connected", {
          deviceId,
          remoteAddr,
          listenQrs: qrs,
          machineCode,
          webhookPath,
          total: connections.size,
        });
        continue;
      }

      if (msg.type === "ping" && deviceId) {
        const conn = connections.get(deviceId);
        if (conn) conn.lastSeen = new Date();
        await setDeviceStatus(deviceId, "online", true);
        socketWrite(socket, { type: "pong", device_id: deviceId });
        continue;
      }

      if (msg.type === "ack" && deviceId) {
        log("gate_ack_received", {
          deviceId,
          requestId: msg.request_id,
          status: msg.status,
          timestamp: msg.timestamp,
        });

        // v6.2-retro ADD: ESP32 has consumed the OPEN_GATE command - reset
        // scanned state immediately so the next cycle starts fresh.
        const ackConn = connections.get(deviceId);
        if (ackConn?.webhookPath) {
          resetWebhookScanned(ackConn.webhookPath);
          // Also reset the machine-level path if it mirrors this connection
          const parts = ackConn.webhookPath.split("/").filter(Boolean);
          if (parts.length >= 3) {
            const machineLevelPath = `/${parts[0]}/${parts[1]}`;
            resetWebhookScanned(machineLevelPath);
          }
        }

        try {
          await pool.query(
            `UPDATE gate_command_log
             SET result = 'ack_received', acked_at = NOW()
             WHERE request_id = ?`,
            [msg.request_id],
          );
        } catch {}
        continue;
      }

      log("unknown_message", { deviceId, type: msg.type });
    }
  });

  socket.on("error", (err) => {
    log("socket_error", { deviceId, remoteAddr, err: err.message });
  });

  socket.on("close", async () => {
    clearTimeout(handshakeTimer);
    if (deviceId) {
      const conn = connections.get(deviceId);
      if (conn?.webhookPath) {
        webhookConnections.delete(conn.webhookPath);
        const parts = conn.webhookPath.split("/").filter(Boolean);
        if (parts.length >= 3) {
          const machineLevelPath = `/${parts[0]}/${parts[1]}`;
          if (webhookConnections.get(machineLevelPath) === conn) {
            webhookConnections.delete(machineLevelPath);
          }
        }
      }
      connections.delete(deviceId);
      await setDeviceStatus(deviceId, "offline");
      log("device_disconnected", { deviceId, remoteAddr, remaining: connections.size });
    }
  });
}

setInterval(() => {
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
  for (const [id, conn] of connections) {
    if (conn.lastSeen < cutoff) {
      log("heartbeat_timeout_evict", { deviceId: id, lastSeen: conn.lastSeen.toISOString() });
      conn.socket.destroy();
      if (conn.webhookPath) {
        webhookConnections.delete(conn.webhookPath);
        const parts = conn.webhookPath.split("/").filter(Boolean);
        if (parts.length >= 3) {
          const machineLevelPath = `/${parts[0]}/${parts[1]}`;
          if (webhookConnections.get(machineLevelPath) === conn) {
            webhookConnections.delete(machineLevelPath);
          }
        }
      }
      connections.delete(id);
      setDeviceStatus(id, "offline").catch(() => {});
    }
  }
}, HEARTBEAT_INTERVAL_MS);

function sendToWebhookPath(webhookPath: string, qr_code_id: string, requestId: string): boolean {
  const conn = webhookConnections.get(webhookPath);
  if (!conn) return false;
  const success = socketWrite(conn.socket, {
    cmd: "OPEN_GATE",
    request_id: requestId,
    qr_code_id,
  });
  if (success) {
    log("gate_open_dispatched_via_webhook", {
      webhookPath,
      qr_code_id,
      requestId,
    });
    // v6.2-retro ADD: mark this path as scanned=true; TTL auto-resets if no ack
    setWebhookScanned(webhookPath);
  }
  return success;
}

const tcpServer = net.createServer(handleDeviceConnection);

tcpServer.on("error", (err) => {
  log("tcp_server_error", { err: err.message });
});

tcpServer.listen(TCP_PORT, () => {
  log("tcp_server_started", { port: TCP_PORT, maxConnections: MAX_CONNECTIONS });
});

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${HTTP_PORT}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/admin")) {
    try {
      const html = fs.readFileSync(UI_PATH, "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("UI not found - ensure services/gate/ui/index.html exists");
    }
    return;
  }

  res.setHeader("Content-Type", "application/json");

  if (
    req.method === "GET" &&
    url.pathname.startsWith("/webhook/") &&
    url.pathname.endsWith("/state")
  ) {
    const webhookPath = url.pathname.slice(0, -"/state".length);
    const entry = webhookState.get(webhookPath);
    res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
    res.end(
      JSON.stringify({
        webhookPath,
        scanned: entry?.scanned ?? false,
        ts: entry?.ts ? new Date(entry.ts).toISOString() : null,
        deviceOnline: webhookConnections.has(webhookPath),
      }),
    );
    return;
  }

  if (
    req.method === "POST" &&
    url.pathname.startsWith("/webhook/") &&
    url.pathname.endsWith("/reset")
  ) {
    const webhookPath = url.pathname.slice(0, -"/reset".length);
    resetWebhookScanned(webhookPath);
    const parts = webhookPath.split("/").filter(Boolean);
    if (parts.length >= 3) {
      resetWebhookScanned(`/${parts[0]}/${parts[1]}`);
    }
    res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ success: true, webhookPath, scanned: false }));
    log("webhook_state_reset_by_esp32", { webhookPath });
    return;
  }

  if (
    req.method === "POST" &&
    url.pathname.startsWith("/webhook/") &&
    !url.pathname.endsWith("/reset")
  ) {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", async () => {
      let payload: Record<string, string> = {};
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {}

      const qrCodeId = payload.qr_code_id || "";
      const requestId = crypto.randomUUID();
      const webhookPath = url.pathname;

      // v6.3 HTTP ADD: ALWAYS mark scanned=true so the HTTP-polling ESP32
      // can detect the signal even when no TCP device is registered.
      setWebhookScanned(webhookPath);
      // Also set the machine-level alias
      const aliasParts = webhookPath.split("/").filter(Boolean);
      if (aliasParts.length >= 3) {
        setWebhookScanned(`/${aliasParts[0]}/${aliasParts[1]}`);
      }
      log("webhook_scan_signal_set", { webhookPath, qrCodeId, requestId });

      // Opportunistically try TCP dispatch too (for mixed TCP+HTTP fleets)
      let dispatched = sendToWebhookPath(webhookPath, qrCodeId, requestId);
      if (!dispatched && aliasParts.length >= 3) {
        const machineLevelPath = `/${aliasParts[0]}/${aliasParts[1]}`;
        dispatched = sendToWebhookPath(machineLevelPath, qrCodeId, requestId);
        if (dispatched) {
          log("webhook_machine_level_fallback", {
            original: webhookPath,
            fallback: machineLevelPath,
            qrCodeId,
          });
        }
      }

      // Always 200 - state is set for HTTP-polling ESP32 regardless of TCP
      res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
      res.end(
        JSON.stringify({
          success: true,
          message: dispatched
            ? "Gate open dispatched (TCP + state set)"
            : "Scan state set (HTTP polling mode)",
          requestId,
          webhookPath,
          tcpDispatched: dispatched,
        }),
      );
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/internal/gate/open") {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", async () => {
      let payload: Record<string, string>;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
        return;
      }

      const { qr_code_id } = payload;
      const requestId = crypto.randomUUID();

      if (!qr_code_id) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: "Missing qr_code_id" }));
        return;
      }

      let dispatchedCount = 0;
      for (const [deviceId, conn] of connections.entries()) {
        if (conn.listenQrs && conn.listenQrs.includes(qr_code_id)) {
          const success = socketWrite(conn.socket, {
            cmd: "OPEN_GATE",
            request_id: requestId,
            qr_code_id,
          });
          if (success) {
            dispatchedCount++;
            log("gate_open_dispatched", { deviceId, qr_code_id, requestId });
          }
        }
      }

      if (dispatchedCount > 0) {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            success: true,
            message: `Gate open dispatched to ${dispatchedCount} devices`,
            requestId,
          }),
        );
      } else {
        // v4 ADD: also check webhookConnections as fallback for the legacy /internal/gate/open path
        // when called by v3 dispatchToGateService with only qr_code_id
        let webhookDispatched = false;
        for (const [wPath, conn] of webhookConnections) {
          const isMatch =
            conn.listenQrs &&
            conn.listenQrs.some((q) => q.toLowerCase() === qr_code_id.toLowerCase());
          if (isMatch) {
            const ok = socketWrite(conn.socket, {
              cmd: "OPEN_GATE",
              request_id: requestId,
              qr_code_id,
            });
            if (ok) {
              webhookDispatched = true;
              log("gate_open_via_webhook_fallback", { webhookPath: wPath, qr_code_id, requestId });
            }
          }
        }
        if (webhookDispatched) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              success: true,
              message: "Gate open dispatched via webhook connection",
              requestId,
            }),
          );
        } else {
          res.writeHead(404);
          res.end(
            JSON.stringify({
              success: false,
              error: "No online devices listening for this qr_code_id",
            }),
          );
        }
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/internal/devices/status") {
    const status: Record<string, unknown>[] = [];
    for (const [id, conn] of connections) {
      status.push({
        device_id: id,
        last_seen: conn.lastSeen.toISOString(),
        registered_at: conn.registeredAt.toISOString(),
        connected: true,
      });
    }
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: { online: connections.size, devices: status } }));
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    const MAIN_PORT = Number(process.env.API_PORT) || 4000;
    const proxyOpts: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: MAIN_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${MAIN_PORT}` },
      timeout: 10_000,
    };

    const proxyReq = http.request(proxyOpts, (proxyRes) => {
      if (!res.headersSent) {
        res.writeHead(proxyRes.statusCode ?? 200, {
          ...proxyRes.headers,
          "Access-Control-Allow-Origin": "*",
        });
      }
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Main backend timeout" }));
      }
    });

    proxyReq.on("error", (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: "Main backend unreachable. Is npm run dev:all running?",
            detail: err.message,
          }),
        );
      }
    });

    req.pipe(proxyReq, { end: true });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ success: false, error: "Not found" }));
});

// Bind to 0.0.0.0 so the admin UI is reachable from the local network
httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
  log("http_api_started", {
    port: HTTP_PORT,
    ui: `http://<server-ip>:${HTTP_PORT}/`,
    note: "admin UI available on all interfaces",
  });
});

async function shutdown(signal: string) {
  log("shutdown", { signal });
  for (const [id, conn] of connections) {
    conn.socket.destroy();
    await setDeviceStatus(id, "offline").catch(() => {});
  }
  tcpServer.close();
  httpServer.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
