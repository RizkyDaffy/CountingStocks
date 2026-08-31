import { Injectable } from "@nestjs/common";

export class HealthResponseDto {
  status!: string;
  service!: string;
  version!: string;
  mcpStatus!: string;
  uptime_s!: number;
  timestamp!: string;
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor() {}

  check(mcpStatus: string): HealthResponseDto {
    return {
      status: "ok",
      service: "google-sheet",
      version: "0.1.0",
      mcpStatus,
      uptime_s: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
