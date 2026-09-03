import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type Mesin = {
  uuid: string;
  machine_code: string;
  machine_name: string;
  machine_desc: string;
  machine_status: "active" | "inactive";
  machine_sc: string;
  machine_factory: string;
  created_at: string;
  updated_at: string;
};

export type CreateMesinPayload = {
  machineCode: string;
  machineName: string;
  machineDesc?: string;
  machineSc?: string;
  machineFactory?: string;
  machineStatus?: "active" | "inactive";
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
    mutationFn: ({ uuid, ...payload }: CreateMesinPayload & { uuid: string }) =>
      fetchApi<Mesin>(`/mesin/${uuid}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mesin"] }),
  });
}

export function useToggleMesinStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => fetchApi<Mesin>(`/mesin/${uuid}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mesin"] }),
  });
}

export function useDeleteMesin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) =>
      fetchApi<{ message: string }>(`/mesin/${uuid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mesin"] }),
  });
}
