function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val?.trim()) {
    throw new Error(
      `FATAL: env var "${key}" is required but not set. Set it in .env before starting the server.`,
    );
  }
  return val.trim();
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback;
}

export const config = {
  JWT_SECRET: requireEnv("JWT_SECRET"),
  INTERNAL_API_KEY: optionalEnv("INTERNAL_API_KEY"),
  API_PORT: Number(optionalEnv("API_PORT", "4000")),
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  ALLOWED_ORIGINS: optionalEnv("ALLOWED_ORIGINS", ""),
  DB: {
    host: optionalEnv("DB_HOST", "localhost"),
    port: Number(optionalEnv("DB_PORT", "3306")),
    user: optionalEnv("DB_USER", "root"),
    password: optionalEnv("DB_PASSWORD", ""),
    database: optionalEnv("DB_NAME", "outindb"),
  },
} as const;
