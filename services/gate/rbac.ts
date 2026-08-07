import net from "net";
import type mysql from "mysql2/promise";

interface DeviceConnection {
  socket: net.Socket;
  lastSeen: Date;
  registeredAt: Date;
}

export interface GateOpenParams {
  requestId: string;
  userId: number;
  stationId: number;
  machineId: number;
  direction: "in" | "out";
  qrCodeId?: string;
  pool: mysql.Pool;
  connections: Map<string, DeviceConnection>;
}

export interface GateOpenResult {
  success: boolean;
  statusCode?: number;
  message?: string;
  error?: string;
  requestId: string;
  esp32DeviceId?: string;
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

export async function dispatchGateOpen(params: GateOpenParams): Promise<GateOpenResult> {
  const { requestId, userId, stationId, machineId, direction, qrCodeId, pool, connections } =
    params;

  const baseLog = { requestId, userId, stationId, machineId, direction, qrCodeId };

  const [deviceRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, connection_status, is_active
     FROM esp32_devices
     WHERE machine_id = ? AND direction = ? AND is_active = 1
     LIMIT 1`,
    [machineId, direction],
  );

  if (deviceRows.length === 0) {
    const msg = "No ESP32 registered for this machine/direction";
    log("gate_dispatch_no_device", { ...baseLog, result: "device_not_found" });
    await writeCommandLog(pool, {
      ...baseLog,
      esp32DeviceId: null,
      result: "device_not_found",
      detail: msg,
    });
    return { success: false, statusCode: 404, error: msg, requestId };
  }

  const esp32DeviceId: string = deviceRows[0].id;
  const connectionStatus: string = deviceRows[0].connection_status;

  const liveConn = connections.get(esp32DeviceId);
  if (!liveConn || connectionStatus !== "online") {
    const msg = `Device ${esp32DeviceId} is offline`;
    log("gate_dispatch_device_offline", { ...baseLog, esp32DeviceId, result: "device_offline" });
    await writeCommandLog(pool, {
      ...baseLog,
      esp32DeviceId,
      result: "device_offline",
      detail: msg,
    });
    return { success: false, statusCode: 503, error: msg, requestId, esp32DeviceId };
  }

  // [Step 3] RBAC — check user_id has privilege to trigger this esp32_device_id
  const [privRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM esp32_user_privileges
     WHERE esp32_device_id = ? AND user_id = ?
     LIMIT 1`,
    [esp32DeviceId, userId],
  );

  if (privRows.length === 0) {
    const msg = `User ${userId} is not authorized for device ${esp32DeviceId}`;
    log("gate_dispatch_rbac_rejected", { ...baseLog, esp32DeviceId, result: "rejected_rbac" });
    await writeCommandLog(pool, {
      ...baseLog,
      esp32DeviceId,
      result: "rejected_rbac",
      detail: msg,
    });
    return {
      success: false,
      statusCode: 403,
      error: "User not authorized for this gate",
      requestId,
      esp32DeviceId,
    };
  }

  // [Step 4] Send OPEN_GATE command over TCP
  const command = {
    command: "OPEN_GATE",
    duration_ms: Number(process.env.GATE_OPEN_DURATION_MS) || 3000,
    request_id: requestId,
  };

  const sent = socketWrite(liveConn.socket, command);

  if (!sent) {
    const msg = "Failed to write to device socket";
    log("gate_dispatch_socket_write_failed", { ...baseLog, esp32DeviceId });
    await writeCommandLog(pool, { ...baseLog, esp32DeviceId, result: "error", detail: msg });
    // Mark device offline since write failed
    connections.delete(esp32DeviceId);
    await pool
      .query("UPDATE esp32_devices SET connection_status = 'offline' WHERE id = ?", [esp32DeviceId])
      .catch(() => {});
    return { success: false, statusCode: 502, error: msg, requestId, esp32DeviceId };
  }

  log("gate_dispatch_sent", { ...baseLog, esp32DeviceId, requestId });

  // Log the dispatch — ACK will update this row later when ESP32 responds
  await writeCommandLog(pool, { ...baseLog, esp32DeviceId, result: "sent", detail: null });

  return {
    success: true,
    message: `OPEN_GATE command dispatched to ${esp32DeviceId}`,
    requestId,
    esp32DeviceId,
  };
}

async function writeCommandLog(
  pool: mysql.Pool,
  data: {
    requestId: string;
    userId: number;
    stationId: number;
    machineId: number;
    direction: string;
    qrCodeId?: string;
    esp32DeviceId: string | null;
    result: string;
    detail: string | null;
  },
) {
  try {
    await pool.query(
      `INSERT INTO gate_command_log
         (request_id, user_id, station_id, machine_id, direction, qr_code_id, esp32_device_id, result, result_detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE result = VALUES(result), result_detail = VALUES(result_detail)`,
      [
        data.requestId,
        data.userId,
        data.stationId,
        data.machineId,
        data.direction,
        data.qrCodeId ?? null,
        data.esp32DeviceId,
        data.result,
        data.detail,
      ],
    );
  } catch (err) {
    // Non-critical — log locally but don't throw
    console.error("gate_log_write_error", (err as Error).message);
  }
}
