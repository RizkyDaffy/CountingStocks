import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthService, HealthResponseDto } from "./health.service";
import { GoogleSheetsService } from "../modules/sheets/google-sheets.service";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Liveness probe",
    description:
      "Reports service status, uptime, version, and Google service account connectivity (MCP status, cached 30s).",
  })
  @ApiOkResponse({ type: HealthResponseDto })
  async check(): Promise<HealthResponseDto> {
    const conn = await this.googleSheetsService.checkConnection();
    return this.healthService.check(conn.message);
  }
}
