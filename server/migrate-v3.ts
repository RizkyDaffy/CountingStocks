import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function tableExists(conn: mysql.Connection, table: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
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

  console.log("🔄 Running V3 migration...\n");

  if (!(await tableExists(conn, "qr_aliases"))) {
    await conn.query(`
      CREATE TABLE qr_aliases (
        old_short_token VARCHAR(50) PRIMARY KEY,
        new_short_token VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_new_short_token (new_short_token)
      )
    `);
    console.log("✅ Created qr_aliases table");
  } else {
    console.log("✅ qr_aliases table already exists");
  }

  console.log("\n🎉 V3 migration selesai!");
  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ V3 migration gagal:", err);
  process.exit(1);
});
