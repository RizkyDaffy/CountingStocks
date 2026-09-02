import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  });

  const dbName = process.env.DB_NAME || "outindb";
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.query(`USE \`${dbName}\``);

  console.log(`✅ Database "${dbName}" Siap`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS qr_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      qr_id VARCHAR(20) NOT NULL UNIQUE,
      part_name VARCHAR(255) NOT NULL,
      factory VARCHAR(255) NOT NULL,
      material VARCHAR(255) NOT NULL,
      qr_value VARCHAR(255) NOT NULL,
      units INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Table qr_codes di buat");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS stock (
      id INT AUTO_INCREMENT PRIMARY KEY,
      part_name VARCHAR(255) NOT NULL,
      factory VARCHAR(255) NOT NULL,
      material VARCHAR(255) NOT NULL,
      units INT NOT NULL DEFAULT 0,
      trend ENUM('up', 'down') DEFAULT 'up',
      delta DECIMAL(5,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Table stock di buat");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id VARCHAR(20) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      type ENUM('Scan In', 'Scan Out', 'QR Created', 'Audit') NOT NULL,
      status ENUM('completed', 'pending', 'failed') DEFAULT 'pending',
      user VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Table tasks di buat");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      model VARCHAR(255) NOT NULL,
      type ENUM('phone', 'tablet') DEFAULT 'phone',
      status ENUM('online', 'offline') DEFAULT 'offline',
      battery INT DEFAULT 0,
      location VARCHAR(255) DEFAULT '',
      last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Table devices di buat");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS scan_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      qr_id VARCHAR(20) NOT NULL,
      label VARCHAR(255) NOT NULL,
      factory VARCHAR(255) NOT NULL,
      scanned_by VARCHAR(100) DEFAULT 'System',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Table scan_records di buat");

  console.log("\n📦 Seeding data...");

  const [existingQr] = (await conn.query("SELECT COUNT(*) AS cnt FROM qr_codes")) as any;
  if (existingQr[0].cnt === 0) {
    await conn.query(`
      INSERT INTO qr_codes (qr_id, part_name, factory, material, qr_value, units, created_at) VALUES
      ('QR-1042', 'Resin Cap', 'Factory Seizo', 'Plastic Resin', '120', 120, '2026-04-17 09:24:00'),
      ('QR-1041', 'Bracket M-22', 'Factory Aichi', 'Aluminum Sheet', '60', 60, '2026-04-16 08:52:00'),
      ('QR-1040', 'Coil Spring', 'Factory Karawang', 'Copper Coil', '200', 200, '2026-04-15 10:00:00'),
      ('QR-1039', 'Hinge B-04', 'Factory Aichi', 'Steel Plate', '40', 40, '2026-04-14 14:30:00'),
      ('QR-1038', 'Gasket R-9', 'Factory Karawang', 'Plastic Resin', '90', 90, '2026-04-13 11:15:00'),
      ('QR-1037', 'Lorem Ipsum A', 'Factory Seizo', 'Steel Plate', '10', 10, '2026-04-12 16:00:00'),
      ('QR-1036', 'Plate X-11', 'Factory Seizo', 'Steel Plate', '320', 320, '2026-04-11 09:00:00'),
      ('QR-1035', 'Clip Z-3', 'Factory Aichi', 'Aluminum Sheet', '150', 150, '2026-04-10 13:45:00')
    `);
    console.log("  ✅ QR codes seeded (8 records)");
  }

  const [existingStock] = (await conn.query("SELECT COUNT(*) AS cnt FROM stock")) as any;
  if (existingStock[0].cnt === 0) {
    await conn.query(`
      INSERT INTO stock (part_name, factory, material, units, trend, delta) VALUES
      ('Lorem Ipsum A', 'Factory Seizo', 'Steel Plate', 1240, 'up', 12),
      ('Bracket M-22', 'Factory Aichi', 'Aluminum Sheet', 860, 'down', 4),
      ('Coil Spring', 'Factory Karawang', 'Copper Coil', 432, 'up', 6),
      ('Resin Cap', 'Factory Seizo', 'Plastic Resin', 2120, 'up', 18),
      ('Hinge B-04', 'Factory Aichi', 'Steel Plate', 78, 'down', 22),
      ('Gasket R-9', 'Factory Karawang', 'Plastic Resin', 540, 'up', 3)
    `);
    console.log("  ✅ Stock seeded (6 records)");
  }

  const [existingTasks] = (await conn.query("SELECT COUNT(*) AS cnt FROM tasks")) as any;
  if (existingTasks[0].cnt === 0) {
    await conn.query(`
      INSERT INTO tasks (task_id, title, type, status, user, created_at) VALUES
      ('T-1042', 'Inbound batch SZ-2026-04-17', 'Scan In', 'completed', 'Hana', '2026-04-17 09:24:00'),
      ('T-1041', 'QR for Resin Cap (×120)', 'QR Created', 'completed', 'Bima', '2026-04-17 08:52:00'),
      ('T-1040', 'Outbound to Aichi line 3', 'Scan Out', 'pending', 'Rama', '2026-04-17 08:10:00'),
      ('T-1039', 'Quarterly audit Karawang', 'Audit', 'completed', 'Sari', '2026-04-16 17:45:00'),
      ('T-1038', 'QR for Bracket M-22 (×60)', 'QR Created', 'failed', 'Bima', '2026-04-16 16:02:00'),
      ('T-1037', 'Inbound batch AC-2026-04-16', 'Scan In', 'completed', 'Hana', '2026-04-16 11:30:00')
    `);
    console.log("  ✅ Tasks seeded (6 records)");
  }

  const [existingDevices] = (await conn.query("SELECT COUNT(*) AS cnt FROM devices")) as any;
  if (existingDevices[0].cnt === 0) {
    await conn.query(`
      INSERT INTO devices (name, model, type, status, battery, location, last_sync) VALUES
      ('Scanner A-01', 'Pixel 8', 'phone', 'online', 86, 'Factory Seizo · Line 1', NOW()),
      ('Scanner A-02', 'Pixel 8', 'phone', 'online', 42, 'Factory Seizo · Line 2', DATE_SUB(NOW(), INTERVAL 2 MINUTE)),
      ('Audit Tab T-01', 'Pixel Tablet', 'tablet', 'online', 67, 'Factory Aichi · QC', DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
      ('Scanner B-04', 'Pixel 7a', 'phone', 'offline', 12, 'Factory Karawang · Dock', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
      ('Audit Tab T-02', 'Pixel Tablet', 'tablet', 'offline', 0, 'Factory Aichi · Storage', DATE_SUB(NOW(), INTERVAL 1 DAY))
    `);
    console.log("  ✅ Devices seeded (5 records)");
  }

  const [existingScans] = (await conn.query("SELECT COUNT(*) AS cnt FROM scan_records")) as any;
  if (existingScans[0].cnt === 0) {
    await conn.query(`
      INSERT INTO scan_records (qr_id, label, factory, scanned_by, created_at) VALUES
      ('QR-1042', 'Resin Cap', 'Factory Seizo', 'Hana', DATE_SUB(NOW(), INTERVAL 2 MINUTE)),
      ('QR-1041', 'Bracket M-22', 'Factory Aichi', 'Bima', DATE_SUB(NOW(), INTERVAL 14 MINUTE)),
      ('QR-1040', 'Coil Spring', 'Factory Karawang', 'Rama', DATE_SUB(NOW(), INTERVAL 1 HOUR))
    `);
    console.log("  ✅ Scan records seeded (3 records)");
  }

  console.log("\n🎉 Migration selesai!");
  await conn.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration gagal:", err);
  process.exit(1);
});
