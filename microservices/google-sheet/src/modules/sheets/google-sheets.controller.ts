import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { GoogleSheetsService } from "./google-sheets.service";
import { SheetsCacheService } from "./sheets-cache.service";
import { AnalyzeResponseDto, SheetAnalysisDto } from "./dto/analyze-response.dto";

export class SheetSnapshotResponseDto {
  spreadsheetId!: string;
  spreadsheetTitle?: string;
  sheet!: SheetAnalysisDto;
  fetchedAt!: string;
  changedAt!: string;
  error?: string;
}

@ApiTags("sheets")
@Controller({ path: "sheets", version: "1" })
export class GoogleSheetsController {
  constructor(
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly cache: SheetsCacheService,
  ) {}

  @Get("analyze")
  @ApiOperation({
    summary: "Analyze spreadsheet (all tabs)",
    description:
      "Full analysis of every worksheet, served from the live cache. Cache refreshes in the background every SHEETS_POLL_INTERVAL_MS (default 10s) so edits appear automatically. A spreadsheetId override bypasses the cache with a direct one-shot fetch.",
  })
  @ApiQuery({
    name: "spreadsheetId",
    required: false,
    description: "Override the configured GOOGLE_SPREADSHEET_ID (direct fetch, not cached)",
  })
  @ApiOkResponse({ type: AnalyzeResponseDto })
  @ApiServiceUnavailableResponse({
    description: "Service account missing/misconfigured or Google API error",
  })
  async analyze(@Query("spreadsheetId") spreadsheetId?: string): Promise<AnalyzeResponseDto> {
    if (spreadsheetId) {
      return this.googleSheetsService.analyzeSpreadsheet(spreadsheetId);
    }
    const snapshot = await this.cache.getSnapshot();
    return snapshot.data;
  }

  @Get(":key")
  @ApiOperation({
    summary: "Get one worksheet by title or sheetId",
    description:
      'Same data as /analyze but scoped to a single tab. Key matches sheet title (exact, then case-insensitive) or numeric sheetId/gid, e.g. /api/v1/sheets/F2 or /api/v1/sheets/101369368. Served from the live cache. Note: a tab literally titled "analyze" is shadowed by the analyze route — reach it by id.',
  })
  @ApiParam({ name: "key", description: "Sheet title or numeric sheetId/gid" })
  @ApiOkResponse({ type: SheetSnapshotResponseDto })
  @ApiNotFoundResponse({ description: "No worksheet matches the given key" })
  @ApiServiceUnavailableResponse({
    description: "Service account missing/misconfigured or Google API error",
  })
  async getSheet(@Param("key") key: string): Promise<SheetSnapshotResponseDto> {
    const snapshot = await this.cache.getSnapshot();
    const sheet = this.cache.findSheet(snapshot, key);
    if (!sheet) {
      throw new NotFoundException({
        success: false,
        error: `Worksheet "${key}" not found. Available: ${snapshot.data.sheets
          .map((s) => `"${s.sheetTitle}" (id: ${s.sheetId})`)
          .join(", ")}`,
      });
    }
    return {
      spreadsheetId: snapshot.data.spreadsheetId,
      spreadsheetTitle: snapshot.data.title,
      sheet,
      fetchedAt: snapshot.fetchedAt,
      changedAt: snapshot.changedAt,
      error: snapshot.error,
    };
  }
}
