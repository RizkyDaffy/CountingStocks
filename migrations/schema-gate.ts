import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { APP_VERSION } from "../microservices/server/version.js";

dotenv.config();

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "outindb",
    multipleStatements: false,
  });

  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version VARCHAR(32) NOT NULL PRIMARY KEY,
         applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB`,
    );

    const [rows] = await conn.query<mysql.RowDataPacket[]>("SELECT version FROM schema_migrations");
    const applied = rows.map((r) => String(r.version));

    const dbMax = applied.reduce<string | null>(
      (max, v) => (max === null || compareSemver(v, max) > 0 ? v : max),
      null,
    );

    if (dbMax !== null && compareSemver(dbMax, APP_VERSION) > 0) {
      console.error(
        `[schema-gate] REFUSING: database schema is at v${dbMax}, newer than application v${APP_VERSION}. ` +
          `Rolling back the application past an applied migration is not allowed. ` +
          `Deploy application version >= v${dbMax} instead, or restore the database from backup.`,
      );
      process.exitCode = 1;
      return;
    }

    if (applied.includes(APP_VERSION)) {
      console.log(`[schema-gate] v${APP_VERSION} already applied. Nothing to do.`);
      return;
    }

    await conn.query("INSERT INTO schema_migrations (version) VALUES (?)", [APP_VERSION]);
    if (applied.length === 0) {
      console.log(
        `[schema-gate] Baseline recorded: v${APP_VERSION} (existing schema assumed already migrated).`,
      );
    } else {
      console.log(
        `[schema-gate] Recorded v${APP_VERSION} (previous: v${dbMax}). ` +
          `Run any new migration scripts for this release now, before starting the app.`,
      );
    }
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error("[schema-gate] FAILED:", err);
  process.exitCode = 1;
});
