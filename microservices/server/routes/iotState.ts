import { Router } from "express";
import { requireInternalKey } from "../middleware/internalKeyMiddleware.js";
import pool from "../db.js";
import type { RowDataPacket } from "mysql2";

const router = Router();

interface IotEntry {
  scanned: boolean;
  ts: number;
  resetTimer?: ReturnType<typeof setTimeout>;
}
const iotMap = new Map<string, IotEntry>();
const STATE_TTL_MS = 60_000;
const STATE_TTL_RAW_MS = 10_000;

function toJKT(ts: number): string {
  return new Date(ts + 7 * 3600_000).toISOString().replace("Z", "+07:00");
}

export function setIotScanned(webhookPath: string, ttl = STATE_TTL_MS): void {
  const prev = iotMap.get(webhookPath);
  if (prev?.resetTimer) clearTimeout(prev.resetTimer);

  const resetTimer = setTimeout(() => {
    const e = iotMap.get(webhookPath);
    if (e?.scanned) {
      iotMap.set(webhookPath, { scanned: false, ts: Date.now() });
      console.log(
        JSON.stringify({ ts: new Date().toISOString(), event: "iot_state_ttl_reset", webhookPath }),
      );
    }
  }, ttl);

  iotMap.set(webhookPath, { scanned: true, ts: Date.now(), resetTimer });
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), event: "iot_state_set_scanned", webhookPath }),
  );
}

export function resetIotScanned(webhookPath: string): void {
  const prev = iotMap.get(webhookPath);
  if (prev?.resetTimer) clearTimeout(prev.resetTimer);
  iotMap.set(webhookPath, { scanned: false, ts: Date.now() });
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), event: "iot_state_reset", webhookPath }),
  );
}

export function getIotEntries(): Record<string, { scanned: boolean; ts: string | null }> {
  const entries: Record<string, { scanned: boolean; ts: string | null }> = {};
  for (const [key, val] of iotMap.entries()) {
    entries[key] = {
      scanned: val.scanned,
      ts: val.ts ? new Date(val.ts).toISOString() : null,
    };
  }
  return entries;
}

function normalizeMc(mc: string): string {
  return mc.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function toPath(mc: string, qr: string): string {
  return `/webhook/${normalizeMc(mc)}/${qr.toUpperCase()}`;
}
function toRawPath(mc: string, f: string, qr: string): string {
  return `/webhook/${mc}/${f}/${qr.toUpperCase()}`;
}
function toFullPath(sc: string, f: string, m: string, qr: string): string {
  return `/webhook/${sc}/${f}/${m}/${qr.toUpperCase()}`;
}

router.get("/debug", requireInternalKey, (_req, res) => {
  const entries: Record<string, { scanned: boolean; ts: string | null }> = {};
  for (const [key, val] of iotMap.entries()) {
    entries[key] = {
      scanned: val.scanned,
      ts: val.ts ? new Date(val.ts).toISOString() : null,
    };
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    totalEntries: iotMap.size,
    entries,
    note: "Open /iot/{mc}/{qr} to see what the ESP32 sees. Keys should match the ESP32's webhook_path.",
  });
});

router.get("/ws/debug", requireInternalKey, async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT uuid, machine_code, machine_name, machine_desc, machine_status, machine_sc, machine_factory, created_at, updated_at FROM mesin ORDER BY machine_factory ASC, machine_code ASC",
    );

    const appliedSlugs = new Map<string, string>();
    for (const key of iotMap.keys()) {
      const parts = key.split("/");
      if (parts.length === 4) appliedSlugs.set(parts[2], parts[3]);
    }

    const applied: Record<string, unknown[]> = {};
    const unused: unknown[] = [];

    for (const row of rows) {
      const slug = String(row.machine_code)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const qr = appliedSlugs.get(slug);
      const entry = { ...row, mc: String(row.machine_code), qr: qr ?? null };
      if (qr) {
        const f =
          row.machine_factory && String(row.machine_factory).trim()
            ? String(row.machine_factory).trim()
            : "Unassigned";
        if (!applied[f]) applied[f] = [];
        applied[f].push(entry);
      } else {
        unused.push(entry);
      }
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ applied: { ...applied, unused } });
  } catch (err: unknown) {
    const detail =
      err && typeof err === "object"
        ? (err as Record<string, unknown>).sqlMessage ||
          (err as Record<string, unknown>).message ||
          (err as Record<string, unknown>).code ||
          String(err)
        : String(err);
    console.error("[iot/ws/debug]", err);
    res.status(500).json({ error: "ws/debug failed", details: detail });
  }
});

router.post("/set/:mc/:qr", requireInternalKey, (req, res) => {
  const path = toPath(req.params.mc, req.params.qr);
  setIotScanned(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    success: true,
    scanned: true,
    webhookPath: path,
    note: "Manually triggered for testing",
  });
});

router.get("/:sc/:f/:m/:qr", async (req, res) => {
  const { sc, f, m, qr } = req.params;
  const qrUpper = qr.toUpperCase();

  try {
    const [mcRows] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM mesin WHERE uuid = ? AND machine_factory = ? LIMIT 1",
      [m, f],
    );
    if (mcRows.length === 0) {
      return res
        .status(404)
        .setHeader("Access-Control-Allow-Origin", "*")
        .json({ error: "machine not found" });
    }

    const [qrRows] = await pool.query<RowDataPacket[]>(
      "SELECT machine_origin FROM qr_codes WHERE qr_id = ? LIMIT 1",
      [qrUpper],
    );
    if (qrRows.length === 0) {
      return res
        .status(404)
        .setHeader("Access-Control-Allow-Origin", "*")
        .json({ error: `qr ${qrUpper} not found` });
    }
  } catch {}

  const path = toFullPath(sc, f, m, qrUpper);
  const entry = iotMap.get(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    scanned: entry?.scanned ?? false,
    webhookPath: path,
    ts: entry?.ts ? toJKT(entry.ts) : null,
  });
});

router.post("/:sc/:f/:m/:qr/reset", (req, res) => {
  const path = toFullPath(req.params.sc, req.params.f, req.params.m, req.params.qr);
  resetIotScanned(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ success: true, scanned: false, webhookPath: path });
});

router.get("/:f/:m/:qr", async (req, res) => {
  const { f, m, qr } = req.params;
  const qrUpper = qr.toUpperCase();

  try {
    const [mcRows] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM mesin WHERE uuid = ? AND machine_factory = ? LIMIT 1",
      [m, f],
    );
    if (mcRows.length === 0) {
      return res
        .status(404)
        .setHeader("Access-Control-Allow-Origin", "*")
        .json({ error: "machine not found" });
    }
  } catch {}

  const path = toRawPath(m, f, qrUpper);
  const entry = iotMap.get(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    scanned: entry?.scanned ?? false,
    webhookPath: path,
    ts: entry?.ts ? toJKT(entry.ts) : null,
  });
});

router.post("/:f/:m/:qr/reset", (req, res) => {
  const path = toRawPath(req.params.m, req.params.f, req.params.qr);
  resetIotScanned(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ success: true, scanned: false, webhookPath: path });
});

router.get("/:m/:qr", async (req, res) => {
  const { m, qr } = req.params;
  const qrUpper = qr.toUpperCase();

  try {
    const [mcRows] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM mesin WHERE machine_code = ? LIMIT 1",
      [m],
    );
    if (mcRows.length === 0) {
      return res
        .status(404)
        .setHeader("Access-Control-Allow-Origin", "*")
        .json({ error: "machine not found" });
    }
  } catch {}

  const path = toPath(m, qrUpper);
  const entry = iotMap.get(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    scanned: entry?.scanned ?? false,
    webhookPath: path,
    ts: entry?.ts ? new Date(entry.ts).toISOString() : null,
  });
});

router.post("/:m/:qr/reset", (req, res) => {
  const path = toPath(req.params.m, req.params.qr);
  resetIotScanned(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ success: true, scanned: false, webhookPath: path });
});

export default router;
