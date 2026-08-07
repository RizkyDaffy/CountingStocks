import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type StockRow = {
  id: number;
  batch_id: string;
  qr_id: string;
  part_name: string;
  factory: string;
  unit_value: number;
  current_stock: number;
  trend: "up" | "down" | "none";
  percentage: number;
  created_at: string;
  updated_at: string;
};

export type StockStats = {
  totalUnits: number;
  skuCount: number;
  emptyStock: number;
};

export function useStock(search = "", factory = "All") {
  return useQuery({
    queryKey: ["stock", search, factory],
    queryFn: () =>
      fetchApi<StockRow[]>(
        `/qr/stock?search=${encodeURIComponent(search)}&factory=${encodeURIComponent(factory)}`,
      ),
    refetchInterval: 8000, // refresh every 8s
  });
}

export function useStockStats() {
  return useQuery({
    queryKey: ["stock-stats"],
    queryFn: () => fetchApi<StockStats>("/qr/stock/stats"),
    refetchInterval: 8000,
  });
}

export function useStockFactories() {
  return useQuery({
    queryKey: ["stock-factories"],
    queryFn: () => fetchApi<string[]>("/qr/stock/factories"),
    // Factory list rarely changes - treat as near-static to avoid
    // re-fetching on every component mount (e.g. factory filter dropdown).
    staleTime: 5 * 60 * 1000,
  });
}
