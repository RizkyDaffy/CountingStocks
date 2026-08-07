import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type Mesin = {
  id: number;
  machine_code: string;
  machine_name: string;
  description: string;
  factory?: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

export type CreateMesinPayload = {
  machineCode: string;
  machineName: string;
  description?: string;
  factory?: string;
  status: "active" | "inactive";
};

export function useMesin(search = "") {
  return useQuery({
    queryKey: ["mesin", search],
    queryFn: () =>
      fetchApi<Mesin[]>(`/mesin${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    staleTime: 1000 * 30,
  });
}

export function useCreateMesin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMesinPayload) =>
      fetchApi<Mesin>("/mesin", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mesin"] }),
  });
}

export function useUpdateMesin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: CreateMesinPayload & { id: number }) =>
      fetchApi<Mesin>(`/mesin/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mesin"] }),
  });
}

export function useToggleMesinStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi<Mesin>(`/mesin/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mesin"] }),
  });
}

export function useDeleteMesin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchApi<{ message: string }>(`/mesin/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mesin"] }),
  });
}
