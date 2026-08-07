import { Request, Response, NextFunction } from "express";
import cors from "cors";

import { config } from "../config.js";

const rawOrigins = config.ALLOWED_ORIGINS;
const allowedOrigins: string[] = rawOrigins
  ? rawOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : [
      "http://localhost:5173",
      "http://localhost:4173",
      "http://localhost:3000",
      "http://localhost:4005",
      "http://localhost:8080",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:8080",
    ];

export const configuredCors = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-internal-key"],
  credentials: true,
  optionsSuccessStatus: 200,
});

export function securityHeaders(req: Request, res: Response, next: NextFunction) {

  res.setHeader("X-Content-Type-Options", "nosniff");

  res.setHeader("X-Frame-Options", "DENY");

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none';");

  res.removeHeader("X-Powered-By");

  next();
}
