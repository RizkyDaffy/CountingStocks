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

  console.log("🔄 Running v4 short-token migration...\n");

  if (!(await columnExists(conn, "qr_codes", "short_token"))) {
    await conn.query(`ALTER TABLE qr_codes ADD COLUMN short_token VARCHAR(16) NULL AFTER token`);
    console.log("✅ Added qr_codes.short_token column");

    await conn.query(`ALTER TABLE qr_codes ADD UNIQUE INDEX idx_short_token (short_token)`);
    console.log("✅ Added unique index on qr_codes.short_token");
  } else {
    console.log("ℹ️  qr_codes.short_token already exists - skipping");
  }

  console.log("\n🎉 v4 migration selesai!");
  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration gagal:", err);
  process.exit(1);
});
