import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function migrateDevices() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pixel_scan_dashboard",
  });

  console.log("🔄 Running devices table migration...\n");

  async function addColumnIfMissing(table: string, column: string, definition: string) {
    const [cols] = (await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    )) as any;

    if (cols.length === 0) {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`);
      console.log(`  ✅ Added column: ${table}.${column}`);
    } else {
      console.log(`  ⏭  Column already exists: ${table}.${column}`);
    }
  }

  await addColumnIfMissing("devices", "device_code", "VARCHAR(50) NULL UNIQUE AFTER id");
  await addColumnIfMissing(
    "devices",
    "device_role",
    "ENUM('IN', 'OUT') NOT NULL DEFAULT 'IN' AFTER location",
  );
  await addColumnIfMissing("devices", "pin_hash", "VARCHAR(64) NULL AFTER device_role");
  await addColumnIfMissing(
    "devices",
    "active_status",
    "ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER pin_hash",
  );

  console.log("\n🎉 Devices migration selesai!");
  await conn.end();
  process.exit(0);
}

migrateDevices().catch((err) => {
  console.error("❌ Devices migration gagal:", err);
  process.exit(1);
});
