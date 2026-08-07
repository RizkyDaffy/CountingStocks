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

function normalizeMc(mc: string): string {
  return mc.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function toPath(mc: string, qr: string): string {
  return `/webhook/${normalizeMc(mc)}/${qr.toUpperCase()}`;
}
function toRawPath(mc: string, f: string, qr: string): string {
  return `/webhook/${mc}/${f}/${qr.toUpperCase()}`;
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
      "SELECT id, machine_code, machine_name, description, status, created_at, updated_at, factory FROM mesin ORDER BY factory ASC, machine_code ASC",
    );

    const appliedSlugs = new Map<string, string>(); // slug → qr
    for (const key of iotMap.keys()) {
      const parts = key.split("/"); // ["", "webhook", mc, qr]
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
          row.factory && String(row.factory).trim() ? String(row.factory).trim() : "Unassigned";
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

router.get("/:mc/:f/:qr", async (req, res) => {
  const { mc, f, qr } = req.params;
  const qrUpper = qr.toUpperCase();

  try {
    // Validate machine exists in DB
    const [mcRows] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM mesin WHERE machine_code = ? AND factory = ? LIMIT 1",
      [mc, f],
    );
    if (mcRows.length === 0) {
      return res
        .status(404)
        .setHeader("Access-Control-Allow-Origin", "*")
        .json({
          error: `the ${mc} doesn't exist on the server, you trippin man`,
        });
    }

    const [qrRows] = await pool.query<RowDataPacket[]>(
      "SELECT machine_origin FROM qr_codes WHERE qr_id = ? LIMIT 1",
      [qrUpper],
    );
    if (qrRows.length === 0) {
      return res
        .status(404)
        .setHeader("Access-Control-Allow-Origin", "*")
        .json({
          error: `the ${qrUpper} doesn't exist on the server, you trippin man`,
        });
    }
    if (qrRows[0].machine_origin !== mc) {
      return res.status(422).setHeader("Access-Control-Allow-Origin", "*").json({
        error: "this qr are not linked with this machine",
      });
    }
  } catch {}

  const path = toRawPath(mc, f, qrUpper);
  const entry = iotMap.get(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    scanned: entry?.scanned ?? false,
    webhookPath: path,
    ts: entry?.ts ? toJKT(entry.ts) : null,
  });
});

router.post("/:mc/:f/:qr/reset", (req, res) => {
  const path = toRawPath(req.params.mc, req.params.f, req.params.qr);
  resetIotScanned(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ success: true, scanned: false, webhookPath: path });
});

router.get("/:mc/:qr", (req, res) => {
  const path = toPath(req.params.mc, req.params.qr);
  const entry = iotMap.get(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    scanned: entry?.scanned ?? false,
    webhookPath: path,
    ts: entry?.ts ? new Date(entry.ts).toISOString() : null,
  });
});

router.post("/:mc/:qr/reset", (req, res) => {
  const path = toPath(req.params.mc, req.params.qr);
  resetIotScanned(path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ success: true, scanned: false, webhookPath: path });
});

export default router;
