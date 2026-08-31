import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";

export function requireInternalKey(req: Request, res: Response, next: NextFunction) {
  if (!INTERNAL_KEY) {
    return res.status(503).json({
      success: false,
      error: "Service temporarily unavailable",
    });
  }

  const providedKey = req.headers["x-internal-key"];

  const key = Array.isArray(providedKey) ? providedKey[0] : providedKey;
  const safeMatch =
    key &&
    INTERNAL_KEY &&
    key.length === INTERNAL_KEY.length &&
    timingSafeEqual(Buffer.from(key), Buffer.from(INTERNAL_KEY));
  if (!safeMatch) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  next();
}
