import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type ScanRecord = {
  id: number;
  qr_id: string;
  label: string;
  factory: string;
  scanned_by: string;
  created_at: string;
};

export function useRecentScans() {
  return useQuery({
    queryKey: ["scans", "recent"],
    queryFn: () => fetchApi<ScanRecord[]>("/scans/recent"),
  });
}

export function useCreateScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scanData: Partial<ScanRecord>) =>
      fetchApi<void>("/scans", {
        method: "POST",
        body: JSON.stringify(scanData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", "recent"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
