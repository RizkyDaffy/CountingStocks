export type StockAnalyticsInput = {
  qtyPerDay: number;
  stockActual: number;
  shikake: number;
  minPlaceholder?: number;
};

export type StockAnalyticsComputed = {
  stockJam: number;
  judge: "O" | "X";
  qtyPerHour: number;
  min: number;
  max: number;
};

export function formatJamUpdateTime(date: Date = new Date()): string {
  return date.toTimeString().slice(0, 8);
}

export function computeStockAnalytics(input: StockAnalyticsInput): StockAnalyticsComputed {
  const qtyPerDay = Math.max(Number(input.qtyPerDay) || 0, 0);
  const stockActual = Math.max(Number(input.stockActual) || 0, 0);
  const shikake = Number(input.shikake) || 0;
  const min = Number(input.minPlaceholder) || 0;

  const qtyPerHour = qtyPerDay > 0 ? qtyPerDay / 8 : 0;

  const stockJam = qtyPerDay > 0 ? (stockActual / qtyPerDay) * 8 : 0;

  const judge: "O" | "X" = stockJam < 4 ? "X" : "O";

  const max = shikake > 0 && qtyPerHour > 0 ? qtyPerDay / shikake / qtyPerHour + min + 2 : 0;

  return { stockJam, judge, qtyPerHour, min, max };
}

export type StockHourStatus = "none" | "critical" | "warning" | "safe";

export function classifyStockJam(stockJam: number, isActive: boolean): StockHourStatus {
  if (!isActive) return "none";
  if (stockJam <= 2) return "critical";
  if (stockJam <= 4) return "warning";
  return "safe";
}
