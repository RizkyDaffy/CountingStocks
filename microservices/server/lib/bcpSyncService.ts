/**
 * BCP Sync Service
 *
 * Polls the google-sheet microservice for rawValues, reads the latest date
 * shift pair (pagi + malam) by column index parity, and updates the stock table
 * (current_stock & units) for the linked part.
 *
 * ponytail: polling interval is 60s with overlap guard.
 */

import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { syncStockAnalyticsOnScan } from "./stockAnalyticsService.js";

const GSHEET_BASE = process.env.GSHEET_SERVICE_URL || "http://localhost:4002";
// Default 5s: the gsheet service serves from its in-memory cache, so this is
// cheap. Total sheet-edit -> UI latency stays within seconds.
const POLL_MS = Math.max(5_000, Number(process.env.BCP_SYNC_INTERVAL_MS) || 5_000);

// stock.percentage is decimal(5,2) - max 999.99. Clamp so a tiny unit_value
// (e.g. 1) can never make the UPDATE fail with "Out of range".
function clampPercentage(pct: number): number {
  return Math.min(999.99, Math.max(0, pct));
}

type BcpLink = {
  id: number;
  part_id: number;
  part_name: string;
  sheet_id: number;
  sheet_title: string;
  row_key: string;
};

type SheetSnapshot = {
  sheet?: {
    sheetTitle: string;
    sheetId: number;
    rawValues: string[][];
  };
};

let isSyncing = false;

/**
 * Extract stock from Google Sheet row by taking the latest non-empty numeric value.
 * In the sheet, data starts at column index 3 (after Machine, Part Name, Model Part).
 */
export function extractStock(rawValues: string[][], rowKey: string): number | null {
  const normalise = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");
  const target = normalise(rowKey);

  for (const row of rawValues) {
    if (row.length < 2) continue;
    if (normalise(row[1] ?? "") !== target) continue;

    // Find the rightmost column >= 3 that has a non-empty numeric value
    for (let i = row.length - 1; i >= 3; i--) {
      const cell = (row[i] ?? "").replace(/[,\s]/g, "");
      if (cell !== "" && !isNaN(parseFloat(cell))) {
        return parseFloat(cell);
      }
    }

    return 0; // Row matched but no numeric data entered yet
  }

  return null; // Row not found in sheet
}

async function fetchSheet(sheetKey: string): Promise<SheetSnapshot | null> {
  try {
    const url = `${GSHEET_BASE}/api/v1/sheets/${encodeURIComponent(sheetKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as SheetSnapshot;
  } catch {
    return null;
  }
}

export async function syncOnce(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    let links: BcpLink[] = [];
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id, part_id, part_name, sheet_id, sheet_title, row_key FROM bcp_links",
      );
      links = rows as BcpLink[];
    } catch {
      return; // DB table may not exist yet
    }

    if (links.length === 0) return;

    // Group links by sheet_id to minimise gsheet API calls
    const bySheet = new Map<number, BcpLink[]>();
    for (const link of links) {
      const arr = bySheet.get(link.sheet_id) ?? [];
      arr.push(link);
      bySheet.set(link.sheet_id, arr);
    }

    for (const [sheetId, sheetLinks] of bySheet) {
      const snapshot = await fetchSheet(String(sheetId));
      if (!snapshot) continue;

      const rawValues = snapshot.sheet?.rawValues ?? [];

      for (const link of sheetLinks) {
        const total = extractStock(rawValues, link.row_key);
        if (total === null) continue; // row missing in sheet - don't overwrite

        try {
          const bcpBatchId = `BCP-${link.part_id}`;
          const bcpQrId = `BCP-${link.part_id}`;

          // Check if BCP stock record exists for this specific part
          const [stockRows] = await pool.query<RowDataPacket[]>(
            "SELECT id, batch_id, qr_id, unit_value, current_stock FROM stock WHERE batch_id = ? OR (part_name = ? AND batch_id LIKE 'BCP-%') LIMIT 1",
            [bcpBatchId, link.part_name],
          );

          if (stockRows.length > 0) {
            const sRow = stockRows[0];
            const oldStock = Number(sRow.current_stock ?? 0);
            const uv = Number(sRow.unit_value ?? 0);
            const trend: "up" | "down" | "none" =
              total > oldStock ? "up" : total < oldStock ? "down" : "none";
            const percentage = uv > 0 ? clampPercentage((total / uv) * 100) : 0;

            // NOTE: stock table has no 'units' column - do not write it.
            await pool.query(
              `UPDATE stock
               SET current_stock = ?, trend = ?, percentage = ?, updated_at = NOW()
               WHERE id = ?`,
              [total, trend, percentage, sRow.id],
            );

            if (sRow.batch_id) {
              await syncStockAnalyticsOnScan(
                link.part_name,
                "Google Sheet BCP",
                sRow.batch_id,
              ).catch(() => {});
            }
          } else {
            // If no BCP stock record exists yet, fetch metadata from master_parts
            const [mpRows] = await pool.query<RowDataPacket[]>(
              "SELECT id, part_name, factory_origin, qty_per_pallet FROM master_parts WHERE id = ? OR UPPER(part_name) = UPPER(?) LIMIT 1",
              [link.part_id, link.part_name],
            );

            const factory = mpRows[0]?.factory_origin || "Factory 2";
            const uv = Number(mpRows[0]?.qty_per_pallet) || 100;
            const percentage = uv > 0 ? clampPercentage((total / uv) * 100) : 0;

            await pool.query<ResultSetHeader>(
              `INSERT INTO stock (batch_id, qr_id, part_name, factory, unit_value, current_stock, trend, percentage)
               VALUES (?, ?, ?, ?, ?, ?, 'up', ?)
               ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), percentage = VALUES(percentage), updated_at = NOW()`,
              [bcpBatchId, bcpQrId, link.part_name, factory, uv, total, percentage],
            );

            await syncStockAnalyticsOnScan(link.part_name, "Google Sheet BCP", bcpBatchId).catch(
              () => {},
            );
          }
        } catch (err) {
          console.error(`[BCP-SYNC] Error updating stock for ${link.part_name}:`, err);
        }
      }
    }
  } finally {
    isSyncing = false;
  }
}

export function startBcpSync(): void {
  const scheduleNext = () => {
    setTimeout(async () => {
      try {
        await syncOnce();
      } catch (err) {
        console.error("[BCP-SYNC] Periodic sync error:", err);
      } finally {
        scheduleNext();
      }
    }, POLL_MS);
  };

  // Initial run after 5s
  setTimeout(async () => {
    await syncOnce().catch(() => {});
    scheduleNext();
  }, 5_000);
}
