import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type TvMachinePartRow = {
  part: string;
  pn: string;
  jam: number;
};

export type TvMachine = {
  id: number;
  machineCode: string;
  machineName: string;
  status: string;
  isActive: boolean;
  stokJam: number;
  stockJam?: number;
  cardStatus: "none" | "critical" | "warning" | "safe";
  partRows: TvMachinePartRow[];
};

export type TvPriority = {
  machine: string;
  partName: string;
  partNumber: string;
  stokJam: number;
  status: string;
};

export type TvDashboardData = {
  factory: string;
  shift: string;
  counts: { critical: number; warning: number; safe: number };
  gaugePercent: number;
  machines: TvMachine[];
  chartLabels: string[];
  chartData: number[];
  chartStokJam: number[];
  chartStatus: ("critical" | "warning" | "safe" | "none")[];
  chartModels?: string[][];
  chartMachines?: string[][];
  priorities: TvPriority[];
};

export function useTvDashboard(factory: string, shift: string, enabled = true) {
  return useQuery({
    queryKey: ["tv-dashboard", factory, shift],
    queryFn: () =>
      fetchApi<TvDashboardData>(
        `/stock-analytics/tv?factory=${encodeURIComponent(factory)}&shift=${encodeURIComponent(shift)}`,
      ),
    refetchInterval: 3000,
    enabled: enabled && !!factory,
  });
}
