import pool from "../db.js";
import type { RowDataPacket } from "mysql2";

export async function resolveShortToken(token: string): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM qr_codes WHERE short_token = ? LIMIT 1",
    [token],
  );

  if (rows.length > 0) {
    return token;
  }

  let currentToken = token;
  let depth = 0;
  while (depth < 5) {
    const [aliasRows] = await pool.query<RowDataPacket[]>(
      "SELECT new_short_token FROM qr_aliases WHERE old_short_token = ? LIMIT 1",
      [currentToken],
    );
    if (aliasRows.length === 0) break;
    currentToken = aliasRows[0].new_short_token;
    depth++;
  }

  return currentToken;
}
