import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

export type MasterPart = {
  id: number;
  part_number: string;
  part_name: string;
  category: string;
  model: string;
  customer: string;
  qty_per_pallet: number;
  unit: string;
  status: "active" | "inactive";
  factory_origin: string;
  machine?: string | null;
  image_base64: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatePartPayload = {
  partNumber: string;
  partName: string;
  category?: string;
  model?: string;
  customer?: string;
  qtyPerPallet: number;
  unit?: string;
  status: "active" | "inactive";
  factoryOrigin?: string;
  machine?: string;
  imageBase64?: string | null;
};

export function useMasterParts(search = "") {
  return useQuery({
    queryKey: ["master-parts", search],
    queryFn: () =>
      fetchApi<MasterPart[]>(
        `/master-parts${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      ),
    staleTime: 1000 * 30,
  });
}

export function useCreateMasterPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePartPayload) =>
      fetchApi<MasterPart>("/master-parts", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-parts"] });
    },
  });
}

export function useUpdateMasterPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: CreatePartPayload & { id: number }) =>
      fetchApi<MasterPart>(`/master-parts/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-parts"] });
    },
  });
}

export function useDeleteMasterPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchApi<{ message: string }>(`/master-parts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-parts"] });
    },
  });
}
