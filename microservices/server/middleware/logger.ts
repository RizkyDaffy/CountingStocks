import { Request, Response, NextFunction } from "express";

import { getClientIp } from "../lib/request.js";
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startMs = Date.now();
  const ip = getClientIp(req);

  res.on("finish", () => {
    const durationMs = Date.now() - startMs;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: durationMs,
      ip,
      ua: req.headers["user-agent"]?.slice(0, 100) ?? "",
    };

    if (res.statusCode >= 500) {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}
