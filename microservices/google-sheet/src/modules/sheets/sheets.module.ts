import { Module } from "@nestjs/common";
import { GoogleSheetsController } from "./google-sheets.controller";
import { GoogleSheetsService } from "./google-sheets.service";
import { SheetsCacheService } from "./sheets-cache.service";

@Module({
  controllers: [GoogleSheetsController],
  providers: [GoogleSheetsService, SheetsCacheService],
  exports: [GoogleSheetsService, SheetsCacheService],
})
export class SheetsModule {}
