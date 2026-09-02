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
    database: process.env.DB_NAME || "outindb",
  });

  console.log("🔄 Running V3 migration (qty_per_day in shikake_settings)...\n");

  if (!(await columnExists(conn, "shikake_settings", "qty_per_day"))) {
    await conn.query(
      `ALTER TABLE shikake_settings ADD COLUMN qty_per_day DECIMAL(12,2) NOT NULL DEFAULT 0`,
    );
    console.log("✅ Added shikake_settings.qty_per_day");
  } else {
    console.log("ℹ️ shikake_settings.qty_per_day already exists");
  }

  console.log("\n🎉 V3 migration selesai!");
  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ V3 migration gagal:", err);
  process.exit(1);
});
