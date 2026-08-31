import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { SheetsModule } from "./modules/sheets/sheets.module";

@Module({
  imports: [AppConfigModule, HealthModule, SheetsModule],
})
export class AppModule {}
