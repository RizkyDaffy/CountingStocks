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

async function columnExists(conn: mysql.Connection, table: string, col: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col],
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

  console.log("🔄 Running V6 migration (BCP links)...\n");

  if (!(await tableExists(conn, "bcp_links"))) {
    await conn.query(`
      CREATE TABLE bcp_links (
        id           INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
        part_id      INT           NOT NULL,
        part_name    VARCHAR(500)  NOT NULL,
        sheet_id     BIGINT        NOT NULL COMMENT 'Numeric gid of the Google Sheet tab',
        sheet_title  VARCHAR(255)  NOT NULL,
        row_key      VARCHAR(500)  NOT NULL COMMENT 'part_name value from gsheet row[1] used for matching',
        created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_part_id (part_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Created table bcp_links");
  } else {
    console.log("ℹ️ bcp_links exists — checking columns...");
    if (!(await columnExists(conn, "bcp_links", "part_name"))) {
      await conn.query("ALTER TABLE bcp_links ADD COLUMN part_name VARCHAR(500) NOT NULL DEFAULT '' AFTER part_id");
      console.log("✅ Added column bcp_links.part_name");
    }
    if (!(await columnExists(conn, "bcp_links", "row_key"))) {
      await conn.query("ALTER TABLE bcp_links ADD COLUMN row_key VARCHAR(500) NOT NULL DEFAULT '' AFTER sheet_title");
      console.log("✅ Added column bcp_links.row_key");
    }
  }

  console.log("\n🎉 V6 migration selesai!");
  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ V6 migration gagal:", err);
  process.exit(1);
});
