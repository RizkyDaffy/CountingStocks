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

async function indexExists(
  conn: mysql.Connection,
  table: string,
  indexName: string,
): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
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

  console.log("🔄 Running V2 migration...\n");

  if (!(await columnExists(conn, "master_parts", "machine"))) {
    await conn.query(`ALTER TABLE master_parts ADD COLUMN machine VARCHAR(100) NULL DEFAULT NULL`);
    console.log("✅ Added master_parts.machine");
  }

  if (await columnExists(conn, "stock_analytics", "jam_update")) {
    const [col] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT DATA_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_analytics' AND COLUMN_NAME = 'jam_update'`,
    );
    if (col[0]?.DATA_TYPE === "timestamp" || col[0]?.DATA_TYPE === "datetime") {
      await conn.query(
        `ALTER TABLE stock_analytics MODIFY COLUMN jam_update VARCHAR(12) DEFAULT '0:00:00'`,
      );
      console.log("✅ Changed stock_analytics.jam_update to VARCHAR (HH:MM:SS)");
    }
  }

  if (!(await indexExists(conn, "stock_analytics", "uk_part_machine"))) {
    await conn.query(
      `ALTER TABLE stock_analytics ADD UNIQUE KEY uk_part_machine (part_number, machine)`,
    );
    console.log("✅ Added unique key on stock_analytics(part_number, machine)");
  }

  if (!(await columnExists(conn, "shikake_settings", "min_val"))) {
    await conn.query(
      `ALTER TABLE shikake_settings ADD COLUMN min_val DECIMAL(12,2) NOT NULL DEFAULT 0`,
    );
    console.log("✅ Added shikake_settings.min_val");
  }

  console.log("\n🎉 V2 migration selesai!");
  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ V2 migration gagal:", err);
  process.exit(1);
});
