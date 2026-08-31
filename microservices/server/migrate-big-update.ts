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

  console.log("🔄 Running BIG UPDATE migration...\n");

  if (!(await tableExists(conn, "users"))) {
    await conn.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        nik VARCHAR(50) DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'operator',
        status ENUM('active', 'inactive') DEFAULT 'active',
        tv_factory VARCHAR(255) DEFAULT '',
        tv_shift ENUM('A', 'B') DEFAULT 'A',
        tv_theme VARCHAR(20) DEFAULT 'default',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Created users table");
  } else {
    if (!(await columnExists(conn, "users", "tv_factory"))) {
      await conn.query(`ALTER TABLE users ADD COLUMN tv_factory VARCHAR(255) DEFAULT ''`);
      console.log("✅ Added users.tv_factory");
    }
    if (!(await columnExists(conn, "users", "tv_shift"))) {
      await conn.query(`ALTER TABLE users ADD COLUMN tv_shift ENUM('A', 'B') DEFAULT 'A'`);
      console.log("✅ Added users.tv_shift");
    }
    if (!(await columnExists(conn, "users", "tv_theme"))) {
      await conn.query(`ALTER TABLE users ADD COLUMN tv_theme VARCHAR(20) DEFAULT 'default'`);
      console.log("✅ Added users.tv_theme");
    }
  }

  await conn.query(`UPDATE users SET role = 'usertv' WHERE role = 'viewer'`);
  console.log("✅ Migrated role viewer → usertv");

  if (!(await tableExists(conn, "mesin"))) {
    await conn.query(`
      CREATE TABLE mesin (
        id INT AUTO_INCREMENT PRIMARY KEY,
        machine_code VARCHAR(50) NOT NULL UNIQUE,
        machine_name VARCHAR(255) NOT NULL,
        description TEXT,
        factory VARCHAR(255) DEFAULT '',
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Created mesin table");
  } else if (!(await columnExists(conn, "mesin", "factory"))) {
    await conn.query(`ALTER TABLE mesin ADD COLUMN factory VARCHAR(255) DEFAULT ''`);
    console.log("✅ Added mesin.factory");
  }

  if (!(await tableExists(conn, "stock_analytics"))) {
    await conn.query(`
      CREATE TABLE stock_analytics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        machine VARCHAR(100) NOT NULL,
        model VARCHAR(255) DEFAULT '',
        part_number VARCHAR(100) DEFAULT '',
        part_name VARCHAR(255) DEFAULT '',
        qty_per_day DECIMAL(12,2) DEFAULT 0,
        stock_actual DECIMAL(12,2) DEFAULT 0,
        stok_jam DECIMAL(12,2) DEFAULT 0,
        judge VARCHAR(20) DEFAULT '',
        problem VARCHAR(255) DEFAULT '',
        shikake DECIMAL(12,4) DEFAULT 1,
        qty_per_hour DECIMAL(12,4) DEFAULT 0,
        min_val DECIMAL(12,2) DEFAULT 0,
        max_val DECIMAL(12,2) DEFAULT 0,
        jam_update TIMESTAMP NULL,
        pic VARCHAR(100) DEFAULT '',
        keterangan TEXT,
        factory VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_machine (machine),
        INDEX idx_factory (factory)
      )
    `);
    console.log("✅ Created stock_analytics table");
  }

  if (!(await tableExists(conn, "shikake_settings"))) {
    await conn.query(`
      CREATE TABLE shikake_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        master_part_id INT NOT NULL,
        shikake_value DECIMAL(12,4) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_master_part (master_part_id)
      )
    `);
    console.log("✅ Created shikake_settings table");
  }

  console.log("\n🎉 BIG UPDATE migration selesai!");
  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration gagal:", err);
  process.exit(1);
});
