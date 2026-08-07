import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function columnExists(
  conn: mysql.Connection,
  table: string,
  column: string,
): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return (rows[0]?.cnt as number) > 0;
}

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pixel_scan_dashboard",
  });

  console.log("🔄 Running V4 migration...\n");

  if (!(await columnExists(conn, "qr_codes", "part_id"))) {
    await conn.query(`ALTER TABLE qr_codes ADD COLUMN part_id INT NULL DEFAULT NULL`);
    console.log("✅ Added qr_codes.part_id");

    await conn.query(`
      UPDATE qr_codes q
      JOIN master_parts mp ON LOWER(TRIM(q.part_name)) = LOWER(TRIM(mp.part_name))
      SET q.part_id = mp.id
      WHERE q.part_id IS NULL
    `);
    console.log("✅ Backfilled qr_codes.part_id from master_parts");
  } else {
    console.log("✅ qr_codes.part_id already exists");
  }

  const [idxRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qr_codes' AND INDEX_NAME = 'idx_qr_part_id'`,
  );
  if ((idxRows[0]?.cnt as number) === 0) {
    await conn.query(`ALTER TABLE qr_codes ADD INDEX idx_qr_part_id (part_id)`);
    console.log("✅ Added index idx_qr_part_id on qr_codes");
  }

  console.log("\n🎉 V4 migration selesai!");
  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ V4 migration gagal:", err);
  process.exit(1);
});
