import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined || val === "") {
    throw new Error(`FATAL: env var "${key}" is required but not set.`);
  }
  return val;
}

@Injectable()
export class AppConfigService {
  readonly nodeEnv: string;
  readonly host: string;
  readonly port: number;
  readonly trustProxy: number;
  readonly allowedOrigins: string[];
  readonly bodyLimit: string;
  readonly swaggerEnabled: boolean;
  readonly publicBaseUrl?: string;
  readonly throttlerTtlMs: number;
  readonly throttlerLimit: number;

  constructor(private readonly configService: ConfigService) {
    this.nodeEnv = requireEnv("NODE_ENV", "development");
    this.host = requireEnv("HOST", "0.0.0.0");
    this.port = Number(this.configService.get<number>("PORT") ?? 4002);

    const proxyHops = Number(this.configService.get("TRUST_PROXY") ?? 0);
    if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 10) {
      throw new Error('FATAL: TRUST_PROXY must be an integer between 0 and 10.');
    }
    this.trustProxy = proxyHops;

    const originsRaw = requireEnv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000");
    this.allowedOrigins = originsRaw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (this.allowedOrigins.length === 0) {
      throw new Error("FATAL: ALLOWED_ORIGINS resolved to an empty list.");
    }

    this.bodyLimit = requireEnv("BODY_LIMIT", "128kb");

    const swaggerFlag = this.configService.get("SWAGGER_ENABLED");
    this.swaggerEnabled =
      swaggerFlag === "true" || (swaggerFlag === undefined && this.nodeEnv !== "production");

    this.publicBaseUrl = this.configService.get<string>("PUBLIC_BASE_URL");

    this.throttlerTtlMs = Number(this.configService.get("THROTTLE_TTL_MS") ?? 60000);
    this.throttlerLimit = Number(this.configService.get("THROTTLE_LIMIT") ?? 100);
    if (!Number.isInteger(this.throttlerLimit) || this.throttlerLimit <= 0) {
      throw new Error("FATAL: THROTTLE_LIMIT must be a positive integer.");
    }
  }
}
