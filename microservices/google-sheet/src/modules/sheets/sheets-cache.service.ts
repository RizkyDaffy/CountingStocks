import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppConfigService } from "../../config/config.service";
import { GoogleSheetsService } from "./google-sheets.service";
import { AnalyzeResponseDto, SheetAnalysisDto } from "./dto/analyze-response.dto";
import { createHash } from "node:crypto";

export interface SheetsSnapshot {
  data: AnalyzeResponseDto;
  fetchedAt: string;
  changedAt: string;
  error?: string;
}

const MIN_POLL_MS = 5000;

@Injectable()
export class SheetsCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SheetsCacheService.name);
  private snapshot: SheetsSnapshot | null = null;
  private snapshotHash = "";
  private timer: NodeJS.Timeout | null = null;
  private refreshing = false;
  private firstRefresh: Promise<void> | null = null;

  constructor(
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit() {
    if (!this.config.googleKeyPath) {
      this.logger.warn("No service account key — sheets cache disabled.");
      return;
    }
    const interval = Math.max(MIN_POLL_MS, this.config.sheetsPollIntervalMs);
    this.firstRefresh = this.refresh();
    this.timer = setInterval(() => void this.refresh(), interval);
    this.timer.unref();
    this.logger.log(`Sheets cache polling every ${interval}ms.`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async refresh(): Promise<void> {
    if (this.refreshing || !this.config.googleKeyPath) return;
    this.refreshing = true;
    try {
      const data = await this.googleSheetsService.analyzeSpreadsheet();
      const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
      const now = new Date().toISOString();
      const changed = hash !== this.snapshotHash;
      if (!this.snapshot || changed) {
        this.snapshotHash = hash;
        this.snapshot = { data, fetchedAt: now, changedAt: now };
      } else {
        this.snapshot = { data, fetchedAt: now, changedAt: this.snapshot.changedAt };
      }
      if (changed) this.logger.log(`Sheets snapshot updated at ${now}.`);
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      this.logger.warn(`Sheets refresh failed: ${message}`);
      if (this.snapshot) {
        this.snapshot = { ...this.snapshot, error: message };
      }
    } finally {
      this.refreshing = false;
    }
  }

  /**
   * Latest cached snapshot. Awaits the first refresh on cold start;
   * falls back to a direct fetch when the cache is not running.
   */
  async getSnapshot(): Promise<SheetsSnapshot> {
    if (this.snapshot) return this.snapshot;
    if (this.firstRefresh) {
      await Promise.race([
        this.firstRefresh,
        new Promise((resolve) => setTimeout(resolve, 15_000)),
      ]);
      if (this.snapshot) return this.snapshot;
    }
    await this.refresh();
    if (!this.snapshot) {
      throw new Error("Google Sheets data unavailable.");
    }
    return this.snapshot;
  }

  /**
   * Resolve one worksheet by sheet title (exact, then case-insensitive)
   * or by numeric sheetId/gid passed as string.
   */
  findSheet(snapshot: SheetsSnapshot, key: string): SheetAnalysisDto | undefined {
    const sheets = snapshot.data.sheets;
    return (
      sheets.find((s) => s.sheetTitle === key) ??
      sheets.find((s) => s.sheetTitle.toLowerCase() === key.toLowerCase()) ??
      sheets.find((s) => String(s.sheetId) === key)
    );
  }
}
