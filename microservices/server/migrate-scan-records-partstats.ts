import pool from "./db.js";

async function run() {
  try {
    console.log("Adding partstats column to scan_records...");
    await pool.query(`
      ALTER TABLE scan_records
      ADD COLUMN partstats VARCHAR(20) DEFAULT 'reguler'
    `);
    console.log("Migration successful!");
    process.exit(0);
  } catch (err: any) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("Column partstats already exists. Skipping.");
      process.exit(0);
    }
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

run();
