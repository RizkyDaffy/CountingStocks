import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

//    Types

export type BcpLink = {
  id: number;
  part_id: number;
  part_name: string;
  sheet_id: number;
  sheet_title: string;
  row_key: string;
  created_at: string;
  updated_at: string;
};

export type BcpPart = {
  id: number;
  part_name: string;
  part_number: string;
  machine: string | null;
  factory_origin: string | null;
};

export type SheetTab = {
  sheetTitle: string;
  sheetId: number;
};

//    Hooks

export function useBcpLinks() {
  return useQuery({
    queryKey: ["bcp-links"],
    queryFn: () => fetchApi<BcpLink[]>("/bcp"),
    staleTime: 10_000,
  });
}

export function useBcpParts(search = "") {
  return useQuery({
    queryKey: ["bcp-parts", search],
    queryFn: () => fetchApi<BcpPart[]>(`/bcp/parts?search=${encodeURIComponent(search)}`),
    staleTime: 30_000,
  });
}

export function useBcpSheets() {
  return useQuery({
    queryKey: ["bcp-sheets"],
    queryFn: () => fetchApi<SheetTab[]>("/bcp/sheets"),
    staleTime: 60_000,
  });
}

export function useBcpSheetRows(sheetKey: string | null | undefined) {
  return useQuery({
    queryKey: ["bcp-sheet-rows", sheetKey],
    queryFn: () => fetchApi<string[][]>(`/bcp/sheets/${encodeURIComponent(sheetKey!)}/rows`),
    enabled: Boolean(sheetKey),
    staleTime: 30_000,
  });
}

//    Mutations

type SaveLinkPayload = {
  partId: number;
  partName: string;
  sheetId: number;
  sheetTitle: string;
  rowKey: string;
};

export function useSaveBcpLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveLinkPayload) =>
      fetchApi<BcpLink>("/bcp", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bcp-links"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-stats"] });
    },
  });
}

export function useDeleteBcpLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi<{ message: string }>(`/bcp/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bcp-links"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-stats"] });
    },
  });
}

export function useTriggerBcpSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchApi<{ message: string }>("/bcp/sync", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bcp-links"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-stats"] });
    },
  });
}
