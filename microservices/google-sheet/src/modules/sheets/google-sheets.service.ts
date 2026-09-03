import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { google, sheets_v4 } from "googleapis";
import { AppConfigService } from "../../config/config.service";
import { AnalyzeResponseDto } from "./dto/analyze-response.dto";
import { buildAnalyzeResponse } from "./sheets-parser";

const HEALTH_CACHE_TTL_MS = 30_000;
const AUTH_TIMEOUT_MS = 8_000;

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: sheets_v4.Sheets | null = null;
  private authEmail: string | null = null;
  private healthCache: { ok: boolean; message: string; checkedAt: number } | null = null;

  constructor(private readonly config: AppConfigService) {}

  /**
   * Lazily initialize the Google Auth client. Returns null when the service
   * account key file is missing so the rest of the app can degrade gracefully.
   */
  private tryGetClient(): sheets_v4.Sheets | null {
    if (this.sheets) return this.sheets;
    if (!this.config.googleKeyPath) return null;

    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: this.config.googleKeyPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
      this.sheets = google.sheets({ version: "v4", auth });
      return this.sheets;
    } catch (err) {
      this.logger.error(`Google auth init failed: ${String(err)}`);
      return null;
    }
  }

  /**
   * Connectivity probe used by /api/v1/health. Cached briefly so frequent
   * health polls do not hammer the Google API.
   */
  async checkConnection(): Promise<{ ok: boolean; message: string }> {
    const now = Date.now();
    if (this.healthCache && now - this.healthCache.checkedAt < HEALTH_CACHE_TTL_MS) {
      return { ok: this.healthCache.ok, message: this.healthCache.message };
    }

    let result: { ok: boolean; message: string };

    if (!this.config.googleKeyPath) {
      result = {
        ok: false,
        message: "Couldn't connect into mcp accounts, is there been any issues?",
      };
    } else {
      const client = this.tryGetClient();
      if (!client) {
        result = {
          ok: false,
          message: "Couldn't connect into mcp accounts, is there been any issues?",
        };
      } else {
        try {
          const withTimeout = <T>(p: Promise<T>): Promise<T> =>
            Promise.race([
              p,
              new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error("auth timeout")), AUTH_TIMEOUT_MS),
              ),
            ]);

          const clientEmail = await this.resolveServiceAccountEmail();
          const meta = await withTimeout(
            client.spreadsheets.get({ spreadsheetId: this.config.googleSpreadsheetId }),
          );

          if (!meta.data.properties?.title) throw new Error("spreadsheet not readable");

          result = {
            ok: true,
            message: `Connected into ${clientEmail ?? "service account"}`,
          };
        } catch (err) {
          this.logger.warn(`Google Sheets connectivity check failed: ${String(err)}`);
          result = {
            ok: false,
            message: "Couldn't connect into mcp accounts, is there been any issues?",
          };
        }
      }
    }

    this.healthCache = { ...result, checkedAt: now };
    return result;
  }

  private async resolveServiceAccountEmail(): Promise<string | null> {
    if (this.authEmail) return this.authEmail;
    try {
      const fs = await import("node:fs");
      const key = JSON.parse(fs.readFileSync(this.config.googleKeyPath!, "utf-8"));
      this.authEmail = key.client_email ?? null;
    } catch {
      this.authEmail = null;
    }
    return this.authEmail;
  }

  /**
   * Fetch metadata + all values for every worksheet, structured per tab.
   */
  async analyzeSpreadsheet(spreadsheetIdOverride?: string): Promise<AnalyzeResponseDto> {
    const spreadsheetId = spreadsheetIdOverride ?? this.config.googleSpreadsheetId;
    const client = this.tryGetClient();

    if (!client) {
      throw new ServiceUnavailableException({
        success: false,
        error: "Google service account not configured. Place credentials.json and restart.",
      });
    }
    if (!spreadsheetId) {
      throw new InternalServerErrorException({
        success: false,
        error: "No spreadsheet id configured (GOOGLE_SPREADSHEET_ID).",
      });
    }

    try {
      const metaResponse = await client.spreadsheets.get({ spreadsheetId });
      const sheetsMeta = metaResponse.data.sheets ?? [];

      const ranges = sheetsMeta
        .map((s) => s.properties?.title)
        .filter((t): t is string => Boolean(t));

      const valuesResponse = await client.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges,
      });
      const valueRanges = valuesResponse.data.valueRanges ?? [];

      return buildAnalyzeResponse(
        spreadsheetId,
        metaResponse.data.properties?.title ?? undefined,
        sheetsMeta.map((sheet, index) => ({
          title: sheet.properties?.title ?? `Sheet${index + 1}`,
          sheetId: sheet.properties?.sheetId ?? undefined,
          gridRows: sheet.properties?.gridProperties?.rowCount ?? undefined,
          gridColumns: sheet.properties?.gridProperties?.columnCount ?? undefined,
          values: valueRanges[index]?.values ?? [],
        })),
      );
    } catch (err) {
      this.logger.error(`Failed to fetch Google Sheets data: ${String(err)}`);
      throw new ServiceUnavailableException({
        success: false,
        error: `Google Sheets API request failed: ${(err as Error).message}`,
      });
    }
  }
}
