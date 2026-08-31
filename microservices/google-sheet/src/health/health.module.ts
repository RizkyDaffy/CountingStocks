import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { SheetsModule } from "../modules/sheets/sheets.module";

@Module({
  imports: [SheetsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
