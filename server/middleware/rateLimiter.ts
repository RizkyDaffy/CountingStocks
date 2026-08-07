import { Request, Response, NextFunction } from "express";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

const ipAttempts = new Map<string, AttemptRecord>();

setInterval(
  () => {
    const now = Date.now();
    for (const [ip, record] of ipAttempts.entries()) {
      if (record.count === 0 && (record.lockedUntil === null || now >= record.lockedUntil)) {
        ipAttempts.delete(ip);
      }
    }
  },
  5 * 60 * 1000,
);

import { getClientIp } from "../lib/request.js";
export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();

  const record = ipAttempts.get(ip) ?? { count: 0, lockedUntil: null };

  if (record.lockedUntil !== null && now >= record.lockedUntil) {
    record.count = 0;
    record.lockedUntil = null;
  }

  if (record.lockedUntil !== null && now < record.lockedUntil) {
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      success: false,
      error: `Terlalu banyak percobaan login. Coba lagi dalam ${retryAfterSec} detik.`,
    });
  }
  ipAttempts.set(ip, record);

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode === 401 && body && typeof body === "object") {
      record.count++;
      const remaining = MAX_ATTEMPTS - record.count;
      if (record.count >= MAX_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOCKOUT_MS;
        console.warn(
          `[RateLimiter] IP ${ip} locked out after ${MAX_ATTEMPTS} failed login attempts`,
        );
        res.status(429);
        res.setHeader("Retry-After", String(Math.ceil(LOCKOUT_MS / 1000)));
        body.error = `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(LOCKOUT_MS / 1000)} detik.`;
      } else if (remaining > 0 && typeof body.error === "string") {
        const cleanError = body.error.replace(/\.+$/, "");
        body.error = `${cleanError}, kamu bisa coba sebanyak ${remaining}x sebelum terkena limit`;
      }
      ipAttempts.set(ip, record);
    } else if (res.statusCode === 200) {
      // Successful login - clear penalty
      record.count = 0;
      record.lockedUntil = null;
      ipAttempts.set(ip, record);
    }
    return originalJson(body);
  };

  next();
}
