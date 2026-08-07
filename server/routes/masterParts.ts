import { Router } from "express";
import pool from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { upsertStockAnalyticsFromMasterPart } from "../lib/stockAnalyticsService.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    let query =
      "SELECT id, part_number, part_name, category, model, customer, qty_per_pallet, unit, status, factory_origin, machine, image_base64, created_at, updated_at FROM master_parts";
    const params: string[] = [];

    if (search) {
      query += " WHERE part_number LIKE ? OR part_name LIKE ? OR model LIKE ?";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += " ORDER BY created_at DESC";

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      partNumber,
      partName,
      category = "",
      model = "",
      customer = "",
      qtyPerPallet,
      unit = "PCS",
      status = "active",
      factoryOrigin = "",
      machine = "",
      imageBase64 = null,
    } = req.body;

    if (!partNumber || !partName || !qtyPerPallet) {
      return res.status(400).json({
        success: false,
        error: "Part Number, Part Name, dan Qty Per Pallet wajib diisi.",
      });
    }

    const machineVal = machine ? String(machine).trim().toUpperCase() : null;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO master_parts
        (part_number, part_name, category, model, customer, qty_per_pallet, unit, status, factory_origin, machine, image_base64)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        partNumber.trim().toUpperCase(),
        partName.trim().toUpperCase(),
        category.trim().toUpperCase(),
        model.trim().toUpperCase(),
        customer.trim().toUpperCase(),
        Number(qtyPerPallet),
        unit.trim().toUpperCase(),
        status,
        factoryOrigin,
        machineVal,
        imageBase64,
      ],
    );

    const [newRow] = await pool.query<RowDataPacket[]>("SELECT * FROM master_parts WHERE id = ?", [
      result.insertId,
    ]);

    if (machineVal) {
      await upsertStockAnalyticsFromMasterPart({
        part_number: newRow[0].part_number as string,
        part_name: newRow[0].part_name as string,
        model: newRow[0].model as string,
        machine: machineVal,
      });
    }

    res.status(201).json({ success: true, data: newRow[0] });
  } catch (err: unknown) {
    const msg = (err as Error).message || "";
    if (msg.includes("Duplicate entry")) {
      return res.status(409).json({
        success: false,
        error: "Part Number sudah terdaftar. Gunakan nomor yang berbeda.",
      });
    }
    res.status(500).json({ success: false, error: msg });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      partNumber,
      partName,
      category = "",
      model = "",
      customer = "",
      qtyPerPallet,
      unit = "PCS",
      status = "active",
      factoryOrigin = "",
      machine = "",
      imageBase64,
    } = req.body;

    if (!partNumber || !partName || !qtyPerPallet) {
      return res.status(400).json({
        success: false,
        error: "Part Number, Part Name, dan Qty Per Pallet wajib diisi.",
      });
    }

    const fields: string[] = [
      "part_number = ?",
      "part_name = ?",
      "category = ?",
      "model = ?",
      "customer = ?",
      "qty_per_pallet = ?",
      "unit = ?",
      "status = ?",
      "factory_origin = ?",
      "machine = ?",
    ];
    const machineVal = machine ? String(machine).trim().toUpperCase() : null;
    const values: unknown[] = [
      partNumber.trim().toUpperCase(),
      partName.trim().toUpperCase(),
      category.trim().toUpperCase(),
      model.trim().toUpperCase(),
      customer.trim().toUpperCase(),
      Number(qtyPerPallet),
      unit.trim().toUpperCase(),
      status,
      factoryOrigin,
      machineVal,
    ];

    if (imageBase64 !== undefined) {
      fields.push("image_base64 = ?");
      values.push(imageBase64);
    }

    values.push(id);

    await pool.query(`UPDATE master_parts SET ${fields.join(", ")} WHERE id = ?`, values);

    const [updatedRow] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM master_parts WHERE id = ?",
      [id],
    );

    if (machineVal) {
      await upsertStockAnalyticsFromMasterPart({
        part_number: updatedRow[0].part_number as string,
        part_name: updatedRow[0].part_name as string,
        model: updatedRow[0].model as string,
        machine: machineVal,
      });
    }

    res.json({ success: true, data: updatedRow[0] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM master_parts WHERE id = ?", [id]);
    res.json({ success: true, message: "Part berhasil dihapus." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
