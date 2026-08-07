import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { computeStockAnalytics, formatJamUpdateTime } from "./stockAnalyticsCalc.js";

export type MasterPartRow = {
  part_number: string;
  part_name: string;
  model?: string;
  machine?: string | null;
};

export async function getMachineFactory(machineCode: string): Promise<string> {
  if (!machineCode?.trim()) return "";
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT factory FROM mesin WHERE UPPER(machine_code) = UPPER(?) LIMIT 1",
    [machineCode.trim()],
  );
  return (rows[0]?.factory as string) ?? "";
}

export async function persistComputedFields(row: RowDataPacket): Promise<void> {
  const computed = computeStockAnalytics({
    qtyPerDay: Number(row.qty_per_day),
    stockActual: Number(row.stock_actual),
    shikake: Number(row.shikake),
    minPlaceholder: Number(row.min_val),
  });

  await pool.query(
    `UPDATE stock_analytics SET
      stok_jam = ?, judge = ?, qty_per_hour = ?, max_val = ?
     WHERE id = ?`,
    [computed.stockJam, computed.judge, computed.qtyPerHour, computed.max, row.id],
  );
}

export async function upsertStockAnalyticsFromMasterPart(part: MasterPartRow): Promise<void> {
  const machine = part.machine?.trim();
  if (!machine) return;

  const partNumber = part.part_number.trim().toUpperCase();
  const partName = part.part_name.trim().toUpperCase();
  const model = (part.model ?? "").trim().toUpperCase();
  const factory = await getMachineFactory(machine);

  const [existing] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM stock_analytics
     WHERE UPPER(part_number) = ? AND UPPER(machine) = ?`,
    [partNumber, machine.toUpperCase()],
  );

  if (existing.length === 0) {
    await pool.query<ResultSetHeader>(
      `INSERT INTO stock_analytics
        (machine, model, part_number, part_name, qty_per_day, stock_actual, stok_jam, judge,
         problem, shikake, qty_per_hour, min_val, max_val, jam_update, pic, factory)
       VALUES (?, ?, ?, ?, 0, 0, 0, 'O', '', 0, 0, 0, 0, '0:00:00', 'unknown', ?)`,
      [machine.toUpperCase(), model, partNumber, partName, factory],
    );
    return;
  }

  await pool.query(
    `UPDATE stock_analytics SET
      machine = ?, model = ?, part_name = ?, factory = ?
     WHERE id = ?`,
    [machine.toUpperCase(), model, partName, factory, existing[0].id],
  );

  const [updated] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM stock_analytics WHERE id = ?",
    [existing[0].id],
  );
  if (updated[0]) await persistComputedFields(updated[0]);
}

export async function updateMinValByPartNumber(partNumber: string, minVal: number): Promise<void> {
  const pn = partNumber.trim().toUpperCase();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM stock_analytics WHERE UPPER(part_number) = ?",
    [pn],
  );
  for (const row of rows) {
    await pool.query("UPDATE stock_analytics SET min_val = ? WHERE id = ?", [minVal, row.id]);
    const [fresh] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM stock_analytics WHERE id = ?",
      [row.id],
    );
    if (fresh[0]) await persistComputedFields(fresh[0]);
  }
}

export async function updateQtyPerDayByPartNumber(
  partNumber: string,
  qtyPerDay: number,
): Promise<void> {
  const pn = partNumber.trim().toUpperCase();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM stock_analytics WHERE UPPER(part_number) = ?",
    [pn],
  );
  for (const row of rows) {
    await pool.query("UPDATE stock_analytics SET qty_per_day = ? WHERE id = ?", [
      qtyPerDay,
      row.id,
    ]);
    const [fresh] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM stock_analytics WHERE id = ?",
      [row.id],
    );
    if (fresh[0]) await persistComputedFields(fresh[0]);
  }
}

export async function syncShikakeSettingsToAnalytics(partNumber: string): Promise<void> {
  const pn = partNumber.trim().toUpperCase();
  const [settings] = await pool.query<RowDataPacket[]>(
    `SELECT s.shikake_value, s.min_val, s.qty_per_day
     FROM shikake_settings s
     JOIN master_parts mp ON mp.id = s.master_part_id
     WHERE UPPER(mp.part_number) = ?`,
    [pn],
  );

  if (settings.length > 0) {
    const { shikake_value, min_val, qty_per_day } = settings[0];
    await pool.query(
      `UPDATE stock_analytics SET
        shikake = ?,
        min_val = ?,
        qty_per_day = ?
       WHERE UPPER(part_number) = ?`,
      [shikake_value, min_val, qty_per_day, pn],
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM stock_analytics WHERE UPPER(part_number) = ?",
      [pn],
    );
    for (const row of rows) {
      await persistComputedFields(row);
    }
  }
}

export async function syncStockAnalyticsOnScan(
  partName: string,
  scannerUsername: string,
  batchId?: string,
  conn: any = pool,
): Promise<void> {
  const normalizedName = partName.trim().toUpperCase();
  let stockActual: number | null = null;

  if (batchId) {
    const [stockRows] = await conn.query(
      "SELECT current_stock FROM stock WHERE batch_id = ? LIMIT 1",
      [batchId],
    );
    if (stockRows.length) {
      stockActual = Number(stockRows[0].current_stock);
    }
  }

  const [rows] = await conn.query(
    `SELECT * FROM stock_analytics
     WHERE UPPER(part_name) = ?`,
    [normalizedName],
  );

  if (!rows.length) {
    const [mpRows] = await conn.query(
      `SELECT part_number, part_name, model, machine FROM master_parts
       WHERE UPPER(part_name) = ? AND machine IS NOT NULL AND machine != ''`,
      [normalizedName],
    );
    if (mpRows[0]?.machine) {
      await upsertStockAnalyticsFromMasterPart({
        part_number: mpRows[0].part_number as string,
        part_name: mpRows[0].part_name as string,
        model: mpRows[0].model as string,
        machine: mpRows[0].machine as string,
      });
      const [again] = await conn.query(`SELECT * FROM stock_analytics WHERE UPPER(part_name) = ?`, [
        normalizedName,
      ]);
      rows.push(...again);
    }
  }

  const jamUpdate = formatJamUpdateTime();
  const pic = scannerUsername?.trim() || "unknown";

  for (const row of rows) {
    if (stockActual !== null) {
      row.stock_actual = stockActual;
    }

    const computed = computeStockAnalytics({
      qtyPerDay: Number(row.qty_per_day),
      stockActual: Number(row.stock_actual),
      shikake: Number(row.shikake),
      minPlaceholder: Number(row.min_val),
    });

    await conn.query(
      `UPDATE stock_analytics SET 
        stock_actual = ?, jam_update = ?, pic = ?,
        stok_jam = ?, judge = ?, qty_per_hour = ?, max_val = ?
       WHERE id = ?`,
      [
        row.stock_actual,
        jamUpdate,
        pic,
        computed.stockJam,
        computed.judge,
        computed.qtyPerHour,
        computed.max,
        row.id,
      ],
    );
  }
}
