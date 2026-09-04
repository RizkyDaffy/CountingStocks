import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { computeStockAnalytics, classifyStockJam } from "../lib/stockAnalyticsCalc.js";
import { persistComputedFields } from "../lib/stockAnalyticsService.js";

const router = Router();

function rowToPayload(row: RowDataPacket) {
  return {
    id: row.id,
    machine: row.mc,
    model: row.model,
    partNumber: row.part_number,
    partName: row.part_name,
    qtyPerDay: Number(row.qty_per_day),
    stockActual: Number(row.stock_actual),
    stockJam: Number(row.stok_jam),
    stokJam: Number(row.stok_jam),
    judge: row.judge,
    problem: row.problem,
    shikake: Number(row.shikake),
    qtyPerHour: Number(row.qty_per_hour),
    min: Number(row.min_val),
    max: Number(row.max_val),
    jamUpdate: row.jam_update,
    pic: row.pic,
    keterangan: row.keterangan,
    factory: row.factory,
  };
}

router.get("/", async (req, res) => {
  try {
    const factory = (req.query.factory as string) || "";
    let query = "SELECT * FROM stock_analytics WHERE 1=1";
    const params: string[] = [];
    if (factory) {
      query += " AND factory = ?";
      params.push(factory);
    }
    query += " ORDER BY machine ASC";
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows.map(rowToPayload) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get("/tv", async (req, res) => {
  try {
    const factory = (req.query.factory as string) || "";
    const shift = (req.query.shift as string) || "";

    // Resolve the factory param: accept uuid OR factory name.
    // Data is historically mixed: mesin.machine_factory stores uuids,
    // stock.factory stores names, stock_analytics.factory has both.
    let factoryKeys: string[] = [];
    let factoryLabel = factory;
    if (factory) {
      const [fRows] = await pool.query<RowDataPacket[]>(
        "SELECT uuid, factory_name FROM factories WHERE uuid = ? OR LOWER(factory_name) = LOWER(?) LIMIT 1",
        [factory, factory],
      );
      if (fRows[0]) {
        factoryKeys = [String(fRows[0].uuid), String(fRows[0].factory_name)];
        factoryLabel = String(fRows[0].factory_name);
      } else {
        factoryKeys = [factory];
      }
    }
    const factoryPh = factoryKeys.map(() => "?").join(", ");

    let mesinQuery = "SELECT * FROM mesin WHERE 1=1";
    const mesinParams: string[] = [];
    if (factory) {
      mesinQuery += ` AND machine_factory IN (${factoryPh})`;
      mesinParams.push(...factoryKeys);
    }
    mesinQuery += " ORDER BY machine_code ASC";
    const [mesinRows] = await pool.query<RowDataPacket[]>(mesinQuery, mesinParams);

    let analyticsQuery = "SELECT * FROM stock_analytics WHERE 1=1";
    const analyticsParams: string[] = [];
    if (factory) {
      analyticsQuery += ` AND factory IN (${factoryPh})`;
      analyticsParams.push(...factoryKeys);
    }
    const [analyticsRows] = await pool.query<RowDataPacket[]>(analyticsQuery, analyticsParams);

    const analyticsByMachine = new Map<string, RowDataPacket[]>();
    for (const a of analyticsRows) {
      const key = String(a.machine).toUpperCase();
      const list = analyticsByMachine.get(key) ?? [];
      list.push(a);
      analyticsByMachine.set(key, list);
    }

    let partsQuery = `SELECT mp.part_name, mp.part_number, mp.machine,
        sa.stok_jam, sa.judge
      FROM master_parts mp
      LEFT JOIN stock_analytics sa
        ON UPPER(sa.part_number) = UPPER(mp.part_number)
        AND UPPER(sa.machine) = UPPER(mp.machine)
      WHERE mp.machine IS NOT NULL AND mp.machine != ''`;
    const partsParams: string[] = [];
    if (factory) {
      partsQuery += ` AND UPPER(mp.machine) IN (
        SELECT UPPER(machine_code) FROM mesin WHERE machine_factory IN (${factoryPh})
      )`;
      partsParams.push(...factoryKeys);
    }
    partsQuery += " ORDER BY mp.machine, mp.part_name";
    const [partRows] = await pool.query<RowDataPacket[]>(partsQuery, partsParams);

    const partsByMachine = new Map<string, { part: string; pn: string; jam: number }[]>();
    for (const p of partRows) {
      const key = String(p.machine).toUpperCase();
      const list = partsByMachine.get(key) ?? [];
      list.push({
        part: p.part_name as string,
        pn: (p.judge as string) || "O",
        jam: Number(p.stok_jam) || 0,
      });
      partsByMachine.set(key, list);
    }

    let stockQuery = "SELECT * FROM stock WHERE 1=1";
    const stockParams: string[] = [];
    if (factory) {
      stockQuery += ` AND factory IN (${factoryPh})`;
      stockParams.push(...factoryKeys);
    }
    stockQuery += " ORDER BY part_name ASC";
    const [stockRows] = await pool.query<RowDataPacket[]>(stockQuery, stockParams);

    const machines = mesinRows.map((m) => {
      const isActive = m.machine_status === "active";
      const machineKey = String(m.machine_code).toUpperCase();
      const rowsForMachine = analyticsByMachine.get(machineKey) ?? [];

      const stockJamValues = rowsForMachine.map((r) => Number(r.stok_jam) || 0);
      const stokJam = stockJamValues.length > 0 ? Math.min(...stockJamValues) : 0;

      const cardStatus = classifyStockJam(stokJam, isActive);
      const partTable = partsByMachine.get(machineKey) ?? [];

      return {
        id: m.id,
        machineCode: m.machine_code,
        machineName: m.machine_name,
        status: m.machine_status,
        isActive,
        stokJam,
        stockJam: stokJam,
        cardStatus,
        partRows: partTable,
      };
    });

    const activeWithStock = machines.filter((m) => m.isActive);
    const critical = activeWithStock.filter((m) => m.cardStatus === "critical").length;
    const warning = activeWithStock.filter((m) => m.cardStatus === "warning").length;
    const safe = activeWithStock.filter((m) => m.cardStatus === "safe").length;

    const gaugePercent =
      activeWithStock.length > 0 ? Math.round((safe / activeWithStock.length) * 1000) / 10 : 0;

    const chartLabels = stockRows.map((s) => s.part_name as string);
    const chartData = stockRows.map((s) => Number(s.current_stock ?? s.units ?? 0));

    const jamByPart = new Map<string, number>();
    for (const a of analyticsRows) {
      const key = String(a.part_name).toUpperCase();
      const existing = jamByPart.get(key);
      const jam = Number(a.stok_jam) || 0;
      if (existing === undefined || jam < existing) jamByPart.set(key, jam);
    }
    const chartStokJam = stockRows.map((s) => {
      const key = String(s.part_name).toUpperCase();
      return jamByPart.get(key) ?? 0;
    });
    const chartStatus = chartStokJam.map((jam) => classifyStockJam(jam, true));

    const modelsByPart = new Map<string, Set<string>>();
    const machinesByPart = new Map<string, Set<string>>();
    for (const a of analyticsRows) {
      const key = String(a.part_name).toUpperCase();
      const model = String(a.model ?? "").trim();
      const machine = String(a.machine ?? "").trim();
      if (model) {
        const set = modelsByPart.get(key) ?? new Set<string>();
        set.add(model);
        modelsByPart.set(key, set);
      }
      if (machine) {
        const set = machinesByPart.get(key) ?? new Set<string>();
        set.add(machine);
        machinesByPart.set(key, set);
      }
    }
    const chartModels = stockRows.map((s) =>
      Array.from(modelsByPart.get(String(s.part_name).toUpperCase()) ?? []),
    );
    const chartMachines = stockRows.map((s) =>
      Array.from(machinesByPart.get(String(s.part_name).toUpperCase()) ?? []),
    );

    const priorityOrder = { critical: 0, warning: 1, safe: 2, none: 3 };
    const priorities = [...machines]
      .filter((m) => m.isActive && m.cardStatus !== "safe" && m.cardStatus !== "none")
      .sort(
        (a, b) =>
          priorityOrder[a.cardStatus] - priorityOrder[b.cardStatus] || a.stokJam - b.stokJam,
      )
      .flatMap((m) =>
        (m.partRows.length > 0 ? m.partRows : [{ part: "-", pn: "-", jam: m.stokJam }]).map(
          (row) => ({
            machine: m.machineCode,
            partName: row.part,
            partNumber: row.pn,
            stokJam: row.jam,
            status: m.cardStatus,
          }),
        ),
      );

    res.json({
      success: true,
      data: {
        factory,
        factoryLabel,
        shift,
        counts: { critical, warning, safe },
        gaugePercent,
        machines,
        chartLabels,
        chartData,
        chartStokJam,
        chartStatus,
        chartModels,
        chartMachines,
        priorities,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      machine,
      model = "",
      partNumber = "",
      partName = "",
      qtyPerDay = 0,
      stockActual = 0,
      problem = "",
      shikake = 1,
      minVal = 0,
      pic = "",
      keterangan = "",
      factory = "",
    } = req.body;

    if (!machine) {
      return res.status(400).json({ success: false, error: "Machine wajib diisi." });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO stock_analytics
        (machine, model, part_number, part_name, qty_per_day, stock_actual, stok_jam, judge,
         problem, shikake, qty_per_hour, min_val, max_val, jam_update, pic, keterangan, factory)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'O', ?, ?, 0, ?, 0, '0:00:00', ?, ?, ?)`,
      [
        String(machine).trim().toUpperCase(),
        model,
        partNumber,
        partName,
        qtyPerDay,
        stockActual,
        problem,
        shikake,
        minVal,
        pic || "unknown",
        keterangan,
        factory,
      ],
    );

    const [newRow] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM stock_analytics WHERE id = ?",
      [result.insertId],
    );
    if (newRow[0]) await persistComputedFields(newRow[0]);
    const [fresh] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM stock_analytics WHERE id = ?",
      [result.insertId],
    );
    res.status(201).json({ success: true, data: rowToPayload(fresh[0]) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      machine,
      model = "",
      partNumber = "",
      partName = "",
      qtyPerDay = 0,
      stockActual = 0,
      problem = "",
      shikake = 1,
      minVal = 0,
      pic = "",
      keterangan = "",
      factory = "",
    } = req.body;

    await pool.query(
      `UPDATE stock_analytics SET
        machine = ?, model = ?, part_number = ?, part_name = ?,
        qty_per_day = ?, stock_actual = ?,
        problem = ?, shikake = ?, min_val = ?, keterangan = ?, factory = ?
       WHERE id = ?`,
      [
        String(machine).trim().toUpperCase(),
        model,
        partNumber,
        partName,
        qtyPerDay,
        stockActual,
        problem,
        shikake,
        minVal,
        keterangan,
        factory,
        id,
      ],
    );

    const [beforePersist] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM stock_analytics WHERE id = ?",
      [id],
    );
    if (beforePersist[0]) await persistComputedFields(beforePersist[0]);
    const [row] = await pool.query<RowDataPacket[]>("SELECT * FROM stock_analytics WHERE id = ?", [
      id,
    ]);
    res.json({ success: true, data: rowToPayload(row[0]) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM stock_analytics WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Deleted" });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
