import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "outindb",
  });

  try {
    await c.query("ALTER TABLE master_parts ADD COLUMN factory_origin VARCHAR(255) DEFAULT ''");
    console.log("Added factory_origin to master_parts");
  } catch (e: any) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log("factory_origin already exists");
    } else {
      console.log(e);
    }
  }

  const createTables = [
    `CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS models (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS customers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS factories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
  ];

  for (let q of createTables) {
    await c.query(q);
    console.log("Executed create table query");
  }

  const seedFactories = [
    "Factory Seizo",
    "Factory Aichi",
    "Factory Karawang",
    "Factory A - Jakarta",
    "Factory B - Bandung",
  ];
  for (let f of seedFactories) {
    try {
      await c.query("INSERT INTO factories (name) VALUES (?)", [f]);
    } catch (e) {}
  }
  console.log("Seeded factories");

  await c.end();
}

run().catch(console.error);
