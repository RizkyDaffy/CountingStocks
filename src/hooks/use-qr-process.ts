import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type ProcessQrResult = {
  action: "SCAN_IN" | "SCAN_OUT";
  newStatus: "in" | "out";
  message: string;
  batchId: string;
  partName: string;
  factoryOrigin: string;
  value: number;
};

export type QrInfoResult = {
  batchId: string;
  partName: string;
  factoryOrigin: string;
  value: number;
  currentStatus: "in" | "out";
  nextAction: "SCAN_IN" | "SCAN_OUT";
  message: string;
  token: string;
};

export type ScanHistory = {
  id: number;
  batch_id: string | null;
  qr_id: string;
  label: string;
  factory: string;
  action: "SCAN_IN" | "SCAN_OUT";
  scanned_by: string;
  created_at: string;
};

export function useProcessQr() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ token, forceAction }: { token: string; forceAction?: "SCAN_IN" | "SCAN_OUT" }) =>
      fetchApi<ProcessQrResult>("/qr/process", {
        method: "POST",
        body: JSON.stringify({ token, forceAction }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qr-history"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["qr-codes"] });
      queryClient.invalidateQueries({ queryKey: ["scans", "recent"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-stats"] });
    },
  });
}

export function useQrInfo(token: string | null) {
  return useQuery({
    queryKey: ["qr-info", token],
    queryFn: () => fetchApi<QrInfoResult>(`/qr/info?token=${encodeURIComponent(token!)}`),
    enabled: !!token,
  });
}

export function useQrHistory() {
  return useQuery({
    queryKey: ["qr-history"],
    queryFn: () => fetchApi<ScanHistory[]>("/qr/history"),
    refetchInterval: 5000,
  });
}
