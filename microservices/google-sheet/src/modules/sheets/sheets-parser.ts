import { Logger } from "@nestjs/common";
import type {
  AnalyzeResponseDto,
  MachineGroupDto,
  SheetAnalysisDto,
  SheetBannerDto,
  SheetStructureDto,
} from "./dto/analyze-response.dto";

const KEY_COLS = [0, 1, 2]; // MACHINE / PART NAME / PART NUMBER

const cellText = (cell: unknown): string =>
  cell === undefined || cell === null ? "" : String(cell).trim();

const isBlankRow = (row: unknown[] | undefined): boolean =>
  !row || row.every((c) => cellText(c) === "");

/**
 * Header row = first row where column A is machine-like (MACHINE / MESIN /
 * Machine / No Mesin) AND the row looks like a header (part-name-like column
 * B/C, or at least two DATE-style headers). Tolerates both the 65-column
 * "DATE '1' [DAY]" layout and the bare Machine/Nama Part/Model Part layout.
 */
export function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const a = cellText(row[0]).toUpperCase();
    const b = cellText(row[1]).toUpperCase();
    const c = cellText(row[2]).toUpperCase();
    const machineHit = /^(MACHINE|MESIN|NO\.?\s*MESIN)/.test(a);
    const partHit = /(PART|NAMA|MODEL)/.test(b) || /(PART|MODEL)/.test(c);
    const dateHits = row.filter((cell) => /DATE\s*'?\d+'?\s*\[/i.test(cellText(cell))).length;
    if (machineHit && (partHit || dateHits >= 2)) return i;
  }
  return -1;
}

/**
 * Banner rows = non-blank rows above the header row that carry no header
 * keywords (the long title string sitting in A1, visually spanning the grid).
 */
function detectBanner(rows: unknown[][], headerIdx: number): SheetBannerDto | undefined {
  if (headerIdx <= 0) return undefined;
  for (let i = 0; i < headerIdx; i++) {
    const row = rows[i] ?? [];
    if (isBlankRow(row)) continue;
    const text = row.map(cellText).find((t) => t !== "") ?? "";
    return { rowIndex: i, text };
  }
  return undefined;
}

/**
 * Map a raw row to a JSON object keyed by the exact header strings.
 * Short rows are padded with null so every object carries every header key.
 */
function mapRow(row: unknown[], headers: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  headers.forEach((header, idx) => {
    const key = header !== "" ? header : `column_${idx}`;
    const value = row[idx];
    obj[key] = value === undefined ? null : value;
  });
  return obj;
}

/**
 * Parse one worksheet's raw values into the structured analysis:
 * banner detection -> dynamic header detection -> blank-row group splitting
 * -> forward-fill of key columns within groups -> padded JSON mapping.
 */
export function parseSheet(
  title: string,
  sheetId: number | undefined,
  rawRows: unknown[][],
): SheetAnalysisDto {
  const totalRows = rawRows.length;
  const totalColumns = rawRows.reduce((max, r) => Math.max(max, r?.length ?? 0), 0);
  const rawValues: string[][] = rawRows.map((r) =>
    (r ?? []).map((c) => (c === undefined || c === null ? "" : String(c))),
  );

  const headerIdx = findHeaderRowIndex(rawRows);

  const base = { sheetTitle: title, sheetId, rawValues };

  if (headerIdx === -1) {
    const status: SheetStructureDto["status"] =
      totalRows === 0 || rawRows.every(isBlankRow) ? "empty" : "no_header_detected";
    const structure: SheetStructureDto = {
      status,
      totalGridRows: totalRows,
      totalGridColumns: totalColumns,
      detectedHeaders: [],
      dataRowCount: 0,
      machineGroupCount: 0,
    };
    return { ...base, structure, machineGroups: [], data: [] };
  }

  const headerRow = rawRows[headerIdx] ?? [];
  const banner = detectBanner(rawRows, headerIdx);

  // Composite two-row header: when the row directly below the header row has
  // empty key columns (A/B) but carries sub-header values (e.g. day numbers
  // under "Tanggal (Siang/Malam)"), merge them as "HEADER SUB" keys.
  const nextRow = rawRows[headerIdx + 1] ?? [];
  const isSubHeaderRow =
    cellText(nextRow[0]) === "" &&
    cellText(nextRow[1]) === "" &&
    nextRow.some((c, idx) => idx >= 2 && cellText(c) !== "");
  const headers = headerRow.map((c, idx) => {
    const main = cellText(c);
    if (!isSubHeaderRow) return main;
    const sub = cellText(nextRow[idx]);
    return sub !== "" ? `${main} ${sub}` : main;
  });
  const dataStart = headerIdx + 1 + (isSubHeaderRow ? 1 : 0);

  // Data region: everything below the header (and sub-header) row,
  // trailing blank rows trimmed.
  const dataRows = rawRows.slice(dataStart);
  while (dataRows.length > 0 && isBlankRow(dataRows[dataRows.length - 1])) dataRows.pop();

  // Split into machine groups on fully-blank separator rows.
  const groups: MachineGroupDto[] = [];
  let current: { rows: unknown[][]; indices: number[] } | null = null;

  dataRows.forEach((row, i) => {
    const absoluteIdx = dataStart + i;
    if (isBlankRow(row)) {
      if (current) {
        groups.push(buildGroup(current, headers));
        current = null;
      }
      return;
    }
    if (!current) current = { rows: [], indices: [] };
    current.rows.push(row);
    current.indices.push(absoluteIdx);
  });
  if (current) groups.push(buildGroup(current, headers));

  const data = groups.flatMap((g) => g.rows);

  const structure: SheetStructureDto = {
    status: "ok",
    banner,
    detectedHeaderRowIndex: headerIdx,
    totalGridRows: totalRows,
    totalGridColumns: totalColumns,
    detectedHeaders: headers,
    dataRowCount: data.length,
    machineGroupCount: groups.length,
  };

  return { ...base, structure, machineGroups: groups, data };
}

/**
 * Build one machine group: forward-fill MACHINE / PART NAME / PART NUMBER
 * from the nearest non-empty row above within the same group only.
 */
function buildGroup(
  group: { rows: unknown[][]; indices: number[] },
  headers: string[],
): MachineGroupDto {
  const filled: unknown[][] = [];
  const last: Record<number, unknown> = {};

  for (const row of group.rows) {
    const copy = [...(row ?? [])];
    for (const col of KEY_COLS) {
      if (cellText(copy[col]) === "") {
        if (last[col] !== undefined) copy[col] = last[col];
      } else {
        last[col] = copy[col];
      }
    }
    filled.push(copy);
  }

  const machine = cellText(filled[0]?.[0]);

  return {
    machine,
    rowIndices: group.indices,
    rows: filled.map((r) => mapRow(r, headers)),
  };
}

export function buildAnalyzeResponse(
  spreadsheetId: string,
  spreadsheetTitle: string | undefined,
  sheetMetas: {
    title: string;
    sheetId?: number;
    gridRows?: number;
    gridColumns?: number;
    values: unknown[][];
  }[],
): AnalyzeResponseDto {
  const logger = new Logger("SheetsParser");
  const sheets = sheetMetas.map((m) => {
    const parsed = parseSheet(m.title, m.sheetId, m.values);
    // Grid metadata reflects the true sheet width even when the API trims
    // trailing empty columns from the values matrix.
    if (m.gridColumns && m.gridColumns > parsed.structure.totalGridColumns!) {
      parsed.structure.totalGridColumns = m.gridColumns;
    }
    if (m.gridRows && m.gridRows > parsed.structure.totalGridRows!) {
      parsed.structure.totalGridRows = m.gridRows;
    }
    if (parsed.structure.status !== "ok") {
      logger.warn(`Sheet "${m.title}": ${parsed.structure.status}`);
    }
    return parsed;
  });

  return {
    spreadsheetId,
    title: spreadsheetTitle,
    sheetCount: sheets.length,
    sheets,
  };
}
