import mysql from "mysql2/promise";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { config } from "./config.js";

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
    host: config.DB.host,
    port: config.DB.port,
    user: config.DB.user,
    password: config.DB.password,
    database: config.DB.database,
  });

  const SECRET_KEY = config.JWT_SECRET;

  console.log("🔄 Running V5 migration...\n");

  if (!(await columnExists(conn, "qr_codes", "machine_origin"))) {
    await conn.query(
      `ALTER TABLE qr_codes ADD COLUMN machine_origin VARCHAR(255) NOT NULL DEFAULT ''`,
    );
    console.log("✅ Added qr_codes.machine_origin");

    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id, token FROM qr_codes WHERE token IS NOT NULL AND token != ''",
    );

    let backfilled = 0;
    for (const row of rows) {
      try {
        const decoded = jwt.verify(row.token, SECRET_KEY) as {
          machineOrigin?: string;
        };
        const mo = decoded.machineOrigin ?? "";
        if (mo) {
          await conn.query("UPDATE qr_codes SET machine_origin = ? WHERE id = ?", [mo, row.id]);
          backfilled++;
        }
      } catch {}
    }
    console.log(`✅ Backfilled machine_origin for ${backfilled} rows`);
  } else {
    console.log("✅ qr_codes.machine_origin already exists");
  }

  console.log("\n🎉 V5 migration selesai!");
  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ V5 migration gagal:", err);
  process.exit(1);
});
