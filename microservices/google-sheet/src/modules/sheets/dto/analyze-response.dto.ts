export class MachineGroupDto {
  machine!: string;
  rowIndices!: number[];
  rows!: Record<string, unknown>[];
}

export class SheetBannerDto {
  rowIndex!: number;
  text!: string;
}

export class SheetStructureDto {
  status!: "ok" | "empty" | "no_header_detected";
  banner?: SheetBannerDto;
  detectedHeaderRowIndex?: number;
  totalGridRows?: number;
  totalGridColumns?: number;
  detectedHeaders!: string[];
  dataRowCount!: number;
  machineGroupCount!: number;
}

export class SheetAnalysisDto {
  sheetTitle!: string;
  sheetId?: number;
  structure!: SheetStructureDto;
  machineGroups!: MachineGroupDto[];
  data!: Record<string, unknown>[];
  rawValues!: string[][];
}

export class AnalyzeResponseDto {
  spreadsheetId!: string;
  title?: string;
  sheetCount!: number;
  sheets!: SheetAnalysisDto[];
}
