import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

const SECRET_KEY = config.JWT_SECRET;

interface JwtPayload {
  id: number;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const publicPaths = [
    "/api/auth/login",
    "/api/devices/station-login",
    "/api/health",
    "/api/qr/info",
    "/api/iot-monitor",
    "/iot",
  ];

  if (publicPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, error: "Unauthorized: Token missing or invalid format" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);

    if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
      return res.status(403).json({ success: false, error: "Forbidden: Invalid or expired token" });
    }

    req.user = decoded as JwtPayload;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: "Forbidden: Invalid or expired token" });
  }
}
