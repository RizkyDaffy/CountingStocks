import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pixel_scan_dashboard",
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS bcp_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stock_id INT NOT NULL,
      part_name VARCHAR(255) NOT NULL,
      spreadsheet_id VARCHAR(128) DEFAULT '',
      sheet_id BIGINT NOT NULL,
      sheet_title VARCHAR(255) DEFAULT '',
      sheet_part_name VARCHAR(255) NOT NULL,
      sheet_part_number VARCHAR(255) DEFAULT '',
      active TINYINT(1) NOT NULL DEFAULT 1,
      last_synced_stock INT NULL,
      last_synced_at TIMESTAMP NULL,
      last_error VARCHAR(512) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_bcp_stock (stock_id),
      INDEX idx_bcp_sheet (sheet_id)
    )
  `);
  console.log("✅ Table bcp_links siap (Business Continues Plan)");

  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration gagal:", err);
  process.exit(1);
});
