import { Injectable } from "@nestjs/common";

export class HealthResponseDto {
  status!: string;
  service!: string;
  version!: string;
  uptime_s!: number;
  timestamp!: string;
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  check(): HealthResponseDto {
    return {
      status: "ok",
      service: "google-sheet",
      version: "0.1.0",
      uptime_s: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
