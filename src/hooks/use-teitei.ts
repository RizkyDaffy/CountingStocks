import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type TeiteiItem = {
  id: number;
  masterPartId: number;
  teiteiValue: number;
  minVal?: number;
  qtyPerDay?: number;
  partNumber?: string;
  partName?: string;
  model?: string;
  factoryOrigin?: string;
};

export type MasterPartOption = {
  id: number;
  partNumber: string;
  partName: string;
  model: string;
  factoryOrigin: string;
};

export function useTeiteiList() {
  return useQuery({
    queryKey: ["teitei"],
    queryFn: () => fetchApi<TeiteiItem[]>("/teitei"),
  });
}

export function useTeiteiParts() {
  return useQuery({
    queryKey: ["teitei-parts"],
    queryFn: () => fetchApi<MasterPartOption[]>("/teitei/parts"),
  });
}

export function useCreateTeitei() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      masterPartId: number;
      teiteiValue: number;
      minVal?: number;
      qtyPerDay?: number;
    }) =>
      fetchApi("/teitei", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teitei"] });
      qc.invalidateQueries({ queryKey: ["teitei-parts"] });
    },
  });
}

export function useUpdateTeitei() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      teiteiValue,
      minVal,
      qtyPerDay,
    }: {
      id: number;
      teiteiValue: number;
      minVal?: number;
      qtyPerDay?: number;
    }) =>
      fetchApi(`/teitei/${id}`, {
        method: "PUT",
        body: JSON.stringify({ teiteiValue, minVal, qtyPerDay }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teitei"] }),
  });
}

export function useDeleteTeitei() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi(`/teitei/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teitei"] }),
  });
}
